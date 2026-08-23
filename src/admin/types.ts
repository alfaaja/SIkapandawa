export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type ProgressStatusFilter = 'all' | ProgressStatus;

export interface DashboardSummary {
    totalUsers: number;
    notStartedUsers: number;
    inProgressUsers: number;
    completedUsers: number;
    totalStarsEarned: number;
    generatedAt: string;
}

export interface AdminUserListItem {
    userId: string;
    displayName: string;
    username: string;
    registeredAt: string;
    highestUnlockedLevel: number;
    completedLevelCount: number;
    totalStars: number;
    jejakPandawaUnlocked: boolean;
    jejakPandawaBestScore: number;
    progressUpdatedAt: string;
    status: ProgressStatus;
}

export interface AdminUserListResponse {
    items: AdminUserListItem[];
    total: number;
    pageSize: number;
    pageOffset: number;
}

export interface AdminLevelProgress {
    level: number;
    stars: number;
    completed: boolean;
    updatedAt: string;
}

export interface AdminUserProgressResponse {
    user: Pick<AdminUserListItem, 'userId' | 'displayName' | 'username'>;
    summary: AdminUserReportSummary;
    levels: AdminLevelProgress[];
}

export interface AdminUserReportSummary {
    completedLevelCount: number;
    totalStars: number;
    averageStars: number;
    grade: string;
    highestUnlockedLevel?: number;
    introSeen?: string[];
    jejakPandawaUnlocked: boolean;
    jejakPandawaBestScore: number;
    jejakTier?: string;
}

export interface AdminCreateUserInput {
    displayName: string;
    username: string;
    password: string;
}

export interface AdminUpdateUserInput {
    displayName: string;
    expectedUsername: string;
    username: string;
}

export interface AdminMutationResult {
    userId: string;
}

export type AdminUserIdentity = Pick<
    AdminUserListItem,
    'userId' | 'displayName' | 'username'
>;

export interface AdminListUsersParams {
    searchText: string;
    progressStatus: ProgressStatusFilter;
    pageSize: number;
    pageOffset: number;
}

export interface AdminListUsersInput {
    searchText?: unknown;
    progressStatus?: unknown;
    pageSize?: unknown;
    pageOffset?: unknown;
}
