import type {
    AdminCreateUserInput,
    AdminUpdateUserInput,
    AdminUserIdentity,
    AdminUserListItem,
    AdminUserListResponse,
    DashboardSummary,
    ProgressStatusFilter
} from '../types';
import { validateUsername } from '../../shared/auth/username';
import { formatDateTime, formatStatus } from '../utils/formatters';
import { createElement, replaceContent } from './dom';
import { UserManagementDialog } from './UserManagementDialog';
import { ProgressCharts } from './ProgressCharts';
import { AspectCharts } from './AspectCharts';
import { MonitoringCharts } from './MonitoringCharts';
import { MonitoringDialog, type DualSourceMonitoring } from './MonitoringDialog';
import { createExpertOverview } from './MonitoringExpertView';
import type { MonitoringHistory, MonitoringSchool } from '../../shared/monitoring';
import { normalizeMonitoringPeriod, numberedMonitoringPeriod, monitoringPeriodNumber } from '../../shared/monitoring';
import type { SchoolAspectAverage } from '../../shared/game/characterAspects';
import { UserProgressDialog } from './UserProgressDialog';
import { AdminAccessDialog, type AdminAccessInput, type AdminAccessItem } from './AdminAccessDialog';

export interface DashboardAccess {
    role: 'master' | 'school' | 'forum';
    schoolName: string | null;
}

type DashboardTab = 'overview' | 'students' | 'aspects' | 'monitoring';

export interface DashboardCallbacks {
    onMonitoringPeriod?(period: string): void;
    onCreateAdmin?(input: AdminAccessInput): Promise<unknown>;
    onListAdmins?(): Promise<AdminAccessItem[]>;
    onEditAdmin?(userId: string, input: AdminUpdateUserInput): Promise<unknown>;
    onResetAdminPassword?(userId: string, password: string): Promise<unknown>;
    onDeleteAdmin?(userId: string, expectedUsername: string): Promise<unknown>;
    onMonitoring(user: AdminUserIdentity): void;
    onSchool(schoolName: string | null): void;
    onDetail(userId: string): void;
    onFilter(status: ProgressStatusFilter): void;
    onLogout(): void;
    onNextPage(): void;
    onPreviousPage(): void;
    onRefresh(): void;
    onSearch(searchText: string): void;
    onCreateUser(input: AdminCreateUserInput): Promise<unknown>;
    onEditUser(userId: string, input: AdminUpdateUserInput): Promise<unknown>;
    onDeleteUser(userId: string, expectedUsername: string): Promise<unknown>;
    onResetPassword(userId: string, password: string): Promise<unknown>;
    onChangeOwnPassword(password: string): Promise<unknown>;
}

const summaryCards: Array<[keyof DashboardSummary, string, string]> = [
    ['totalUsers', 'Total pemain', 'Semua akun terdaftar'],
    ['notStartedUsers', 'Belum mulai', 'Belum menyelesaikan level'],
    ['inProgressUsers', 'Sedang bermain', 'Progres Level 1–9'],
    ['completedUsers', 'Selesai', 'Menuntaskan 10 level']
];

