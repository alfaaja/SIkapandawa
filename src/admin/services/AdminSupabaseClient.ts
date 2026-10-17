import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLocalAdminFetch } from './localAdminFetch';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

export const ADMIN_AUTH_STORAGE_KEY = 'sikapandawa.admin.auth';

export interface AdminBackendError {
    code?: string;
    message: string;
    status?: number;
}

export interface AdminBackendResponse {
    data: unknown;
    error: AdminBackendError | null;
}

export interface AdminBackend {
    signInWithPassword(credentials: {
        email: string;
        password: string;
    }): Promise<AdminBackendResponse>;
    getSession(): Promise<AdminBackendResponse>;
    signOut(): Promise<{ error: AdminBackendError | null }>;
    updateOwnPassword(password: string): Promise<AdminBackendResponse>;
    rpc(name: string, args?: Record<string, unknown>): Promise<AdminBackendResponse>;
    getJejakAspects(userId: string): Promise<AdminBackendResponse>;
    invokeAdminFunction(
        action: string,
        body: Record<string, unknown>
    ): Promise<AdminBackendResponse>;
}

function normalizeFunctionError(error: unknown): AdminBackendError | null {
    if (typeof error !== 'object' || error === null) return null;
    const value = error as {
        code?: unknown;
        message?: unknown;
        status?: unknown;
        context?: { status?: unknown };
    };
    return {
        message: typeof value.message === 'string'
            ? value.message
            : 'Admin function request failed',
        ...(typeof value.code === 'string' ? { code: value.code } : {}),
        ...(typeof value.status === 'number'
            ? { status: value.status }
            : typeof value.context?.status === 'number'
                ? { status: value.context.status }
                : {})
    };
}

export class AdminConfigurationError extends Error {
    constructor() {
        super('Konfigurasi panel admin belum tersedia.');
        this.name = 'AdminConfigurationError';
    }
}

export function createAdminSupabaseClient(
    url: string,
    publishableKey: string
): SupabaseClient {
    const normalizedUrl = url.trim();
    const normalizedKey = publishableKey.trim();
    if (!normalizedUrl || !normalizedKey) throw new AdminConfigurationError();

    return createClient(normalizedUrl, normalizedKey, {
        ...(import.meta.env.DEV && typeof window !== 'undefined' && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)
            ? { global: { fetch: createLocalAdminFetch(normalizedUrl, window.location.origin) } } : {}),
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: ADMIN_AUTH_STORAGE_KEY
        }
    });
}

export function createAdminBackend(client: SupabaseClient): AdminBackend {
    return {
        async signInWithPassword(credentials) {
            const response = await client.auth.signInWithPassword(credentials);
            return { data: response.data, error: response.error };
        },
        async getSession() {
            const response = await client.auth.getSession();
            return { data: response.data, error: response.error };
        },
        async signOut() {
            const response = await client.auth.signOut();
            return { error: response.error };
        },
        async updateOwnPassword(password) {
            const response = await client.auth.updateUser({ password });
            return { data: response.data, error: response.error };
        },
        async rpc(name, args) {
            const response = await client.rpc(name, args);
            return { data: response.data, error: response.error };
        },
        async getJejakAspects(userId) {
            // Each maximum covers all runs, independent of the API row limit.
            // Existing table RLS authorizes the signed-in reader.
            const results = await Promise.all(CHARACTER_ASPECTS.map(async aspect => {
                const response = await client.from('jejak_aspect_runs')
                    .select(`score:aspect_scores->${aspect.id}`)
                    .eq('user_id', userId)
                    .eq('curriculum_version', 2)
                    .order(`aspect_scores->${aspect.id}`, { ascending: false })
                    .limit(1)
                    .maybeSingle();
                return { id: aspect.id, score: response.data?.score ?? null, error: response.error };
            }));
            const error = results.find(result => result.error)?.error ?? null;
            return { data: error ? null : Object.fromEntries(results.map(result => [result.id, result.score])), error };
        },
        async invokeAdminFunction(action, body) {
            const response = await client.functions.invoke('admin-users', {
                body: { ...body, action },
                headers: { 'Idempotency-Key': crypto.randomUUID() }
            });
            return { data: response.data, error: normalizeFunctionError(response.error) };
        }
    };
}

let backend: AdminBackend | null = null;

export function getAdminBackend(): AdminBackend {
    if (!backend) {
        const client = createAdminSupabaseClient(
            import.meta.env.VITE_SUPABASE_URL ?? '',
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
        );
        backend = createAdminBackend(client);
    }
    return backend;
}
