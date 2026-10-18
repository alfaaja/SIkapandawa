import { MonitoringHistoryView } from '../../shared/ui/MonitoringHistoryView';
import type { MonitoringHistory, MonitoringSchool } from '../../shared/monitoring';
import type { AdminUserIdentity } from '../types';
import { MonitoringCharts } from './MonitoringCharts';
import { createElement, replaceContent } from './dom';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import { evaluateMonitoringComparison, type MonitoringComparison } from '../../shared/monitoringComparison';
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
        const children: HTMLElement[] = [charts.element, records.element];
        if (dual) {
            const teacherCharts = new MonitoringCharts(); teacherCharts.render(dual.teacherSchools, 'teacher');
            const teacherRecords = new MonitoringHistoryView(); teacherRecords.render(dual.teacherHistory, dual.loadTeacherMore);
            teacherRecords.element.prepend(createElement('h2', { text: 'Catatan guru' }));
            children.push(teacherCharts.element, teacherRecords.element, this.comparison(dual.comparison));
        }
        this.paint('Monitoring ' + user.displayName + ' · @' + user.username, ...children);
    }
    private comparison(data: MonitoringComparison): HTMLElement {
        const section = createElement('section', { className: 'monitoring-comparison', attributes: { 'aria-label': 'Perbandingan penilaian orang tua dan guru' } });
        section.append(createElement('h2', { text: 'Perbandingan ortu–guru' }),
            createElement('p', { className: 'muted', text: 'Aturan awal · draft-1 · perlu validasi pakar. Hasil membantu klarifikasi pengamatan, bukan penetapan manipulasi. Pasangan hanya pada nomor titik dan periode monitoring yang sama; tanggal pengamatan boleh berbeda. N/A dikecualikan. Pengisian berulang dirata-ratakan per sumber/periode; setiap titik berbobot sama. Catatan lama tanpa periode tidak dibandingkan.' }));
        const format = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
        const cards = createElement('div', { className: 'level-grid' });
        for (const result of evaluateMonitoringComparison(data)) {
            const card = createElement('article', { className: 'level-card comparison-card' });
            card.append(createElement('h3', { text: CHARACTER_ASPECTS.find(a => a.id === result.id)!.label }),
                createElement('p', { className: 'status-pill', text: result.status === 'insufficient' ? 'Data belum cukup' : result.status === 'review' ? 'Perlu klarifikasi' : 'Pola selisih besar berulang belum terdeteksi' }),
                createElement('p', { text: result.pairedPoints + '/12 titik berpasangan · ' + result.pairedPeriods + ' pasangan periode' }),
                createElement('p', { text: 'Kesamaan rata-rata pasangan: ' + (result.exactAgreementPercent === null ? '—' : format.format(result.exactAgreementPercent) + '%') }),
                createElement('p', { text: 'Rata-rata selisih absolut: ' + (result.meanAbsoluteDifference === null ? '—' : format.format(result.meanAbsoluteDifference) + ' poin') }),
                createElement('p', { text: 'Arah selisih ortu − guru: ' + (result.signedBias === null ? '—' : format.format(result.signedBias) + ' poin') }));
            const details = createElement('details'); details.append(createElement('summary', { text: 'Lihat penalaran dan selisih 12 titik' }));
            for (const line of result.trace) details.append(createElement('p', { text: line }));
            const pointList = createElement('ul', { className: 'monitoring-score-list' });
            for (let point = 1; point <= 12; point++) {
                const value = result.points.find(p => p.pointNumber === point);
                pointList.append(createElement('li', { text: 'Titik ' + point + ': ' + (value ? 'selisih ' + format.format(value.meanAbsoluteDifference) + ' poin' : 'belum ada pasangan pengamatan') }));
            }
            details.append(pointList); card.append(details); cards.append(card);
        }
        section.append(cards); return section;
    }
    close(): void { if (this.dialog.open) this.dialog.close(); }
}