export class DashboardView {
    private readonly schoolFilter = createElement('select', {
        attributes: { id: 'school-filter', 'aria-label': 'Sekolah' }
    });
    private readonly status = createElement('div', {
        className: 'status-banner',
        attributes: { role: 'status', 'aria-live': 'polite' }
    });
    private readonly summary = createElement('section', {
        className: 'summary-grid',
        attributes: { 'aria-label': 'Ringkasan pemain' }
    });
    private readonly tableBody = createElement('tbody');
    private readonly pageInfo = createElement('p', { className: 'page-info' });
    private readonly refreshedAt = createElement('span', { text: 'Belum diperbarui' });
    private readonly previousButton = createElement('button', {
        className: 'button button-secondary',
        text: 'Sebelumnya',
        attributes: { type: 'button' }
    });
    private readonly nextButton = createElement('button', {
        className: 'button button-secondary',
        text: 'Berikutnya',
        attributes: { type: 'button' }
    });
    private readonly progressDialog = new UserProgressDialog();
    private readonly progressCharts: ProgressCharts;
    private readonly aspectCharts = new AspectCharts();
    private readonly monitoringCharts = new MonitoringCharts();
    private readonly teacherMonitoringCharts = new MonitoringCharts();
    private readonly monitoringDialog = new MonitoringDialog();
    private readonly managementDialog: UserManagementDialog;
    private readonly accessDialog: AdminAccessDialog | null;
    private readonly tabPanels = new Map<DashboardTab, HTMLElement>();
    private readonly tabButtons = new Map<DashboardTab, HTMLButtonElement>();
    private selectedTab: DashboardTab = 'overview';
    private schools: string[] = [];
    private readonly periodFilter = createElement('input', { attributes: { id: 'admin-monitoring-period', type: 'number', inputmode: 'numeric', min: '1', step: '1', max: String(Number.MAX_SAFE_INTEGER), value: '1', required: '' } });
    private readonly periodHint = createElement('p', { className: 'muted' });
    private readonly periodArchives = createElement('details', { className: 'period-archives', attributes: { hidden: '' } });

    constructor(
        private readonly root: HTMLElement,
        private readonly callbacks: DashboardCallbacks,
        private readonly adminUsername = 'admin',
        private readonly demoMode = false,
        private readonly adminUserId: string | null = null,
        private readonly access: DashboardAccess = { role: 'forum', schoolName: null }
    ) {
        this.progressCharts = new ProgressCharts(adminUserId, adminUsername);
        this.accessDialog = ['master', 'school'].includes(access.role) && callbacks.onCreateAdmin && callbacks.onListAdmins
            ? new AdminAccessDialog({ onCreate: input => callbacks.onCreateAdmin!(input), onList: () => callbacks.onListAdmins!(),
                onUpdate: callbacks.onEditAdmin, onResetPassword: callbacks.onResetAdminPassword, onDelete: callbacks.onDeleteAdmin },
                access.role === 'school' ? access.schoolName : null) : null;
        this.managementDialog = new UserManagementDialog({
            onCreate: (input) => this.callbacks.onCreateUser(input),
            onUpdate: (userId, input) => this.callbacks.onEditUser(userId, input),
            onDelete: (userId, username) => this.callbacks.onDeleteUser(userId, username),
            onResetPassword: (userId, password) => (
                this.callbacks.onResetPassword(userId, password)
            ),
            onChangeOwnPassword: (password) => this.callbacks.onChangeOwnPassword(password),
            onChanged: async () => { this.callbacks.onRefresh(); }
        });
    }

    renderShell(): void {
        const main = createElement('main', { className: 'dashboard-shell' });
        const header = this.createHeader();
        const content = createElement('div', { className: 'dashboard-content' });
        const tableSection = createElement('section', {
            className: 'players-panel',
            attributes: { 'aria-labelledby': 'players-title' }
        });
        tableSection.append(this.createPlayersHeading());
        if (this.demoMode) {
            tableSection.append(createElement('aside', {
                className: 'data-source-notice',
                text: 'Data contoh — username di daftar ini bukan akun database Supabase. Data asli akan tampil setelah backend admin diaktifkan.',
                attributes: { role: 'note' }
            }));
        }
        tableSection.append(this.createTable(), this.createPagination());
        const overview = createElement('section', { className: 'dashboard-tab-panel' });
        overview.append(this.summary, this.progressCharts.element);
        const aspects = createElement('section', { className: 'dashboard-tab-panel' });
        aspects.append(this.aspectCharts.element);
        const monitoring = createElement('section', { className: 'dashboard-tab-panel' });
        const sources = createElement('div', { className: 'expert-source-charts' });
        sources.append(this.monitoringCharts.element, this.teacherMonitoringCharts.element);
        monitoring.append(createExpertOverview(() => {
            this.selectTab('students');
            this.tabPanels.get('students')?.focus();
        }), this.createMonitoringPeriodFilter(), sources);
        content.append(this.status, this.createNavigation([
            ['overview', 'Ringkasan', overview],
            ['students', 'Siswa', tableSection],
            ['aspects', 'Aspek', aspects],
            ['monitoring', 'Monitoring', monitoring]
        ]), overview, tableSection, aspects, monitoring);
        main.append(header, content);
        replaceContent(this.root, main);
        this.progressDialog.mount(main);
        this.monitoringDialog.mount(main);
        this.managementDialog.mount(main);
        this.accessDialog?.mount(main);
    }

