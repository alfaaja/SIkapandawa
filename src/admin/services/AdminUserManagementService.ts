import { normalizeUsername, validateUsername } from '../../shared/auth/username';
import { normalizeSchoolName } from '../../shared/auth/school';
import type {
    AdminCreateUserInput,
    AdminMutationResult,
    AdminUpdateUserInput
} from '../types';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminServiceError, classifyBackendError } from './errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function normalizeDisplayName(value: unknown): string {
    if (typeof value !== 'string') throw new AdminServiceError('validation');
    const normalized = value.trim().normalize('NFKC');
    if (normalized.length < 2 || normalized.length > 24) {
        throw new AdminServiceError('validation');
    }
    return normalized;
}

function requireUsername(value: unknown): string {
    if (typeof value !== 'string') throw new AdminServiceError('validation');
    const username = validateUsername(value);
    if (!username) throw new AdminServiceError('validation');
    return username;
}

function requireUserId(value: unknown): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        throw new AdminServiceError('validation');
    }
    return value;
}

function requirePassword(value: unknown): string {
    if (
        typeof value !== 'string'
        || value.length < MIN_PASSWORD_LENGTH
        || value.length > MAX_PASSWORD_LENGTH
    ) {
        throw new AdminServiceError('validation');
    }
    return value;
}

function parseMutationResult(value: unknown): AdminMutationResult {
    if (
        typeof value !== 'object'
        || value === null
        || !('userId' in value)
        || typeof value.userId !== 'string'
        || !UUID_PATTERN.test(value.userId)
    ) {
        throw new AdminServiceError('invalid_response');
    }
    return { userId: value.userId };
}

export class AdminUserManagementService {
    constructor(private readonly backend: AdminBackend) {}

    async createUser(input: AdminCreateUserInput): Promise<AdminMutationResult> {
        const schoolName = normalizeSchoolName(input.schoolName);
        if (input.schoolName !== undefined && !schoolName) throw new AdminServiceError('validation');
        return this.invoke('create', {
            ...(schoolName ? { schoolName } : {}),
            displayName: normalizeDisplayName(input.displayName),
            username: requireUsername(input.username),
            password: requirePassword(input.password)
        });
    }

    async updateUser(
        userId: string,
        input: Partial<AdminUpdateUserInput>
    ): Promise<AdminMutationResult> {
        return this.invoke('update', {
            userId: requireUserId(userId),
            displayName: normalizeDisplayName(input.displayName),
            expectedUsername: requireUsername(input.expectedUsername),
            username: requireUsername(input.username)
        });
    }

    async deleteUser(
        userId: string,
        expectedUsername: string
    ): Promise<AdminMutationResult> {
        const body: Record<string, unknown> = { userId: requireUserId(userId) };
        const normalized = validateUsername(expectedUsername);
        if (!normalized || normalized !== normalizeUsername(expectedUsername)) {
            throw new AdminServiceError('validation');
        }
        body.expectedUsername = normalized;
        return this.invoke('delete', body);
    }

    async resetPassword(userId: string, password: string): Promise<AdminMutationResult> {
        return this.invoke('reset_password', {
            userId: requireUserId(userId),
            password: requirePassword(password)
        });
    }

    private async invoke(
        action: string,
        body: Record<string, unknown>
    ): Promise<AdminMutationResult> {
        try {
            const response = await this.backend.invokeAdminFunction(action, body);
            if (response.error) throw classifyBackendError(response.error);
            return parseMutationResult(response.data);
        } catch (error) {
            if (error instanceof AdminServiceError) throw error;
            throw new AdminServiceError(navigator.onLine ? 'generic' : 'offline');
        }
    }
}
