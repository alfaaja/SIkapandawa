import type {
    AdminBackend,
    AdminBackendResponse
} from '../services/AdminSupabaseClient';
import type {
    AdminLevelProgress,
    AdminUserListItem,
    ProgressStatus
} from '../types';
import { validateUsername } from '../../shared/auth/username';
import { DEFAULT_SCHOOL_NAME, normalizeSchoolName } from '../../shared/auth/school';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import {
    getJejakReportTier,
    getMissionReportRank
} from '../../shared/game/reporting';

const MOCK_SESSION_KEY = 'sikapandawa.admin.mock-session';

function userId(index: number): string {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function createUsers(): AdminUserListItem[] {
    const profiles = [
        { displayName: 'Arjuna Pratama', username: 'arjuna.pratama' },
        { displayName: 'Srikandi Lestari', username: 'srikandi.lestari' },
        { displayName: 'Bima Adinata', username: 'bima.adinata' },
        { displayName: 'Nakula Wijaya', username: 'nakula.wijaya' },
        { displayName: 'Sadewa Putri', username: 'sadewa.putri' },
        { displayName: 'Dewi Kunti', username: 'dewi.kunti' },
        { displayName: 'Gatotkaca Muda', username: 'gatotkaca.muda' },
        { displayName: 'Drupadi Kirana', username: 'drupadi.kirana' }
    ];
    return Array.from({ length: 56 }, (_, index) => {
        const profile = profiles[index % profiles.length]!;
        const cycle = Math.floor(index / profiles.length);
        const completedLevelCount = index % 11;
        const status: ProgressStatus = completedLevelCount === 0
            ? 'not_started'
            : completedLevelCount === 10 ? 'completed' : 'in_progress';
        const day = String((index % 27) + 1).padStart(2, '0');
        return {
            schoolName: DEFAULT_SCHOOL_NAME,
            userId: userId(index + 1),
            displayName: profile.displayName,
            username: cycle === 0
                ? profile.username
                : `${profile.username}.${String(index + 1).padStart(2, '0')}`,
            registeredAt: `2026-07-${day}T03:30:00.000Z`,
            highestUnlockedLevel: Math.min(10, completedLevelCount + 1),
            completedLevelCount,
            totalStars: Math.min(30, completedLevelCount * 2 + index % 3),
            jejakPandawaUnlocked: completedLevelCount === 10,
            jejakPandawaBestScore: completedLevelCount === 10 ? index % 11 : 0,
            progressUpdatedAt: `2026-08-${String((index % 9) + 1).padStart(2, '0')}T08:15:00.000Z`,
            status
        };
    });
}

function createLevels(user: AdminUserListItem): AdminLevelProgress[] {
    return Array.from({ length: 10 }, (_, index) => ({
        level: index + 1,
        stars: index < user.completedLevelCount ? (index % 3) + 1 : 0,
        completed: index < user.completedLevelCount,
        updatedAt: user.progressUpdatedAt
    }));
}

function success(data: unknown): AdminBackendResponse {
    return { data, error: null };
}

export function createAdminMockBackend(): AdminBackend {
    let users = createUsers();
    const mockRole = new URLSearchParams(window.location.search).get('mockRole') ?? 'admin';

    return {
        async signInWithPassword() {
            if (mockRole === 'invalid') {
                return {
                    data: { user: null },
                    error: { message: 'Invalid credentials', status: 400 }
                };
            }
            sessionStorage.setItem(MOCK_SESSION_KEY, 'active');
            return success({ user: { id: userId(999) } });
        },
        async getSession() {
            const active = sessionStorage.getItem(MOCK_SESSION_KEY) === 'active';
            return success({
                session: active ? {
                    user: {
                        id: userId(999),
                        user_metadata: { username: 'admin.demo' }
                    }
                } : null
            });
        },
        async signOut() {
            sessionStorage.removeItem(MOCK_SESSION_KEY);
            return { error: null };
        },
        async updateOwnPassword(password) {
            if (password.length < 12 || password.length > 128) {
                return {
                    data: null,
                    error: { code: '22023', message: 'Invalid credential', status: 400 }
                };
            }
            return success({ user: { id: userId(999) } });
        },
        async invokeAdminFunction(action, body) {
            if (mockRole !== 'admin') {
                return {
                    data: null,
                    error: { code: '42501', message: 'Insufficient privilege', status: 403 }
                };
            }
            const userIdValue = typeof body.userId === 'string' ? body.userId : '';
            if (action === 'create') {
                const displayName = typeof body.displayName === 'string'
                    ? body.displayName.trim()
                    : '';
                const username = typeof body.username === 'string'
                    ? validateUsername(body.username)
                    : null;
                const passwordIsValid = typeof body.password === 'string'
                    && body.password.length >= 12
                    && body.password.length <= 128;
                if (
                    displayName.length < 2
                    || displayName.length > 24
                    || !username
                    || !passwordIsValid
                ) {
                    return {
                        data: null,
                        error: { code: '22023', message: 'Invalid account data', status: 400 }
                    };
                }
                if (users.some((user) => user.username === username)) {
                    return {
                        data: null,
                        error: { code: '23505', message: 'Duplicate username', status: 409 }
                    };
                }
                const created: AdminUserListItem = {
                    schoolName: normalizeSchoolName(body.schoolName) ?? DEFAULT_SCHOOL_NAME,
                    userId: crypto.randomUUID(),
                    displayName,
                    username,
                    registeredAt: new Date().toISOString(),
                    highestUnlockedLevel: 1,
                    completedLevelCount: 0,
                    totalStars: 0,
                    jejakPandawaUnlocked: false,
                    jejakPandawaBestScore: 0,
                    progressUpdatedAt: new Date().toISOString(),
                    status: 'not_started'
                };
                users = [created, ...users];
                return success({ userId: created.userId });
            }

            const target = users.find((user) => user.userId === userIdValue);
            if (!target) {
                return {
                    data: null,
                    error: { code: 'P0002', message: 'Player not found', status: 404 }
                };
            }
            if (action === 'update') {
                const displayName = typeof body.displayName === 'string'
                    ? body.displayName.trim()
                    : '';
                const expectedUsername = typeof body.expectedUsername === 'string'
                    ? validateUsername(body.expectedUsername)
                    : null;
                const username = typeof body.username === 'string'
                    ? validateUsername(body.username)
                    : null;
                if (
                    displayName.length < 2
                    || displayName.length > 24
                    || !expectedUsername
                    || !username
                    || expectedUsername !== target.username
                ) {
                    return {
                        data: null,
                        error: { code: '22023', message: 'Invalid profile update', status: 400 }
                    };
                }
                if (users.some((user) => (
                    user.userId !== target.userId && user.username === username
                ))) {
                    return {
                        data: null,
                        error: { code: '23505', message: 'Duplicate username', status: 409 }
                    };
                }
                users = users.map((user) => user.userId === target.userId
                    ? { ...user, displayName, username }
                    : user);
                return success({ userId: target.userId });
            }
            if (action === 'reset_password') {
                const passwordIsValid = typeof body.password === 'string'
                    && body.password.length >= 12
                    && body.password.length <= 128;
                if (!passwordIsValid) {
                    return {
                        data: null,
                        error: { code: '22023', message: 'Invalid credential', status: 400 }
                    };
                }
                return success({ userId: target.userId });
            }
            if (action === 'delete') {
                if (
                    typeof body.expectedUsername === 'string'
                    && body.expectedUsername !== target.username
                ) {
                    return {
                        data: null,
                        error: { code: '22023', message: 'Confirmation mismatch', status: 400 }
                    };
                }
                users = users.filter((user) => user.userId !== target.userId);
                return success({ userId: target.userId });
            }
            return {
                data: null,
                error: { code: '22023', message: 'Unknown action', status: 400 }
            };
        },
        async rpc(name, args = {}) {
            if (mockRole === 'user') {
                return {
                    data: null,
                    error: { code: '42501', message: 'Insufficient privilege', status: 403 }
                };
            }
            if (name === 'admin_dashboard_summary') {
                const cohort = users.filter(user => !args.school_name || user.schoolName === args.school_name);
                return success({
                    schools: [...new Set(users.map(user => user.schoolName))].sort(),
                    totalUsers: cohort.length,
                    notStartedUsers: cohort.filter((user) => user.status === 'not_started').length,
                    inProgressUsers: cohort.filter((user) => user.status === 'in_progress').length,
                    completedUsers: cohort.filter((user) => user.status === 'completed').length,
                    totalStarsEarned: cohort.reduce((total, user) => total + user.totalStars, 0),
                    generatedAt: new Date().toISOString()
                });
            }
            if (name === 'admin_school_aspect_averages') {
                const cohort = users.filter(user => !user.isAdmin && (!args.school_name || user.schoolName === args.school_name));
                return success([...new Set(cohort.map(user => user.schoolName))].sort().map(schoolName => {
                    const students = cohort.filter(user => user.schoolName === schoolName);
                    const known = students.filter(user => [0, 10].includes(user.jejakPandawaBestScore));
                    return { schoolName, studentCount: students.length, jejakKnownCount: known.length,
                        aspects: CHARACTER_ASPECTS.map(aspect => ({ id: aspect.id,
                            missionAverage: students.reduce((sum, user) => sum + createLevels(user).filter(level => (aspect.levels as readonly number[]).includes(level.level)).reduce((score, level) => score + level.stars, 0), 0) / students.length,
                            jejakAverage: known.length ? known.reduce((sum, user) => sum + user.jejakPandawaBestScore / 5, 0) / known.length : null
                        })) };
                }));
            }
            if (name === 'admin_list_users') {
                const search = typeof args.search_text === 'string'
                    ? args.search_text.toLowerCase()
                    : '';
                const status = typeof args.progress_status === 'string'
                    ? args.progress_status
                    : 'all';
                const pageSize = typeof args.page_size === 'number' ? args.page_size : 25;
                const pageOffset = typeof args.page_offset === 'number' ? args.page_offset : 0;
                const filtered = users.filter((user) => {
                    const matchesSearch = !search
                        || user.username.toLowerCase().includes(search)
                        || user.displayName.toLowerCase().includes(search);
                    const matchesStatus = status === 'all' || user.status === status;
                    return matchesSearch && matchesStatus && (!args.school_name || user.schoolName === args.school_name);
                });
                return success({
                    items: filtered.slice(pageOffset, pageOffset + pageSize),
                    total: filtered.length,
                    pageSize,
                    pageOffset
                });
            }
            if (name === 'admin_get_user_progress') {
                const target = users.find((user) => user.userId === args.target_user_id);
                if (!target) {
                    return {
                        data: null,
                        error: { code: 'P0002', message: 'Player not found', status: 404 }
                    };
                }
                const levels = createLevels(target);
                const totalStars = levels.reduce((total, level) => total + level.stars, 0);
                return success({
                    user: {
                        userId: target.userId,
                        displayName: target.displayName,
                        username: target.username
                    },
                    summary: {
                        completedLevelCount: target.completedLevelCount,
                        totalStars,
                        averageStars: Number((totalStars / 10).toFixed(1)),
                        grade: getMissionReportRank(totalStars).name,
                        highestUnlockedLevel: target.highestUnlockedLevel,
                        introSeen: target.completedLevelCount > 0
                            ? ['yudhistira', 'bima'].slice(0, Math.min(2, target.completedLevelCount))
                            : [],
                        jejakPandawaUnlocked: target.jejakPandawaUnlocked,
                        jejakPandawaBestScore: target.jejakPandawaBestScore,
                        jejakTier: getJejakReportTier(target.jejakPandawaBestScore)
                    },
                    levels
                });
            }
            return {
                data: null,
                error: { message: 'Unknown mock RPC', status: 500 }
            };
        }
    };
}
