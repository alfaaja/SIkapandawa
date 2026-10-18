// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createAdminMockBackend } from './mocks/AdminMockBackend';
import { AdminDashboardService } from './services/AdminDashboardService';
import { AdminDashboardController } from './controllers/AdminDashboardController';
import { DashboardView, type DashboardCallbacks } from './ui/DashboardView';
import { ProgressCharts } from './ui/ProgressCharts';
import type { AdminUserListItem } from './types';

const SCHOOL = 'SDN Kalibanteng Kulon 01';
function student(schoolName: string, totalStars: number, jejakPandawaBestScore: number, userId: string = crypto.randomUUID()): AdminUserListItem {
    return { userId, schoolName, displayName: userId, username: userId,
        registeredAt: '2026-08-01T00:00:00Z', highestUnlockedLevel: 1,
        completedLevelCount: 0, totalStars, jejakPandawaBestScore,
        jejakPandawaUnlocked: false, progressUpdatedAt: '2026-08-01T00:00:00Z', status: 'not_started' };
}

describe('school dashboard', () => {
    it('filters summary and paginated search by school without losing other school choices', async () => {
        const backend = createAdminMockBackend();
        const service = new AdminDashboardService(backend);
        expect((await service.getSummary()).schools).toEqual([SCHOOL]);
        await backend.invokeAdminFunction('create', {
            displayName: 'Siswa Uji', username: 'sekolah.baru',
            password: crypto.randomUUID(), schoolName: 'SDN Sekolah Kedua'
        });
        const all = await service.getSummary();
        const summary = await service.getSummary(SCHOOL);
        const list = await service.listUsers({ schoolName: SCHOOL, pageSize: 100 });
        expect(all.schools.length).toBeGreaterThan(1);
        expect(summary.schools).toEqual(all.schools);
        expect(summary.totalUsers).toBe(list.total);
        expect(summary.totalUsers).toBeLessThan(all.totalUsers);
        expect(list.items.every(user => user.schoolName === SCHOOL)).toBe(true);
        const searched = await service.listUsers({ schoolName: SCHOOL, searchText: 'arjuna', pageSize: 100 });
        expect(searched.items.every(user => user.schoolName === SCHOOL && user.username.includes('arjuna'))).toBe(true);
        expect((await service.listChartUsers(SCHOOL)).length).toBe(list.total);
    });

    it('uses all students, including zero scores, for two averages per school and excludes the admin', () => {
        const charts = new ProgressCharts('admin-id', 'admin');
        charts.render([student(SCHOOL, 30, 10), student(SCHOOL, 0, 0),
            student('SDN Sekolah Kedua', 6, 4), student(SCHOOL, 30, 10, 'admin-id')], null);
        const bars = [...charts.element.querySelectorAll<HTMLElement>('.school-chart-bar')];
        expect(bars).toHaveLength(4);
        expect(bars.map(bar => bar.style.getPropertyValue('--bar-height'))).toEqual(['50%', '50%', '20%', '40%']);
        expect(charts.element.textContent).toContain('15/30');
        expect(charts.element.textContent).toContain('5/10');
        expect(charts.element.textContent).toContain('2 siswa');
        expect(charts.element.querySelector<HTMLButtonElement>('[data-testid="chart-name-mode"]')!.hidden).toBe(true);
    });

    it('restores the original student charts for a selected school and safely handles empty schools', () => {
        const charts = new ProgressCharts(null, 'admin');
        charts.render([student(SCHOOL, 30, 10), student('Other', 0, 0)], SCHOOL);
        expect(charts.element.querySelectorAll('.chart-bar')).toHaveLength(2);
        expect(charts.element.querySelectorAll('.school-chart-bar')).toHaveLength(0);
        charts.render([], null);
        expect(charts.element.textContent).toContain('Belum ada data siswa');
    });

    it('excludes every server-marked admin from school averages regardless of viewer', () => {
        const users = [student(SCHOOL, 30, 10), student(SCHOOL, 0, 0),
            { ...student(SCHOOL, 30, 10, 'other-admin'), isAdmin: true }];
        const charts = new ProgressCharts('viewer-admin', 'admin');
        charts.render(users);
        expect(charts.element.textContent).toContain('15/30');
        expect(charts.element.textContent).toContain('2 siswa');
    });

    it('renders school names as text and keeps fractions for averages', () => {
        const charts = new ProgressCharts(null, 'admin');
        charts.render([student('<img src=x onerror=alert(1)>', 1, 1), student('<img src=x onerror=alert(1)>', 0, 0)], null);
        expect(charts.element.querySelector('img')).toBeNull();
        expect(charts.element.textContent).toContain('0,5/30');
        expect(charts.element.textContent).toContain('0,5/10');
    });

    it('starts at All, retains selection across refreshes, and lists the school in student rows', () => {
        const root = document.createElement('div');
        const onSchool = vi.fn();
        const view = new DashboardView(root, { onSchool } as unknown as DashboardCallbacks);
        view.renderShell();
        const summary = { totalUsers: 1, notStartedUsers: 1, inProgressUsers: 0, completedUsers: 0,
            totalStarsEarned: 0, generatedAt: '2026-08-01T00:00:00Z', schools: [SCHOOL, 'Other'] };
        const list = { items: [student(SCHOOL, 0, 0)], total: 1, pageSize: 25, pageOffset: 0 };
        view.renderData(summary, list, list.items, null);
        const select = root.querySelector<HTMLSelectElement>('#school-filter')!;
        expect(select.value).toBe('');
        expect(select.options[0]!.textContent).toBe('All');
        select.value = SCHOOL;
        select.dispatchEvent(new Event('change'));
        expect(onSchool).toHaveBeenCalledWith(SCHOOL);
        view.renderData(summary, list, list.items, SCHOOL);
        expect(select.value).toBe(SCHOOL);
        expect(root.querySelector('tbody')!.textContent).toContain(SCHOOL);
    });

    it('resets pagination and scopes every request when selecting a school', async () => {
        const service = { getSummary: vi.fn().mockResolvedValue({}),
            listUsers: vi.fn().mockResolvedValue({ items: [], total: 100 }), listChartUsers: vi.fn().mockResolvedValue([]),
            getMonitoringPeriods: vi.fn().mockResolvedValue([]), getAspectAverages: vi.fn().mockResolvedValue([]), getMonitoringSummary: vi.fn().mockResolvedValue([]) };
        const view = { showLoading: vi.fn(), renderData: vi.fn(), renderAspectData: vi.fn(), renderMonitoringSummary: vi.fn(), renderTeacherMonitoringSummary: vi.fn(), renderMonitoringPeriods: vi.fn(), closeMonitoring: vi.fn(), showError: vi.fn() };
        const controller = new AdminDashboardController(service as never, view as never, vi.fn());
        await controller.refresh();
        controller.nextPage();
        await vi.waitFor(() => expect(service.listUsers).toHaveBeenCalledTimes(2));
        controller.setSchool(SCHOOL);
        await vi.waitFor(() => expect(view.renderData).toHaveBeenLastCalledWith({}, expect.anything(), [], SCHOOL));
        expect(service.getSummary).toHaveBeenLastCalledWith(SCHOOL);
        expect(service.listChartUsers).toHaveBeenLastCalledWith(SCHOOL);
        expect(service.getAspectAverages).toHaveBeenLastCalledWith(SCHOOL);
        expect(service.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ schoolName: SCHOOL, pageOffset: 0 }));
    });
});
