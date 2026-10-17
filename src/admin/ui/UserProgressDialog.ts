import { LEVEL_REPORT_LABELS } from '../../shared/game/reporting';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import type { AdminUserProgressResponse } from '../types';
import { formatDateTime } from '../utils/formatters';
import { createElement, replaceContent } from './dom';

export class UserProgressDialog {
    private readonly dialog = createElement('dialog', { className: 'progress-dialog' });
    private readonly content = createElement('div', { className: 'dialog-content' });

    constructor() {
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.close();
        });
        this.dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.close();
        });
        this.dialog.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const controls = [...this.content.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )];
            if (controls.length === 0) {
                event.preventDefault();
                return;
            }
            const first = controls[0];
            const last = controls[controls.length - 1];
            const leavingStart = event.shiftKey && document.activeElement === first;
            const leavingEnd = !event.shiftKey && document.activeElement === last;
            if (leavingStart || leavingEnd) {
                event.preventDefault();
                (event.shiftKey ? last : first)?.focus();
            }
        });
    }

    mount(parent: HTMLElement): void {
        this.dialog.append(this.content);
        parent.append(this.dialog);
    }

    showLoading(): void {
        const title = createElement('h2', { text: 'Memuat progres…' });
        title.id = 'progress-loading-title';
        this.dialog.setAttribute('aria-labelledby', title.id);
        replaceContent(this.content, title);
        this.open();
    }

    showError(message: string): void {
        const title = createElement('h2', { text: 'Detail belum dapat dimuat' });
        title.id = 'progress-error-title';
        this.dialog.setAttribute('aria-labelledby', title.id);
        const copy = createElement('p', { className: 'error-copy', text: message });
        const close = this.createCloseButton(false);
        replaceContent(this.content, title, copy, close);
        close.focus();
    }

    show(progress: AdminUserProgressResponse): void {
        const close = this.createCloseButton(true);
        const header = createElement('header', { className: 'dialog-header' });
        const headingGroup = createElement('div');
        const eyebrow = createElement('p', { className: 'eyebrow', text: 'RAPOR PEMAIN' });
        const title = createElement('h2', { text: progress.user.displayName });
        title.id = 'player-report-title';
        const username = createElement('p', {
            className: 'report-username',
            text: `@${progress.user.username}`
        });
        headingGroup.append(eyebrow, title, username);
        header.append(headingGroup, close);
        this.dialog.setAttribute('aria-labelledby', title.id);

        replaceContent(
            this.content,
            header,
            this.createSummary(progress),
            this.createLevels(progress),
            this.createJejakAspects(progress),
            this.createGameFeatures(progress)
        );
        this.open();
        close.focus();
    }

    close(): void {
        if (this.dialog.open) this.dialog.close();
    }

    private createSummary(progress: AdminUserProgressResponse): HTMLElement {
        const section = createElement('section', {
            className: 'report-section',
            attributes: { 'aria-labelledby': 'report-summary-title' }
        });
        const title = createElement('h3', { text: 'Ringkasan Rapor Misi' });
        title.id = 'report-summary-title';
        const cards = createElement('div', { className: 'report-summary-grid' });
        cards.append(
            this.metric('Total bintang', `${progress.summary.totalStars}/30`),
            this.metric('Predikat', progress.summary.grade),
            this.metric('Level selesai', `${progress.summary.completedLevelCount}/10`),
            this.metric('Rata-rata terbaik', `${progress.summary.averageStars}/3`)
        );
        section.append(title, cards, createElement('p', {
            className: 'report-note',
            text: 'Rapor menampilkan nilai terbaik yang sudah tersinkron, bukan riwayat percobaan.'
        }));
        return section;
    }

    private createLevels(progress: AdminUserProgressResponse): HTMLElement {
        const section = createElement('section', {
            className: 'report-section',
            attributes: { 'aria-labelledby': 'report-levels-title' }
        });
        const title = createElement('h3', { text: 'Nilai Level 1–10' });
        title.id = 'report-levels-title';
        const grid = createElement('ol', { className: 'level-grid' });
        for (const level of progress.levels) {
            const item = createElement('li', { className: 'level-card' });
            const top = createElement('div', { className: 'level-card-top' });
            const labels = createElement('div');
            labels.append(
                createElement('strong', { text: `Level ${level.level}` }),
                createElement('span', {
                    className: 'level-theme',
                    text: LEVEL_REPORT_LABELS[level.level - 1] ?? 'Nilai budi pekerti'
                })
            );
            const status = createElement('span', {
                className: level.completed ? 'pill pill-completed' : 'pill pill-not-started',
                text: level.completed ? 'Selesai' : 'Belum selesai'
            });
            const stars = createElement('p', {
                className: 'stars',
                text: `${'★'.repeat(level.stars)}${'☆'.repeat(3 - level.stars)}`,
                attributes: { 'aria-label': `${level.stars} dari 3 bintang` }
            });
            top.append(labels, status);
            item.append(
                top,
                stars,
                createElement('p', {
                    className: 'level-score',
                    text: `Nilai terbaik: ${level.stars}/3 bintang`
                }),
                createElement('p', {
                    className: 'level-updated',
                    text: `Diperbarui ${formatDateTime(level.updatedAt)}`
                })
            );
            grid.append(item);
        }
        section.append(title, grid);
        return section;
    }

    private createJejakAspects(progress: AdminUserProgressResponse): HTMLElement {
        const section = createElement('section', {
            className: 'report-section jejak-aspect-section',
            attributes: { 'aria-labelledby': 'report-jejak-aspects-title' }
        });
        const title = createElement('h3', { text: 'Aspek Jejak Pandawa' });
        title.id = 'report-jejak-aspects-title';
        section.append(title);
        if (!progress.jejakAspects) {
            section.append(createElement('p', {
                className: 'report-note',
                text: 'Belum ada rincian jawaban Jejak versi 2 yang tersinkron. Skor total saja belum menunjukkan nilai setiap aspek.'
            }));
            return section;
        }
        section.append(createElement('p', {
            className: 'report-note',
            text: 'Nilai terbaik tiap aspek dari jawaban permainan yang tersinkron. Setiap aspek maksimal 2 poin; nilai terbaiknya dapat berasal dari permainan yang berbeda.'
        }));
        const grid = createElement('div', { className: 'jejak-aspect-grid' });
        for (const aspect of CHARACTER_ASPECTS) {
            const score = progress.jejakAspects[aspect.id];
            const card = createElement('article', { className: 'jejak-aspect-card' });
            const label = createElement('h4', { text: aspect.label });
            const meter = createElement('meter', {
                text: `${score}/2`,
                attributes: { min: '0', max: '2', value: String(score), 'aria-label': `${aspect.label}: ${score} dari 2 poin` }
            });
            card.append(label, createElement('strong', { text: `${score}/2` }), meter);
            grid.append(card);
        }
        section.append(grid);
        return section;
    }

    private createGameFeatures(progress: AdminUserProgressResponse): HTMLElement {
        const section = createElement('section', {
            className: 'report-section game-features',
            attributes: { 'aria-labelledby': 'game-features-title' }
        });
        const title = createElement('h3', { text: 'Fitur Game' });
        title.id = 'game-features-title';
        const jejakValue = progress.summary.jejakPandawaUnlocked
            ? `${progress.summary.jejakPandawaBestScore}/10 • ${progress.summary.jejakTier ?? 'Terbuka'}`
            : 'Terkunci';
        const introSeen = progress.summary.introSeen?.length
            ? progress.summary.introSeen.join(', ')
            : 'Belum ada intro tersinkron';
        const cards = createElement('div', { className: 'feature-grid' });
        cards.append(
            this.metric('Jejak Pandawa', jejakValue),
            this.metric('Level tertinggi', String(progress.summary.highestUnlockedLevel ?? '—')),
            this.metric('Intro Pandawa dilihat', introSeen)
        );
        section.append(title, cards);
        return section;
    }

    private metric(label: string, value: string): HTMLElement {
        const card = createElement('article', { className: 'report-metric' });
        card.append(
            createElement('p', { className: 'summary-label', text: label }),
            createElement('strong', { text: value })
        );
        return card;
    }

    private open(): void {
        if (!this.dialog.open) this.dialog.showModal();
    }

    private createCloseButton(iconOnly: boolean): HTMLButtonElement {
        const button = createElement('button', {
            className: iconOnly ? 'icon-button' : 'button button-secondary',
            text: iconOnly ? '×' : 'Tutup',
            attributes: {
                type: 'button',
                'aria-label': iconOnly ? 'Tutup detail progres' : 'Tutup'
            }
        });
        button.addEventListener('click', () => this.close());
        return button;
    }
}
