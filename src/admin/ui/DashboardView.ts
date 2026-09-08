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
import { UserProgressDialog } from './UserProgressDialog';

export interface DashboardCallbacks {
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
    private readonly managementDialog: UserManagementDialog;

    constructor(
        private readonly root: HTMLElement,
        private readonly callbacks: DashboardCallbacks,
        private readonly adminUsername = 'admin',
        private readonly demoMode = false,
        private readonly adminUserId: string | null = null
    ) {
        this.progressCharts = new ProgressCharts(adminUserId, adminUsername);
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
        tableSection.append(this.status, this.createTable(), this.createPagination());
        content.append(this.summary, this.progressCharts.element, tableSection);
        main.append(header, content);
        replaceContent(this.root, main);
        this.progressDialog.mount(main);
        this.managementDialog.mount(main);
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
            text: `Masuk sebagai @${this.adminUsername}`
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
            text: 'Cari akun, buka rapor, atau kelola akses pemain.'
        }));
        const tools = createElement('div', { className: 'players-toolbar-group' });
        const addPlayer = createElement('button', {
            className: 'button button-primary add-player-button',
            text: 'Tambah pemain',
            attributes: { type: 'button', 'aria-label': 'Tambah pemain' }
        });
        addPlayer.addEventListener('click', () => this.managementDialog.showCreate());
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
            'Username', 'Nama tampilan', 'Terdaftar', 'Level', 'Selesai', 'Bintang',
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

    renderData(
        summary: DashboardSummary,
        list: AdminUserListResponse,
        chartUsers: readonly AdminUserListItem[] = list.items
    ): void {
        this.renderSummary(summary);
        this.progressCharts.render(chartUsers);
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

    showProgressError(message: string): void {
        this.progressDialog.showError(message);
    }

    showProgress(progress: Parameters<UserProgressDialog['show']>[0]): void {
        this.progressDialog.show(progress);
    }
}
