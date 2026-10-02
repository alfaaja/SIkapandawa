import type {
    AdminLevelProgress,
    AdminListUsersInput,
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserProgressResponse,
    AdminUserReportSummary,
    DashboardSummary,
    ProgressStatus
} from '../types';
import { normalizeListUsersParams } from '../utils/pagination';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminServiceError, classifyBackendError } from './errors';
import { DEFAULT_SCHOOL_NAME, normalizeSchoolName } from '../../shared/auth/school';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<ProgressStatus>(['not_started', 'in_progress', 'completed']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function requiredString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string') throw new AdminServiceError('invalid_response');
    return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AdminServiceError('invalid_response');
    }
    return value;
}

function requiredNumberInRange(
    record: Record<string, unknown>,
    key: string,
    minimum: number,
    maximum: number,
    integer = true
): number {
    const value = requiredNumber(record, key);
    if (value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
        throw new AdminServiceError('invalid_response');
    }
    return value;
}

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
    const value = record[key];
    if (typeof value !== 'boolean') throw new AdminServiceError('invalid_response');
    return value;
}

function parseSummary(value: unknown): DashboardSummary {
    if (!isRecord(value)) throw new AdminServiceError('invalid_response');
    return {
        schools: Array.isArray(value.schools)
            ? value.schools.filter((school): school is string => typeof school === 'string')
            : [DEFAULT_SCHOOL_NAME],
        totalUsers: requiredNumber(value, 'totalUsers'),
        notStartedUsers: requiredNumber(value, 'notStartedUsers'),
        inProgressUsers: requiredNumber(value, 'inProgressUsers'),
        completedUsers: requiredNumber(value, 'completedUsers'),
        totalStarsEarned: requiredNumber(value, 'totalStarsEarned'),
        generatedAt: requiredString(value, 'generatedAt')
    };
}

function parseListItem(value: unknown): AdminUserListItem {
    if (!isRecord(value)) throw new AdminServiceError('invalid_response');
    const status = requiredString(value, 'status');
    if (!STATUSES.has(status as ProgressStatus)) {
        throw new AdminServiceError('invalid_response');
    }
    return {
        ...(typeof value.isAdmin === 'boolean' ? { isAdmin: value.isAdmin } : {}),
        schoolName: normalizeSchoolName(value.schoolName) ?? DEFAULT_SCHOOL_NAME,
        userId: requiredString(value, 'userId'),
        displayName: requiredString(value, 'displayName'),
        username: requiredString(value, 'username'),
        registeredAt: requiredString(value, 'registeredAt'),
        highestUnlockedLevel: requiredNumberInRange(value, 'highestUnlockedLevel', 1, 10),
        completedLevelCount: requiredNumberInRange(value, 'completedLevelCount', 0, 10),
        totalStars: requiredNumberInRange(value, 'totalStars', 0, 30),
        jejakPandawaUnlocked: requiredBoolean(value, 'jejakPandawaUnlocked'),
        jejakPandawaBestScore: requiredNumberInRange(value, 'jejakPandawaBestScore', 0, 10),
        progressUpdatedAt: requiredString(value, 'progressUpdatedAt'),
        status: status as ProgressStatus
    };
}

function parseLevel(value: unknown): AdminLevelProgress {
    if (!isRecord(value)) throw new AdminServiceError('invalid_response');
    return {
        level: requiredNumberInRange(value, 'level', 1, 10),
        stars: requiredNumberInRange(value, 'stars', 0, 3),
        completed: requiredBoolean(value, 'completed'),
        updatedAt: requiredString(value, 'updatedAt')
    };
}

