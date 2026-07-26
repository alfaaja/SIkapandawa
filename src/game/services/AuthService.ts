import { AuthStorageService } from './AuthStorageService';
import { LegacyMigrationService } from './LegacyMigrationService';
import { ProgressStorageService } from './ProgressStorageService';
import {
    getSupabaseClient,
    getSupabaseConfigurationError,
    isLocalFallbackAllowed,
    isSupabaseConfigured
} from './SupabaseClient';

export interface AccountProfile {
    id: string;
    displayName: string;
    username: string;
    createdAt: string;
}

export type AuthResult =
    | { ok: true; account: AccountProfile }
    | { ok: false; error: string };

const REMOTE_PROFILE_KEY = 'sikapandawa.remoteProfile';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isAccountProfile(value: unknown): value is AccountProfile {
    if (!isRecord(value)) return false;
    return typeof value.id === 'string'
        && typeof value.displayName === 'string'
        && typeof value.username === 'string'
        && typeof value.createdAt === 'string';
}

function safeReadProfile(): AccountProfile | null {
    try {
        const raw = window.localStorage.getItem(REMOTE_PROFILE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isAccountProfile(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function safeWriteProfile(profile: AccountProfile): boolean {
    try {
        window.localStorage.setItem(REMOTE_PROFILE_KEY, JSON.stringify(profile));
        return true;
    } catch {
        return false;
    }
}

function clearRemoteProfile(): void {
    try {
        window.localStorage.removeItem(REMOTE_PROFILE_KEY);
    } catch {
        // Session Supabase tetap menjadi sumber kebenaran.
    }
}

function validateDisplayName(value: string): string | null {
    const normalized = value.trim();
    return normalized.length >= 2 && normalized.length <= 24 ? normalized : null;
}

export function normalizeUsername(value: string): string {
    return value.trim().normalize('NFKC').toLowerCase();
}

function validateUsername(value: string): string | null {
    const normalized = normalizeUsername(value);
    if (normalized.length < 3 || normalized.length > 20) return null;
    return /^[a-z0-9._-]+$/.test(normalized) ? normalized : null;
}

async function sha256Hex(value: string): Promise<string> {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(
        new Uint8Array(digest),
        (byte) => byte.toString(16).padStart(2, '0')
    ).join('');
}

export async function buildInternalAuthEmail(username: string): Promise<string> {
    const normalized = validateUsername(username);
    if (!normalized) throw new Error('Invalid username');
    return `${await sha256Hex(normalized)}@users.sikapandawa.invalid`;
}

async function fetchRemoteProfile(userId: string): Promise<AccountProfile | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
        .from('profiles')
        .select('id, display_name, username, created_at')
        .eq('id', userId)
        .single();
    if (error || !isRecord(data)) return null;
    const profile: AccountProfile = {
        id: String(data.id ?? ''),
        displayName: String(data.display_name ?? ''),
        username: String(data.username ?? ''),
        createdAt: String(data.created_at ?? '')
    };
    return isAccountProfile(profile) ? profile : null;
}

async function finishRemoteLogin(userId: string): Promise<AuthResult> {
    const profile = await fetchRemoteProfile(userId);
    if (!profile || !safeWriteProfile(profile)) {
        return {
            ok: false,
            error: 'Profil pemain tidak dapat dimuat. Silakan coba masuk kembali.'
        };
    }
    return { ok: true, account: profile };
}

async function registerRemote(
    displayName: string,
    username: string,
    normalizedUsername: string,
    password: string
): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: getSupabaseConfigurationError() };
    const email = await buildInternalAuthEmail(normalizedUsername);
    const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: displayName,
                username,
                normalized_username: normalizedUsername
            }
        }
    });
    if (error || !data.user) {
        return {
            ok: false,
            error: 'Nama panggilan sudah dipakai atau pendaftaran gagal.'
        };
    }
    if (!data.session) {
        return {
            ok: false,
            error: 'Akun dibuat tetapi belum aktif. Pastikan Confirm Email dinonaktifkan.'
        };
    }
    return finishRemoteLogin(data.user.id);
}

