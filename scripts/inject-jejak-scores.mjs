import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildInternalAuthEmail } from './bulk-seed-students.mjs';

const DEFAULT_ORIGIN = 'https://sikapandawa.com';
const DEFAULT_PROJECT_REF = 'qbjkvbsdimxiglbhorre';
const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export const JEJAK_SCORES = Object.freeze([
    { displayName: 'AYUDIA INARA', username: 'ayudia.inara', score: 7 },
    { displayName: 'FIORELLA PUTRI', username: 'fiorella.putri', score: 8 },
    { displayName: 'ARZIKI RAYA F', username: 'arziki.raya.f', score: 10 },
    { displayName: 'TALITA ZAHRA', username: 'talita.zahra', score: 9 },
    { displayName: 'SYAIRA MEZZAL', username: 'syaira.mezzal', score: 8 },
    { displayName: 'DESTY FEBRYANSAH', username: 'desty.febryansah', score: 10 },
    { displayName: 'NARENDRA PUTRA', username: 'narendra.putra', score: 9 },
    { displayName: 'M. DIKA SAPUTRA', username: 'm.dika.saputra', score: 10 },
    { displayName: 'PUTRI AYU M', username: 'putri.ayu.m', score: 9 },
    { displayName: 'NIZA ADELIA', username: 'niza.adelia', score: 10 },
    { displayName: 'DENISA AYU S', username: 'denisa.ayu.s', score: 10 },
    { displayName: 'BRIAN IRFANUL', username: 'brian.irfanul', score: 10 },
    { displayName: 'NESIA MALINIA', username: 'nesia.malinia', score: 10 },
    { displayName: 'ANANTA VENTIN', username: 'ananta.ventin', score: 10 },
    { displayName: 'CAKAWALA VELA', username: 'cakawala.vela', score: 10 },
    { displayName: 'SEAN ARSENIO', username: 'sean.arsenio', score: 10 }
]);

export function validateJejakManifest(entries) {
    const usernames = new Set();
    for (const entry of entries) {
        if (!USERNAME_PATTERN.test(entry.username ?? '')) {
            throw new Error(`Invalid username: ${String(entry.username)}`);
        }
        if (usernames.has(entry.username)) {
            throw new Error(`Duplicate username: ${entry.username}`);
        }
        if (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > 10) {
            throw new Error(`Jejak score for @${entry.username} must be between 0 and 10`);
        }
        if (typeof entry.displayName !== 'string' || entry.displayName.length < 2) {
            throw new Error(`Invalid display name for @${entry.username}`);
        }
        usernames.add(entry.username);
    }
}

function parseArguments(argv) {
    const options = {
        execute: false,
        origin: DEFAULT_ORIGIN,
        confirmProject: '',
        outputDir: process.cwd()
    };
    for (const argument of argv) {
        if (argument === '--execute') options.execute = true;
        else if (argument.startsWith('--origin=')) options.origin = argument.slice(9);
        else if (argument.startsWith('--confirm-project=')) {
            options.confirmProject = argument.slice(18);
        } else if (argument.startsWith('--output-dir=')) {
            options.outputDir = path.resolve(argument.slice(13));
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return Object.freeze(options);
}

async function writeAtomic(filePath, content) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, filePath);
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(20_000)
            });
            if (response.status !== 429 && response.status < 500) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
    }
    throw new Error(`Network request failed after ${attempts} attempts`, { cause: lastError });
}

async function responseJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function parsePublicConfiguration(bundle) {
    const supabaseUrl = bundle.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0];
    const publishableKey = bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
    if (!supabaseUrl || !publishableKey) return null;
    return Object.freeze({
        supabaseUrl,
        publishableKey,
        projectRef: new URL(supabaseUrl).hostname.split('.')[0]
    });
}

