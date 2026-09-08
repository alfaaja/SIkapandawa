import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TOTAL_LEVELS = 10;
const MIN_COMPLETED_TOTAL = TOTAL_LEVELS;
const MAX_TOTAL = TOTAL_LEVELS * 3;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;
const DEFAULT_ORIGIN = 'https://sikapandawa.com';
const DEFAULT_PROJECT_REF = 'qbjkvbsdimxiglbhorre';

export const STUDENTS = Object.freeze([
    { displayName: 'AYUDIA INARA', username: 'ayudia.inara', targetStars: 11 },
    { displayName: 'FIORELLA PUTRI', username: 'fiorella.putri', targetStars: 15 },
    { displayName: 'ARZIKI RAYA F', username: 'arziki.raya.f', targetStars: 13 },
    { displayName: 'TALITA ZAHRA', username: 'talita.zahra', targetStars: 13 },
    { displayName: 'SYAIRA MEZZAL', username: 'syaira.mezzal', targetStars: 13 },
    { displayName: 'DESTY FEBRYANSAH', username: 'desty.febryansah', targetStars: 14 },
    { displayName: 'NARENDRA PUTRA', username: 'narendra.putra', targetStars: 14 },
    { displayName: 'M. DIKA SAPUTRA', username: 'm.dika.saputra', targetStars: 15 },
    { displayName: 'PUTRI AYU M', username: 'putri.ayu.m', targetStars: 12 },
    { displayName: 'NIZA ADELIA', username: 'niza.adelia', targetStars: 16 },
    { displayName: 'DENISA AYU S', username: 'denisa.ayu.s', targetStars: 19 },
    { displayName: 'BRIAN IRFANUL', username: 'brian.irfanul', targetStars: 15 },
    { displayName: 'NESIA MALINIA', username: 'nesia.malinia', targetStars: 11 },
    { displayName: 'ANANTA VENTIN', username: 'ananta.ventin', targetStars: 16 },
    { displayName: 'CAKAWALA VELA', username: 'cakawala.vela', targetStars: 18 },
    { displayName: 'SEAN ARSENIO', username: 'sean.arsenio', targetStars: 22 }
]);

export function distributeStars(total) {
    if (!Number.isInteger(total)) throw new RangeError('Star total must be an integer');
    if (total < MIN_COMPLETED_TOTAL || total > MAX_TOTAL) {
        throw new RangeError('Completed star total must be between 10 and 30');
    }
    const base = Math.floor(total / TOTAL_LEVELS);
    const remainder = total % TOTAL_LEVELS;
    return Array.from(
        { length: TOTAL_LEVELS },
        (_, index) => base + (index < remainder ? 1 : 0)
    );
}

export function validateStudentRoster(students) {
    const usernames = new Set();
    for (const student of students) {
        if (
            typeof student.displayName !== 'string'
            || student.displayName.trim() !== student.displayName
            || student.displayName.length < 2
            || student.displayName.length > 24
        ) {
            throw new Error(`Invalid display name for ${student.username ?? 'unknown'}`);
        }
        if (typeof student.username !== 'string' || !USERNAME_PATTERN.test(student.username)) {
            throw new Error(`Invalid username: ${String(student.username)}`);
        }
        if (usernames.has(student.username)) {
            throw new Error(`Duplicate username: ${student.username}`);
        }
        distributeStars(student.targetStars);
        usernames.add(student.username);
    }
}

export async function buildInternalAuthEmail(username) {
    if (!USERNAME_PATTERN.test(username)) throw new Error('Invalid username');
    const digest = createHash('sha256').update(username, 'utf8').digest('hex');
    return `${digest}@users.sikapandawa.invalid`;
}

export function escapeCsvCell(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

function makePassword() {
    return `Sika!${randomBytes(18).toString('base64url')}`;
}

function rosterFingerprint(students) {
    const manifest = students.map(({ displayName, username, targetStars }) => ({
        displayName,
        username,
        targetStars
    }));
    return createHash('sha256').update(JSON.stringify(manifest), 'utf8').digest('hex');
}

async function writeAtomic(filePath, content) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, filePath);
}