function parseReportSummary(value: unknown): AdminUserReportSummary {
    if (!isRecord(value)) throw new AdminServiceError('invalid_response');
    const introSeen = value.introSeen;
    if (
        introSeen !== undefined
        && (!Array.isArray(introSeen) || introSeen.some((item) => typeof item !== 'string'))
    ) {
        throw new AdminServiceError('invalid_response');
    }
    const highestUnlockedLevel = value.highestUnlockedLevel;
    if (
        highestUnlockedLevel !== undefined
        && (
            typeof highestUnlockedLevel !== 'number'
            || !Number.isInteger(highestUnlockedLevel)
            || highestUnlockedLevel < 1
            || highestUnlockedLevel > 10
        )
    ) {
        throw new AdminServiceError('invalid_response');
    }
    return {
        completedLevelCount: requiredNumberInRange(value, 'completedLevelCount', 0, 10),
        totalStars: requiredNumberInRange(value, 'totalStars', 0, 30),
        averageStars: requiredNumberInRange(value, 'averageStars', 0, 3, false),
        grade: requiredString(value, 'grade'),
        jejakPandawaUnlocked: requiredBoolean(value, 'jejakPandawaUnlocked'),
        jejakPandawaBestScore: requiredNumberInRange(value, 'jejakPandawaBestScore', 0, 10),
        ...(typeof highestUnlockedLevel === 'number'
            ? { highestUnlockedLevel }
            : {}),
        ...(introSeen ? { introSeen: [...introSeen] } : {}),
        ...(typeof value.jejakTier === 'string' ? { jejakTier: value.jejakTier } : {})
    };
}

async function unwrapRpc(
    backend: AdminBackend,
    name: string,
    args?: Record<string, unknown>
): Promise<unknown> {
    try {
        const response = await backend.rpc(name, args);
        if (response.error) throw classifyBackendError(response.error);
        return response.data;
    } catch (error) {
        if (error instanceof AdminServiceError) throw error;
        throw new AdminServiceError(navigator.onLine ? 'generic' : 'offline');
    }
}

export class AdminDashboardService {
    constructor(private readonly backend: AdminBackend) {}

    async getSummary(schoolName: string | null = null): Promise<DashboardSummary> {
        return parseSummary(await unwrapRpc(this.backend, 'admin_dashboard_summary', {
            school_name: normalizeSchoolName(schoolName)
        }));
    }

    async listUsers(input: AdminListUsersInput): Promise<AdminUserListResponse> {
        const params = normalizeListUsersParams(input);
        const value = await unwrapRpc(this.backend, 'admin_list_users', {
            search_text: params.searchText || null,
            progress_status: params.progressStatus,
            page_size: params.pageSize,
            page_offset: params.pageOffset,
            school_name: params.schoolName
        });
        if (!isRecord(value) || !Array.isArray(value.items)) {
            throw new AdminServiceError('invalid_response');
        }
        return {
            items: value.items.map(parseListItem),
            total: requiredNumber(value, 'total'),
            pageSize: requiredNumber(value, 'pageSize'),
            pageOffset: requiredNumber(value, 'pageOffset')
        };
    }

    async listChartUsers(schoolName: string | null = null): Promise<AdminUserListItem[]> {
        const pageSize = 100;
        const firstPage = await this.listUsers({
            schoolName,
            searchText: '',
            progressStatus: 'all',
            pageSize,
            pageOffset: 0
        });
        let users = [...firstPage.items];
        for (let pageOffset = pageSize; pageOffset < firstPage.total; pageOffset += pageSize) {
            const page = await this.listUsers({
                schoolName,
                searchText: '',
                progressStatus: 'all',
                pageSize,
                pageOffset
            });
            users = [...users, ...page.items];
        }
        return users;
    }

    async getUserProgress(userId: string): Promise<AdminUserProgressResponse> {
        if (!UUID_PATTERN.test(userId)) throw new AdminServiceError('invalid_response');
        const value = await unwrapRpc(this.backend, 'admin_get_user_progress', {
            target_user_id: userId
        });
        if (
            !isRecord(value)
            || !isRecord(value.user)
            || !Array.isArray(value.levels)
            || !isRecord(value.summary)
        ) {
            throw new AdminServiceError('invalid_response');
        }
        const levels = value.levels.map(parseLevel).sort((a, b) => a.level - b.level);
        if (
            levels.length !== 10
            || levels.some((level, index) => level.level !== index + 1)
        ) {
            throw new AdminServiceError('invalid_response');
        }
        return {
            user: {
                userId: requiredString(value.user, 'userId'),
                displayName: requiredString(value.user, 'displayName'),
                username: requiredString(value.user, 'username')
            },
            summary: parseReportSummary(value.summary),
            levels
        };
    }
}
