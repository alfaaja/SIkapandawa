import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminDashboardService } from './AdminDashboardService';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

function makeBackend(rpc: AdminBackend['rpc']): AdminBackend {
    return {
        signInWithPassword: vi.fn(),
        getSession: vi.fn(),
        signOut: vi.fn(),
        updateOwnPassword: vi.fn(),
        getJejakAspects: vi.fn().mockResolvedValue({ data: Object.fromEntries(CHARACTER_ASPECTS.map(aspect => [aspect.id, null])), error: null }),
        rpc,
        invokeAdminFunction: vi.fn()
    };
}

function listItem(overrides: Record<string, unknown> = {}) {
    return {
        userId: USER_ID,
        displayName: 'Budi',
        schoolName: 'SDN Kalibanteng Kulon 01',
        username: 'budi',
        registeredAt: '2026-08-01T00:00:00.000Z',
        highestUnlockedLevel: 3,
        completedLevelCount: 2,
        totalStars: 5,
        jejakPandawaUnlocked: false,
        jejakPandawaBestScore: 0,
        progressUpdatedAt: '2026-08-02T00:00:00.000Z',
        status: 'in_progress',
        ...overrides
    };
}

describe('AdminDashboardService', () => {
    it('validates per-student v2 aspect maxima and never infers them from the legacy best total', async () => {
        const data = {
            user: { userId: USER_ID, displayName: 'Budi', username: 'budi' },
            levels: Array.from({ length: 10 }, (_, index) => ({ level: index + 1, stars: 3, completed: true, updatedAt: '2026-10-17T00:00:00Z' })),
            summary: { completedLevelCount: 10, totalStars: 30, averageStars: 3, grade: 'Baik', jejakPandawaUnlocked: true, jejakPandawaBestScore: 10 }
        };
        const backend = makeBackend(vi.fn().mockResolvedValue({ data, error: null }));
        const service = new AdminDashboardService(backend);
        expect((await service.getUserProgress(USER_ID)).jejakAspects).toBeNull();
        const scores = { kejujuran: 2, keberanian: 0, kesopanan: 1, kebijaksanaan: 2, keadilan: 1 };
        const read = vi.mocked(backend.getJejakAspects);
        read.mockResolvedValue({ data: scores, error: null });
        expect((await service.getUserProgress(USER_ID)).jejakAspects).toEqual(scores);
        expect(read).toHaveBeenLastCalledWith(USER_ID);
        for (const invalid of [null, {}, { ...scores, keadilan: null }, { ...scores, keadilan: 3 }, { ...scores, keadilan: 0.5 }, { ...scores, keadilan: '1' }]) {
            read.mockResolvedValue({ data: invalid, error: null });
            await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({ code: 'invalid_response' });
        }
        read.mockResolvedValue({ data: null, error: { code: '42501', message: 'private detail' } });
        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({ code: 'access_denied' });
        read.mockRejectedValue(new TypeError('network detail'));
        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({ code: 'generic' });
        data.user.userId = 'different-user';
        read.mockClear();
        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({ code: 'invalid_response' });
        expect(read).not.toHaveBeenCalled();
    });
    it('scopes monitoring RPCs and rejects invalid student identities before reading history', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
        const service = new AdminDashboardService(makeBackend(rpc));
        expect(await service.getMonitoringSummary('SDN Satu', USER_ID)).toEqual([]);
        expect(rpc).toHaveBeenCalledWith('admin_monitoring_summary', { school_name: 'SDN Satu', target_user_id: USER_ID });
        rpc.mockResolvedValue({ data: { items: [], total: 0, pageSize: 25, pageOffset: 25 }, error: null });
        expect((await service.getMonitoringHistory(USER_ID, 25)).pageOffset).toBe(25);
        await expect(service.getMonitoringHistory('not-an-id')).rejects.toThrow();
        await expect(service.getMonitoringSummary(null, 'not-an-id')).rejects.toThrow();
    });
    it('validates school aspect scales and coverage without turning missing Jejak data into zero', async () => {
        const school = { schoolName: 'SDN Satu', studentCount: 2, jejakKnownCount: 0, jejakVersion: 2,
            aspects: CHARACTER_ASPECTS.map(aspect => ({ id: aspect.id, missionAverage: 3, jejakAverage: null })) };
        const rpc = vi.fn().mockResolvedValue({ data: [school], error: null });
        const service = new AdminDashboardService(makeBackend(rpc));
        await expect(service.getAspectAverages('SDN Satu')).resolves.toEqual([school]);
        expect(rpc).toHaveBeenCalledWith('admin_school_aspect_averages_v2', { school_name: 'SDN Satu' });
        for (const invalid of [{ ...school, jejakVersion: 1 }, { ...school, jejakKnownCount: 3 }, { ...school, jejakKnownCount: 1 },
            { ...school, aspects: [] }, { ...school, aspects: school.aspects.map(aspect => ({ ...aspect, missionAverage: 7 })) }]) {
            rpc.mockResolvedValue({ data: [invalid], error: null });
            await expect(service.getAspectAverages()).rejects.toThrow();
        }
    });
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('loads and validates the dashboard summary RPC', async () => {
        const data = {
            schools: ['SDN Kalibanteng Kulon 01'],
            totalUsers: 4,
            notStartedUsers: 1,
            inProgressUsers: 2,
            completedUsers: 1,
            totalStarsEarned: 42,
            generatedAt: '2026-08-10T00:00:00.000Z'
        };
        const rpc = vi.fn().mockResolvedValue({ data, error: null });

        await expect(new AdminDashboardService(makeBackend(rpc)).getSummary())
            .resolves.toEqual(data);
        expect(rpc).toHaveBeenCalledWith('admin_dashboard_summary', { school_name: null });
    });

    it('normalizes list input and sends the exact read-only RPC arguments', async () => {
        const data = {
            items: [listItem()],
            total: 1,
            pageSize: 100,
            pageOffset: 0
        };
        const rpc = vi.fn().mockResolvedValue({ data, error: null });
        const service = new AdminDashboardService(makeBackend(rpc));

        await expect(service.listUsers({
            searchText: `  ${'b'.repeat(90)}  `,
            progressStatus: 'in_progress',
            pageSize: 200,
            pageOffset: -1
        })).resolves.toEqual(data);
        expect(rpc).toHaveBeenCalledWith('admin_list_users', {
            search_text: 'b'.repeat(80),
            progress_status: 'in_progress',
            page_size: 100,
            page_offset: 0,
            school_name: null
        });
    });

    it('sends null rather than an empty search string', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: { items: [], total: 0, pageSize: 25, pageOffset: 0 },
            error: null
        });

        await new AdminDashboardService(makeBackend(rpc)).listUsers({});

        expect(rpc).toHaveBeenCalledWith('admin_list_users', expect.objectContaining({
            search_text: null
        }));
    });

    it('loads the complete unfiltered cohort for dashboard charts', async () => {
        const data = {
            items: [listItem({ isAdmin: true })],
            total: 1,
            pageSize: 100,
            pageOffset: 0
        };
        const rpc = vi.fn().mockResolvedValue({ data, error: null });

        await expect(new AdminDashboardService(makeBackend(rpc)).listChartUsers())
            .resolves.toEqual(data.items);
        expect(rpc).toHaveBeenCalledWith('admin_list_users', {
            search_text: null,
            progress_status: 'all',
            page_size: 100,
            page_offset: 0,
            school_name: null
        });
    });

    it('paginates chart data beyond the one-hundred-user RPC limit', async () => {
        const firstPage = {
            items: Array.from({ length: 100 }, (_, index) => listItem({
                userId: `user-${index}`
            })),
            total: 101,
            pageSize: 100,
            pageOffset: 0
        };
        const lastItem = listItem({ userId: 'user-100' });
        const rpc = vi.fn()
            .mockResolvedValueOnce({ data: firstPage, error: null })
            .mockResolvedValueOnce({
                data: { items: [lastItem], total: 101, pageSize: 100, pageOffset: 100 },
                error: null
            });

        const users = await new AdminDashboardService(makeBackend(rpc))
            .listChartUsers('SDN Kalibanteng Kulon 01');

        expect(users).toHaveLength(101);
        expect(users[users.length - 1]).toEqual(lastItem);
        expect(rpc).toHaveBeenLastCalledWith('admin_list_users', expect.objectContaining({
            page_size: 100,
            page_offset: 100,
            school_name: 'SDN Kalibanteng Kulon 01'
        }));
    });

    it.each([
        null,
        { items: 'not-an-array', total: 0, pageSize: 25, pageOffset: 0 },
        { items: [listItem({ status: 'owner' })], total: 1, pageSize: 25, pageOffset: 0 },
        { items: [listItem({ username: 7 })], total: 1, pageSize: 25, pageOffset: 0 },
        { items: [listItem({ totalStars: 31 })], total: 1, pageSize: 25, pageOffset: 0 },
        { items: [listItem({ jejakPandawaBestScore: 11 })], total: 1, pageSize: 25, pageOffset: 0 }
    ])('rejects a malformed list response %#', async (data) => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({ data, error: null })
        ));

        await expect(service.listUsers({})).rejects.toMatchObject({
            code: 'invalid_response'
        });
    });

    it('maps backend privilege denial without leaking database details', async () => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({
                data: null,
                error: { code: '42501', message: 'private.admin_users details' }
            })
        ));

        await expect(service.getSummary()).rejects.toMatchObject({
            code: 'access_denied',
            message: 'Akun tidak memiliki akses admin'
        });
    });

    it('requests detail by UUID and sorts exactly ten levels', async () => {
        const levels = Array.from({ length: 10 }, (_, index) => ({
            level: 10 - index,
            stars: index % 4,
            completed: index < 4,
            updatedAt: '2026-08-02T00:00:00.000Z'
        }));
        const rpc = vi.fn().mockResolvedValue({
            data: {
                user: { userId: USER_ID, displayName: 'Budi', username: 'budi' },
                levels,
                summary: {
                    completedLevelCount: 4,
                    totalStars: 6,
                    averageStars: 0.6,
                    grade: 'Awal Perjalanan',
                    jejakPandawaUnlocked: false,
                    jejakPandawaBestScore: 0
                }
            },
            error: null
        });

        const result = await new AdminDashboardService(makeBackend(rpc))
            .getUserProgress(USER_ID);

        expect(result.levels.map((level) => level.level))
            .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result.summary).toEqual({
            completedLevelCount: 4,
            totalStars: 6,
            averageStars: 0.6,
            grade: 'Awal Perjalanan',
            jejakPandawaUnlocked: false,
            jejakPandawaBestScore: 0
        });
        expect(rpc).toHaveBeenCalledWith('admin_get_user_progress', {
            target_user_id: USER_ID
        });
    });

    it('rejects an invalid target UUID before calling the backend', async () => {
        const rpc = vi.fn();

        await expect(new AdminDashboardService(makeBackend(rpc))
            .getUserProgress('<script>')).rejects.toMatchObject({
            code: 'invalid_response'
        });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('rejects detail unless it contains exactly levels 1 through 10', async () => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({
                data: {
                    user: { userId: USER_ID, displayName: 'Budi', username: 'budi' },
                    levels: Array.from({ length: 9 }, (_, index) => ({
                        level: index + 1,
                        stars: 0,
                        completed: false,
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    }))
                },
                error: null
            })
        ));

        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({
            code: 'invalid_response'
        });
    });

    it('maps a missing player detail to a safe not-found contract', async () => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'P0002', status: 404, message: 'internal row detail' }
            })
        ));

        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({
            code: 'not_found',
            message: 'Data pemain tidak ditemukan.'
        });
    });

    it('rejects a report response without its progress summary', async () => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({
                data: {
                    user: { userId: USER_ID, displayName: 'Budi', username: 'budi' },
                    levels: Array.from({ length: 10 }, (_, index) => ({
                        level: index + 1,
                        stars: 0,
                        completed: false,
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    }))
                },
                error: null
            })
        ));

        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({
            code: 'invalid_response'
        });
    });

    it('rejects out-of-range values in a report response', async () => {
        const service = new AdminDashboardService(makeBackend(
            vi.fn().mockResolvedValue({
                data: {
                    user: { userId: USER_ID, displayName: 'Budi', username: 'budi' },
                    levels: Array.from({ length: 10 }, (_, index) => ({
                        level: index + 1,
                        stars: index === 4 ? 4 : 0,
                        completed: false,
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    })),
                    summary: {
                        completedLevelCount: 0,
                        totalStars: 0,
                        averageStars: 0,
                        grade: 'Awal Perjalanan',
                        jejakPandawaUnlocked: false,
                        jejakPandawaBestScore: 0
                    }
                },
                error: null
            })
        ));

        await expect(service.getUserProgress(USER_ID)).rejects.toMatchObject({
            code: 'invalid_response'
        });
    });
});
