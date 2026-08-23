import type {
    AdminListUsersInput,
    AdminListUsersParams,
    ProgressStatusFilter
} from '../types';

const ALLOWED_STATUSES = new Set<ProgressStatusFilter>([
    'all',
    'not_started',
    'in_progress',
    'completed'
]);

function normalizeInteger(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number
): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

export function normalizeListUsersParams(
    input: AdminListUsersInput
): AdminListUsersParams {
    const rawSearch = typeof input.searchText === 'string' ? input.searchText : '';
    const rawStatus = typeof input.progressStatus === 'string'
        ? input.progressStatus
        : 'all';
    const progressStatus: ProgressStatusFilter = ALLOWED_STATUSES.has(
        rawStatus as ProgressStatusFilter
    ) ? rawStatus as ProgressStatusFilter : 'all';

    return {
        searchText: rawSearch.trim().slice(0, 80),
        progressStatus,
        pageSize: normalizeInteger(input.pageSize, 25, 1, 100),
        pageOffset: normalizeInteger(
            input.pageOffset,
            0,
            0,
            Number.MAX_SAFE_INTEGER
        )
    };
}
