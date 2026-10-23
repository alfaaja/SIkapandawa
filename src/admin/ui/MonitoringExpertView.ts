import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import { evaluateMonitoringComparison, type AspectComparison, type MonitoringComparison } from '../../shared/monitoringComparison';
import { monitoringPeriodNumber } from '../../shared/monitoring';
import { createElement as el } from './dom';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const score = (value: number | null, suffix = '') => value === null ? '—' : number.format(value) + suffix;
const labels: Record<AspectComparison['status'], string> = {
    review: 'Perlu klarifikasi', insufficient: 'Data belum cukup',
    no_repeated_large_gap: 'Pola selisih besar berulang belum terdeteksi'
};

function flow(): HTMLElement {
    const steps = el('ol', { className: 'expert-flow', attributes: { 'aria-label': 'Alur sistem pakar forward chaining' } });
    for (const [title, copy] of [
        ['Dua sudut pandang', 'Pengamatan orang tua & guru'],
        ['Pasangkan data', 'Siswa, periode & titik yang sama'],
        ['Telusuri aturan', 'Kelengkapan & selisih penilaian'],
        ['Tinjau hasil', 'Klarifikasi berdasarkan bukti']
    ]) {
        const step = el('li');
        step.append(el('strong', { text: title }), el('span', { text: copy })); steps.append(step);
    }
    return steps;
}

export function createExpertOverview(onStudents: () => void): HTMLElement {
    const section = el('section', { className: 'expert-overview', attributes: { 'aria-label': 'Sistem pakar monitoring' } });
    const intro = el('div', { className: 'expert-intro' });
    const heading = el('div');
    heading.append(el('p', { className: 'expert-eyebrow', text: 'SIKAPANDAWA / MONITORING PERILAKU' }),
        el('h2', { text: 'Dua pengamatan. Satu gambaran lebih utuh.' }),
        el('p', { text: 'Sistem pakar membantu meninjau kesesuaian penilaian orang tua dan guru pada lima aspek karakter siswa.' }));
    const method = el('div', { className: 'expert-method' });
    method.append(el('span', { className: 'expert-method-label', text: 'METODE SISTEM PAKAR' }),
        el('strong', { text: 'Forward chaining' }), el('span', { text: 'Dari fakta pengamatan menuju kesimpulan berbasis aturan.' }));
    intro.append(heading, method);
    const footer = el('div', { className: 'expert-overview-footer' });
    const copy = el('p'); copy.append(el('strong', { text: 'Analisis tersedia per siswa.' }), ' Grafik di bawah merangkum pengamatan per sekolah. Buka siswa untuk melihat hasil, bukti, dan penalarannya.');
    const action = el('button', { className: 'button button-primary', text: 'Lihat analisis siswa', attributes: { type: 'button' } });
    action.addEventListener('click', onStudents); footer.append(copy, action);
    section.append(intro, flow(), footer); return section;
}

function metric(value: string, label: string): HTMLElement {
    const item = el('div', { className: 'expert-metric' });
    item.append(el('strong', { text: value }), el('span', { text: label })); return item;
}

function aspectCard(result: AspectComparison, data: MonitoringComparison): HTMLElement {
    const label = CHARACTER_ASPECTS.find(a => a.id === result.id)!.label;
    const card = el('article', { className: 'comparison-card', attributes: { 'data-status': result.status } });
    const heading = el('div', { className: 'expert-aspect-heading' });
    heading.append(el('h3', { text: label }), el('p', { className: 'expert-status', text: labels[result.status] }));
    const metrics = el('div', { className: 'expert-aspect-metrics' });
    metrics.append(metric(score(result.meanAbsoluteDifference), 'Rata-rata selisih / 3'),
        metric(score(result.exactAgreementPercent, '%'), 'Pasangan bernilai sama'),
        metric(String(result.largeGapPoints), 'Titik berselisih ≥2'));
    const coverage = el('p', { className: 'expert-coverage', text: result.pairedPoints + '/12 titik berpasangan' });
    const points = el('ol', { className: 'expert-points', attributes: { 'aria-label': 'Selisih 12 titik ' + label } });
    for (let point = 1; point <= 12; point++) {
        const value = result.points.find(p => p.pointNumber === point);
        const detail = value ? 'selisih ' + number.format(value.meanAbsoluteDifference) + ' poin' : 'belum ada pasangan pengamatan';
        points.append(el('li', { text: String(point), attributes: {
            'data-gap': !value ? 'missing' : value.meanAbsoluteDifference >= 2 ? 'large' : 'small',
            'aria-label': 'Titik ' + point + ': ' + detail, title: 'Titik ' + point + ': ' + detail
        } }));
    }
    const details = el('details', { className: 'expert-evidence' });
    details.append(el('summary', { text: 'Lihat penalaran dan selisih 12 titik' }));
    const trace = el('ol', { className: 'expert-trace' });
    for (const line of result.trace) trace.append(el('li', { text: line }));
    details.append(trace, el('p', { className: 'expert-bias', text: 'Arah selisih ortu − guru: ' + score(result.signedBias, ' poin') }));
    const table = el('table', { className: 'expert-pair-table' });
    table.append(el('caption', { text: 'Bukti pasangan ' + label + ' · rata-rata skor per sumber 1–4; selisih absolut 0–3' }));
    const head = el('thead'); const header = el('tr');
    for (const title of ['Titik', 'Orang tua', 'Guru', 'Selisih']) header.append(el('th', { text: title, attributes: { scope: 'col' } }));
    head.append(header); const body = el('tbody');
    for (let point = 1; point <= 12; point++) {
        const pair = data.cells.find(p => p.aspect === result.id && p.pointNumber === point);
        const row = el('tr'); row.append(el('th', { text: String(point), attributes: { scope: 'row' } }));
        for (const value of [pair?.parentAverage ?? null, pair?.teacherAverage ?? null, pair ? Math.abs(pair.parentAverage - pair.teacherAverage) : null]) {
            row.append(el('td', { text: score(value) }));
        }
        body.append(row);
    }
    table.append(head, body); details.append(table);
    const pointLegend = el('p', { className: 'expert-point-legend', text: 'Nomor menunjukkan titik observasi · kuning: selisih ≥2 · hijau: selisih <2 · putus-putus: belum berpasangan.' });
    card.append(heading, metrics, coverage, points, pointLegend, details); return card;
}

