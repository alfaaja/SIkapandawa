import { buildInternalAuthEmail, validateUsername } from '../../shared/auth/username';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminServiceError, classifyBackendError } from './errors';
import { parseStaffAccess, type StaffAccess } from '../../shared/auth/staff';

export type AdminAuthResult =
    | { ok: true }
    | { ok: false; error: AdminServiceError };

function hasUser(data: unknown): boolean {
    if (typeof data !== 'object' || data === null || !('user' in data)) return false;
    const user = data.user;
    return typeof user === 'object' && user !== null && 'id' in user;
}

function hasSession(data: unknown): boolean {
    if (typeof data !== 'object' || data === null || !('session' in data)) return false;
    const session = data.session;
    return typeof session === 'object' && session !== null && 'user' in session;
}

function userIdFromAuthData(data: unknown): string | null {
    if (typeof data !== 'object' || data === null || !('user' in data)) return null;
    const user = data.user;
    if (typeof user !== 'object' || user === null || !('id' in user)) return null;
    return typeof user.id === 'string' ? user.id : null;
}

function userIdFromSession(data: unknown): string | null {
    if (!hasSession(data)) return null;
    const session = (data as { session: { user?: unknown } }).session;
    if (typeof session.user !== 'object' || session.user === null) return null;
    const user = session.user as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
}

function sessionUsername(data: unknown): string | null {
    if (!hasSession(data)) return null;
    const session = (data as { session: { user?: unknown } }).session;
    if (typeof session.user !== 'object' || session.user === null) return null;
    const metadata = (session.user as { user_metadata?: unknown }).user_metadata;
    if (typeof metadata !== 'object' || metadata === null) return null;
    const username = (metadata as { username?: unknown }).username;
    return typeof username === 'string' ? validateUsername(username) : null;
}

export class AdminAuthService {
    private currentUsername = 'admin';
    private currentUserId: string | null = null;
    private access: StaffAccess | null = null;

    constructor(private readonly backend: AdminBackend) {}

    private async clearUnverifiedSession(): Promise<void> {
        this.currentUsername = 'admin';
        this.currentUserId = null;
        this.access = null;
        try {
            await this.backend.signOut();
        } catch {
            // Authorization remains fail-closed even if remote sign-out is unavailable.
        }
    }

    private async authorize(): Promise<AdminAuthResult> {
        try {
            const gate = await this.backend.rpc('staff_access');
            if (!gate.error) {
                const access = parseStaffAccess(gate.data);
                if (access.role !== 'teacher') {
                    this.access = access;
                    return { ok: true };
                }
                await this.clearUnverifiedSession();
                return { ok: false, error: new AdminServiceError('access_denied') };
            }

            const classified = classifyBackendError(gate.error);
            await this.clearUnverifiedSession();
            return { ok: false, error: classified };
        } catch {
            await this.clearUnverifiedSession();
            return {
                ok: false,
                error: new AdminServiceError(navigator.onLine ? 'generic' : 'offline')
            };
        }
    }

    async login(username: string, password: string): Promise<AdminAuthResult> {
        const normalized = validateUsername(username);
        if (!normalized || password.length === 0) {
            return {
                ok: false,
                error: new AdminServiceError('invalid_credentials')
            };
        }

        let response;
        try {
            response = await this.backend.signInWithPassword({
                email: await buildInternalAuthEmail(normalized),
                password
            });
        } catch {
            return {
                ok: false,
                error: new AdminServiceError(navigator.onLine ? 'generic' : 'offline')
            };
        }
        if (response.error || !hasUser(response.data)) {
            if (response.error?.status === 429) {
                return { ok: false, error: new AdminServiceError('rate_limited') };
            }
            return {
                ok: false,
                error: new AdminServiceError('invalid_credentials')
            };
        }
        const result = await this.authorize();
        if (result.ok) {
            this.currentUsername = normalized;
            this.currentUserId = userIdFromAuthData(response.data);
        }
        return result;
    }

    async restoreSession(): Promise<AdminAuthResult> {
        try {
            const response = await this.backend.getSession();
            if (response.error) {
                return { ok: false, error: classifyBackendError(response.error) };
            }
            if (!hasSession(response.data)) {
                return { ok: false, error: new AdminServiceError('session_expired') };
            }
            const result = await this.authorize();
            if (result.ok) {
                this.currentUsername = sessionUsername(response.data) ?? 'admin';
                this.currentUserId = userIdFromSession(response.data);
            }
            return result;
        } catch {
            return {
                ok: false,
                error: new AdminServiceError(navigator.onLine ? 'generic' : 'offline')
            };
        }
    }

    async logout(): Promise<void> {
        await this.backend.signOut();
        this.currentUsername = 'admin';
        this.currentUserId = null;
        this.access = null;
    }

    async changeOwnPassword(password: string): Promise<AdminAuthResult> {
        if (password.length < 12 || password.length > 128) {
            return { ok: false, error: new AdminServiceError('validation') };
        }
        try {
            const response = await this.backend.updateOwnPassword(password);
            if (response.error) {
                return { ok: false, error: classifyBackendError(response.error) };
            }
            return { ok: true };
        } catch {
            return {
                ok: false,
                error: new AdminServiceError(navigator.onLine ? 'generic' : 'offline')
            };
        }
    }

    getCurrentUsername(): string {
        return this.currentUsername;
    }

    getAccess(): StaffAccess | null { return this.access; }

    getCurrentUserId(): string | null {
        return this.currentUserId;
    }
}
