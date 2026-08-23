const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;

export function normalizeUsername(value: string): string {
    return value.trim().normalize('NFKC').toLowerCase();
}

export function validateUsername(value: string): string | null {
    const normalized = normalizeUsername(value);
    if (
        normalized.length < MIN_USERNAME_LENGTH
        || normalized.length > MAX_USERNAME_LENGTH
    ) {
        return null;
    }
    return USERNAME_PATTERN.test(normalized) ? normalized : null;
}

async function sha256Hex(value: string): Promise<string> {
    const encoded = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
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
