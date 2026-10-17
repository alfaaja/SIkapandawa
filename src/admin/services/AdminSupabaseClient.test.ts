import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
    createClientMock: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: createClientMock
}));

import {
    ADMIN_AUTH_STORAGE_KEY,
    AdminConfigurationError,
    createAdminBackend,
    createAdminSupabaseClient
} from './AdminSupabaseClient';

describe('createAdminSupabaseClient', () => {
    beforeEach(() => {
        createClientMock.mockReset();
        createClientMock.mockReturnValue({ auth: {}, rpc: vi.fn() });
    });

    it('creates an isolated persistent admin session using only public config', () => {
        const client = createAdminSupabaseClient(
            ' https://project.supabase.co ',
            ' publishable-test-key '
        );

        expect(client).toBe(createClientMock.mock.results[0]?.value);
        expect(createClientMock).toHaveBeenCalledWith(
            'https://project.supabase.co',
            'publishable-test-key',
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    storageKey: ADMIN_AUTH_STORAGE_KEY
                }
            }
        );
    });

    it.each([
        ['', 'key'],
        ['https://project.supabase.co', '   ']
    ])('rejects incomplete browser configuration', (url, key) => {
        expect(() => createAdminSupabaseClient(url, key))
            .toThrow(AdminConfigurationError);
        expect(createClientMock).not.toHaveBeenCalled();
    });
});

