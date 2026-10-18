// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminServiceError } from '../services/errors';
import type { AdminUserListResponse, DashboardSummary } from '../types';
import { AdminDashboardController } from './AdminDashboardController';

const summary: DashboardSummary = {
    schools: ['SDN Kalibanteng Kulon 01'],
    totalUsers: 1,
    notStartedUsers: 1,
    inProgressUsers: 0,
    completedUsers: 0,
    totalStarsEarned: 0,
    generatedAt: '2026-08-10T00:00:00.000Z'
};

const emptyList: AdminUserListResponse = {
    items: [],
    total: 0,
    pageSize: 25,
    pageOffset: 0
};

function withChartUsers<T extends Record<string, unknown>>(service: T): T & {
    listChartUsers: ReturnType<typeof vi.fn>;
    getMonitoringSummary: ReturnType<typeof vi.fn>;
    getAspectAverages: ReturnType<typeof vi.fn>;
    getMonitoringPeriods: ReturnType<typeof vi.fn>;
} {
    return {
        ...service,
        getMonitoringPeriods: vi.fn().mockResolvedValue([]),
        getAspectAverages: vi.fn().mockResolvedValue([]),
        getMonitoringSummary: vi.fn().mockResolvedValue([]),
        listChartUsers: vi.fn().mockResolvedValue(emptyList.items)
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function makeView() {
    return {
        showLoading: vi.fn(),
        showOffline: vi.fn(),
        showError: vi.fn(),
        showChartError: vi.fn(),
        renderData: vi.fn(),
        renderAspectData: vi.fn(),
        renderMonitoringSummary: vi.fn(),
        renderTeacherMonitoringSummary: vi.fn(),
        renderMonitoringPeriods: vi.fn(),
        closeMonitoring: vi.fn(),
        showMonitoringLoading: vi.fn(),
        showMonitoring: vi.fn(),
        showMonitoringError: vi.fn(),
        showProgressLoading: vi.fn(),
        showProgress: vi.fn(),
        showProgressError: vi.fn()
    };
}

describe('AdminDashboardController', () => {
    it('keeps parent data available when the teacher summary fails independently',async()=>{
        const service=withChartUsers({getSummary:vi.fn().mockResolvedValue(summary),listUsers:vi.fn().mockResolvedValue(emptyList)});
        service.getMonitoringSummary.mockImplementation((_school:unknown,_user:unknown,reporter:string)=>reporter==='teacher'?Promise.reject(new Error('teacher unavailable')):Promise.resolve([]));
        const view=makeView(); await new AdminDashboardController(service as never,view as never,vi.fn()).refresh();
        expect(view.renderMonitoringSummary).toHaveBeenCalledWith([]);
        expect(view.renderTeacherMonitoringSummary).toHaveBeenCalledWith(null);
        expect(view.showError).not.toHaveBeenCalled();
    });
    it('uses one normalized monitoring period and keeps deferred history callbacks pinned to that period', async () => {
        const history={items:[],total:0,pageOffset:0,pageSize:25};
        const service={...withChartUsers({getSummary:vi.fn().mockResolvedValue(summary),listUsers:vi.fn().mockResolvedValue(emptyList)}),
            getMonitoringHistory:vi.fn().mockResolvedValue(history),getMonitoringComparison:vi.fn().mockResolvedValue({ruleVersion:'draft-1',periodPolicy:'same-point-monitoring-period',cells:[]})};
        const view=makeView(); const controller=new AdminDashboardController(service as never,view as never,vi.fn());
        controller.setMonitoringPeriod(' Periode   Kedua ');
        await vi.waitFor(()=>expect(view.renderMonitoringSummary).toHaveBeenCalled());
        expect(service.getMonitoringSummary).toHaveBeenCalledWith(null,null,'teacher','periode kedua');
        await controller.showMonitoring({userId:'student',displayName:'Siswa',username:'siswa'});
        const args=view.showMonitoring.mock.calls[0];
        await args[3](25); await args[4].loadTeacherMore(25);
        expect(service.getMonitoringHistory).toHaveBeenCalledWith('student',25,'parent','periode kedua');
        expect(service.getMonitoringHistory).toHaveBeenCalledWith('student',25,'teacher','periode kedua');
        controller.setMonitoringPeriod('x'); expect(view.showError).toHaveBeenCalledWith('Periode monitoring harus 2–80 karakter.',expect.any(Function));
    });
    it('ignores monitoring results from an earlier student and invalidates them on school changes', async () => {
        const old = deferred<unknown>();
        const recent = deferred<unknown>();
        const history = { items: [], total: 0, pageSize: 25, pageOffset: 0 };
        const comparison = { ruleVersion: 'draft-1', periodPolicy: 'same-point-monitoring-period', cells: [] };
        const service = { getMonitoringHistory: vi.fn().mockImplementation((id: string, _offset: number, reporter: string) => reporter === 'teacher' ? Promise.resolve(history) : id === 'a' ? old.promise : recent.promise), getMonitoringSummary: vi.fn().mockResolvedValue([]), getMonitoringComparison: vi.fn().mockResolvedValue(comparison) };
        const view = makeView();
        const controller = new AdminDashboardController(service as never, view as never, vi.fn());
        const a = { userId: 'a', displayName: 'A', username: 'aaa' };
        const b = { userId: 'b', displayName: 'B', username: 'bbb' };
        const first = controller.showMonitoring(a);
        const second = controller.showMonitoring(b);
        recent.resolve(history); await second;
        old.resolve(history); await first;
        expect(view.showMonitoring).toHaveBeenCalledTimes(1);
        expect(view.showMonitoring).toHaveBeenCalledWith(b, history, [], expect.any(Function), expect.objectContaining({ comparison }));
    });
    it('renders a monitoring error when the history request fails', async () => {
        const service = { getMonitoringHistory: vi.fn().mockRejectedValue(new Error('offline')), getMonitoringSummary: vi.fn().mockResolvedValue([]) };
        const view = makeView();
        const controller = new AdminDashboardController(service as never, view as never, vi.fn());
        await controller.showMonitoring({ userId: 'a', displayName: 'A', username: 'aaa' });
        expect(view.showMonitoringError).toHaveBeenCalledOnce();
    });
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('prevents an older list request from overwriting a newer result', async () => {
        const first = deferred<AdminUserListResponse>();
        const second = deferred<AdminUserListResponse>();
        const newerList = { ...emptyList, total: 2 };
        const service = withChartUsers({
            getSummary: vi.fn().mockResolvedValue(summary),
            listUsers: vi.fn()
                .mockReturnValueOnce(first.promise)
                .mockReturnValueOnce(second.promise),
            getUserProgress: vi.fn()
        });
        const view = makeView();
        const controller = new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        );

        const olderRefresh = controller.refresh();
        const newerRefresh = controller.refresh();
        second.resolve(newerList);
        await newerRefresh;
        first.resolve(emptyList);
        await olderRefresh;

        expect(view.renderData).toHaveBeenCalledTimes(1);
        expect(view.renderData).toHaveBeenCalledWith(summary, newerList, emptyList.items, null);
    });

    it('debounces search and resets server pagination', async () => {
        vi.useFakeTimers();
        const service = withChartUsers({
            getSummary: vi.fn().mockResolvedValue(summary),
            listUsers: vi.fn().mockResolvedValue(emptyList),
            getUserProgress: vi.fn()
        });
        const controller = new AdminDashboardController(
            service as never,
            makeView() as never,
            vi.fn()
        );

        controller.setSearch('bu');
        controller.setSearch('budi');
        await vi.advanceTimersByTimeAsync(299);
        expect(service.listUsers).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(service.listUsers).toHaveBeenCalledOnce();
        expect(service.listUsers).toHaveBeenCalledWith(expect.objectContaining({
            searchText: 'budi',
            pageOffset: 0,
            pageSize: 25
        }));
    });

    it('shows an offline retry state without requesting data', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const service = withChartUsers({
            getSummary: vi.fn(),
            listUsers: vi.fn(),
            getUserProgress: vi.fn()
        });
        const view = makeView();

        await new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        ).refresh();

        expect(view.showOffline).toHaveBeenCalledOnce();
        expect(service.getSummary).not.toHaveBeenCalled();
        expect(service.listUsers).not.toHaveBeenCalled();
    });

    it('returns to login when the database reports an expired session', async () => {
        const service = withChartUsers({
            getSummary: vi.fn().mockRejectedValue(new AdminServiceError('session_expired')),
            listUsers: vi.fn().mockResolvedValue(emptyList),
            getUserProgress: vi.fn()
        });
        const onSessionExpired = vi.fn();

        await new AdminDashboardController(
            service as never,
            makeView() as never,
            onSessionExpired
        ).refresh();

        expect(onSessionExpired).toHaveBeenCalledOnce();
    });

    it('keeps summary and player data usable when chart loading fails', async () => {
        const service = withChartUsers({
            getSummary: vi.fn().mockResolvedValue(summary),
            listUsers: vi.fn().mockResolvedValue(emptyList),
            getUserProgress: vi.fn()
        });
        service.listChartUsers.mockRejectedValue(new Error('Chart gagal'));
        const view = makeView();

        await new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        ).refresh();

        expect(view.renderData).toHaveBeenCalledWith(summary, emptyList, [], null);
        expect(view.showChartError).toHaveBeenCalledWith(
            'Grafik capaian tidak dapat dimuat.'
        );
        expect(view.showError).not.toHaveBeenCalled();
    });

    it('renders a retryable service error and retries through the supplied callback', async () => {
        const service = withChartUsers({
            getSummary: vi.fn()
                .mockRejectedValueOnce(new Error('Gagal sementara'))
                .mockResolvedValueOnce(summary),
            listUsers: vi.fn().mockResolvedValue(emptyList),
            getUserProgress: vi.fn()
        });
        const view = makeView();
        const controller = new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        );

        await controller.refresh();
        expect(view.showError).toHaveBeenCalledWith(
            'Gagal sementara',
            expect.any(Function)
        );
        const retry = view.showError.mock.calls[0]?.[1] as () => void;
        retry();
        await vi.waitFor(() => expect(view.renderData).toHaveBeenCalledOnce());
    });

    it('resets pagination for a filter and navigates only within result bounds', async () => {
        const list = { ...emptyList, total: 60 };
        const service = withChartUsers({
            getSummary: vi.fn().mockResolvedValue(summary),
            listUsers: vi.fn().mockResolvedValue(list),
            getUserProgress: vi.fn()
        });
        const controller = new AdminDashboardController(
            service as never,
            makeView() as never,
            vi.fn()
        );

        controller.nextPage();
        expect(service.listUsers).not.toHaveBeenCalled();
        await controller.refresh();
        controller.nextPage();
        await vi.waitFor(() => expect(service.listUsers).toHaveBeenCalledTimes(2));
        expect(service.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({
            pageOffset: 25
        }));
        controller.previousPage();
        await vi.waitFor(() => expect(service.listUsers).toHaveBeenCalledTimes(3));
        expect(service.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({
            pageOffset: 0
        }));
        controller.setFilter('completed');
        await vi.waitFor(() => expect(service.listUsers).toHaveBeenCalledTimes(4));
        expect(service.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({
            progressStatus: 'completed',
            pageOffset: 0
        }));
    });

    it('prevents an older detail request from replacing newer detail', async () => {
        const first = deferred<never>();
        const newer = {
            user: { userId: 'new', displayName: 'New', username: 'new' },
            levels: []
        };
        const service = {
            getSummary: vi.fn(),
            listUsers: vi.fn(),
            getUserProgress: vi.fn()
                .mockReturnValueOnce(first.promise)
                .mockResolvedValueOnce(newer)
        };
        const view = makeView();
        const controller = new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        );

        const olderRequest = controller.showDetail('old');
        await controller.showDetail('new');
        first.reject(new Error('old failure'));
        await olderRequest;

        expect(view.showProgress).toHaveBeenCalledOnce();
        expect(view.showProgress).toHaveBeenCalledWith(newer);
        expect(view.showProgressError).not.toHaveBeenCalled();
    });

    it('shows a safe detail error for the newest failed request', async () => {
        const service = {
            getSummary: vi.fn(),
            listUsers: vi.fn(),
            getUserProgress: vi.fn().mockRejectedValue(new Error('Detail gagal'))
        };
        const view = makeView();

        await new AdminDashboardController(
            service as never,
            view as never,
            vi.fn()
        ).showDetail('user-id');

        expect(view.showProgressLoading).toHaveBeenCalledOnce();
        expect(view.showProgressError).toHaveBeenCalledWith('Detail gagal');
    });
});
