// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminMockBackend } from './AdminMockBackend';

const FIRST_USER_ID = '00000000-0000-4000-8000-000000000001';

describe('development admin mock backend', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/admin/?mockRole=admin');
    });

    it('models isolated login, restore, and logout lifecycle', async () => {
        const backend = createAdminMockBackend();

        await expect(backend.getSession()).resolves.toMatchObject({
            data: { session: null },
            error: null
        });
        await expect(backend.signInWithPassword({
            email: 'hash@users.sikapandawa.invalid',
            password: crypto.randomUUID()
        })).resolves.toMatchObject({ error: null });
        await expect(backend.getSession()).resolves.toMatchObject({
            data: { session: { user: expect.any(Object) } }
        });
        await expect(backend.signOut()).resolves.toEqual({ error: null });
        await expect(backend.getSession()).resolves.toMatchObject({
            data: { session: null }
        });
    });

    it('models invalid credentials without exposing a session', async () => {
        window.history.replaceState({}, '', '/admin/?mockRole=invalid');
        const backend = createAdminMockBackend();

        await expect(backend.signInWithPassword({
            email: 'hash@users.sikapandawa.invalid',
            password: crypto.randomUUID()
        })).resolves.toMatchObject({
            data: { user: null },
            error: { status: 400 }
        });
    });

    it('models database-enforced denial for a regular player', async () => {
        window.history.replaceState({}, '', '/admin/?mockRole=user');
        const backend = createAdminMockBackend();

        await expect(backend.rpc('admin_dashboard_summary')).resolves.toMatchObject({
            data: null,
            error: { code: '42501', status: 403 }
        });
    });

    it('returns summary and server-filtered, paginated users', async () => {
        const backend = createAdminMockBackend();

        await expect(backend.rpc('admin_dashboard_summary')).resolves.toMatchObject({
            data: {
                totalUsers: 56,
                notStartedUsers: expect.any(Number),
                inProgressUsers: expect.any(Number),
                completedUsers: expect.any(Number),
                totalStarsEarned: expect.any(Number),
                generatedAt: expect.any(String)
            },
            error: null
        });
        const response = await backend.rpc('admin_list_users', {
            search_text: 'arjuna.pratama.09',
            progress_status: 'all',
            page_size: 25,
            page_offset: 0
        });
        expect(response).toMatchObject({
            data: { total: 1, pageSize: 25, pageOffset: 0 },
            error: null
        });
        expect((response.data as { items: Array<{ displayName: string; username: string }> })
            .items[0]).toMatchObject({
            displayName: 'Arjuna Pratama',
            username: 'arjuna.pratama.09'
        });
    });

    it('uses unique, human-friendly demo identities without HTML-like fixture data', async () => {
        const response = await createAdminMockBackend().rpc('admin_list_users', {
            progress_status: 'all',
            page_size: 100,
            page_offset: 0
        });
        const items = (response.data as {
            items: Array<{ displayName: string; username: string }>;
        }).items;
        const unsafeFixture = /<[^>]+>|onerror|script/i;

        expect(items).toHaveLength(56);
        expect(items[0]).toMatchObject({
            displayName: 'Arjuna Pratama',
            username: 'arjuna.pratama'
        });
        expect(new Set(items.map(({ username }) => username)).size).toBe(56);
        expect(items.every(({ displayName, username }) => (
            !unsafeFixture.test(displayName)
            && !unsafeFixture.test(username)
            && !/^pemain\.\d+$/i.test(username)
        ))).toBe(true);
    });

    it('filters by progress status and honors page bounds', async () => {
        const response = await createAdminMockBackend().rpc('admin_list_users', {
            progress_status: 'completed',
            page_size: 2,
            page_offset: 2
        });

        expect(response).toMatchObject({
            data: { total: 5, pageSize: 2, pageOffset: 2 },
            error: null
        });
        expect((response.data as { items: unknown[] }).items).toHaveLength(2);
    });

    it('returns ten detail levels or a stable not-found error', async () => {
        const backend = createAdminMockBackend();
        const detail = await backend.rpc('admin_get_user_progress', {
            target_user_id: FIRST_USER_ID
        });

        expect((detail.data as { levels: unknown[] }).levels).toHaveLength(10);
        expect(detail.data).toMatchObject({
            summary: {
                completedLevelCount: expect.any(Number),
                totalStars: expect.any(Number),
                averageStars: expect.any(Number),
                grade: expect.any(String),
                jejakPandawaUnlocked: expect.any(Boolean),
                jejakPandawaBestScore: expect.any(Number)
            }
        });
        await expect(backend.rpc('admin_get_user_progress', {
            target_user_id: '00000000-0000-4000-8000-999999999999'
        })).resolves.toMatchObject({
            data: null,
            error: { code: 'P0002', status: 404 }
        });
    });

    it('fails closed for unknown RPC names', async () => {
        await expect(createAdminMockBackend().rpc('delete_everything'))
            .resolves.toMatchObject({
                data: null,
                error: { status: 500 }
            });
    });

    it('models create, update, reset, and delete with refreshed list state', async () => {
        const backend = createAdminMockBackend();
        const credential = crypto.randomUUID();
        const created = await backend.invokeAdminFunction('create', {
            displayName: 'Sinta Dewi',
            username: 'sinta.test',
            password: credential
        });
        const createdUserId = (created.data as { userId: string }).userId;
        let list = await backend.rpc('admin_list_users', {
            search_text: 'sinta.test',
            progress_status: 'all',
            page_size: 25,
            page_offset: 0
        });
        expect(list).toMatchObject({ data: { total: 1 } });

        await backend.invokeAdminFunction('update', {
            userId: createdUserId,
            displayName: 'Sinta Baru',
            expectedUsername: 'sinta.test',
            username: 'sinta.baru'
        });
        list = await backend.rpc('admin_list_users', {
            search_text: 'sinta.baru',
            progress_status: 'all',
            page_size: 25,
            page_offset: 0
        });
        expect(list).toMatchObject({
            data: {
                total: 1,
                items: [expect.objectContaining({
                    displayName: 'Sinta Baru',
                    username: 'sinta.baru'
                })]
            }
        });

        await expect(backend.invokeAdminFunction('reset_password', {
            userId: createdUserId,
            password: crypto.randomUUID()
        })).resolves.toMatchObject({ data: { userId: createdUserId }, error: null });
        await backend.invokeAdminFunction('delete', {
            userId: createdUserId,
            expectedUsername: 'sinta.baru'
        });
        list = await backend.rpc('admin_list_users', {
            search_text: 'sinta.baru',
            progress_status: 'all',
            page_size: 25,
            page_offset: 0
        });
        expect(list).toMatchObject({ data: { total: 0 } });
    });

    it('validates mock mutations and never echoes credentials', async () => {
        const backend = createAdminMockBackend();
        const credential = crypto.randomUUID();

        const invalid = await backend.invokeAdminFunction('create', {
            displayName: 'X',
            username: 'x',
            password: credential
        });

        expect(invalid).toMatchObject({ data: null, error: { status: 400 } });
        expect(JSON.stringify(invalid)).not.toContain(credential);
    });
});
