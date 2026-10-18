// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserListResponse, DashboardSummary } from '../types';
import { DashboardView, type DashboardCallbacks } from './DashboardView';

const summary: DashboardSummary = {
    schools: ['SDN Kalibanteng Kulon 01'],
    totalUsers: 1,
    notStartedUsers: 0,
    inProgressUsers: 1,
    completedUsers: 0,
    totalStarsEarned: 5,
    generatedAt: '2026-08-10T00:00:00.000Z'
};

function makeCallbacks(): DashboardCallbacks {
    return {
        onMonitoring: vi.fn(),
        onDetail: vi.fn(),
        onFilter: vi.fn(),
        onSchool: vi.fn(),
        onLogout: vi.fn(),
        onNextPage: vi.fn(),
        onPreviousPage: vi.fn(),
        onRefresh: vi.fn(),
        onSearch: vi.fn(),
        onCreateUser: vi.fn(),
        onEditUser: vi.fn(),
        onDeleteUser: vi.fn(),
        onResetPassword: vi.fn(),
        onChangeOwnPassword: vi.fn()
    } as DashboardCallbacks;
}

type SelfPasswordCallbacks = DashboardCallbacks & {
    onChangeOwnPassword(password: string): Promise<unknown>;
};

function listWithUsername(username: string): AdminUserListResponse {
    return {
        items: [{
            userId: '123e4567-e89b-42d3-a456-426614174000',
            displayName: '<script>bad()</script>',
            schoolName: 'SDN Kalibanteng Kulon 01',
            username,
            registeredAt: '2026-08-01T00:00:00.000Z',
            highestUnlockedLevel: 3,
            completedLevelCount: 2,
            totalStars: 5,
            jejakPandawaUnlocked: false,
            jejakPandawaBestScore: 0,
            progressUpdatedAt: '2026-08-02T00:00:00.000Z',
            status: 'in_progress'
        }],
        total: 1,
        pageSize: 25,
        pageOffset: 0
    };
}

