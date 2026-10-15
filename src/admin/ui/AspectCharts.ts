import { CHARACTER_ASPECTS, type SchoolAspectAverage } from '../../shared/game/characterAspects';
import { createElement, replaceContent } from './dom';

/** One grouped chart per school; table filters never change the school cohort. */
export class AspectCharts {
    readonly element = createElement('section', {
        className: 'progress-charts aspect-charts', attributes: { 'aria-label': 'Rata-rata lima aspek' }
    });

    render(schools: readonly SchoolAspectAverage[]): void {
        const grid = createElement('div', { className: 'aspect-charts-grid' });
        const format = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
        for (const school of schools) {
            const panel = createElement('article', { className: 'chart-panel aspect-chart-panel' });
            panel.append(createElement('h3', { text: school.schoolName }),
                createElement('p', { className: 'chart-subtitle', text: school.studentCount + ' siswa · rincian Jejak ' + school.jejakKnownCount + ' dari ' + school.studentCount }));
            const axis = createElement('ol', { className: 'aspect-y-axis', attributes: { 'aria-hidden': 'true' } });
            for (const value of [100, 80, 60, 40, 20, 0]) axis.append(createElement('li', { text: String(value) }));
            const viewport = createElement('div', {
                className: 'aspect-chart-scroll', attributes: { tabindex: '0', 'aria-label': 'Lima aspek ' + school.schoolName }
            });
            const list = createElement('ol', { className: 'aspect-chart-groups' });
            for (const aspect of CHARACTER_ASPECTS) {
                const scores = school.aspects.find(item => item.id === aspect.id);
                if (!scores) continue;
                const item = createElement('li', { className: 'aspect-chart-group' });
                const bars = createElement('div', { className: 'aspect-chart-pair' });
                for (const definition of [
                    { name: 'Misi Pandawa', className: 'chart-misi', value: scores.missionAverage, maximum: 6 },
                    { name: 'Jejak Pandawa', className: 'chart-jejak', value: scores.jejakAverage, maximum: 2 }
                ]) {
                    const plot = createElement('div', { className: 'aspect-chart-plot ' + definition.className });
                    const value = definition.value;
                    const percent = (value ?? 0) / definition.maximum * 100;
                    const description = school.schoolName + ', ' + aspect.label + ', ' + definition.name + ': ' + (value === null ? 'Belum ada rincian' : format.format(value) + ' dari ' + definition.maximum + ' (' + format.format(percent) + '%)');
                    const bar = createElement('div', {
                        className: 'chart-bar aspect-bar' + (!value ? ' chart-bar-zero' : ''),
                        attributes: { role: 'img', 'aria-label': description, title: description }
                    });
                    bar.style.setProperty('--bar-height', percent + '%');
                    bar.append(createElement('strong', { className: 'chart-value', text: value === null ? '—' : format.format(percent) + '%' }));
                    plot.append(bar);
                    bars.append(plot);
                }
                item.append(bars, createElement('strong', { className: 'aspect-chart-label', text: aspect.label }));
                list.append(item);
            }
            viewport.append(list);
            const chart = createElement('div', { className: 'aspect-chart-frame' });
            chart.append(axis, viewport);
            const legend = createElement('div', { className: 'school-chart-legend aspect-chart-legend' });
            legend.append(createElement('span', { className: 'chart-misi', text: 'Misi Pandawa' }),
                createElement('span', { className: 'chart-jejak', text: 'Jejak Pandawa' }));
            panel.append(createElement('p', { className: 'aspect-axis-title', text: 'Capaian (%)' }), chart, legend);
            if (school.jejakKnownCount < school.studentCount) {
                panel.append(createElement('p', { className: 'school-chart-count aspect-coverage',
                    text: school.jejakKnownCount === 0 ? 'Belum ada rincian Jejak.' : 'Rata-rata Jejak hanya memakai data yang tersedia. Skor lama tanpa rincian memerlukan permainan ulang.' }));
            }
            grid.append(panel);
        }
        if (schools.length === 0) grid.append(createElement('p', { className: 'chart-empty', text: 'Belum ada data siswa.' }));
        replaceContent(this.element, createElement('h2', { text: 'Rata-rata lima aspek' }),
            createElement('p', { className: 'muted', text: 'Lima aspek dalam satu grafik per sekolah. Skala 0–100%: Misi maksimal 6 poin per aspek, Jejak maksimal 2 poin. Arahkan penunjuk ke batang untuk melihat poin asli. Misi mencakup seluruh siswa, termasuk yang belum bermain (0).' }), grid);
    }

    showError(): void {
        replaceContent(this.element, createElement('p', { className: 'chart-error', text: 'Rata-rata lima aspek tidak dapat dimuat. Coba segarkan panel.', attributes: { role: 'status' } }));
    }
}
