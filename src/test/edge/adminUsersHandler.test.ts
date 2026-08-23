import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AdminMutationError,
    createAdminUsersHandler,
    isAdminUuid
} from '../../../supabase/functions/admin-users/handler';

const ALLOWED_ORIGIN = 'https://admin.example.test';
const BLOCKED_ORIGIN = 'https://attacker.example.test';
const ADMIN_ID = '123e4567-e89b-42d3-a456-426614174000';
const TARGET_ID = '987e6543-e21b-42d3-a456-426614174000';

function makeDependencies() {
    return {
        allowedOrigins: new Set([ALLOWED_ORIGIN]),
        verifyUser: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
        isAdmin: vi.fn().mockResolvedValue(true),
        adminUsers: {
            createUser: vi.fn().mockResolvedValue({ userId: TARGET_ID }),
            updateUser: vi.fn().mockResolvedValue({ userId: TARGET_ID }),
            getUsername: vi.fn().mockResolvedValue('budi'),
            deleteUser: vi.fn().mockResolvedValue({ userId: TARGET_ID }),
            resetPassword: vi.fn().mockResolvedValue({ userId: TARGET_ID })
        }
    };
}

function request(
    body: unknown,
    options: {
        method?: string;
        origin?: string;
        accessToken?: string | null;
        accessControlRequestHeaders?: string;
        rawBody?: string;
    } = {}
): Request {
    const headers = new Headers({
        Origin: options.origin ?? ALLOWED_ORIGIN,
        'Content-Type': 'application/json'
    });
    const accessToken = options.accessToken === undefined
        ? crypto.randomUUID()
        : options.accessToken;
    if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.accessControlRequestHeaders) {
        headers.set('Access-Control-Request-Headers', options.accessControlRequestHeaders);
    }
    return new Request('https://project.functions.supabase.co/admin-users', {
        method: options.method ?? 'POST',
        headers,
        ...(options.method === 'GET' || options.method === 'OPTIONS'
            ? {}
            : { body: options.rawBody ?? JSON.stringify(body) })
    });
}

async function json(response: Response): Promise<Record<string, unknown>> {
    return await response.json() as Record<string, unknown>;
}

function expectNoPrivilegedCalls(dependencies: ReturnType<typeof makeDependencies>): void {
    expect(dependencies.adminUsers.createUser).not.toHaveBeenCalled();
    expect(dependencies.adminUsers.updateUser).not.toHaveBeenCalled();
    expect(dependencies.adminUsers.getUsername).not.toHaveBeenCalled();
    expect(dependencies.adminUsers.deleteUser).not.toHaveBeenCalled();
    expect(dependencies.adminUsers.resetPassword).not.toHaveBeenCalled();
}

