import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8';
import {
    buildInternalAuthEmail,
    validateUsername
} from '../../../src/shared/auth/username.ts';
import {
    AdminMutationError,
    createAdminUsersHandler,
    isAdminUuid,
    type AdminMutationPort
} from './handler.ts';
import { resolveAdminAllowedOrigins } from './corsOrigins.ts';
import { executeAdminOperation } from './operation.ts';
import { safeMutationFailure } from './mutationFailure.ts';
import { executeUsernameRename } from './usernameRename.ts';

interface OperationState {
    status?: unknown;
    targetUserId?: unknown;
    replayed?: unknown;
}

function requiredEnvironment(name: string): string {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing required environment: ${name}`);
    return value;
}

function publishableKey(): string {
    return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim()
        || Deno.env.get('SUPABASE_ANON_KEY')?.trim()
        || requiredEnvironment('SUPABASE_PUBLISHABLE_KEY');
}

function serviceClient(): SupabaseClient {
    return createClient(
        requiredEnvironment('SUPABASE_URL'),
        requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
}

function callerClient(accessToken: string): SupabaseClient {
    return createClient(requiredEnvironment('SUPABASE_URL'), publishableKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
}

async function hmacFingerprint(secret: string, payload: unknown): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(JSON.stringify(payload))
    );
    return Array.from(new Uint8Array(signature), (byte) => (
        byte.toString(16).padStart(2, '0')
    )).join('');
}

function createMutationPort(
    client: SupabaseClient,
    actorUserId: () => string,
    operationId: string,
    fingerprintSecret: string
): AdminMutationPort {
    async function targetIsProtected(userId: string): Promise<boolean> {
        const { data, error } = await client.rpc('admin_target_is_protected', {
            target_user_id: userId
        });
        if (error) throw safeMutationFailure(error);
        return data === true;
    }

    async function usernameFor(userId: string): Promise<string | null> {
        const { data, error } = await client
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .maybeSingle();
        if (error) throw safeMutationFailure(error);
        return typeof data?.username === 'string' ? data.username : null;
    }

    async function runOperation(
        action: 'create' | 'update' | 'rename_username' | 'reset_password' | 'delete',
        targetUserId: string | null,
        targetUsername: string,
        sensitiveFingerprintInput: unknown,
        requestDetails: Record<string, unknown>,
        mutate: () => Promise<{ userId: string }>
    ): Promise<{ userId: string }> {
        if (!isAdminUuid(operationId)) {
            throw new AdminMutationError(400, 'Idempotency-Key wajib berupa UUID');
        }
        const fingerprint = await hmacFingerprint(fingerprintSecret, {
            action,
            targetUserId,
            targetUsername,
            payload: sensitiveFingerprintInput
        });
        const { data: beginData, error: beginError } = await client.rpc(
            'admin_begin_account_operation',
            {
                operation_id: operationId,
                actor_user_id: actorUserId(),
                action,
                target_user_id: targetUserId,
                target_username: targetUsername,
                request_fingerprint: fingerprint,
                request_details: requestDetails
            }
        );
        if (beginError) {
            if (/rate limit/i.test(beginError.message)) {
                throw new AdminMutationError(429, 'Terlalu banyak operasi akun');
            }
            if (/idempotency/i.test(beginError.message)) {
                throw new AdminMutationError(409, 'Permintaan operasi sudah digunakan');
            }
            throw safeMutationFailure(beginError);
        }
        const state = (beginData ?? {}) as OperationState;
        if (state.replayed === true) {
            if (state.status === 'succeeded' && typeof state.targetUserId === 'string') {
                return { userId: state.targetUserId };
            }
            throw new AdminMutationError(409, 'Operasi akun sedang atau sudah diproses');
        }

        let resultingTargetUserId = targetUserId;
        try {
            return await executeAdminOperation({
                async mutate() {
                    const result = await mutate();
                    resultingTargetUserId = result.userId;
                    return result;
                },
                async finish(status) {
                    const { error } = await client.rpc('admin_finish_account_operation', {
                        operation_id: operationId,
                        final_status: status,
                        error_code: status === 'failed' ? 'mutation_failed' : null,
                        resulting_target_user_id: resultingTargetUserId
                    });
                    if (error) throw error;
                }
            });
        } catch (error) {
            if (error instanceof AdminMutationError) throw error;
            throw safeMutationFailure(error);
        }
    }

    return {
        async createUser(input) {
            return runOperation(
                'create',
                null,
                input.username,
                input,
                { changedFields: ['displayName', 'username', 'credential'] },
                async () => {
                    const email = await buildInternalAuthEmail(input.username);
                    const { data, error } = await client.auth.admin.createUser({
                        email,
                        password: input.password,
                        email_confirm: true,
                        user_metadata: {
                            display_name: input.displayName,
                            username: input.username,
                            normalized_username: input.username,
                            ...(input.schoolName ? { school_name: input.schoolName } : {})
                        },
                        app_metadata: { admin_operation_id: operationId }
                    });
                    if (error || !data.user) throw error ?? new Error('Missing user');
                    return { userId: data.user.id };
                }
            );
        },

        async updateUser(userId, input) {
            if (userId === actorUserId() || await targetIsProtected(userId)) {
                throw new AdminMutationError(403, 'Akun admin tidak dapat dikelola di sini');
            }
            const storedUsername = await usernameFor(userId);
            const username = typeof storedUsername === 'string'
                ? validateUsername(storedUsername)
                : null;
            if (!username) throw new AdminMutationError(404, 'Akun pemain tidak ditemukan');
            if (username !== input.expectedUsername) {
                throw new AdminMutationError(
                    409,
                    'Username akun telah berubah. Muat ulang dan coba lagi'
                );
            }

            if (input.username === username) {
                return runOperation(
                    'update',
                    userId,
                    username,
                    input,
                    { changedFields: ['displayName'] },
                    async () => {
                        const { data, error } = await client
                            .from('profiles')
                            .update({ display_name: input.displayName })
                            .eq('id', userId)
                            .select('id')
                            .single();
                        if (error || !data) throw error ?? new Error('Missing profile');
                        return { userId };
                    }
                );
            }

            return runOperation(
                'rename_username',
                userId,
                input.username,
                input,
                { changedFields: ['displayName', 'username', 'credentialIdentity'] },
                async () => {
                    const { data: authData, error: authReadError } =
                        await client.auth.admin.getUserById(userId);
                    if (authReadError || !authData.user || authData.user.id !== userId) {
                        throw authReadError ?? new Error('Missing user');
                    }
                    const previousEmail = authData.user.email;
                    if (!previousEmail) throw new Error('Missing user email');
                    const previousMetadata = authData.user.user_metadata ?? {};

                    const email = await buildInternalAuthEmail(input.username);
                    const userMetadata = {
                        ...previousMetadata,
                        display_name: input.displayName,
                        username: input.username,
                        normalized_username: input.username
                    };
                    return executeUsernameRename({
                        userId,
                        currentEmail: previousEmail,
                        currentMetadata: previousMetadata,
                        currentUsername: input.expectedUsername,
                        newEmail: email,
                        newMetadata: userMetadata,
                        newUsername: input.username,
                        newDisplayName: input.displayName
                    }, {
                        async revokeSessions(targetUserId) {
                            const { error } = await client.rpc(
                                'admin_revoke_user_sessions',
                                { target_user_id: targetUserId }
                            );
                            if (error) throw error;
                        },
                        async updateAuthIdentity(targetUserId, identity) {
                            const { data, error } =
                                await client.auth.admin.updateUserById(targetUserId, {
                                    email: identity.email,
                                    email_confirm: identity.emailConfirm,
                                    user_metadata: identity.userMetadata
                                });
                            if (error || !data.user || data.user.id !== targetUserId) {
                                throw error ?? new Error('Missing user');
                            }
                        },
                        async updateProfileIdentity(identity) {
                            const { error } = await client.rpc(
                                'admin_service_update_profile_identity',
                                {
                                    target_user_id: identity.userId,
                                    expected_username: identity.expectedUsername,
                                    new_username: identity.newUsername,
                                    new_display_name: identity.newDisplayName
                                }
                            );
                            if (error) throw error;
                        }
                    });
                }
            );
        },

        getUsername: usernameFor,

        async deleteUser(userId) {
            if (await targetIsProtected(userId)) {
                throw new AdminMutationError(403, 'Akun admin tidak dapat dihapus');
            }
            const username = await usernameFor(userId);
            if (!username) throw new AdminMutationError(404, 'Akun pemain tidak ditemukan');
            return runOperation(
                'delete',
                userId,
                username,
                { confirmedUsername: username },
                { changedFields: ['account', 'progress'] },
                async () => {
                    const { error: sessionError } = await client.rpc(
                        'admin_revoke_user_sessions',
                        { target_user_id: userId }
                    );
                    if (sessionError) throw sessionError;
                    const { error } = await client.auth.admin.deleteUser(userId);
                    if (error) throw error;
                    return { userId };
                }
            );
        },

        async resetPassword(userId, password) {
            if (await targetIsProtected(userId)) {
                throw new AdminMutationError(403, 'Password akun admin tidak dapat direset di sini');
            }
            const username = await usernameFor(userId);
            if (!username) throw new AdminMutationError(404, 'Akun pemain tidak ditemukan');
            return runOperation(
                'reset_password',
                userId,
                username,
                { password },
                { changedFields: ['credential'] },
                async () => {
                    const { error: sessionError } = await client.rpc(
                        'admin_revoke_user_sessions',
                        { target_user_id: userId }
                    );
                    if (sessionError) throw sessionError;
                    const { data, error } = await client.auth.admin.updateUserById(
                        userId,
                        { password }
                    );
                    if (error || !data.user) throw error ?? new Error('Missing user');
                    return { userId };
                }
            );
        }
    };
}

Deno.serve(async (request: Request): Promise<Response> => {
    const operationId = request.headers.get('idempotency-key') ?? '';
    let accessToken = '';
    let verifiedActor = '';
    try {
        let privilegedPort: AdminMutationPort | null = null;
        const requirePrivilegedPort = (): AdminMutationPort => {
            if (!privilegedPort) {
                privilegedPort = createMutationPort(
                    serviceClient(),
                    () => verifiedActor,
                    operationId,
                    Deno.env.get('ADMIN_IDEMPOTENCY_SECRET')?.trim()
                        || requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')
                );
            }
            return privilegedPort;
        };
        const mutationPort: AdminMutationPort = {
            createUser: (input) => requirePrivilegedPort().createUser(input),
            updateUser: (userId, input) => (
                requirePrivilegedPort().updateUser(userId, input)
            ),
            getUsername: (userId) => requirePrivilegedPort().getUsername(userId),
            deleteUser: (userId) => requirePrivilegedPort().deleteUser(userId),
            resetPassword: (userId, password) => (
                requirePrivilegedPort().resetPassword(userId, password)
            )
        };
        const handler = createAdminUsersHandler({
                allowedOrigins: new Set(resolveAdminAllowedOrigins(
                    Deno.env.get('ADMIN_ALLOWED_ORIGINS'),
                )),
            async verifyUser(token) {
                accessToken = token;
                const { data, error } = await callerClient(token).auth.getUser(token);
                if (error || !data.user) return null;
                verifiedActor = data.user.id;
                return { id: data.user.id };
            },
            async isAdmin(userId) {
                if (!accessToken || userId !== verifiedActor) return false;
                const { error } = await callerClient(accessToken)
                    .rpc('admin_dashboard_summary');
                return !error;
            },
            adminUsers: mutationPort
        });
        return await handler(request);
    } catch {
        return new Response(JSON.stringify({ error: 'Konfigurasi backend admin belum lengkap' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
    }
});
