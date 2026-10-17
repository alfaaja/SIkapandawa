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