export function createExpertAnalysis(data: MonitoringComparison): HTMLElement {
    const results = evaluateMonitoringComparison(data);
    const review = results.filter(r => r.status === 'review').length;
    const insufficient = results.filter(r => r.status === 'insufficient').length;
    const section = el('section', { className: 'monitoring-comparison expert-analysis', attributes: { 'aria-label': 'Perbandingan penilaian orang tua dan guru' } });
    const hero = el('div', { className: 'expert-result-hero' });
    const context = el('div', { className: 'expert-context' });
    context.append(el('span', { className: 'expert-eyebrow', text: 'SISTEM PAKAR / Forward chaining' }));
    const period = data.cells[0]?.period;
    context.append(el('span', { className: 'expert-period', text: period ? (monitoringPeriodNumber(period) === null ? period : 'Periode ' + monitoringPeriodNumber(period)) : 'Belum ada pasangan data' }));
    hero.append(context, el('h2', { text: 'Perbandingan ortu–guru' }),
        el('p', { className: 'expert-lead', text: 'Hasil penelusuran aturan dari pengamatan yang berpasangan pada lima aspek karakter.' }));
    const verdict = el('div', { className: 'expert-verdict', attributes: { 'data-tone': review ? 'review' : insufficient ? 'insufficient' : 'aligned' } });
    verdict.append(el('span', { className: 'expert-verdict-label', text: 'RINGKASAN ANALISIS' }),
        el('h3', { text: review ? review + ' aspek perlu klarifikasi' : insufficient ? 'Lengkapi pasangan pengamatan' : 'Pola selisih besar belum terdeteksi' }),
        el('p', { text: review ? 'Tinjau aspek bertanda kuning bersama orang tua dan guru. Telusuri titik yang berbeda untuk memahami konteks pengamatan.' : insufficient ? 'Sebagian aspek belum mencapai minimal 6 titik berpasangan. Lengkapi penilaian pada periode dan nomor titik yang sama.' : 'Pada data berpasangan yang tersedia, belum ditemukan pola selisih besar berulang. Lanjutkan pengamatan berkala.' }));
    const counts = el('div', { className: 'expert-summary-metrics' });
    counts.append(metric(String(review), 'Aspek perlu klarifikasi'), metric(String(5 - review - insufficient), 'Aspek tanpa pola selisih besar'), metric(String(insufficient), 'Aspek belum cukup data'));
    hero.append(verdict, counts);
    const method = el('details', { className: 'expert-rulebook' });
    method.append(el('summary', { text: 'Cara sistem pakar membaca data' }), flow(),
        el('p', { text: 'Aturan awal · ' + data.ruleVersion + ' · perlu validasi pakar. Minimal 6 titik berpasangan per aspek; selisih ≥2 pada minimal 3 titik memicu status Perlu klarifikasi. N/A dikecualikan. Pengisian berulang dirata-ratakan per sumber/periode, lalu setiap titik berbobot sama. Tanggal observasi boleh berbeda; catatan lama tanpa periode tidak dibandingkan.' }));
    const cards = el('div', { className: 'expert-aspects' });
    for (const result of results) cards.append(aspectCard(result, data));
    section.append(hero, el('p', { className: 'expert-disclaimer', text: 'Aturan awal ' + data.ruleVersion + ', perlu validasi pakar. Perbedaan penilaian bukan bukti manipulasi atau ketidakjujuran. Gunakan hasil untuk klarifikasi konteks rumah dan sekolah.' }),
        method, el('h3', { className: 'expert-section-title', text: 'Hasil per aspek karakter' }), cards);
    return section;
}
