import { MonitoringHistoryView } from '../../shared/ui/MonitoringHistoryView';
import type { MonitoringHistory, MonitoringSchool } from '../../shared/monitoring';
import type { AdminUserIdentity } from '../types';
import { MonitoringCharts } from './MonitoringCharts';
import { createElement, replaceContent } from './dom';
import type { MonitoringComparison } from '../../shared/monitoringComparison';
import { createExpertAnalysis } from './MonitoringExpertView';
export interface DualSourceMonitoring {
    teacherHistory: MonitoringHistory; teacherSchools: MonitoringSchool[];
    loadTeacherMore: (offset: number) => Promise<MonitoringHistory>; comparison: MonitoringComparison;
}
export class MonitoringDialog {
    private readonly dialog = createElement('dialog', { className: 'progress-dialog monitoring-dialog', attributes: { 'aria-label': 'Monitoring siswa' } });
    private readonly content = createElement('div', { className: 'dialog-content' });
    constructor() { this.dialog.append(this.content); this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.close(); }); }
    mount(parent: HTMLElement): void { parent.append(this.dialog); }
    private paint(title: string, ...children: HTMLElement[]) {
        const close = createElement('button', { className: 'icon-button', text: '×', attributes: { type: 'button', 'aria-label': 'Tutup monitoring' } });
        close.addEventListener('click', () => this.close());
        const header = createElement('header', { className: 'dialog-header' });
        header.append(createElement('h2', { text: title }), close);
        replaceContent(this.content, header, ...children);
        if (!this.dialog.open) this.dialog.showModal(); close.focus();
    }
    showLoading(): void { this.paint('Memuat monitoring siswa…'); }
    showError(): void { if (this.dialog.open) this.paint('Monitoring belum dapat dimuat. Coba lagi.'); }
    show(user: AdminUserIdentity, history: MonitoringHistory, schools: MonitoringSchool[], loadMore: (offset: number) => Promise<MonitoringHistory>, dual?: DualSourceMonitoring): void {
        if (!this.dialog.open) return;
        const charts = new MonitoringCharts(); charts.render(schools);
        const records = new MonitoringHistoryView(); records.render(history, loadMore);
        const children: HTMLElement[] = [];
        if (dual) {
            const analysis = createExpertAnalysis(dual.comparison);
            if ([...history.items, ...dual.teacherHistory.items].some(item => [item.guardianName, item.situation, item.behavior].some(text => text.includes('[DATA UJI')))) {
                analysis.prepend(createElement('p', { className: 'expert-test-notice', text: 'DATA UJI terdeteksi · Riwayat yang dimuat memuat contoh pengujian, bukan pengamatan nyata.' }));
            } else if (history.total > history.items.length || dual.teacherHistory.total > dual.teacherHistory.items.length) {
                analysis.prepend(createElement('p', { className: 'expert-test-notice', text: 'Tinjau sumber data · Riwayat baru dimuat sebagian. Analisis mencakup seluruh catatan periode ini; periksa juga penandaan data uji di catatan sebelumnya.' }));
            }
            children.push(analysis);
            const teacherCharts = new MonitoringCharts(); teacherCharts.render(dual.teacherSchools, 'teacher');
            const teacherRecords = new MonitoringHistoryView(); teacherRecords.render(dual.teacherHistory, dual.loadTeacherMore);
            teacherRecords.element.prepend(createElement('h2', { text: 'Catatan guru' }));
            const evidence = createElement('details', { className: 'expert-observations' });
            evidence.append(createElement('summary', { text: 'Grafik & riwayat pengamatan' }),
                createElement('p', { className: 'muted', text: 'Telusuri catatan asli dari kedua sumber pada periode yang dipilih.' }),
                charts.element, records.element, teacherCharts.element, teacherRecords.element);
            children.push(evidence);
        } else children.push(charts.element, records.element);
        this.paint('Monitoring ' + user.displayName + ' · @' + user.username, ...children);
    }
    close(): void { if (this.dialog.open) this.dialog.close(); }
}