describe('DashboardView', () => {
    beforeEach(() => {
        Object.defineProperties(HTMLDialogElement.prototype, {
            showModal: {
                configurable: true,
                value() { this.setAttribute('open', ''); }
            },
            close: {
                configurable: true,
                value() { this.removeAttribute('open'); }
            }
        });
    });

    it('renders malicious profile data only as visible text', () => {
        const root = document.createElement('div');
        const view = new DashboardView(root, makeCallbacks());
        view.renderShell();

        view.renderData(summary, listWithUsername('<img src=x onerror=alert(1)>'));

        expect(root.textContent).toContain('@<img src=x onerror=alert(1)>');
        expect(root.textContent).toContain('<script>bad()</script>');
        expect(root.querySelector('tbody img')).toBeNull();
        expect(root.querySelector('tbody script')).toBeNull();
        expect(root.querySelectorAll('.summary-card')).toHaveLength(4);
        expect(root.querySelector('.player-username')?.textContent)
            .toBe('@<img src=x onerror=alert(1)>');
    });

    it('wires semantic search, filter, navigation, refresh, logout, and detail actions', () => {
        const root = document.createElement('div');
        const callbacks = makeCallbacks();
        const view = new DashboardView(root, callbacks);
        view.renderShell();
        view.renderData(summary, listWithUsername('budi'));
        const search = root.querySelector<HTMLInputElement>('#player-search')!;
        const filter = root.querySelector<HTMLSelectElement>('#progress-filter')!;

        search.value = 'budi';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        filter.value = 'completed';
        filter.dispatchEvent(new Event('change', { bubbles: true }));
        root.querySelector<HTMLButtonElement>('tbody button')!.click();
        Array.from(root.querySelectorAll('button')).find(
            (button) => button.textContent === 'Segarkan'
        )!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        Array.from(root.querySelectorAll('button')).find(
            (button) => button.textContent === 'Keluar'
        )!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(callbacks.onSearch).toHaveBeenCalledWith('budi');
        expect(callbacks.onFilter).toHaveBeenCalledWith('completed');
        expect(callbacks.onDetail).toHaveBeenCalledWith(
            '123e4567-e89b-42d3-a456-426614174000'
        );
        expect(callbacks.onRefresh).toHaveBeenCalledOnce();
        expect(callbacks.onLogout).toHaveBeenCalledOnce();
    });

    it('renders loading, empty, offline, and retryable error states', () => {
        const root = document.createElement('div');
        const view = new DashboardView(root, makeCallbacks());
        const retry = vi.fn();
        view.renderShell();

        view.showLoading();
        expect(root.querySelector('[role="status"]')?.textContent).toContain('Memuat');
        view.showOffline(retry);
        expect(root.textContent).toContain('offline');
        Array.from(root.querySelectorAll('button')).find(
            (button) => button.textContent === 'Coba lagi'
        )!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(retry).toHaveBeenCalledOnce();
        view.renderData(summary, { items: [], total: 0, pageSize: 25, pageOffset: 0 });
        expect(root.textContent).toContain('Tidak ada pemain');
    });

    it('shows exactly ten progress levels and escapes profile text', () => {
        const root = document.createElement('div');
        const view = new DashboardView(root, makeCallbacks());
        view.renderShell();
        view.showProgressLoading();
        view.showProgress({
            user: {
                userId: '123e4567-e89b-42d3-a456-426614174000',
                displayName: '<img src=x>',
                username: '<admin>'
            },
            summary: {
                completedLevelCount: 3,
                totalStars: 6,
                averageStars: 0.6,
                grade: 'Awal Perjalanan',
                jejakPandawaUnlocked: true,
                jejakPandawaBestScore: 7
            },
            levels: Array.from({ length: 10 }, (_, index) => ({
                level: index + 1,
                stars: index % 4,
                completed: index < 3,
                updatedAt: '2026-08-02T00:00:00.000Z'
            }))
        });

        expect(root.querySelectorAll('.level-card')).toHaveLength(10);
        expect(root.textContent).toContain('<img src=x>');
        expect(root.querySelector('.dialog-content img')).toBeNull();
        expect(root.textContent).toContain('Total bintang');
        expect(root.textContent).toContain('6/30');
        expect(root.textContent).toContain('Awal Perjalanan');
        expect(root.textContent).toContain('Jejak Pandawa');
        expect(root.textContent).toContain('7/10');
        expect(root.textContent).toContain('Nilai terbaik: 0/3 bintang');
    });

    it('exposes visible user-management actions with player-specific accessible names', () => {
        const root = document.createElement('div');
        const callbacks = makeCallbacks() as DashboardCallbacks & Record<string, ReturnType<typeof vi.fn>>;
        const view = new DashboardView(root, callbacks);
        view.renderShell();
        view.renderData(summary, listWithUsername('budi'));

        const labels = Array.from(root.querySelectorAll('button'))
            .map((button) => button.getAttribute('aria-label') ?? button.textContent);
        expect(labels).toContain('Tambah pemain');
        expect(labels).toContain('Edit @budi');
        expect(labels).toContain('Hapus @budi');
        expect(labels).toContain('Reset password @budi');

        const actionCell = root.querySelector('td[data-label="Aksi"]');
        expect(actionCell?.classList.contains('row-actions')).toBe(false);
        expect(actionCell?.querySelector('.row-actions')?.children).toHaveLength(5);
    });

    it('explains inside the player panel when identities are demo data', () => {
        const root = document.createElement('div');
        const view = new DashboardView(root, makeCallbacks(), 'admin.demo', true);

        view.renderShell();

        const notice = root.querySelector('.players-panel .data-source-notice');
        expect(notice?.textContent).toContain('bukan akun database');
        expect(notice?.getAttribute('role')).toBe('note');
    });

    it('uses own-auth password change for the current admin and requires confirmation', async () => {
        const root = document.createElement('div');
        const callbacks = {
            ...makeCallbacks(),
            onChangeOwnPassword: vi.fn().mockResolvedValue(undefined)
        } as SelfPasswordCallbacks;
        const view = new DashboardView(root, callbacks, 'Sikapandawa');
        view.renderShell();
        view.renderData(summary, listWithUsername('Sikapandawa'));
        const passwordAction = Array.from(root.querySelectorAll<HTMLButtonElement>('tbody button'))
            .find((button) => button.textContent === 'Password')!;

        passwordAction.click();
        const fields = root.querySelectorAll<HTMLInputElement>('dialog input[type="password"]');
        const credential = crypto.randomUUID();
        fields[0]!.value = credential;
        fields[1]!.value = `${credential}-different`;
        root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await Promise.resolve();

        expect(callbacks.onChangeOwnPassword).not.toHaveBeenCalled();
        expect(callbacks.onResetPassword).not.toHaveBeenCalled();
        expect(root.querySelector('[role="alert"]')?.textContent).toContain('tidak sama');

        fields[1]!.value = credential;
        root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(callbacks.onChangeOwnPassword).toHaveBeenCalledOnce());

        expect(callbacks.onChangeOwnPassword).toHaveBeenCalledWith(credential);
        expect(callbacks.onResetPassword).not.toHaveBeenCalled();
        expect(root.textContent).not.toContain(credential);
    });

    it('uses own-auth password change when the restored admin username is unavailable', async () => {
        const root = document.createElement('div');
        const callbacks = {
            ...makeCallbacks(),
            onChangeOwnPassword: vi.fn().mockResolvedValue(undefined)
        } as SelfPasswordCallbacks;
        const view = new DashboardView(
            root,
            callbacks,
            'admin',
            false,
            '123e4567-e89b-42d3-a456-426614174000'
        );
        view.renderShell();
        view.renderData(summary, listWithUsername('Sikapandawa'));
        const passwordAction = Array.from(root.querySelectorAll<HTMLButtonElement>('tbody button'))
            .find((button) => button.textContent === 'Password')!;

        passwordAction.click();
        expect(root.querySelector('dialog h2')?.textContent)
            .toBe('Ganti password @Sikapandawa');

        const fields = root.querySelectorAll<HTMLInputElement>('dialog input[type="password"]');
        const credential = crypto.randomUUID();
        fields[0]!.value = credential;
        fields[1]!.value = credential;
        root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );

        await vi.waitFor(() => expect(callbacks.onChangeOwnPassword).toHaveBeenCalledWith(credential));
        expect(callbacks.onResetPassword).not.toHaveBeenCalled();
    });

    it('does not treat a different user id as the current admin based on username alone', () => {
        const root = document.createElement('div');
        const callbacks = makeCallbacks();
        const view = new DashboardView(
            root,
            callbacks,
            'Sikapandawa',
            false,
            'different-admin-id'
        );
        view.renderShell();
        view.renderData(summary, listWithUsername('Sikapandawa'));

        const passwordAction = Array.from(root.querySelectorAll<HTMLButtonElement>('tbody button'))
            .find((button) => button.textContent === 'Password')!;
        passwordAction.click();

        expect(root.querySelector('dialog h2')?.textContent)
            .toBe('Reset password @Sikapandawa');
    });

    it('shows only one dashboard section at a time and preserves it across data refresh', () => {
        const root = document.createElement('div'); document.body.append(root);
        const view = new DashboardView(root, makeCallbacks()); view.renderShell();
        expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Ringkasan');
        expect([...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter(panel => !panel.hidden)).toHaveLength(1);
        const students = root.querySelector<HTMLButtonElement>('#dashboard-tab-students')!;
        students.click(); view.renderData(summary, listWithUsername('budi'));
        expect(students.getAttribute('aria-selected')).toBe('true');
        expect(root.querySelector<HTMLElement>('#dashboard-panel-students')!.hidden).toBe(false);
        students.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Aspek');
        expect(document.activeElement?.id).toBe('dashboard-tab-aspects');
        root.remove();
    });

    it('locks the school selector and new-player scope to the verified school', () => {
        const root = document.createElement('div'); const callbacks = makeCallbacks();
        const view = new DashboardView(root, callbacks, 'kepala.sekolah', false, 'school-admin', { role: 'school', schoolName: 'Sekolah A' });
        view.renderShell(); view.renderData({ ...summary, schools: ['Sekolah A', 'Sekolah B'] }, listWithUsername('budi'));
        const selector = root.querySelector<HTMLSelectElement>('#school-filter')!;
        expect(selector.disabled).toBe(true); expect([...selector.options].map(option => option.value)).toEqual(['Sekolah A']);
        selector.dispatchEvent(new Event('change')); expect(callbacks.onSchool).not.toHaveBeenCalled();
        root.querySelector<HTMLButtonElement>('[aria-label="Tambah pemain"]')!.click();
        const schoolInput = root.querySelector<HTMLInputElement>('#create-school-name')!;
        expect(schoolInput.value).toBe('Sekolah A'); expect(schoolInput.readOnly).toBe(true);
    });

    it('exposes staff-account management only for a verified master with management callbacks', async () => {
        const callbacks = { ...makeCallbacks(), onCreateAdmin: vi.fn(), onListAdmins: vi.fn().mockResolvedValue([]) };
        const root = document.createElement('div');
        for (const role of ['school', 'forum'] as const) {
            new DashboardView(root, callbacks, 'Sikapandawa', false, 'id', { role, schoolName: 'Sekolah A' }).renderShell();
            expect([...root.querySelectorAll('button')].some(button => button.textContent === 'Kelola admin')).toBe(false);
        }
        new DashboardView(root, callbacks, 'Sikapandawa', false, 'id', { role: 'master', schoolName: null }).renderShell();
        [...root.querySelectorAll('button')].find(button => button.textContent === 'Kelola admin')!.click();
        await vi.waitFor(() => expect(callbacks.onListAdmins).toHaveBeenCalledOnce());
        expect(root.querySelector('#admin-access-title')?.textContent).toBe('Kelola admin');
    });

    it('applies an explicit monitoring period without changing the selected section', () => {
        const root = document.createElement('div');
        const callbacks = { ...makeCallbacks(), onMonitoringPeriod: vi.fn() };
        const view = new DashboardView(root, callbacks); view.renderShell();
        root.querySelector<HTMLButtonElement>('#dashboard-tab-monitoring')!.click();
        const period = root.querySelector<HTMLInputElement>('input#admin-monitoring-period')!;
        expect(period.type).toBe('number'); expect(period.value).toBe('1');
        view.renderMonitoringPeriods(['Siklus kedua', 'periode 2']);
        period.stepUp(); expect(period.value).toBe('2');
        root.querySelector('.monitoring-period-filter')!.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(callbacks.onMonitoringPeriod).toHaveBeenCalledWith('periode 2');
        expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Monitoring');
    });

    it('routes school teacher management edits through staff-specific callbacks', async () => {
        const teacher = { userId: 'teacher-id', username: 'guru.sekolah', displayName: 'Guru Sekolah', role: 'teacher' as const, schoolName: 'SDN Kalibanteng Kulon 01' };
        const callbacks = { ...makeCallbacks(), onCreateAdmin: vi.fn(), onListAdmins: vi.fn().mockResolvedValue([teacher]), onEditAdmin: vi.fn().mockResolvedValue({}), onResetAdminPassword: vi.fn(), onDeleteAdmin: vi.fn() };
        const root = document.createElement('div');
        new DashboardView(root, callbacks, 'kepala.sekolah', false, 'school-admin', { role: 'school', schoolName: teacher.schoolName }).renderShell();
        [...root.querySelectorAll('button')].find(button => button.textContent === 'Kelola guru')!.click();
        await vi.waitFor(() => expect(root.querySelector('[aria-label="Edit @guru.sekolah"]')).not.toBeNull());
        root.querySelector<HTMLButtonElement>('[aria-label="Edit @guru.sekolah"]')!.click();
        root.querySelector<HTMLInputElement>('#staff-edit-name')!.value = 'Guru Baru';
        root.querySelector('.admin-access-editor')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onEditAdmin).toHaveBeenCalledWith('teacher-id', expect.objectContaining({ displayName: 'Guru Baru' })));
        expect(callbacks.onEditUser).not.toHaveBeenCalled();
    });

    it('keeps historical periods accessible, rejects invalid numbers, and preserves numeric input on refresh', () => {
        const root = document.createElement('div');
        const callbacks = { ...makeCallbacks(), onMonitoringPeriod: vi.fn() };
        const view = new DashboardView(root, callbacks); view.renderShell();
        const period = root.querySelector<HTMLInputElement>('#admin-monitoring-period')!;
        const form = root.querySelector('form.monitoring-period-filter')!;
        for (const value of ['0', '-1', '1.5', '']) {
            period.value = value; form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
        expect(callbacks.onMonitoringPeriod).not.toHaveBeenCalled();
        period.value = '3'; view.renderMonitoringPeriods(['periode 3', 'Siklus kedua']); expect(period.value).toBe('3');
        const archive = root.querySelector<HTMLDetailsElement>('.period-archives')!; expect(archive.hidden).toBe(false);
        archive.querySelector('button')!.click(); expect(callbacks.onMonitoringPeriod).toHaveBeenLastCalledWith('siklus kedua');
        expect([...root.querySelectorAll('button')].some(button => button.textContent === 'Catatan lama')).toBe(false);
        expect(root.textContent).not.toContain('Menampilkan catatan lama');
        view.renderMonitoringPeriods(null); expect(period.value).toBe('3');
    });
});
