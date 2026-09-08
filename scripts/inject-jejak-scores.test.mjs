import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    JEJAK_SCORES,
    executeJejakImport,
    readLocalEnvironmentConfiguration,
    validateJejakManifest
} from './inject-jejak-scores.mjs';

test('Jejak manifest covers the sixteen managed accounts with valid scores', () => {
    assert.equal(JEJAK_SCORES.length, 16);
    assert.doesNotThrow(() => validateJejakManifest(JEJAK_SCORES));
    assert.equal(new Set(JEJAK_SCORES.map(({ username }) => username)).size, 16);
    assert.equal(JEJAK_SCORES.find(({ username }) => username === 'ayudia.inara')?.score, 7);
    assert.equal(JEJAK_SCORES.find(({ username }) => username === 'arziki.raya.f')?.score, 10);
    assert.equal(JEJAK_SCORES.find(({ username }) => username === 'nesia.malinia')?.score, 10);
});

test('Jejak manifest rejects duplicates and scores outside zero through ten', () => {
    assert.throws(() => validateJejakManifest([
        { displayName: 'One', username: 'student.one', score: 7 },
        { displayName: 'Two', username: 'student.one', score: 8 }
    ]), /Duplicate username/);
    assert.throws(() => validateJejakManifest([
        { displayName: 'One', username: 'student.one', score: 11 }
    ]), /between 0 and 10/);
});

test('Jejak dry run performs no file or network mutation', async () => {
    const originalFetch = globalThis.fetch;
    const originalLog = console.log;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('network should not be used');
    };
    console.log = () => {};
    try {
        await executeJejakImport({
            execute: false,
            origin: 'https://example.test',
            confirmProject: '',
            outputDir: process.cwd()
        });
        assert.equal(fetchCalls, 0);
    } finally {
        globalThis.fetch = originalFetch;
        console.log = originalLog;
    }
});

test('reads production public configuration from a gitignored local env file', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'sikapandawa-env-test-'));
    try {
        await writeFile(path.join(outputDir, '.env.local'), [
            'VITE_SUPABASE_URL=https://qbjkvbsdimxiglbhorre.supabase.co',
            'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_key'
        ].join('\n'), 'utf8');

        await assert.doesNotReject(async () => {
            const configuration = await readLocalEnvironmentConfiguration(outputDir);
            assert.equal(configuration.projectRef, 'qbjkvbsdimxiglbhorre');
        });
    } finally {
        await rm(outputDir, { recursive: true, force: true });
    }
});

test('Jejak import unlocks, records, verifies, and resumes all managed accounts', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'sikapandawa-jejak-test-'));
    const originalFetch = globalThis.fetch;
    const originalLog = console.log;
    const progressByToken = new Map();
    const calls = [];
    const accounts = JEJAK_SCORES.map((student, index) => ({
        ...student,
        password: `Sika!safe-key-${index}`,
        targetStars: 10,
        status: 'verified'
    }));
    await writeFile(
        path.join(outputDir, 'sikapandawa-bulk-import-state.json.local'),
        `${JSON.stringify({ projectRef: 'qbjkvbsdimxiglbhorre', accounts })}\n`,
        'utf8'
    );

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        calls.push({ url, body: init.body });
        if (url === 'https://example.test/admin/') {
            return new Response('<script type="module" src="/assets/admin-test.js"></script>');
        }
        if (url === 'https://example.test/assets/admin-test.js') {
            return new Response('https://qbjkvbsdimxiglbhorre.supabase.co sb_publishable_test_key');
        }
        if (url.includes('/auth/v1/token?grant_type=password')) {
            const payload = JSON.parse(init.body);
            const index = accounts.findIndex((account) => account.password === payload.password);
            if (index < 0) return jsonResponse({ error: 'invalid_grant' }, 400);
            const account = accounts[index];
            const token = `token-${account.username}`;
            if (!progressByToken.has(token)) {
                progressByToken.set(token, {
                    jejakPandawaUnlocked: false,
                    jejakPandawaBestScore: 0,
                    completedLevels: Array.from({ length: 10 }, (_, level) => level + 1)
                });
            }
            return jsonResponse({ access_token: token, user: { id: `id-${account.username}` } });
        }
        const token = String(init.headers?.Authorization ?? '').replace('Bearer ', '');
        const username = token.replace('token-', '');
        const account = accounts.find((candidate) => candidate.username === username);
        if (url.includes('/rest/v1/profiles?')) {
            return jsonResponse([{
                id: `id-${username}`,
                display_name: account.displayName,
                username
            }]);
        }
        if (url.endsWith('/rest/v1/rpc/read_complete_progress')) {
            return jsonResponse(progressByToken.get(token));
        }
        if (url.endsWith('/rest/v1/rpc/unlock_jejak_pandawa')) {
            progressByToken.set(token, {
                ...progressByToken.get(token),
                jejakPandawaUnlocked: true
            });
            return jsonResponse(progressByToken.get(token));
        }
        if (url.endsWith('/rest/v1/rpc/record_jejak_result')) {
            const payload = JSON.parse(init.body);
            progressByToken.set(token, {
                ...progressByToken.get(token),
                jejakPandawaBestScore: payload.run_score
            });
            return jsonResponse(progressByToken.get(token));
        }
        throw new Error(`Unexpected request: ${url}`);
    };
    console.log = () => {};

    try {
        const options = {
            execute: true,
            origin: 'https://example.test',
            confirmProject: 'qbjkvbsdimxiglbhorre',
            outputDir
        };
        await executeJejakImport(options);
        assert.equal(calls.filter(({ url }) => url.endsWith('/unlock_jejak_pandawa')).length, 16);
        assert.equal(calls.filter(({ url }) => url.endsWith('/record_jejak_result')).length, 16);
        for (const student of JEJAK_SCORES) {
            const progress = progressByToken.get(`token-${student.username}`);
            assert.equal(progress.jejakPandawaUnlocked, true);
            assert.equal(progress.jejakPandawaBestScore, student.score);
        }
        const checkpoint = await readFile(
            path.join(outputDir, 'sikapandawa-jejak-import-state.json.local'),
            'utf8'
        );
        assert.doesNotMatch(checkpoint, /password|Sika!/);
        assert.equal(JSON.parse(checkpoint).records.length, 16);

        calls.length = 0;
        await executeJejakImport(options);
        assert.equal(calls.filter(({ url }) => url.endsWith('/unlock_jejak_pandawa')).length, 0);
        assert.equal(calls.filter(({ url }) => url.endsWith('/record_jejak_result')).length, 0);

        progressByToken.set('token-ayudia.inara', {
            ...progressByToken.get('token-ayudia.inara'),
            jejakPandawaBestScore: 10
        });
        await assert.rejects(executeJejakImport(options), /cannot be lowered safely/);

        progressByToken.set('token-ayudia.inara', {
            jejakPandawaUnlocked: false,
            jejakPandawaBestScore: 0,
            completedLevels: Array.from({ length: 9 }, (_, level) => level + 1)
        });
        await assert.rejects(executeJejakImport(options), /All ten levels must be complete/);
    } finally {
        globalThis.fetch = originalFetch;
        console.log = originalLog;
        await rm(outputDir, { recursive: true, force: true });
    }
});

