import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    STUDENTS,
    buildInternalAuthEmail,
    distributeStars,
    escapeCsvCell,
    executeImport,
    validateStudentRoster
} from './bulk-seed-students.mjs';

test('distributeStars spreads totals across exactly ten levels', () => {
    assert.deepEqual(distributeStars(11), [2, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    assert.deepEqual(distributeStars(13), [2, 2, 2, 1, 1, 1, 1, 1, 1, 1]);
    assert.deepEqual(distributeStars(19), [2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
    assert.deepEqual(distributeStars(22), [3, 3, 2, 2, 2, 2, 2, 2, 2, 2]);
});

test('distributeStars rejects totals outside the completed ten-level range', () => {
    assert.throws(() => distributeStars(9), /between 10 and 30/);
    assert.throws(() => distributeStars(31), /between 10 and 30/);
    assert.throws(() => distributeStars(12.5), /integer/);
});

test('student roster contains sixteen unique valid pending accounts', () => {
    assert.equal(STUDENTS.length, 16);
    assert.doesNotThrow(() => validateStudentRoster(STUDENTS));
    assert.equal(new Set(STUDENTS.map(({ username }) => username)).size, 16);
    assert.equal(STUDENTS.find(({ username }) => username === 'denisa.ayu.s')?.targetStars, 19);
    assert.equal(STUDENTS.find(({ username }) => username === 'nesia.malinia')?.targetStars, 11);
});

test('student roster validation rejects unsafe or duplicate entries', () => {
    assert.throws(
        () => validateStudentRoster([
            { displayName: 'Valid Name', username: 'valid.name', targetStars: 12 },
            { displayName: 'Other Name', username: 'valid.name', targetStars: 13 }
        ]),
        /Duplicate username/
    );
    assert.throws(
        () => validateStudentRoster([
            { displayName: 'Valid Name', username: 'UPPERCASE', targetStars: 12 }
        ]),
        /Invalid username/
    );
});

test('internal auth email is deterministic without exposing the username', async () => {
    const email = await buildInternalAuthEmail('ayudia.inara');
    assert.match(email, /^[a-f0-9]{64}@users\.sikapandawa\.invalid$/);
    assert.equal(email.includes('ayudia'), false);
    assert.equal(email, await buildInternalAuthEmail('ayudia.inara'));
});

test('CSV escaping protects commas, quotes, and line breaks', () => {
    assert.equal(escapeCsvCell('plain'), 'plain');
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('a"b'), '"a""b"');
    assert.equal(escapeCsvCell('a\nb'), '"a\nb"');
});

test('dry run makes no network request', async () => {
    const originalFetch = globalThis.fetch;
    const originalLog = console.log;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('network should not be used');
    };
    console.log = () => {};
    try {
        await executeImport({
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

test('execute import creates, records, persists, and verifies all students', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'sikapandawa-import-test-'));
    const originalFetch = globalThis.fetch;
    const originalLog = console.log;
    const accountsByEmail = new Map();
    const accountsByToken = new Map();
    const progressByToken = new Map();
    const calls = [];

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        const method = init.method ?? 'GET';
        calls.push({ url, method });
        if (url === 'https://example.test/admin/') {
            return new Response('<script type="module" src="/assets/admin-test.js"></script>');
        }
        if (url === 'https://example.test/assets/admin-test.js') {
            return new Response(
                'https://qbjkvbsdimxiglbhorre.supabase.co sb_publishable_test_key'
            );
        }
        if (url.endsWith('/auth/v1/signup')) {
            const payload = JSON.parse(init.body);
            const username = payload.data.username;
            const token = `token-${username}`;
            const userId = `id-${username}`;
            accountsByToken.set(token, {
                id: userId,
                display_name: payload.data.display_name,
                username
            });
            accountsByEmail.set(payload.email, {
                password: payload.password,
                token,
                userId
            });
            progressByToken.set(token, {
                highestUnlockedLevel: 1,
                levelStars: Object.fromEntries(
                    Array.from({ length: 10 }, (_, index) => [String(index + 1), 0])
                ),
                completedLevels: []
            });
            return jsonResponse({ access_token: token, user: { id: userId } });
        }
        if (url.includes('/auth/v1/token?grant_type=password')) {
            const payload = JSON.parse(init.body);
            const account = accountsByEmail.get(payload.email);
            if (!account || account.password !== payload.password) {
                return jsonResponse({ error: 'invalid_grant' }, 400);
            }
            return jsonResponse({
                access_token: account.token,
                user: { id: account.userId }
            });
        }
        const token = String(init.headers?.Authorization ?? '').replace('Bearer ', '');
        if (url.includes('/rest/v1/profiles?')) {
            return jsonResponse([accountsByToken.get(token)]);
        }
        if (url.endsWith('/rest/v1/rpc/read_complete_progress')) {
            return jsonResponse(progressByToken.get(token));
        }
        if (url.endsWith('/rest/v1/rpc/record_level_result')) {
            const payload = JSON.parse(init.body);
            const current = progressByToken.get(token);
            const level = payload.level_id;
            const nextStars = {
                ...current.levelStars,
                [String(level)]: Math.max(current.levelStars[String(level)], payload.run_stars)
            };
            const nextCompleted = Array.from(new Set([...current.completedLevels, level]))
                .sort((left, right) => left - right);
            const nextProgress = {
                highestUnlockedLevel: Math.max(
                    current.highestUnlockedLevel,
                    Math.min(10, level + 1)
                ),
                levelStars: nextStars,
                completedLevels: nextCompleted
            };
            progressByToken.set(token, nextProgress);
            return jsonResponse(nextProgress);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
    };
    console.log = () => {};

    try {
        await executeImport({
            execute: true,
            origin: 'https://example.test',
            confirmProject: 'qbjkvbsdimxiglbhorre',
            outputDir
        });
        assert.equal(accountsByToken.size, 16);
        assert.equal(calls.filter(({ url }) => url.endsWith('/auth/v1/signup')).length, 16);
        assert.equal(
            calls.filter(({ url }) => url.endsWith('/rest/v1/rpc/record_level_result')).length,
            160
        );
        for (const student of STUDENTS) {
            const progress = progressByToken.get(`token-${student.username}`);
            assert.equal(
                Object.values(progress.levelStars).reduce((sum, stars) => sum + stars, 0),
                student.targetStars
            );
            assert.equal(progress.completedLevels.length, 10);
        }
        const credentials = await readFile(
            path.join(outputDir, 'sikapandawa-player-credentials.csv.local'),
            'utf8'
        );
        assert.match(credentials, /AYUDIA INARA,ayudia\.inara,Sika!/);
        assert.doesNotMatch(credentials, /access_token|refresh_token|sb_publishable/);

        calls.length = 0;
        await executeImport({
            execute: true,
            origin: 'https://example.test',
            confirmProject: 'qbjkvbsdimxiglbhorre',
            outputDir
        });
        assert.equal(calls.filter(({ url }) => url.endsWith('/auth/v1/signup')).length, 0);
        assert.equal(
            calls.filter(({ url }) => url.includes('/auth/v1/token?grant_type=password')).length,
            16
        );
        assert.equal(
            calls.filter(({ url }) => url.endsWith('/rest/v1/rpc/record_level_result')).length,
            0
        );

        const statePath = path.join(outputDir, 'sikapandawa-bulk-import-state.json.local');
        const staleState = JSON.parse(await readFile(statePath, 'utf8'));
        staleState.accounts[0].targetStars = 30;
        await writeFile(statePath, `${JSON.stringify(staleState)}\n`, 'utf8');
        await assert.rejects(
            executeImport({
                execute: true,
                origin: 'https://example.test',
                confirmProject: 'qbjkvbsdimxiglbhorre',
                outputDir
            }),
            /does not match the current roster/
        );
    } finally {
        globalThis.fetch = originalFetch;
        console.log = originalLog;
        await rm(outputDir, { recursive: true, force: true });
    }
});

test('execute import refuses an unconfirmed production project', async () => {
    await assert.rejects(
        executeImport({
            execute: true,
            origin: 'https://example.test',
            confirmProject: 'wrong-project',
            outputDir: process.cwd()
        }),
        /requires --confirm-project/
    );
});
