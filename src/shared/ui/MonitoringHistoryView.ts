import { CHARACTER_ASPECTS } from '../game/characterAspects';
import type { MonitoringHistory } from '../monitoring';
import { createElement, replaceContent } from '../../admin/ui/dom';

export class MonitoringHistoryView {
    readonly element = createElement('section', { className: 'monitoring-history', attributes: { 'aria-label': 'Riwayat monitoring' } });
    private generation = 0;
    render(history: MonitoringHistory, loadMore: (offset: number) => Promise<MonitoringHistory>): void {
        const generation = ++this.generation;
        const list = createElement('div', { className: 'monitoring-history-list' });
        const notice = createElement('p', { attributes: { role: 'status' } });
        const more = createElement('button', { className: 'button button-secondary', text: 'Muat catatan berikutnya', attributes: { type: 'button' } });
        let offset = history.pageOffset + history.items.length;
        const seen = new Set<string>();
        const append = (page: MonitoringHistory) => {
            for (const entry of page.items) {
                if (seen.has(entry.id)) continue;
                seen.add(entry.id);
                const card = createElement('details', { className: 'monitoring-entry' });
                card.append(createElement('summary', { text: 'Titik ' + entry.pointNumber + ' · ' + new Date(entry.observedAt).toLocaleString('id-ID') + ' · ' + entry.guardianName }));
                const scores = createElement('ul', { className: 'monitoring-score-list' });
                for (const aspect of CHARACTER_ASPECTS) scores.append(createElement('li', { text: aspect.label + ': ' + (entry.scores[aspect.id] ?? 'N/A') }));
                card.append(createElement('p', { text: 'Kelas: ' + (entry.studentClass || '—') }), scores,
                    createElement('p', { text: 'Situasi: ' + entry.situation }), createElement('p', { text: 'Perilaku nyata: ' + (entry.behavior || '—') }),
                    createElement('p', { text: 'Penguatan / arahan: ' + (entry.reinforcement || '—') }),
                    createElement('small', { text: 'Disimpan ' + new Date(entry.createdAt).toLocaleString('id-ID') }));
                list.append(card);
            }
            more.hidden = offset >= page.total;
        };
        append(history);
        more.addEventListener('click', async () => {
            more.disabled = true;
            try {
                const next = await loadMore(offset);
                if (generation !== this.generation) return;
                offset = next.pageOffset + next.items.length;
                append(next);
                notice.textContent = '';
            } catch { notice.textContent = 'Riwayat berikutnya belum dapat dimuat. Coba lagi.'; }
            finally { more.disabled = false; }
        });
        replaceContent(this.element, createElement('h3', { text: 'Riwayat monitoring (' + history.total + ' catatan)' }),
            createElement('p', { text: 'Setiap pengisian disimpan terpisah, termasuk pengisian ulang titik yang sama.' }), list, notice, more);
        if (history.total === 0) list.append(createElement('p', { text: 'Belum ada catatan monitoring.' }));
    }
}
