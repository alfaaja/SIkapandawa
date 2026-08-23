const DEFAULT_ADMIN_ALLOWED_ORIGINS = [
    'https://sikapandawa.com',
    'https://www.sikapandawa.com',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://localhost:8080',
    'http://localhost:8081',
] as const;

export function resolveAdminAllowedOrigins(configured?: string | null): string[] {
    const source = configured?.trim()
        ? configured.split(',')
        : DEFAULT_ADMIN_ALLOWED_ORIGINS;

    return Array.from(new Set(source.map((origin) => origin.trim()).filter(Boolean)));
}