export async function readLocalEnvironmentConfiguration(outputDir) {
    const content = await readFile(path.join(outputDir, '.env.local'), 'utf8');
    const values = Object.fromEntries(content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
            const separator = line.indexOf('=');
            const key = line.slice(0, separator).trim();
            const rawValue = line.slice(separator + 1).trim();
            const value = /^(["']).*\1$/.test(rawValue) ? rawValue.slice(1, -1) : rawValue;
            return [key, value];
        }));
    const supabaseUrl = values.VITE_SUPABASE_URL;
    const publishableKey = values.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (
        typeof supabaseUrl !== 'string'
        || typeof publishableKey !== 'string'
        || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)
    ) {
        throw new Error('Local Supabase public configuration is incomplete');
    }
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
        throw new Error('Local Supabase URL is invalid');
    }
    return Object.freeze({
        supabaseUrl: url.origin,
        publishableKey,
        projectRef: url.hostname.split('.')[0]
    });
}

async function discoverPublicConfiguration(origin) {
    const adminUrl = new URL('/admin/', new URL(origin).origin);
    const htmlResponse = await fetchWithRetry(adminUrl);
    if (!htmlResponse.ok) throw new Error(`Admin page returned HTTP ${htmlResponse.status}`);
    const html = await htmlResponse.text();
    const scriptMatch = html.match(/<script[^>]+src=["']([^"']*admin-[^"']+\.js)["']/i);
    if (!scriptMatch) throw new Error('Admin bundle URL was not found');
    const bundleResponse = await fetchWithRetry(new URL(scriptMatch[1], adminUrl));
    if (!bundleResponse.ok) throw new Error(`Admin bundle returned HTTP ${bundleResponse.status}`);
    const bundle = await bundleResponse.text();
    const configuration = parsePublicConfiguration(bundle);
    if (!configuration) throw new Error('Public Supabase configuration was not found');
    return configuration;
}

async function discoverLocalPublicConfiguration(outputDir) {
    const adminIndexPath = path.join(outputDir, 'dist', 'admin', 'index.html');
    await readFile(adminIndexPath, 'utf8');
    const assetsDirectory = path.join(outputDir, 'dist', 'assets');
    const assetNames = (await readdir(assetsDirectory))
        .filter((name) => name.endsWith('.js'))
        .sort();
    for (const assetName of assetNames) {
        const configuration = parsePublicConfiguration(
            await readFile(path.join(assetsDirectory, assetName), 'utf8')
        );
        if (configuration?.projectRef === DEFAULT_PROJECT_REF) return configuration;
    }
    throw new Error('Local public Supabase configuration was not found');
}

async function loadPublicConfiguration(options) {
    try {
        return await readLocalEnvironmentConfiguration(options.outputDir);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
    try {
        return await discoverPublicConfiguration(options.origin);
    } catch (error) {
        const configuration = await discoverLocalPublicConfiguration(options.outputDir);
        console.warn('Using local admin bundle for public Supabase configuration discovery.');
        return configuration;
    }
}

function publicHeaders(publishableKey, token = publishableKey) {
    return {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

async function signIn(configuration, account) {
    const email = await buildInternalAuthEmail(account.username);
    const response = await fetchWithRetry(
        `${configuration.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
            method: 'POST',
            headers: publicHeaders(configuration.publishableKey),
            body: JSON.stringify({ email, password: account.password })
        }
    );
    const body = await responseJson(response);
    if (!response.ok || typeof body?.access_token !== 'string' || typeof body?.user?.id !== 'string') {
        throw new Error(`Unable to authenticate @${account.username}`);
    }
    return { token: body.access_token, userId: body.user.id };
}

async function callAuthenticated(configuration, session, pathname, body) {
    const response = await fetchWithRetry(`${configuration.supabaseUrl}${pathname}`, {
        method: 'POST',
        headers: publicHeaders(configuration.publishableKey, session.token),
        body: JSON.stringify(body)
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`);
    return data;
}

async function verifyProfile(configuration, session, account) {
    const query = new URLSearchParams({
        select: 'id,display_name,username',
        id: `eq.${session.userId}`
    });
    const response = await fetchWithRetry(
        `${configuration.supabaseUrl}/rest/v1/profiles?${query}`,
        { headers: publicHeaders(configuration.publishableKey, session.token) }
    );
    const body = await responseJson(response);
    const profile = Array.isArray(body) ? body[0] : null;
    if (
        !response.ok
        || profile?.id !== session.userId
        || profile?.username !== account.username
        || profile?.display_name !== account.displayName
    ) {
        throw new Error(`Profile verification failed for @${account.username}`);
    }
}

async function readProgress(configuration, session) {
    return callAuthenticated(configuration, session, '/rest/v1/rpc/read_complete_progress', {});
}

async function applyJejakScore(configuration, session, account) {
    const before = await readProgress(configuration, session);
    const currentScore = Number(before?.jejakPandawaBestScore ?? 0);
    if (currentScore > account.score) {
        throw new Error(`Existing Jejak score for @${account.username} cannot be lowered safely`);
    }
    if (before?.jejakPandawaUnlocked !== true) {
        const completed = new Set(before?.completedLevels ?? []);
        if (completed.size !== 10) {
            throw new Error(`All ten levels must be complete before unlocking @${account.username}`);
        }
        await callAuthenticated(
            configuration,
            session,
            '/rest/v1/rpc/unlock_jejak_pandawa',
            {}
        );
    }
    if (currentScore < account.score) {
        await callAuthenticated(
            configuration,
            session,
            '/rest/v1/rpc/record_jejak_result',
            { run_score: account.score }
        );
    }
    const verified = await readProgress(configuration, session);
    if (
        verified?.jejakPandawaUnlocked !== true
        || Number(verified?.jejakPandawaBestScore) !== account.score
    ) {
        throw new Error(`Jejak verification failed for @${account.username}`);
    }
}

async function loadManagedAccounts(outputDir) {
    const statePath = path.join(outputDir, 'sikapandawa-bulk-import-state.json.local');
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    if (state.projectRef !== DEFAULT_PROJECT_REF || !Array.isArray(state.accounts)) {
        throw new Error('Managed-account state targets an unexpected project');
    }
    const byUsername = new Map(state.accounts.map((account) => [account.username, account]));
    return JEJAK_SCORES.map((target) => {
        const account = byUsername.get(target.username);
        if (
            account?.displayName !== target.displayName
            || typeof account?.password !== 'string'
            || account.password.length < 12
        ) {
            throw new Error(`Missing verified local credentials for @${target.username}`);
        }
        return Object.freeze({ ...target, password: account.password });
    });
}

async function persistCheckpoint(checkpointPath, records) {
    await writeAtomic(checkpointPath, `${JSON.stringify({
        version: 1,
        projectRef: DEFAULT_PROJECT_REF,
        updatedAt: new Date().toISOString(),
        records: records.map((record) => ({ ...record }))
    }, null, 2)}\n`);
}

export async function executeJejakImport(options) {
    validateJejakManifest(JEJAK_SCORES);
    if (!options.execute) {
        console.log('Dry run only. Pass --execute and --confirm-project to mutate production.');
        for (const student of JEJAK_SCORES) console.log(`${student.username}: ${student.score}/10`);
        return;
    }
    if (options.confirmProject !== DEFAULT_PROJECT_REF) {
        throw new Error(`Execution requires --confirm-project=${DEFAULT_PROJECT_REF}`);
    }
    const accounts = await loadManagedAccounts(options.outputDir);
    const configuration = await loadPublicConfiguration(options);
    if (configuration.projectRef !== options.confirmProject) {
        throw new Error('Discovered Supabase project does not match the confirmed project');
    }
    const checkpointPath = path.join(
        options.outputDir,
        'sikapandawa-jejak-import-state.json.local'
    );
    let records = [];
    for (const [index, account] of accounts.entries()) {
        const session = await signIn(configuration, account);
        await verifyProfile(configuration, session, account);
        await applyJejakScore(configuration, session, account);
        records = [...records, {
            username: account.username,
            score: account.score,
            verifiedAt: new Date().toISOString()
        }];
        await persistCheckpoint(checkpointPath, records);
        console.log(`[${index + 1}/${accounts.length}] @${account.username}: verified ${account.score}/10`);
    }
    console.log(`Verified ${accounts.length} Jejak scores.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
    executeJejakImport(parseArguments(process.argv.slice(2))).catch((error) => {
        console.error(error instanceof Error ? error.message : 'Jejak import failed');
        process.exitCode = 1;
    });
}
