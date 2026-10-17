import { MonitoringHistoryView } from '../../shared/ui/MonitoringHistoryView';
import type { MonitoringHistory, MonitoringSchool } from '../../shared/monitoring';
import type { AdminUserIdentity } from '../types';
import { MonitoringCharts } from './MonitoringCharts';
import { createElement, replaceContent } from './dom';
export class MonitoringDialog {
    private readonly dialog = createElement('dialog', { className: 'progress-dialog monitoring-dialog', attributes: { 'aria-label': 'Monitoring siswa' } });
    private readonly content = createElement('div', { className: 'dialog-content' });
    constructor() { this.dialog.append(this.content); this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.close(); }); }
    mount(parent: HTMLElement): void { parent.append(this.dialog); }
    private paint(title: string, ...children: HTMLElement[]) {
        const close = createElement('button', { className: 'button button-secondary', text: 'Tutup monitoring', attributes: { type: 'button' } });
        close.addEventListener('click', () => this.close());
        replaceContent(this.content, createElement('h2', { text: title }), close, ...children);
        if (!this.dialog.open) this.dialog.showModal(); close.focus();
    }
    showLoading(): void { this.paint('Memuat monitoring siswa…'); }
    showError(): void { if (this.dialog.open) this.paint('Monitoring belum dapat dimuat. Coba lagi.'); }
    show(user: AdminUserIdentity, history: MonitoringHistory, schools: MonitoringSchool[], loadMore: (offset: number) => Promise<MonitoringHistory>): void {
        if (!this.dialog.open) return;
        const charts = new MonitoringCharts(); charts.render(schools);
        const records = new MonitoringHistoryView(); records.render(history, loadMore);
        this.paint('Monitoring ' + user.displayName + ' · @' + user.username, charts.element, records.element);
    }
    close(): void { if (this.dialog.open) this.dialog.close(); }
}
