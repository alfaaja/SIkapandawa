// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { MonitoringDialog } from './MonitoringDialog';
beforeEach(() => Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
    close: { configurable: true, value() { this.removeAttribute('open'); } }
}));
it('does not reopen a dismissed loading dialog on a late error or success', () => {
    const root = document.createElement('main'); const dialog = new MonitoringDialog(); dialog.mount(root);
    dialog.showLoading(); dialog.close(); dialog.showError();
    expect(root.querySelector('dialog')!.open).toBe(false);
    dialog.show({ userId: 'id', displayName: 'Budi', username: 'budi' }, { items: [], total: 0, pageOffset: 0, pageSize: 25 }, [], async () => ({ items: [], total: 0, pageOffset: 0, pageSize: 25 }));
    expect(root.querySelector('dialog')!.open).toBe(false);
});
it('shows student history and a recoverable error while open, and supports both close controls', () => {
    const root = document.createElement('main'); const dialog = new MonitoringDialog(); dialog.mount(root);
    const emptyHistory = { items: [], total: 0, pageOffset: 0, pageSize: 25 };
    dialog.showLoading();
    dialog.show({ userId: 'id', displayName: '<Budi>', username: 'budi' }, emptyHistory, [], async () => emptyHistory);
    expect(root.querySelector('h2')?.textContent).toBe('Monitoring <Budi> · @budi');
    expect(root.querySelector('budi')).toBeNull();
    expect(root.textContent).toContain('Riwayat monitoring (0 catatan)');
    root.querySelector('button')!.click();
    expect(root.querySelector('dialog')!.open).toBe(false);
    dialog.showLoading(); dialog.showError();
    expect(root.querySelector('dialog')!.open).toBe(true);
    expect(root.textContent).toContain('Monitoring belum dapat dimuat. Coba lagi.');
    root.querySelector('dialog')!.click();
    expect(root.querySelector('dialog')!.open).toBe(false);
});
it('separates parent and teacher charts and explains draft forward-chaining decisions', () => {
    const root = document.createElement('main'); const dialog = new MonitoringDialog(); dialog.mount(root);
    const history = { items: [], total: 0, pageOffset: 0, pageSize: 25 }; dialog.showLoading();
    dialog.show({ userId: 'student', displayName: 'Siswa', username: 'siswa' }, history, [], async () => history, {
        teacherHistory: history, teacherSchools: [], loadTeacherMore: async () => history,
        comparison: { ruleVersion: 'draft-1', periodPolicy: 'same-point-monitoring-period', cells: Array.from({ length: 6 }, (_, i) => ({
            pointNumber: i + 1, period: 'periode 1', aspect: 'kejujuran', parentAverage: 4, teacherAverage: i < 3 ? 2 : 4, parentCount: 1, teacherCount: 1
        })) }
    });
    expect(root.querySelectorAll('[data-reporter="parent"]')).toHaveLength(1); expect(root.querySelectorAll('[data-reporter="teacher"]')).toHaveLength(1);
    expect(root.textContent).toContain('Monitoring guru'); expect(root.textContent).toContain('Perlu klarifikasi');
    expect(root.textContent).toContain('6/12 titik berpasangan'); expect(root.textContent).toContain('R3: minimal 3 titik');
    expect(root.querySelectorAll('.comparison-card')).toHaveLength(5); expect(root.textContent).toContain('draft-1');
    expect(root.textContent).toContain('Titik 12: belum ada pasangan pengamatan');
});
