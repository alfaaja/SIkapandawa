/**
 * AuthStorageService — satu-satunya gerbang localStorage untuk akun lokal.
 * Prototype frontend saja, bukan autentikasi production.
 */

export interface LocalAccount {
    id: string;
    displayName: string;
    username: string;
    passwordSalt: string;
    passwordHash: string;
    createdAt: string;
}

const KEYS = {
    accounts: 'sikapandawa.accounts',
    activeAccountId: 'sikapandawa.activeAccountId'
} as const;

export type RegisterResult =
    | { ok: true; account: LocalAccount }
    | { ok: false; error: string };

function safeGet(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key: string, value: string): boolean {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function safeRemove(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // storage tidak tersedia; tidak ada yang perlu dihapus
    }
}

function randomHex(bytes: number): string {
    const buf = new Uint8Array(bytes);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < buf.length; i++) {
            buf[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function createId(): string {
    if (window.crypto && 'randomUUID' in window.crypto) {
        return window.crypto.randomUUID();
    }
    return `acc-${Date.now().toString(36)}-${randomHex(8)}`;
}

/** SHA-256 via Web Crypto; fallback hash sederhana bila subtle tidak tersedia. */
async function hashPassword(password: string, salt: string): Promise<string> {
    const text = `${salt}:${password}`;
    if (window.crypto && window.crypto.subtle) {
        const data = new TextEncoder().encode(text);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback non-kriptografis (prototype saja).
    console.warn('[Auth] Web Crypto tidak tersedia; memakai fallback hash prototype.');
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < text.length; i++) {
        h1 = (h1 ^ text.charCodeAt(i)) * 0x01000193 >>> 0;
        h2 = ((h2 << 5) + h2 + text.charCodeAt(i)) >>> 0;
    }
    return `fb-${h1.toString(16)}-${h2.toString(16)}`;
}

function isAccount(value: unknown): value is LocalAccount {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.id === 'string'
        && typeof v.displayName === 'string'
        && typeof v.username === 'string'
        && typeof v.passwordSalt === 'string'
        && typeof v.passwordHash === 'string';
}

export const AuthStorageService = {
    listAccounts(): LocalAccount[] {
        const raw = safeGet(KEYS.accounts);
        if (!raw) return [];
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(isAccount);
        } catch {
            return [];
        }
    },

    findByUsername(username: string): LocalAccount | null {
        const wanted = username.trim().toLowerCase();
        return this.listAccounts().find((a) => a.username.toLowerCase() === wanted) ?? null;
    },

    async register(displayName: string, username: string, password: string): Promise<RegisterResult> {
        const name = displayName.trim();
        const uname = username.trim();

        if (name.length < 2 || name.length > 24) {
            return { ok: false, error: 'Nama lengkap harus 2 sampai 24 karakter.' };
        }
        if (uname.length < 3 || uname.length > 20) {
            return { ok: false, error: 'Nama panggilan harus 3 sampai 20 karakter.' };
        }
        if (password.length < 6) {
            return { ok: false, error: 'Password minimal 6 karakter.' };
        }
        if (this.findByUsername(uname)) {
            return { ok: false, error: 'Nama panggilan sudah dipakai. Silakan pilih yang lain.' };
        }

        const salt = randomHex(16);
        const hash = await hashPassword(password, salt);
        const account: LocalAccount = {
            id: createId(),
            displayName: name,
            username: uname,
            passwordSalt: salt,
            passwordHash: hash,
            createdAt: new Date().toISOString()
        };

        const accounts = this.listAccounts();
        accounts.push(account);
        if (!safeSet(KEYS.accounts, JSON.stringify(accounts))) {
            return { ok: false, error: 'Penyimpanan browser tidak tersedia. Akun tidak dapat dibuat.' };
        }
        return { ok: true, account };
    },

    async verifyLogin(username: string, password: string): Promise<LocalAccount | null> {
        const account = this.findByUsername(username);
        if (!account) return null;
        const hash = await hashPassword(password, account.passwordSalt);
        return hash === account.passwordHash ? account : null;
    },

    getActiveAccount(): LocalAccount | null {
        const id = safeGet(KEYS.activeAccountId);
        if (!id) return null;
        return this.listAccounts().find((a) => a.id === id) ?? null;
    },

    setActiveAccount(id: string): boolean {
        return safeSet(KEYS.activeAccountId, id);
    },

    /** Logout: hanya menghapus akun aktif, tidak menghapus akun/progress. */
    clearActiveAccount(): void {
        safeRemove(KEYS.activeAccountId);
    }
};