test('Jejak import falls back to the local admin bundle when production HTML is protected', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'sikapandawa-jejak-fallback-test-'));
    const originalFetch = globalThis.fetch;
    const originalLog = console.log;
    const originalWarn = console.warn;
    const progressByToken = new Map();
    const accounts = JEJAK_SCORES.map((student, index) => ({
        ...student,
        password: `Sika!safe-key-${index}`
    }));
    await writeFile(
        path.join(outputDir, 'sikapandawa-bulk-import-state.json.local'),
        `${JSON.stringify({ projectRef: 'qbjkvbsdimxiglbhorre', accounts })}\n`,
        'utf8'
    );
    await mkdir(path.join(outputDir, 'dist', 'admin'), { recursive: true });
    await mkdir(path.join(outputDir, 'dist', 'assets'), { recursive: true });
    await writeFile(
        path.join(outputDir, 'dist', 'admin', 'index.html'),
        '<script type="module" src="../assets/admin-local.js"></script>',
        'utf8'
    );
    await writeFile(
        path.join(outputDir, 'dist', 'assets', 'admin-local.js'),
        'import "./index-local.js";',
        'utf8'
    );
    await writeFile(
        path.join(outputDir, 'dist', 'assets', 'index-local.js'),
        'https://qbjkvbsdimxiglbhorre.supabase.co sb_publishable_test_key',
        'utf8'
    );

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url === 'https://example.test/admin/') {
            return new Response('<title>One moment, please...</title>');
        }
        if (url.includes('/auth/v1/token?grant_type=password')) {
            const payload = JSON.parse(init.body);
            const account = accounts.find((candidate) => candidate.password === payload.password);
            if (!account) return jsonResponse({ error: 'invalid_grant' }, 400);
            const token = `token-${account.username}`;
            progressByToken.set(token, {
                jejakPandawaUnlocked: true,
                jejakPandawaBestScore: account.score,
                completedLevels: Array.from({ length: 10 }, (_, level) => level + 1)
            });
            return jsonResponse({ access_token: token, user: { id: `id-${account.username}` } });
        }
        const token = String(init.headers?.Authorization ?? '').replace('Bearer ', '');
        const username = token.replace('token-', '');
        const account = accounts.find((candidate) => candidate.username === username);
        if (url.includes('/rest/v1/profiles?')) {
            return jsonResponse([{
                id: `id-${username}`,
                display_name: account.displayName,
                username
            }]);
        }
        if (url.endsWith('/rest/v1/rpc/read_complete_progress')) {
            return jsonResponse(progressByToken.get(token));
        }
        throw new Error(`Unexpected request: ${url}`);
    };
    console.log = () => {};
    console.warn = () => {};

    try {
        await executeJejakImport({
            execute: true,
            origin: 'https://example.test',
            confirmProject: 'qbjkvbsdimxiglbhorre',
            outputDir
        });
        const checkpoint = JSON.parse(await readFile(
            path.join(outputDir, 'sikapandawa-jejak-import-state.json.local'),
            'utf8'
        ));
        assert.equal(checkpoint.records.length, 16);
    } finally {
        globalThis.fetch = originalFetch;
        console.log = originalLog;
        console.warn = originalWarn;
        await rm(outputDir, { recursive: true, force: true });
    }
});
