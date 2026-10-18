import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import type { MonitoringSchool, MonitoringReporter } from '../../shared/monitoring';
import { createElement, replaceContent } from './dom';
const COLORS = ['#773eb2', '#b57800', '#18775a', '#2866b5', '#bf426c'];
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>): SVGElementTagNameMap[K] {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
}
export class MonitoringCharts {
    readonly element = createElement('section', { className: 'progress-charts monitoring-charts', attributes: { 'aria-label': 'Grafik monitoring 12 titik' } });
    render(schools: readonly MonitoringSchool[], reporterType: MonitoringReporter = 'parent'): void {
        this.element.setAttribute('data-reporter', reporterType);
        replaceContent(this.element, createElement('h2', { text: 'Monitoring ' + (reporterType === 'teacher' ? 'guru' : 'orang tua') + ' · 12 titik' }),
            createElement('p', { className: 'muted', text: 'Skor 1–4 per aspek. N/A dan siswa tanpa pengamatan tidak dihitung sebagai nol. Pengisian berulang dirata-ratakan per siswa dahulu, lalu antar-siswa. Setiap siswa memiliki bobot yang sama.' }));
        const format = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
        for (const school of schools) {
            const panel = createElement('article', { className: 'chart-panel monitoring-chart-panel' });
            panel.append(createElement('h3', { text: school.schoolName }), createElement('p', { text: school.participantCount + ' dari ' + school.studentCount + ' siswa sudah memiliki catatan. Garis terputus menunjukkan data belum tersedia.' }));
            const legend = createElement('ul', { className: 'monitoring-legend' });
            CHARACTER_ASPECTS.forEach((aspect, i) => {
                const item = createElement('li', { text: aspect.label }); item.style.setProperty('--aspect-color', COLORS[i]); legend.append(item);
            });
            const chart = svg('svg', { viewBox: '0 0 800 300', role: 'img', 'aria-label': 'Rata-rata lima aspek pada 12 titik observasi ' + school.schoolName });
            for (const value of [1, 2, 3, 4]) {
                const y = 250 - (value - 1) / 3 * 210;
                chart.append(svg('line', { x1: '55', x2: '760', y1: String(y), y2: String(y), stroke: '#deddd3' }));
                const label = svg('text', { x: '40', y: String(y + 5), 'text-anchor': 'end' }); label.textContent = String(value); chart.append(label);
            }
            for (let i = 0; i < 12; i++) {
                const label = svg('text', { x: String(55 + i * 705 / 11), y: '275', 'text-anchor': 'middle' }); label.textContent = String(i + 1); chart.append(label);
            }
            const label = svg('text', { x: '405', y: '298', 'text-anchor': 'middle' }); label.textContent = 'Titik observasi'; chart.append(label);
            CHARACTER_ASPECTS.forEach((aspect, index) => {
                let segment: string[] = [];
                const flush = () => { if (segment.length > 1) chart.append(svg('polyline', { points: segment.join(' '), fill: 'none', stroke: COLORS[index], 'stroke-width': '3' })); segment = []; };
                for (const point of school.points) {
                    const score = point.aspects.find(item => item.id === aspect.id);
                    if (!score || score.average === null) { flush(); continue; }
                    const x = 55 + (point.pointNumber - 1) * 705 / 11;
                    const y = 250 - (score.average - 1) / 3 * 210;
                    segment.push(x + ',' + y);
                    const dot = svg('circle', { cx: String(x), cy: String(y), r: '4.5', fill: COLORS[index] });
                    const title = svg('title', {}); title.textContent = aspect.label + ', titik ' + point.pointNumber + ': ' + format.format(score.average) + '/4, ' + score.studentCount + ' siswa'; dot.append(title); chart.append(dot);
                }
                flush();
            });
            const viewport = createElement('div', { className: 'monitoring-chart-scroll', attributes: { tabindex: '0', 'aria-label': 'Grafik dua belas titik ' + school.schoolName } }); viewport.append(chart);
            const details = createElement('details'); details.append(createElement('summary', { text: 'Lihat nilai dan jumlah siswa per titik' }));
            const table = createElement('table', { className: 'monitoring-data-table' });
            const caption = createElement('caption', { text: 'Rata-rata skor /4 dan jumlah siswa teramati (n)' });
            const head = createElement('thead'); const heading = createElement('tr'); heading.append(createElement('th', { text: 'Titik', attributes: { scope: 'col' } }));
            for (const aspect of CHARACTER_ASPECTS) heading.append(createElement('th', { text: aspect.label, attributes: { scope: 'col' } })); head.append(heading);
            const body = createElement('tbody');
            for (const point of school.points) {
                const row = createElement('tr'); row.append(createElement('th', { text: String(point.pointNumber), attributes: { scope: 'row' } }));
                for (const aspect of CHARACTER_ASPECTS) {
                    const score = point.aspects.find(value => value.id === aspect.id);
                    row.append(createElement('td', { text: score?.average == null ? 'N/A' : format.format(score.average) + ' (n=' + score.studentCount + ')' }));
                }
                body.append(row);
            }
            table.append(caption, head, body); const tableScroll = createElement('div', { className: 'monitoring-chart-scroll' }); tableScroll.append(table); details.append(tableScroll);
            panel.append(legend, viewport, details); this.element.append(panel);
        }
        if (!schools.length) this.element.append(createElement('p', { text: 'Belum ada data siswa untuk monitoring.' }));
    }
    showError(): void { replaceContent(this.element, createElement('p', { className: 'chart-error', text: 'Monitoring belum dapat dimuat. Coba segarkan panel.' })); }
}
