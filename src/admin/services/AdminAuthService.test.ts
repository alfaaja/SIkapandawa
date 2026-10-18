import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminAuthService, type AdminAuthResult } from './AdminAuthService';

type SelfPasswordService = AdminAuthService & {
    changeOwnPassword(password: string): Promise<AdminAuthResult>;
};

function selfPasswordService(backend: AdminBackend): SelfPasswordService {
    return new AdminAuthService(backend) as SelfPasswordService;
}

function makeBackend(overrides: Partial<AdminBackend> = {}) {
    return {
        signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-id' } },
            error: null
        }),
        getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'admin-id' } } },
            error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        updateOwnPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getJejakAspects: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ data: { role: 'master', schoolName: null }, error: null }),
        invokeAdminFunction: vi.fn(),
        ...overrides
    } satisfies AdminBackend;
}

describe('AdminAuthService', () => {
    it('takes school scope from the verified RPC and denies teachers or malformed memberships', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: { role: 'school', schoolName: 'SDN SATU' }, error: null });
        const backend = makeBackend({ rpc });
        const service = new AdminAuthService(backend);
        expect((await service.login('admin.satu', crypto.randomUUID())).ok).toBe(true);
        expect(service.getAccess()).toEqual({ role: 'school', schoolName: 'SDN SATU' });
        for (const data of [{ role: 'teacher', schoolName: 'SDN SATU' }, { role: 'master', schoolName: 'SDN SATU' }, { role: 'school', schoolName: null }, {}]) {
            rpc.mockResolvedValue({ data, error: null });
            expect((await service.restoreSession()).ok).toBe(false);
            expect(service.getAccess()).toBeNull();
        }
    });
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('signs in with the normalized legacy internal email then checks authorization', async () => {
        const backend = makeBackend();
        const service = new AdminAuthService(backend);
        const credential = crypto.randomUUID();

        await expect(service.login(' BUDI ', credential)).resolves.toEqual({ ok: true });
        expect(backend.signInWithPassword).toHaveBeenCalledWith({
            email: '24263bfaefb124c488c2f5e63d1d30b418f51d0d6f5b380aa1956ec40ea57278@users.sikapandawa.invalid',
            password: credential
        });
        expect(backend.rpc).toHaveBeenCalledWith('staff_access');
    });

    it.each([
        ['ab', crypto.randomUUID()],
        ['valid-user', '']
    ])('returns the same generic credential error without contacting auth', async (
        username,
        password
    ) => {
        const backend = makeBackend();
        const result = await new AdminAuthService(backend).login(username, password);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_credentials');
        expect(backend.signInWithPassword).not.toHaveBeenCalled();
    });

    it('does not distinguish a bad password from an unknown account', async () => {
        const backend = makeBackend({
            signInWithPassword: vi.fn().mockResolvedValue({
                data: { user: null },
                error: { status: 400, message: 'Invalid login credentials' }
            })
        });

        const result = await new AdminAuthService(backend)
            .login('valid-user', crypto.randomUUID());

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid_credentials');
    });

    it('signs out a valid Supabase user that fails the database admin gate', async () => {
        const backend = makeBackend({
            rpc: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '42501', message: 'internal role detail' }
            })
        });

        const result = await new AdminAuthService(backend)
            .login('valid-user', crypto.randomUUID());

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('access_denied');
            expect(result.error.message).toBe('Akun tidak memiliki akses admin');
        }
        expect(backend.signOut).toHaveBeenCalledOnce();
    });

    it('fails closed and signs out when the admin gate request rejects', async () => {
        const backend = makeBackend({
            rpc: vi.fn().mockRejectedValue(new TypeError('raw network detail'))
        });

        const result = await new AdminAuthService(backend)
            .login('valid-user', crypto.randomUUID());

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('generic');
        expect(backend.signOut).toHaveBeenCalledOnce();
    });

    it('maps an authentication rate limit to a safe error', async () => {
        const backend = makeBackend({
            signInWithPassword: vi.fn().mockResolvedValue({
                data: null,
                error: { status: 429, message: 'raw detail' }
            })
        });

        const result = await new AdminAuthService(backend)
            .login('valid-user', crypto.randomUUID());

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('rate_limited');
    });

    it('restores an existing session only after the admin RPC gate succeeds', async () => {
        const backend = makeBackend();
        const service = new AdminAuthService(backend);

        await expect(service.restoreSession()).resolves.toEqual({ ok: true });
        expect(backend.getSession).toHaveBeenCalledOnce();
        expect(backend.rpc).toHaveBeenCalledWith('staff_access');
        expect(service.getCurrentUserId()).toBe('admin-id');
    });

    it('tracks the signed-in admin user id after login', async () => {
        const backend = makeBackend({
            signInWithPassword: vi.fn().mockResolvedValue({
                data: { user: { id: 'signed-admin-id' } },
                error: null
            })
        });
        const service = new AdminAuthService(backend);

        await expect(service.login('Sikapandawa', crypto.randomUUID()))
            .resolves.toEqual({ ok: true });

        expect(service.getCurrentUserId()).toBe('signed-admin-id');
    });

    it('reports an expired session without calling the admin RPC', async () => {
        const backend = makeBackend({
            getSession: vi.fn().mockResolvedValue({
                data: { session: null },
                error: null
            })
        });

        const result = await new AdminAuthService(backend).restoreSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('session_expired');
        expect(backend.rpc).not.toHaveBeenCalled();
    });

    it('maps a network rejection to offline when the browser is offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const backend = makeBackend({
            signInWithPassword: vi.fn().mockRejectedValue(new TypeError('fetch failed'))
        });

        const result = await new AdminAuthService(backend)
            .login('valid-user', crypto.randomUUID());

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('offline');
    });

    it('delegates logout to the isolated admin backend', async () => {
        const backend = makeBackend();

        await new AdminAuthService(backend).logout();

        expect(backend.signOut).toHaveBeenCalledOnce();
    });

    it.each([11, 129])(
        'rejects an own-password credential with %i characters before contacting auth',
        async (length) => {
            const updateOwnPassword = vi.fn();
            const backend = {
                ...makeBackend(),
                updateOwnPassword
            } as AdminBackend;

            const result = await selfPasswordService(backend)
                .changeOwnPassword('x'.repeat(length));

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('validation');
            expect(updateOwnPassword).not.toHaveBeenCalled();
        }
    );

    it.each([12, 128])(
        'updates the signed-in admin password through own auth at the %i-character boundary',
        async (length) => {
            const credential = 'x'.repeat(length);
            const updateOwnPassword = vi.fn().mockResolvedValue({
                data: { user: { id: 'admin-id' } },
                error: null
            });
            const invokeAdminFunction = vi.fn();
            const backend = {
                ...makeBackend({ invokeAdminFunction }),
                updateOwnPassword
            } as AdminBackend;

            await expect(selfPasswordService(backend).changeOwnPassword(credential))
                .resolves.toEqual({ ok: true });
            expect(updateOwnPassword).toHaveBeenCalledWith(credential);
            expect(invokeAdminFunction).not.toHaveBeenCalled();
        }
    );

    it('returns only a generic error and never logs or echoes a rejected password', async () => {
        const credential = 'credential-never-echoed';
        const updateOwnPassword = vi.fn().mockResolvedValue({
            data: { user: null },
            error: { status: 500, message: `provider rejected ${credential}` }
        });
        const backend = {
            ...makeBackend(),
            updateOwnPassword
        } as AdminBackend;
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await selfPasswordService(backend).changeOwnPassword(credential);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('generic');
            expect(result.error.message).not.toContain(credential);
        }
        expect(log).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });
});
