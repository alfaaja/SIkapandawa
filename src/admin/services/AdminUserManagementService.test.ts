import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminUserManagementService } from './AdminUserManagementService';

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

function makeBackend() {
    return {
        signInWithPassword: vi.fn(),
        getSession: vi.fn(),
        signOut: vi.fn(),
        updateOwnPassword: vi.fn(),
        rpc: vi.fn(),
        invokeAdminFunction: vi.fn().mockResolvedValue({
            data: { userId: USER_ID },
            error: null
        })
    } satisfies AdminBackend;
}

describe('AdminUserManagementService', () => {
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('normalizes and creates a player through the trusted function port', async () => {
        const backend = makeBackend();
        const credential = crypto.randomUUID();
        const service = new AdminUserManagementService(backend);

        await expect(service.createUser({
            displayName: '  Sinta Dewi  ',
            username: '  SINTA.01  ',
            password: credential
        })).resolves.toMatchObject({ userId: USER_ID });
        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('create', {
            displayName: 'Sinta Dewi',
            username: 'sinta.01',
            password: credential
        });
    });

    it.each([
        [{ displayName: 'S', username: 'sinta', password: crypto.randomUUID() }],
        [{ displayName: 'Sinta', username: '<admin>', password: crypto.randomUUID() }],
        [{ displayName: 'Sinta', username: 'sinta', password: 'x'.repeat(5) }]
    ])('rejects invalid create input before the trusted call: %#', async (input) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).createUser(input))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('normalizes and sends an edited username with the display name', async () => {
        const backend = makeBackend();

        await new AdminUserManagementService(backend).updateUser(USER_ID, {
            displayName: '  Sinta Baru ',
            expectedUsername: '  SINTA.LAMA  ',
            username: '  SINTA.BARU  '
        });

        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('update', {
            userId: USER_ID,
            displayName: 'Sinta Baru',
            expectedUsername: 'sinta.lama',
            username: 'sinta.baru'
        });
    });

    it.each([
        ['not-a-uuid', {
            displayName: 'Sinta', expectedUsername: 'sinta', username: 'sinta.baru'
        }],
        [USER_ID, {}],
        [USER_ID, {
            displayName: 'x', expectedUsername: 'sinta', username: 'sinta.baru'
        }],
        [USER_ID, {
            displayName: 'Sinta', expectedUsername: '<admin>', username: 'sinta.baru'
        }],
        [USER_ID, {
            displayName: 'Sinta', expectedUsername: 'sinta', username: '<admin>'
        }]
    ])('rejects an unsafe update before the trusted call', async (userId, changes) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).updateUser(userId, changes))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('deletes by validated user id through the trusted function port', async () => {
        const backend = makeBackend();

        await new AdminUserManagementService(backend).deleteUser(USER_ID, 'budi');

        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('delete', {
            userId: USER_ID,
            expectedUsername: 'budi'
        });
    });

    it('rejects delete unless both user id and expected username are valid', async () => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).deleteUser(USER_ID, '<admin>'))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('resets a credential through the trusted function port without returning it', async () => {
        const backend = makeBackend();
        const credential = crypto.randomUUID();

        const result = await new AdminUserManagementService(backend)
            .resetPassword(USER_ID, credential);

        expect(result).not.toHaveProperty('password');
        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('reset_password', {
            userId: USER_ID,
            password: credential
        });
    });

    it.each([
        ['not-a-uuid', crypto.randomUUID()],
        [USER_ID, 'x'.repeat(5)]
    ])('rejects an invalid reset before the trusted call', async (userId, credential) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend)
            .resetPassword(userId, credential)).rejects.toMatchObject({
            code: 'validation'
        });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('maps trusted-function failures to safe admin errors', async () => {
        const backend = makeBackend();
        backend.invokeAdminFunction.mockResolvedValue({
            data: null,
            error: { status: 403, code: '42501', message: 'internal authorization detail' }
        });

        await expect(new AdminUserManagementService(backend).deleteUser(USER_ID, 'budi'))
            .rejects.toMatchObject({
                code: 'access_denied',
                message: 'Akun tidak memiliki akses admin'
            });
    });
});
