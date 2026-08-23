import { validateUsername } from '../../../src/shared/auth/username.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MAX_BODY_BYTES = 8_192;

export function isAdminUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

export interface VerifiedAdminUser {
    id: string;
}

export interface AdminMutationPort {
    createUser(input: {
        displayName: string;
        username: string;
        password: string;
    }): Promise<{ userId: string }>;
    updateUser(userId: string, input: {
        displayName: string;
        expectedUsername: string;
        username: string;
    }): Promise<{ userId: string }>;
    getUsername(userId: string): Promise<string | null>;
    deleteUser(userId: string): Promise<{ userId: string }>;
    resetPassword(userId: string, password: string): Promise<{ userId: string }>;
}

export interface AdminUsersHandlerDependencies {
    allowedOrigins: Set<string>;
    verifyUser(accessToken: string): Promise<VerifiedAdminUser | null>;
    isAdmin(userId: string): Promise<boolean>;
    adminUsers: AdminMutationPort;
}

export class AdminMutationError extends Error {
    constructor(
        readonly status: 400 | 403 | 404 | 409 | 429 | 503,
        readonly publicMessage: string
    ) {
        super(publicMessage);
        this.name = 'AdminMutationError';
    }
}

type JsonRecord = Record<string, unknown>;

function corsHeaders(origin?: string): Headers {
    const headers = new Headers({
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        Vary: 'Origin'
    });
    if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        headers.set(
            'Access-Control-Allow-Headers',
            [
                'authorization',
                'apikey',
                'content-type',
                'idempotency-key',
                'x-client-info',
                'x-supabase-api-version'
            ].join(', ')
        );
    }
    return headers;
}

function json(status: number, body: JsonRecord, origin?: string): Response {
    return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function hasExactKeys(value: JsonRecord, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    return actual.length === wanted.length
        && actual.every((key, index) => key === wanted[index]);
}

function requireUuid(value: unknown): string | null {
    return isAdminUuid(value) ? value : null;
}

function requireDisplayName(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().normalize('NFKC');
    if (normalized.length < 2 || normalized.length > 24) return null;
    return /[\u0000-\u001f\u007f]/.test(normalized) ? null : normalized;
}

function requirePassword(value: unknown): string | null {
    if (
        typeof value !== 'string'
        || value.length < MIN_PASSWORD_LENGTH
        || value.length > MAX_PASSWORD_LENGTH
    ) return null;
    return value;
}

async function parseBody(request: Request): Promise<JsonRecord | null> {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('application/json')) return null;
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) return null;
    try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null;
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? parsed as JsonRecord
            : null;
    } catch {
        return null;
    }
}

async function performMutation(
    actor: VerifiedAdminUser,
    body: JsonRecord,
    adminUsers: AdminMutationPort,
    origin: string
): Promise<Response> {
    if (body.action === 'create') {
        if (!hasExactKeys(body, ['action', 'displayName', 'username', 'password'])) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const displayName = requireDisplayName(body.displayName);
        const username = typeof body.username === 'string'
            ? validateUsername(body.username)
            : null;
        const password = requirePassword(body.password);
        if (!displayName || !username || !password) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const result = await adminUsers.createUser({ displayName, username, password });
        return json(201, result, origin);
    }

    if (body.action === 'update') {
        if (!hasExactKeys(
            body,
            ['action', 'userId', 'displayName', 'expectedUsername', 'username']
        )) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const userId = requireUuid(body.userId);
        const displayName = requireDisplayName(body.displayName);
        const expectedUsername = typeof body.expectedUsername === 'string'
            ? validateUsername(body.expectedUsername)
            : null;
        const username = typeof body.username === 'string'
            ? validateUsername(body.username)
            : null;
        if (!userId || !displayName || !expectedUsername || !username) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        return json(200, await adminUsers.updateUser(userId, {
            displayName,
            expectedUsername,
            username
        }), origin);
    }

    if (body.action === 'delete') {
        if (!hasExactKeys(body, ['action', 'userId', 'expectedUsername'])) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const userId = requireUuid(body.userId);
        const expectedUsername = typeof body.expectedUsername === 'string'
            ? validateUsername(body.expectedUsername)
            : null;
        if (!userId || !expectedUsername || userId === actor.id) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const actualUsername = await adminUsers.getUsername(userId);
        const normalizedActualUsername = typeof actualUsername === 'string'
            ? validateUsername(actualUsername)
            : null;
        if (normalizedActualUsername !== expectedUsername) {
            return json(400, { error: 'Username confirmation does not match' }, origin);
        }
        return json(200, await adminUsers.deleteUser(userId), origin);
    }

    if (body.action === 'reset_password') {
        if (!hasExactKeys(body, ['action', 'userId', 'password'])) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        const userId = requireUuid(body.userId);
        const password = requirePassword(body.password);
        if (!userId || !password || userId === actor.id) {
            return json(400, { error: 'Invalid request' }, origin);
        }
        return json(200, await adminUsers.resetPassword(userId, password), origin);
    }

    return json(400, { error: 'Invalid request' }, origin);
}

export function createAdminUsersHandler(
    dependencies: AdminUsersHandlerDependencies
): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
        const origin = request.headers.get('origin') ?? '';
        const allowedOrigin = origin && dependencies.allowedOrigins.has(origin)
            ? origin
            : null;
        if (!allowedOrigin) return json(403, { error: 'Origin not allowed' });

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
        }
        if (request.method !== 'POST') {
            const response = json(405, { error: 'Method not allowed' }, allowedOrigin);
            response.headers.set('Allow', 'POST, OPTIONS');
            return response;
        }

        const authorization = request.headers.get('authorization') ?? '';
        if (!authorization.startsWith('Bearer ') || authorization.length <= 7) {
            return json(401, { error: 'Authentication required' }, allowedOrigin);
        }

        try {
            const actor = await dependencies.verifyUser(authorization.slice(7));
            if (!actor) return json(401, { error: 'Authentication required' }, allowedOrigin);
            if (!await dependencies.isAdmin(actor.id)) {
                return json(403, { error: 'Admin access required' }, allowedOrigin);
            }
            const body = await parseBody(request);
            if (!body) return json(400, { error: 'Invalid request' }, allowedOrigin);
            return await performMutation(actor, body, dependencies.adminUsers, allowedOrigin);
        } catch (error) {
            if (error instanceof AdminMutationError) {
                return json(error.status, { error: error.publicMessage }, allowedOrigin);
            }
            return json(500, { error: 'Admin operation failed' }, allowedOrigin);
        }
    };
}