describe('admin-users Edge Function handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses one canonical UUID validator for target and idempotency identifiers', () => {
        expect(isAdminUuid('7b59b704-2d40-4d75-a7f4-c5c6cd6e80f6')).toBe(true);
        expect(isAdminUuid('7b59b704-2d40-4d75-a7f4c5c6cd6e80f6')).toBe(false);
    });

    it('answers an allowed CORS preflight without authenticating', async () => {
        const dependencies = makeDependencies();
        const handler = createAdminUsersHandler(dependencies);

        const response = await handler(request(null, {
            method: 'OPTIONS',
            accessToken: null,
            accessControlRequestHeaders:
                'authorization, apikey, content-type, idempotency-key, x-client-info'
        }));

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
        expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        expect(response.headers.get('access-control-allow-headers'))
            .toMatch(/authorization/i);
        expect(response.headers.get('access-control-allow-headers'))
            .toMatch(/content-type/i);
        expect(response.headers.get('access-control-allow-headers'))
            .toMatch(/x-client-info/i);
        expect(response.headers.get('vary')).toMatch(/origin/i);
        expect(dependencies.verifyUser).not.toHaveBeenCalled();
        expectNoPrivilegedCalls(dependencies);
    });

    it('rejects a disallowed browser origin without reflecting it', async () => {
        const dependencies = makeDependencies();

        const response = await createAdminUsersHandler(dependencies)(request(null, {
            method: 'OPTIONS',
            origin: BLOCKED_ORIGIN,
            accessToken: null
        }));

        expect(response.status).toBe(403);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
        expect(dependencies.verifyUser).not.toHaveBeenCalled();
        expectNoPrivilegedCalls(dependencies);
    });

    it('allows POST only', async () => {
        const dependencies = makeDependencies();

        const response = await createAdminUsersHandler(dependencies)(request(null, {
            method: 'GET'
        }));

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('POST, OPTIONS');
        expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
        expectNoPrivilegedCalls(dependencies);
    });

    it('rejects a missing bearer token before the admin gate', async () => {
        const dependencies = makeDependencies();

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'budi'
        }, { accessToken: null }));

        expect(response.status).toBe(401);
        expect(await json(response)).toEqual({ error: 'Authentication required' });
        expect(dependencies.verifyUser).not.toHaveBeenCalled();
        expect(dependencies.isAdmin).not.toHaveBeenCalled();
        expectNoPrivilegedCalls(dependencies);
    });

    it('rejects an invalid token verified by Supabase Auth', async () => {
        const dependencies = makeDependencies();
        dependencies.verifyUser.mockResolvedValue(null);

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'budi'
        }));

        expect(response.status).toBe(401);
        expect(dependencies.verifyUser).toHaveBeenCalledWith(expect.any(String));
        expect(dependencies.isAdmin).not.toHaveBeenCalled();
        expectNoPrivilegedCalls(dependencies);
    });

    it('denies an authenticated non-admin before any privileged operation', async () => {
        const dependencies = makeDependencies();
        dependencies.isAdmin.mockResolvedValue(false);

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'reset_password',
            userId: TARGET_ID,
            password: crypto.randomUUID()
        }));

        expect(response.status).toBe(403);
        expect(await json(response)).toEqual({ error: 'Admin access required' });
        expect(dependencies.isAdmin).toHaveBeenCalledWith(ADMIN_ID);
        expectNoPrivilegedCalls(dependencies);
    });

    it('returns a generic failure if the admin gate itself errors', async () => {
        const dependencies = makeDependencies();
        dependencies.isAdmin.mockRejectedValue(new Error('private.admin_users leaked detail'));

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'budi'
        }));

        expect(response.status).toBe(500);
        expect(JSON.stringify(await json(response))).not.toContain('private.admin_users');
        expectNoPrivilegedCalls(dependencies);
    });

    it('rejects malformed JSON and unknown actions after authorization', async () => {
        const malformedDependencies = makeDependencies();
        const malformed = await createAdminUsersHandler(malformedDependencies)(request(null, {
            rawBody: '{invalid'
        }));
        expect(malformed.status).toBe(400);
        expectNoPrivilegedCalls(malformedDependencies);

        const unknownDependencies = makeDependencies();
        const unknown = await createAdminUsersHandler(unknownDependencies)(request({
            action: 'promote_admin',
            userId: TARGET_ID
        }));
        expect(unknown.status).toBe(400);
        expectNoPrivilegedCalls(unknownDependencies);
    });

    it('normalizes and creates a user only after auth, admin, and validation gates', async () => {
        const dependencies = makeDependencies();
        const credential = crypto.randomUUID();

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'create',
            displayName: '  Sinta Dewi  ',
            username: '  SINTA.01  ',
            password: credential
        }));

        expect(response.status).toBe(201);
        expect(dependencies.adminUsers.createUser).toHaveBeenCalledWith({
            displayName: 'Sinta Dewi',
            username: 'sinta.01',
            password: credential
        });
        expect(await json(response)).toEqual({ userId: TARGET_ID });
        expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    });

    it.each([
        [{ action: 'create', displayName: 'S', username: 'sinta', password: crypto.randomUUID() }],
        [{ action: 'create', displayName: 'Sinta', username: '<admin>', password: crypto.randomUUID() }],
        [{ action: 'create', displayName: 'Sinta', username: 'sinta', password: 'x'.repeat(5) }],
        [{
            action: 'create',
            displayName: 'Sinta',
            username: 'sinta',
            password: crypto.randomUUID(),
            role: 'admin'
        }]
    ])('rejects invalid or over-posted create payload %#', async (body) => {
        const dependencies = makeDependencies();

        const response = await createAdminUsersHandler(dependencies)(request(body));

        expect(response.status).toBe(400);
        expectNoPrivilegedCalls(dependencies);
    });

    it('strictly validates and normalizes editable identity fields', async () => {
        const dependencies = makeDependencies();

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'update',
            userId: TARGET_ID,
            displayName: '  Budi Baru  ',
            expectedUsername: '  BUDI.LAMA  ',
            username: '  BUDI.BARU  '
        }));

        expect(response.status).toBe(200);
        expect(dependencies.adminUsers.updateUser).toHaveBeenCalledWith(TARGET_ID, {
            displayName: 'Budi Baru',
            expectedUsername: 'budi.lama',
            username: 'budi.baru'
        });

        for (const body of [
            {
                action: 'update', userId: TARGET_ID,
                displayName: 'Budi Baru', expectedUsername: 'budi.lama',
                username: '<admin>'
            },
            {
                action: 'update', userId: TARGET_ID,
                displayName: 'Budi Baru', expectedUsername: '<admin>',
                username: 'budi.baru'
            },
            {
                action: 'update', userId: TARGET_ID,
                displayName: 'Budi Baru', expectedUsername: 'budi.lama',
                username: 'budi.baru', role: 'admin'
            }
        ]) {
            const invalidDependencies = makeDependencies();
            const invalid = await createAdminUsersHandler(invalidDependencies)(request(body));
            expect(invalid.status).toBe(400);
            expectNoPrivilegedCalls(invalidDependencies);
        }
    });

    it('preserves the trusted-port denial for a protected account update', async () => {
        const dependencies = makeDependencies();
        dependencies.adminUsers.updateUser.mockRejectedValue(
            new AdminMutationError(403, 'Akun admin tidak dapat dikelola di sini')
        );

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'update',
            userId: ADMIN_ID,
            displayName: 'Admin Baru',
            expectedUsername: 'admin',
            username: 'admin.baru'
        }));

        expect(response.status).toBe(403);
        expect(await json(response)).toEqual({
            error: 'Akun admin tidak dapat dikelola di sini'
        });
    });

    it('re-checks exact username confirmation before deleting', async () => {
        const dependencies = makeDependencies();

        const mismatch = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'other-user'
        }));
        expect(mismatch.status).toBe(400);
        expect(dependencies.adminUsers.getUsername).toHaveBeenCalledWith(TARGET_ID);
        expect(dependencies.adminUsers.deleteUser).not.toHaveBeenCalled();

        dependencies.adminUsers.getUsername.mockClear();
        const matched = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'budi'
        }));
        expect(matched.status).toBe(200);
        expect(dependencies.adminUsers.deleteUser).toHaveBeenCalledWith(TARGET_ID);
        expect(await json(matched)).toEqual({ userId: TARGET_ID });
    });

    it('deletes a legacy player when stored username casing differs after normalization', async () => {
        const dependencies = makeDependencies();
        dependencies.adminUsers.getUsername.mockResolvedValue('Sugionoo');

        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'delete',
            userId: TARGET_ID,
            expectedUsername: 'Sugionoo'
        }));

        expect(response.status).toBe(200);
        expect(dependencies.adminUsers.getUsername).toHaveBeenCalledWith(TARGET_ID);
        expect(dependencies.adminUsers.deleteUser).toHaveBeenCalledWith(TARGET_ID);
        expect(await json(response)).toEqual({ userId: TARGET_ID });
    });

    it('validates UUID and credential length before resetting a password', async () => {
        const invalidDependencies = makeDependencies();
        const invalid = await createAdminUsersHandler(invalidDependencies)(request({
            action: 'reset_password',
            userId: 'not-a-uuid',
            password: crypto.randomUUID()
        }));
        expect(invalid.status).toBe(400);
        expectNoPrivilegedCalls(invalidDependencies);

        const dependencies = makeDependencies();
        const credential = crypto.randomUUID();
        const response = await createAdminUsersHandler(dependencies)(request({
            action: 'reset_password',
            userId: TARGET_ID,
            password: credential
        }));
        expect(response.status).toBe(200);
        expect(dependencies.adminUsers.resetPassword)
            .toHaveBeenCalledWith(TARGET_ID, credential);
        expect(JSON.stringify(await json(response))).not.toContain(credential);
    });
});