    private createNavigation(tabs: Array<[DashboardTab, string, HTMLElement]>): HTMLElement {
        this.tabPanels.clear(); this.tabButtons.clear();
        const navigation = createElement('nav', { className: 'dashboard-navigation', attributes: { role: 'tablist', 'aria-label': 'Bagian panel admin' } });
        for (const [key, label, panel] of tabs) {
            const button = createElement('button', { className: 'dashboard-tab', text: label, attributes: { type: 'button', role: 'tab', id: `dashboard-tab-${key}`, 'aria-controls': `dashboard-panel-${key}` } });
            panel.id = `dashboard-panel-${key}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id); panel.tabIndex = 0;
            this.tabPanels.set(key, panel); this.tabButtons.set(key, button);
            button.addEventListener('click', () => this.selectTab(key));
            button.addEventListener('keydown', event => {
                const keys = tabs.map(([tab]) => tab);
                let index = keys.indexOf(key);
                if (event.key === 'ArrowRight') index = (index + 1) % keys.length;
                else if (event.key === 'ArrowLeft') index = (index - 1 + keys.length) % keys.length;
                else if (event.key === 'Home') index = 0;
                else if (event.key === 'End') index = keys.length - 1;
                else return;
                event.preventDefault(); this.selectTab(keys[index]); this.tabButtons.get(keys[index])?.focus();
            });
            navigation.append(button);
        }
        this.selectTab(this.selectedTab);
        return navigation;
    }

    private createMonitoringPeriodFilter(): HTMLElement {
        const form = createElement('form', { className: 'monitoring-period-filter' });
        const group = createElement('div', { className: 'field-group' });
        this.renderMonitoringPeriods([]);
        group.append(createElement('label', { text: 'Periode monitoring', attributes: { for: this.periodFilter.id } }), this.periodFilter);
        const submit = createElement('button', { className: 'button button-secondary', text: 'Terapkan periode', attributes: { type: 'submit' } });
        form.append(group, submit, this.periodHint, this.periodArchives);
        form.addEventListener('submit', event => {
            event.preventDefault(); if (!form.reportValidity()) return;
            try {
                const period = numberedMonitoringPeriod(this.periodFilter.value);
                this.periodFilter.value = String(monitoringPeriodNumber(period));
                this.periodHint.textContent = 'Grafik ortu dan guru memakai nomor periode yang sama.';
                this.callbacks.onMonitoringPeriod?.(period);
            } catch { this.periodFilter.setCustomValidity('Periode harus berupa bilangan bulat mulai dari 1.'); this.periodFilter.reportValidity(); }
        });
        this.periodFilter.addEventListener('input', () => this.periodFilter.setCustomValidity(''));
        return form;
    }

    renderMonitoringPeriods(periods: string[] | null): void {
        if (!this.periodHint.textContent) this.periodHint.textContent = 'Isi nomor periode yang sama dengan form guru dan orang tua. Gunakan panah kecil untuk menaikkan atau menurunkan angka.';
        if (periods !== null) {
            const named = [...new Set(periods.map(normalizeMonitoringPeriod))].filter(period => period !== 'legacy' && monitoringPeriodNumber(period) === null);
            replaceContent(this.periodArchives, createElement('summary', { text: 'Arsip periode dengan nama lama' }), ...named.map(period => {
                const button = createElement('button', { className: 'button button-secondary', text: period, attributes: { type: 'button' } });
                button.addEventListener('click', () => {
                    this.periodHint.textContent = 'Menampilkan arsip periode: ' + period;
                    this.callbacks.onMonitoringPeriod?.(period);
                });
                return button;
            }));
            this.periodArchives.hidden = named.length === 0;
        }
    }

    private selectTab(selected: DashboardTab): void {
        this.selectedTab = selected;
        for (const [key, panel] of this.tabPanels) panel.hidden = key !== selected;
        for (const [key, button] of this.tabButtons) {
            button.setAttribute('aria-selected', String(key === selected)); button.tabIndex = key === selected ? 0 : -1;
        }
    }

    private createHeader(): HTMLElement {
        const header = createElement('header', { className: 'dashboard-header' });
        const titleGroup = createElement('div');
        const eyebrow = createElement('p', { className: 'eyebrow', text: 'SIKAPANDAWA' });
        const title = createElement('h1', { text: 'Panel Admin' });
        const refreshCopy = createElement('p', { className: 'refresh-copy' });
        refreshCopy.append('Terakhir diperbarui: ', this.refreshedAt);
        const identity = createElement('p', {
            className: 'admin-identity',
            text: `@${this.adminUsername} · ${this.access.role === 'master' ? 'Admin master' : this.access.role === 'school' ? 'Admin sekolah' : 'Forum / dinas'}`
        });
        titleGroup.append(eyebrow, title, identity);
        if (this.demoMode) {
            titleGroup.append(createElement('p', {
                className: 'demo-notice',
                text: 'Mode demo • data contoh, bukan akun Supabase asli'
            }));
        }
        titleGroup.append(refreshCopy);
        const actions = createElement('div', { className: 'header-actions' });
        const schoolGroup = createElement('div', { className: 'field-group school-filter-group' });
        const schoolLabel = createElement('label', { text: 'Sekolah' });
        schoolLabel.htmlFor = 'school-filter';
        this.schoolFilter.append(createElement('option', { text: 'All', attributes: { value: '' } }));
        this.schoolFilter.addEventListener('change', () => {
            if (this.access.role === 'school') return;
            this.callbacks.onSchool(this.schoolFilter.value || null);
        });
        if (this.access.role === 'school') {
            replaceContent(this.schoolFilter, createElement('option', { text: this.access.schoolName ?? 'Sekolah belum ditetapkan', attributes: { value: this.access.schoolName ?? '' } }));
            this.schoolFilter.disabled = true;
        }
        schoolGroup.append(schoolLabel, this.schoolFilter);
        const changePassword = createElement('button', {
            className: 'button button-secondary',
            text: 'Ganti password saya',
            attributes: { type: 'button' }
        });
        const refresh = createElement('button', {
            className: 'button button-secondary',
            text: 'Segarkan',
            attributes: { type: 'button' }
        });
        const logout = createElement('button', {
            className: 'button button-quiet',
            text: 'Keluar',
            attributes: { type: 'button' }
        });
        changePassword.addEventListener('click', () => {
            this.managementDialog.showChangeOwnPassword(this.adminUsername);
        });
        refresh.addEventListener('click', this.callbacks.onRefresh);
        logout.addEventListener('click', this.callbacks.onLogout);
        actions.append(schoolGroup);
        if (this.accessDialog) {
            const manageAdmins = createElement('button', { className: 'button button-secondary', text: this.access.role === 'school' ? 'Kelola guru' : 'Kelola admin', attributes: { type: 'button' } });
            manageAdmins.addEventListener('click', () => { void this.accessDialog!.show(this.schools); });
            actions.append(manageAdmins);
        }
        actions.append(changePassword, refresh, logout);
        header.append(titleGroup, actions);
        return header;
    }

    private createPlayersHeading(): HTMLElement {
        const wrapper = createElement('div', { className: 'players-heading' });
        const headingGroup = createElement('div');
        const title = createElement('h2', { text: 'Daftar pemain' });
        title.id = 'players-title';
        headingGroup.append(title, createElement('p', {
            className: 'muted',
            text: 'Cari akun, buka rapor, atau pilih Monitoring untuk melihat analisis sistem pakar per siswa.'
        }));
        const tools = createElement('div', { className: 'players-toolbar-group' });
        const addPlayer = createElement('button', {
            className: 'button button-primary add-player-button',
            text: 'Tambah pemain',
            attributes: { type: 'button', 'aria-label': 'Tambah pemain' }
        });
        addPlayer.addEventListener('click', () => {
            this.managementDialog.showCreate();
            if (this.access.role === 'school') {
                const input = this.root.querySelector<HTMLInputElement>('#create-school-name');
                if (input) { input.value = this.access.schoolName ?? ''; input.readOnly = true; }
            }
        });
        tools.append(addPlayer, this.createToolbar());
        wrapper.append(headingGroup, tools);
        return wrapper;
    }

    private createToolbar(): HTMLElement {
        const toolbar = createElement('div', { className: 'toolbar' });
        const searchGroup = createElement('div', { className: 'field-group' });
        const searchLabel = createElement('label', { text: 'Cari pemain' });
        searchLabel.htmlFor = 'player-search';
        const search = createElement('input', {
            attributes: {
                id: 'player-search',
                type: 'search',
                placeholder: 'Nama atau username',
                maxlength: '80'
            }
        });
        search.addEventListener('input', () => this.callbacks.onSearch(search.value));
        searchGroup.append(searchLabel, search);

        const filterGroup = createElement('div', { className: 'field-group' });
        const filterLabel = createElement('label', { text: 'Status progres' });
        filterLabel.htmlFor = 'progress-filter';
        const filter = createElement('select', { attributes: { id: 'progress-filter' } });
        const options: Array<[ProgressStatusFilter, string]> = [
            ['all', 'Semua status'],
            ['not_started', 'Belum mulai'],
            ['in_progress', 'Sedang bermain'],
            ['completed', 'Selesai']
        ];
        for (const [value, label] of options) {
            filter.append(createElement('option', { text: label, attributes: { value } }));
        }
        filter.addEventListener('change', () => {
            this.callbacks.onFilter(filter.value as ProgressStatusFilter);
        });
        filterGroup.append(filterLabel, filter);
        toolbar.append(searchGroup, filterGroup);
        return toolbar;
    }

    private createTable(): HTMLElement {
        const region = createElement('div', {
            className: 'table-region',
            attributes: { tabindex: '0' }
        });
        const table = createElement('table');
        const caption = createElement('caption', {
            className: 'sr-only',
            text: 'Daftar akun pemain Sikapandawa dan ringkasan progres'
        });
        const thead = createElement('thead');
        const row = createElement('tr');
        for (const label of [
            'Username', 'Nama tampilan', 'Sekolah', 'Terdaftar', 'Level', 'Selesai', 'Bintang',
            'Jejak Pandawa', 'Update progres', 'Status', 'Aksi'
        ]) {
            row.append(createElement('th', { text: label, attributes: { scope: 'col' } }));
        }
        thead.append(row);
        table.append(caption, thead, this.tableBody);
        region.append(table);
        return region;
    }

    private createPagination(): HTMLElement {
        const pagination = createElement('nav', {
            className: 'pagination',
            attributes: { 'aria-label': 'Navigasi halaman pemain' }
        });
        this.previousButton.addEventListener('click', this.callbacks.onPreviousPage);
        this.nextButton.addEventListener('click', this.callbacks.onNextPage);
        pagination.append(this.previousButton, this.pageInfo, this.nextButton);
        return pagination;
    }

    showLoading(message = 'Memuat data pemain…'): void {
        this.status.className = 'status-banner status-loading';
        this.status.textContent = message;
        this.status.hidden = false;
    }

    showError(message: string, retry: () => void): void {
        this.status.className = 'status-banner status-error';
        const copy = createElement('span', { text: message });
        const button = createElement('button', {
            className: 'text-button',
            text: 'Coba lagi',
            attributes: { type: 'button' }
        });
        button.addEventListener('click', retry);
        replaceContent(this.status, copy, button);
        this.status.hidden = false;
    }

    showOffline(retry: () => void): void {
        this.showError('Panel sedang offline. Periksa koneksi internet Anda.', retry);
    }

    showChartError(message: string): void {
        this.progressCharts.showError(message);
    }

    renderAspectData(schools: SchoolAspectAverage[] | null): void {
        if (schools === null) this.aspectCharts.showError();
        else this.aspectCharts.render(schools);
    }

    renderData(
        summary: DashboardSummary,
        list: AdminUserListResponse,
        chartUsers: readonly AdminUserListItem[] = list.items,
        schoolName: string | null = null
    ): void {
        this.renderSummary(summary);
        const schools = [...new Set(summary.schools ?? chartUsers.map(user => user.schoolName))]
            .filter(Boolean).sort((left, right) => left.localeCompare(right, 'id'));
        this.schools = this.access.role === 'school' ? [this.access.schoolName ?? ''].filter(Boolean) : schools;
        replaceContent(this.schoolFilter,
            ...(this.access.role === 'school' ? [] : [createElement('option', { text: 'All', attributes: { value: '' } })]),
            ...this.schools.map(school => createElement('option', { text: school, attributes: { value: school } }))
        );
        this.schoolFilter.value = this.access.role === 'school' ? this.access.schoolName ?? '' : schoolName ?? '';
        this.progressCharts.render(chartUsers, this.access.role === 'school' ? this.access.schoolName : schoolName);
        this.renderUsers(list);
        this.refreshedAt.textContent = formatDateTime(summary.generatedAt);
        if (list.items.length === 0) {
            this.status.className = 'status-banner status-empty';
            this.status.textContent = 'Tidak ada pemain yang cocok dengan pencarian ini.';
            this.status.hidden = false;
        } else {
            this.status.hidden = true;
        }
    }

    private renderSummary(summary: DashboardSummary): void {
        const cards = summaryCards.map(([key, label, hint]) => {
            const card = createElement('article', { className: 'summary-card' });
            card.append(
                createElement('p', { className: 'summary-label', text: label }),
                createElement('strong', { className: 'summary-value', text: String(summary[key]) }),
                createElement('p', { className: 'summary-hint', text: hint })
            );
            return card;
        });
        replaceContent(this.summary, ...cards);
    }

    private renderUsers(list: AdminUserListResponse): void {
        const rows = list.items.map((user) => {
            const row = createElement('tr');
            const username = this.cell('Username');
            username.append(createElement('strong', {
                className: 'player-username',
                text: `@${user.username}`
            }));
            row.append(
                username,
                this.cell('Nama tampilan', user.displayName),
                this.cell('Sekolah', user.schoolName),
                this.cell('Terdaftar', formatDateTime(user.registeredAt)),
                this.cell('Level', String(user.highestUnlockedLevel)),
                this.cell('Selesai', `${user.completedLevelCount}/10`),
                this.cell('Bintang', `${user.totalStars}/30`),
                this.cell('Jejak Pandawa', user.jejakPandawaUnlocked
                    ? `Terbuka • ${user.jejakPandawaBestScore}/10`
                    : 'Terkunci'),
                this.cell('Update progres', formatDateTime(user.progressUpdatedAt))
            );
            const statusCell = this.cell('Status');
            statusCell.append(createElement('span', {
                className: `pill pill-${user.status.replace('_', '-')}`,
                text: formatStatus(user.status)
            }));
            const actionCell = this.cell('Aksi');
            actionCell.classList.add('action-cell');
            const actionGrid = createElement('div', { className: 'row-actions' });
            actionGrid.append(...this.userActions(user));
            actionCell.append(actionGrid);
            row.append(statusCell, actionCell);
            return row;
        });
        replaceContent(this.tableBody, ...rows);

        const currentPage = list.total === 0 ? 0 : Math.floor(list.pageOffset / list.pageSize) + 1;
        const totalPages = Math.ceil(list.total / list.pageSize);
        this.pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages} • ${list.total} pemain`;
        this.previousButton.disabled = list.pageOffset === 0;
        this.nextButton.disabled = list.pageOffset + list.pageSize >= list.total;
    }

    private userActions(user: AdminUserIdentity): HTMLButtonElement[] {
        const isCurrentAdmin = this.adminUserId !== null
            ? this.adminUserId === user.userId
            : validateUsername(user.username) === validateUsername(this.adminUsername);
        return [
            this.actionButton('Rapor', `Detail rapor @${user.username}`, () => {
                this.callbacks.onDetail(user.userId);
            }, 'button-secondary'),
            this.actionButton('Monitoring', `Monitoring @${user.username}`, () => this.callbacks.onMonitoring(this.identity(user)), 'button-secondary'),
            this.actionButton('Edit', `Edit @${user.username}`, () => {
                this.managementDialog.showEdit(this.identity(user));
            }),
            this.actionButton('Password', isCurrentAdmin
                ? `Ganti password @${user.username}`
                : `Reset password @${user.username}`, () => {
                if (isCurrentAdmin) {
                    this.managementDialog.showChangeOwnPassword(user.username);
                    return;
                }
                this.managementDialog.showResetPassword(this.identity(user));
            }),
            this.actionButton('Hapus', `Hapus @${user.username}`, () => {
                this.managementDialog.showDelete(this.identity(user));
            }, 'button-danger-quiet')
        ];
    }

    private actionButton(
        text: string,
        label: string,
        onClick: () => void,
        variant = 'button-quiet'
    ): HTMLButtonElement {
        const button = createElement('button', {
            className: `button button-compact ${variant}`,
            text,
            attributes: { type: 'button', 'aria-label': label }
        });
        button.addEventListener('click', onClick);
        return button;
    }

    private cell(label: string, text?: string): HTMLTableCellElement {
        return createElement('td', {
            ...(text === undefined ? {} : { text }),
            attributes: { 'data-label': label }
        });
    }

    private identity(user: AdminUserIdentity): AdminUserIdentity {
        return { userId: user.userId, displayName: user.displayName, username: user.username };
    }

    showProgressLoading(): void {
        this.progressDialog.showLoading();
    }

    renderMonitoringSummary(schools: MonitoringSchool[] | null, reporterType: 'parent' | 'teacher' = 'parent'): void {
        const charts = reporterType === 'teacher' ? this.teacherMonitoringCharts : this.monitoringCharts;
        if (schools === null) charts.showError(); else charts.render(schools, reporterType);
    }
    renderTeacherMonitoringSummary(schools: MonitoringSchool[] | null): void { this.renderMonitoringSummary(schools, 'teacher'); }
    showMonitoringLoading(): void { this.monitoringDialog.showLoading(); }
    showMonitoringError(): void { this.monitoringDialog.showError(); }
    showMonitoring(user: AdminUserIdentity, history: MonitoringHistory, schools: MonitoringSchool[], loadMore: (offset: number) => Promise<MonitoringHistory>, dual?: DualSourceMonitoring): void {
        this.monitoringDialog.show(user, history, schools, loadMore, dual);
    }
    closeMonitoring(): void { this.monitoringDialog.close(); }

    showProgressError(message: string): void {
        this.progressDialog.showError(message);
    }

    showProgress(progress: Parameters<UserProgressDialog['show']>[0]): void {
        this.progressDialog.show(progress);
    }
}
