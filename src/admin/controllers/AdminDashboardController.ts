import type { ProgressStatusFilter, AdminUserIdentity } from '../types';
import type { AdminDashboardService } from '../services/AdminDashboardService';
import { AdminServiceError } from '../services/errors';
import type { DashboardView } from '../ui/DashboardView';
import { normalizeMonitoringPeriod } from '../../shared/monitoring';

const SEARCH_DEBOUNCE_MS = 300;

export class AdminDashboardController {
    private searchText = '';
    private schoolName: string | null = null;
    private progressStatus: ProgressStatusFilter = 'all';
    private pageOffset = 0;
    private readonly pageSize = 25;
    private total = 0;
    private requestSequence = 0;
    private detailSequence = 0;
    private monitoringSequence = 0;
    private monitoringPeriod = 'periode 1';
    private searchTimer: number | undefined;

    constructor(
        private readonly service: AdminDashboardService,
        private readonly view: DashboardView,
        private readonly onSessionExpired: () => void
    ) {}

    async refresh(): Promise<void> {
        const sequence = ++this.requestSequence;
        if (!navigator.onLine) {
            this.view.showOffline(() => void this.refresh());
            return;
        }
        this.view.showLoading();
        try {
            const [summaryResult, listResult, chartResult, aspectResult, monitoringResult, teacherResult, periodsResult] = await Promise.allSettled([
                this.service.getSummary(this.schoolName),
                this.service.listUsers({
                    schoolName: this.schoolName,
                    searchText: this.searchText,
                    progressStatus: this.progressStatus,
                    pageSize: this.pageSize,
                    pageOffset: this.pageOffset
                }),
                this.service.listChartUsers(this.schoolName),
                this.service.getAspectAverages(this.schoolName),
                this.service.getMonitoringSummary(this.schoolName, null, 'parent', this.monitoringPeriod),
                this.service.getMonitoringSummary(this.schoolName, null, 'teacher', this.monitoringPeriod),
                this.service.getMonitoringPeriods()
            ]);
            if (sequence !== this.requestSequence) return;
            if (summaryResult.status === 'rejected') throw summaryResult.reason;
            if (listResult.status === 'rejected') throw listResult.reason;
            const summary = summaryResult.value;
            const list = listResult.value;
            const chartUsers = chartResult.status === 'fulfilled' ? chartResult.value : [];
            this.total = list.total;
            this.view.renderData(summary, list, chartUsers, this.schoolName);
            this.view.renderAspectData(aspectResult.status === 'fulfilled' ? aspectResult.value : null);
            this.view.renderMonitoringSummary(monitoringResult.status === 'fulfilled' ? monitoringResult.value : null);
            this.view.renderTeacherMonitoringSummary(teacherResult.status === 'fulfilled' ? teacherResult.value : null);
            this.view.renderMonitoringPeriods(periodsResult.status === 'fulfilled' ? periodsResult.value : null);
            if (chartResult.status === 'rejected') {
                this.view.showChartError('Grafik capaian tidak dapat dimuat.');
            }
        } catch (error) {
            if (sequence !== this.requestSequence) return;
            if (
                error instanceof AdminServiceError
                && (error.code === 'session_expired' || error.code === 'access_denied')
            ) {
                this.onSessionExpired();
                return;
            }
            const message = error instanceof Error
                ? error.message
                : 'Panel admin tidak dapat dimuat.';
            this.view.showError(message, () => void this.refresh());
        }
    }

    setSearch(searchText: string): void {
        window.clearTimeout(this.searchTimer);
        this.searchTimer = window.setTimeout(() => {
            this.searchText = searchText;
            this.pageOffset = 0;
            void this.refresh();
        }, SEARCH_DEBOUNCE_MS);
    }

    setFilter(progressStatus: ProgressStatusFilter): void {
        this.progressStatus = progressStatus;
        this.pageOffset = 0;
        void this.refresh();
    }

    setSchool(schoolName: string | null): void {
        ++this.monitoringSequence;
        this.view.closeMonitoring();
        this.schoolName = schoolName;
        this.pageOffset = 0;
        ++this.detailSequence;
        void this.refresh();
    }

    nextPage(): void {
        if (this.pageOffset + this.pageSize >= this.total) return;
        this.pageOffset += this.pageSize;
        void this.refresh();
    }

    setMonitoringPeriod(period: string): void {
        try { this.monitoringPeriod = normalizeMonitoringPeriod(period); }
        catch { this.view.showError('Periode monitoring harus 2–80 karakter.', () => void this.refresh()); return; }
        ++this.monitoringSequence;
        this.view.closeMonitoring();
        void this.refresh();
    }

    previousPage(): void {
        this.pageOffset = Math.max(0, this.pageOffset - this.pageSize);
        void this.refresh();
    }

    async showDetail(userId: string): Promise<void> {
        const sequence = ++this.detailSequence;
        this.view.showProgressLoading();
        try {
            const progress = await this.service.getUserProgress(userId);
            if (sequence === this.detailSequence) this.view.showProgress(progress);
        } catch (error) {
            if (sequence !== this.detailSequence) return;
            const message = error instanceof Error
                ? error.message
                : 'Detail progres tidak dapat dimuat.';
            this.view.showProgressError(message);
        }
    }

    async showMonitoring(user: AdminUserIdentity): Promise<void> {
        const sequence = ++this.monitoringSequence;
        const period = this.monitoringPeriod;
        this.view.showMonitoringLoading();
        try {
            const [history, summary, teacherHistory, teacherSchools, comparison] = await Promise.all([
                this.service.getMonitoringHistory(user.userId, 0, 'parent', period), this.service.getMonitoringSummary(null, user.userId, 'parent', period),
                this.service.getMonitoringHistory(user.userId, 0, 'teacher', period), this.service.getMonitoringSummary(null, user.userId, 'teacher', period),
                this.service.getMonitoringComparison(user.userId, period)
            ]);
            if (sequence === this.monitoringSequence) this.view.showMonitoring(user, history, summary,
                offset => this.service.getMonitoringHistory(user.userId, offset, 'parent', period), {
                    teacherHistory, teacherSchools, comparison,
                    loadTeacherMore: offset => this.service.getMonitoringHistory(user.userId, offset, 'teacher', period)
                });
        } catch { if (sequence === this.monitoringSequence) this.view.showMonitoringError(); }
    }
}