describe('createAdminBackend', () => {
    it('reads each aspect maximum across all v2 runs for only the selected student', async () => {
        const ids = ['kejujuran', 'keberanian', 'kesopanan', 'kebijaksanaan', 'keadilan'];
        const queries = ids.map((_, index) => {
            const query = {
                select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: { score: [2, 0, 1, 2, 1][index] }, error: null })
            };
            return query;
        });
        const from = vi.fn();
        queries.forEach(query => from.mockReturnValueOnce(query));
        const backend = createAdminBackend({ from } as never);
        await expect(backend.getJejakAspects('student-id')).resolves.toEqual({
            data: { kejujuran: 2, keberanian: 0, kesopanan: 1, kebijaksanaan: 2, keadilan: 1 }, error: null
        });
        queries.forEach((query, index) => {
            expect(from).toHaveBeenCalledWith('jejak_aspect_runs');
            expect(query.select).toHaveBeenCalledWith(`score:aspect_scores->${ids[index]}`);
            expect(query.eq).toHaveBeenCalledWith('user_id', 'student-id');
            expect(query.eq).toHaveBeenCalledWith('curriculum_version', 2);
            expect(query.order).toHaveBeenCalledWith(`aspect_scores->${ids[index]}`, { ascending: false });
            expect(query.limit).toHaveBeenCalledWith(1);
        });
    });

    it('returns missing aspect values without using the legacy total and propagates read failures', async () => {
        const query = {
            select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        };
        const backend = createAdminBackend({ from: vi.fn().mockReturnValue(query) } as never);
        await expect(backend.getJejakAspects('student-id')).resolves.toEqual({
            data: { kejujuran: null, keberanian: null, kesopanan: null, kebijaksanaan: null, keadilan: null }, error: null
        });
        query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'denied', code: '42501' } } as never);
        await expect(backend.getJejakAspects('student-id')).resolves.toMatchObject({ error: { code: '42501' } });
    });
    it('delegates auth and RPC operations without exposing other client methods', async () => {
        const signInWithPassword = vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-id' } },
            error: null
        });
        const getSession = vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'admin-id' } } },
            error: null
        });
        const signOut = vi.fn().mockResolvedValue({ error: null });
        const rpc = vi.fn().mockResolvedValue({ data: { totalUsers: 1 }, error: null });
        const backend = createAdminBackend({
            auth: { signInWithPassword, getSession, signOut },
            rpc
        } as never);

        await expect(backend.signInWithPassword({
            email: 'internal@example.invalid',
            password: crypto.randomUUID()
        })).resolves.toEqual({ data: { user: { id: 'admin-id' } }, error: null });
        await expect(backend.getSession()).resolves.toEqual({
            data: { session: { user: { id: 'admin-id' } } },
            error: null
        });
        await expect(backend.signOut()).resolves.toEqual({ error: null });
        await expect(backend.rpc('admin_dashboard_summary')).resolves.toEqual({
            data: { totalUsers: 1 },
            error: null
        });
        expect(rpc).toHaveBeenCalledWith('admin_dashboard_summary', undefined);
    });

    it('routes privileged user mutations through the trusted admin Edge Function', async () => {
        const invoke = vi.fn().mockResolvedValue({
            data: { userId: '123e4567-e89b-42d3-a456-426614174000' },
            error: null
        });
        const auth = {
            signInWithPassword: vi.fn(),
            getSession: vi.fn(),
            signOut: vi.fn()
        };
        const backend = createAdminBackend({
            auth,
            functions: { invoke },
            rpc: vi.fn()
        } as never);
        const body = { username: 'sinta', displayName: 'Sinta' };

        await expect(backend.invokeAdminFunction('create', body)).resolves.toEqual({
            data: { userId: '123e4567-e89b-42d3-a456-426614174000' },
            error: null
        });
        expect(invoke).toHaveBeenCalledWith('admin-users', {
            body: { action: 'create', ...body },
            headers: { 'Idempotency-Key': expect.any(String) }
        });
        expect(auth).not.toHaveProperty('admin');
    });

    it('changes the signed-in admin password through Auth without invoking admin-users', async () => {
        const updateUser = vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-id' } },
            error: null
        });
        const invoke = vi.fn();
        const backend = createAdminBackend({
            auth: {
                signInWithPassword: vi.fn(),
                getSession: vi.fn(),
                signOut: vi.fn(),
                updateUser
            },
            functions: { invoke },
            rpc: vi.fn()
        } as never) as ReturnType<typeof createAdminBackend> & {
            updateOwnPassword(password: string): Promise<unknown>;
        };
        const credential = crypto.randomUUID();

        await expect(backend.updateOwnPassword(credential)).resolves.toEqual({
            data: { user: { id: 'admin-id' } },
            error: null
        });
        expect(updateUser).toHaveBeenCalledWith({ password: credential });
        expect(invoke).not.toHaveBeenCalled();
    });

    it('does not let caller-controlled body fields override the trusted action', async () => {
        const invoke = vi.fn().mockResolvedValue({
            data: { userId: '123e4567-e89b-42d3-a456-426614174000' },
            error: null
        });
        const backend = createAdminBackend({
            auth: {
                signInWithPassword: vi.fn(),
                getSession: vi.fn(),
                signOut: vi.fn()
            },
            functions: { invoke },
            rpc: vi.fn()
        } as never);

        await backend.invokeAdminFunction('delete', {
            action: 'create',
            userId: '123e4567-e89b-42d3-a456-426614174000'
        });

        expect(invoke).toHaveBeenCalledWith('admin-users', {
            body: {
                userId: '123e4567-e89b-42d3-a456-426614174000',
                action: 'delete'
            },
            headers: { 'Idempotency-Key': expect.any(String) }
        });
    });

    it.each([
        [
            { message: 'denied', context: { status: 401 } },
            { message: 'denied', status: 401 }
        ],
        [
            { message: 'conflict', code: 'already_exists', status: 409 },
            { message: 'conflict', code: 'already_exists', status: 409 }
        ],
        [
            { message: 42, code: 42, status: 400 },
            { message: 'Admin function request failed', status: 400 }
        ]
    ])('normalizes trusted-function error variants %#', async (error, expected) => {
        const backend = createAdminBackend({
            auth: {
                signInWithPassword: vi.fn(),
                getSession: vi.fn(),
                signOut: vi.fn()
            },
            functions: {
                invoke: vi.fn().mockResolvedValue({ data: null, error })
            },
            rpc: vi.fn()
        } as never);

        await expect(backend.invokeAdminFunction('delete', {})).resolves.toEqual({
            data: null,
            error: expected
        });
    });
});