export const AuthService = {
    isRemoteMode(): boolean {
        return isSupabaseConfigured();
    },

    getActiveAccount(): AccountProfile | null {
        if (isSupabaseConfigured()) return safeReadProfile();
        const local = AuthStorageService.getActiveAccount();
        if (!local) return null;
        return {
            id: local.id,
            displayName: local.displayName,
            username: local.username,
            createdAt: local.createdAt
        };
    },

    async restoreSession(): Promise<AccountProfile | null> {
        const client = getSupabaseClient();
        if (!client) return this.getActiveAccount();
        const { data, error } = await client.auth.getSession();
        if (error || !data.session) {
            clearRemoteProfile();
            return null;
        }
        const profile = await fetchRemoteProfile(data.session.user.id);
        if (!profile) {
            clearRemoteProfile();
            return null;
        }
        safeWriteProfile(profile);
        return profile;
    },

    async register(
        displayName: string,
        username: string,
        password: string
    ): Promise<AuthResult> {
        const validDisplayName = validateDisplayName(displayName);
        const normalizedUsername = validateUsername(username);
        if (!validDisplayName) {
            return { ok: false, error: 'Nama lengkap harus 2 sampai 24 karakter.' };
        }
        if (!normalizedUsername) {
            return {
                ok: false,
                error: 'Nama panggilan 3–20 karakter: huruf, angka, titik, garis bawah, atau minus.'
            };
        }
        if (password.length < 6) {
            return { ok: false, error: 'Password minimal 6 karakter.' };
        }

        if (isSupabaseConfigured()) {
            return registerRemote(
                validDisplayName,
                username.trim().normalize('NFKC'),
                normalizedUsername,
                password
            );
        }
        if (!isLocalFallbackAllowed()) {
            return { ok: false, error: getSupabaseConfigurationError() };
        }

        const result = await AuthStorageService.register(
            validDisplayName,
            username.trim(),
            password
        );
        if (!result.ok) return result;
        ProgressStorageService.createInitialProgress(result.account.id);
        if (!AuthStorageService.setActiveAccount(result.account.id)) {
            return {
                ok: false,
                error: 'Penyimpanan browser tidak tersedia. Akun tidak dapat diaktifkan.'
            };
        }
        return { ok: true, account: result.account };
    },

    async login(username: string, password: string): Promise<AuthResult> {
        const normalizedUsername = validateUsername(username);
        if (!normalizedUsername || !password) {
            return { ok: false, error: 'Nama panggilan dan password harus diisi.' };
        }

        const client = getSupabaseClient();
        if (!client) {
            if (!isLocalFallbackAllowed()) {
                return { ok: false, error: getSupabaseConfigurationError() };
            }
            const local = await AuthStorageService.verifyLogin(username, password);
            if (!local || !AuthStorageService.setActiveAccount(local.id)) {
                return { ok: false, error: 'Akun tidak ditemukan atau password salah.' };
            }
            return { ok: true, account: local };
        }

        const email = await buildInternalAuthEmail(normalizedUsername);
        const login = await client.auth.signInWithPassword({ email, password });
        if (!login.error && login.data.user) {
            return finishRemoteLogin(login.data.user.id);
        }

        const legacy = await AuthStorageService.verifyLogin(username, password);
        if (!legacy) {
            return { ok: false, error: 'Akun tidak ditemukan atau password salah.' };
        }

        const migratedSignup = await registerRemote(
            legacy.displayName,
            legacy.username,
            normalizedUsername,
            password
        );
        if (!migratedSignup.ok) {
            return { ok: false, error: 'Akun tidak ditemukan atau password salah.' };
        }
        const migrated = await LegacyMigrationService.migrate(
            legacy,
            migratedSignup.account.id
        );
        if (!migrated) {
            return {
                ok: false,
                error: 'Akun masuk, tetapi progress lokal belum selesai disinkronkan.'
            };
        }
        return migratedSignup;
    },

    async logout(): Promise<void> {
        const profile = this.getActiveAccount();
        if (profile && isSupabaseConfigured()) {
            const flush = import('./ProgressSyncService').then(
                ({ ProgressSyncService }) => ProgressSyncService.flush(profile.id)
            );
            await Promise.race([
                flush,
                new Promise<boolean>((resolve) => {
                    window.setTimeout(() => resolve(false), 1800);
                })
            ]);
            await getSupabaseClient()?.auth.signOut();
            clearRemoteProfile();
        }
        AuthStorageService.clearActiveAccount();
    }
};