function stateToCsv(state) {
    const headers = ['display_name', 'username', 'password', 'target_stars', 'status'];
    const rows = state.accounts.map((account) => [
        account.displayName,
        account.username,
        account.password,
        account.targetStars,
        account.status
    ]);
    return `${[headers, ...rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n')}\r\n`;
}

async function loadOrCreateState(statePath, credentialsPath) {
    let state;
    try {
        state = JSON.parse(await readFile(statePath, 'utf8'));
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        state = {
            version: 1,
            projectRef: DEFAULT_PROJECT_REF,
            rosterFingerprint: rosterFingerprint(STUDENTS),
            createdAt: new Date().toISOString(),
            accounts: STUDENTS.map((student) => ({
                ...student,
                password: makePassword(),
                status: 'pending'
            }))
        };
    }
    validateStudentRoster(state.accounts);
    if (state.projectRef !== DEFAULT_PROJECT_REF) {
        throw new Error('State file targets a different Supabase project');
    }
    if (state.rosterFingerprint !== rosterFingerprint(state.accounts)
        || state.rosterFingerprint !== rosterFingerprint(STUDENTS)) {
        throw new Error('State file does not match the current roster');
    }
    await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
    await writeAtomic(credentialsPath, stateToCsv(state));
    return state;
}

async function persistState(state, statePath, credentialsPath) {
    await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
    await writeAtomic(credentialsPath, stateToCsv(state));
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

async function discoverPublicConfiguration(origin) {
    const normalizedOrigin = new URL(origin).origin;
    const adminUrl = new URL('/admin/', normalizedOrigin);
    const htmlResponse = await fetchWithRetry(adminUrl);
    if (!htmlResponse.ok) throw new Error(`Admin page returned HTTP ${htmlResponse.status}`);
    const html = await htmlResponse.text();
    const scriptMatch = html.match(/<script[^>]+src=["']([^"']*admin-[^"']+\.js)["']/i);
    if (!scriptMatch) throw new Error('Admin bundle URL was not found');
    const bundleResponse = await fetchWithRetry(new URL(scriptMatch[1], adminUrl));
    if (!bundleResponse.ok) throw new Error(`Admin bundle returned HTTP ${bundleResponse.status}`);
    const bundle = await bundleResponse.text();
    const supabaseUrl = bundle.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0];
    const publishableKey = bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
    if (!supabaseUrl || !publishableKey) {
        throw new Error('Public Supabase configuration was not found');
    }
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return Object.freeze({ supabaseUrl, publishableKey, projectRef });
}

function publicHeaders(publishableKey, token = publishableKey) {
    return {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

async function signIn(configuration, email, password) {
    const response = await fetchWithRetry(
        `${configuration.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
            method: 'POST',
            headers: publicHeaders(configuration.publishableKey),
            body: JSON.stringify({ email, password })
        }
    );
    const body = await responseJson(response);
    if (!response.ok || typeof body?.access_token !== 'string') return null;
    return { token: body.access_token, userId: body.user?.id, created: false };
}

async function createOrResumeAccount(configuration, account) {
    const email = await buildInternalAuthEmail(account.username);
    if (account.status !== 'pending') {
        const existingSession = await signIn(configuration, email, account.password);
        if (existingSession) return existingSession;
    }
    const signupResponse = await fetchWithRetry(`${configuration.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: publicHeaders(configuration.publishableKey),
        body: JSON.stringify({
            email,
            password: account.password,
            data: {
                display_name: account.displayName,
                username: account.username,
                normalized_username: account.username
            }
        })
    });
    const signupBody = await responseJson(signupResponse);
    if (signupResponse.ok && typeof signupBody?.access_token === 'string') {
        return {
            token: signupBody.access_token,
            userId: signupBody.user?.id,
            created: true
        };
    }
    const resumed = await signIn(configuration, email, account.password);
    if (resumed) return resumed;
    throw new Error(`Unable to create or resume @${account.username}`);
}

async function callAuthenticated(configuration, session, pathname, body) {
    const response = await fetchWithRetry(`${configuration.supabaseUrl}${pathname}`, {
        method: 'POST',
        headers: publicHeaders(configuration.publishableKey, session.token),
        body: JSON.stringify(body)
    });
    const data = await responseJson(response);
    if (!response.ok) {
        throw new Error(`${pathname} returned HTTP ${response.status}`);
    }
    return data;
}

async function verifyProfile(configuration, session, account) {
    if (typeof session.userId !== 'string') throw new Error('Auth response omitted user ID');
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

function normalizeLevelStars(progress) {
    return Array.from(
        { length: TOTAL_LEVELS },
        (_, index) => Number(progress?.levelStars?.[String(index + 1)] ?? 0)
    );
}

async function readProgress(configuration, session) {
    return callAuthenticated(configuration, session, '/rest/v1/rpc/read_complete_progress', {});
}

async function applyProgress(configuration, session, account) {
    const targets = distributeStars(account.targetStars);
    const before = await readProgress(configuration, session);
    const current = normalizeLevelStars(before);
    const completedBefore = new Set(before?.completedLevels ?? []);
    if (current.some((stars, index) => stars > targets[index])) {
        throw new Error(`Existing progress for @${account.username} cannot be lowered safely`);
    }
    for (let index = 0; index < targets.length; index += 1) {
        if (current[index] === targets[index] && completedBefore.has(index + 1)) continue;
        await callAuthenticated(
            configuration,
            session,
            '/rest/v1/rpc/record_level_result',
            { level_id: index + 1, run_stars: targets[index] }
        );
    }
    const verified = await readProgress(configuration, session);
    const finalStars = normalizeLevelStars(verified);
    const total = finalStars.reduce((sum, stars) => sum + stars, 0);
    const completed = new Set(verified?.completedLevels ?? []);
    const allCompleted = Array.from(
        { length: TOTAL_LEVELS },
        (_, index) => completed.has(index + 1)
    ).every(Boolean);
    if (
        total !== account.targetStars
        || !allCompleted
        || Number(verified?.highestUnlockedLevel) !== TOTAL_LEVELS
    ) {
        throw new Error(`Progress verification failed for @${account.username}`);
    }
    return finalStars;
}

export async function executeImport(options) {
    validateStudentRoster(STUDENTS);
    if (!options.execute) {
        console.log('Dry run only. Pass --execute and --confirm-project to mutate production.');
        for (const student of STUDENTS) {
            console.log(`${student.username}: ${distributeStars(student.targetStars).join('+')} = ${student.targetStars}`);
        }
        return;
    }
    if (options.confirmProject !== DEFAULT_PROJECT_REF) {
        throw new Error(`Execution requires --confirm-project=${DEFAULT_PROJECT_REF}`);
    }

    const statePath = path.join(options.outputDir, 'sikapandawa-bulk-import-state.json.local');
    const credentialsPath = path.join(options.outputDir, 'sikapandawa-player-credentials.csv.local');
    const state = await loadOrCreateState(statePath, credentialsPath);
    const configuration = await discoverPublicConfiguration(options.origin);
    if (configuration.projectRef !== options.confirmProject) {
        throw new Error('Discovered Supabase project does not match the confirmed project');
    }

    let verifiedCount = 0;
    for (const account of state.accounts) {
        const session = await createOrResumeAccount(configuration, account);
        await verifyProfile(configuration, session, account);
        account.status = account.status === 'verified'
            ? 'verified'
            : session.created ? 'account_created' : 'account_resumed';
        await persistState(state, statePath, credentialsPath);
        const levelStars = await applyProgress(configuration, session, account);
        account.status = 'verified';
        account.levelStars = levelStars;
        account.verifiedAt = new Date().toISOString();
        await persistState(state, statePath, credentialsPath);
        verifiedCount += 1;
        console.log(`[${verifiedCount}/${state.accounts.length}] @${account.username}: verified ${account.targetStars}/30`);
    }
    console.log(`Verified ${verifiedCount} accounts. Credentials: ${credentialsPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
    executeImport(parseArguments(process.argv.slice(2))).catch((error) => {
        console.error(error instanceof Error ? error.message : 'Bulk import failed');
        process.exitCode = 1;
    });
}
