import type { AdminUserListItem } from '../types';
import { validateUsername } from '../../shared/auth/username';
import { createElement, replaceContent } from './dom';
import { DEFAULT_SCHOOL_NAME, normalizeSchoolName } from '../../shared/auth/school';

interface ChartDefinition {
    title: string;
    accentClass: string;
    maximum: number;
    value(user: AdminUserListItem): number;
}

interface ChartViewState {
    compactNames: boolean;
}

const charts: readonly ChartDefinition[] = Object.freeze([
    {
        title: 'Capaian Misi Pandawa',
        accentClass: 'chart-misi',
        maximum: 30,
        value: (user) => user.totalStars
    },
    {
        title: 'Capaian Jejak Pandawa',
        accentClass: 'chart-jejak',
        maximum: 10,
        value: (user) => user.jejakPandawaBestScore
    }
]);

function compareRegistration(left: AdminUserListItem, right: AdminUserListItem): number {
    const dateOrder = left.registeredAt.localeCompare(right.registeredAt);
    return dateOrder || left.displayName.localeCompare(right.displayName, 'id');
}

function clampScore(value: number, maximum: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), maximum);
}

function compactName(displayName: string): string {
    const letters = Array.from(displayName.normalize('NFKD'))
        .filter((character) => /[\p{L}\p{N}]/u.test(character));
    return letters.slice(0, 2).join('').toLocaleUpperCase('id-ID') || '—';
}

export class ProgressCharts {
    readonly element = createElement('section', {
        className: 'progress-charts',
        attributes: { 'aria-labelledby': 'progress-charts-title' }
    });
    private readonly modeButton = createElement('button', {
        className: 'button button-secondary chart-mode-button',
        text: 'Mode ringkas',
        attributes: {
            type: 'button',
            'aria-pressed': 'false',
            'data-testid': 'chart-name-mode'
        }
    });
    private students: readonly AdminUserListItem[] = Object.freeze([]);
    private schoolName: string | null = null;
    private readonly description = createElement('p', { className: 'muted' });
    private state: ChartViewState = Object.freeze({ compactNames: false });

    constructor(
        private readonly adminUserId: string | null,
        private readonly adminUsername: string
    ) {
        const heading = createElement('div', { className: 'charts-heading' });
        const headingCopy = createElement('div', { className: 'charts-heading-copy' });
        const title = createElement('h2', { text: 'Visualisasi capaian' });
        title.id = 'progress-charts-title';
        headingCopy.append(
            title,
            this.description
        );
        this.modeButton.addEventListener('click', () => this.toggleNameMode());
        heading.append(headingCopy, this.modeButton);
        this.element.append(heading, createElement('div', { className: 'charts-grid' }));
    }

    render(users: readonly AdminUserListItem[], schoolName: string | null = null): void {
        this.schoolName = schoolName;
        this.students = Object.freeze(users
            .filter((user) => !this.isAdmin(user))
            .filter(user => schoolName === null || normalizeSchoolName(user.schoolName) === normalizeSchoolName(schoolName))
            .slice()
            .sort(compareRegistration));
        this.renderCharts();
    }

    private renderCharts(): void {
        const grid = this.element.querySelector<HTMLElement>('.charts-grid');
        if (!grid) return;
        this.modeButton.hidden = this.schoolName === null;
        this.element.classList.toggle('progress-charts-schools', this.schoolName === null);
        this.description.textContent = this.schoolName === null
            ? 'Rata-rata seluruh siswa per sekolah, termasuk yang belum bermain. Tinggi batang menunjukkan persentase skor maksimum.'
            : `Nilai siswa ${this.schoolName}. Grafik tidak terpengaruh pencarian atau status daftar pemain.`;
        replaceContent(grid, ...(this.schoolName === null
            ? [this.createSchoolChart()]
            : charts.map((chart) => this.createChart(chart, this.students))));
    }

    private createSchoolChart(): HTMLElement {
        const groups = new Map<string, { count: number; mission: number; jejak: number }>();
        for (const student of this.students) {
            const name = normalizeSchoolName(student.schoolName) ?? DEFAULT_SCHOOL_NAME;
            const group = groups.get(name) ?? { count: 0, mission: 0, jejak: 0 };
            group.count++;
            group.mission += clampScore(student.totalStars, 30);
            group.jejak += clampScore(student.jejakPandawaBestScore, 10);
            groups.set(name, group);
        }
        const panel = createElement('article', { className: 'chart-panel school-chart-panel' });
        panel.append(createElement('h3', { text: 'Rata-rata capaian per sekolah' }));
        const legend = createElement('div', { className: 'school-chart-legend' });
        for (const definition of charts) {
            legend.append(createElement('span', {
                className: definition.accentClass,
                text: `${definition.title.replace('Capaian ', '')} (/${definition.maximum})`
            }));
        }
        panel.append(legend);
        const viewport = createElement('div', {
            className: 'school-chart-scroll', attributes: { tabindex: '0', 'aria-label': 'Rata-rata capaian per sekolah' }
        });
        const list = createElement('ol', { className: 'school-chart-groups' });
        const format = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
        for (const [school, group] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'id'))) {
            const item = createElement('li', { className: 'school-chart-group' });
            const bars = createElement('div', { className: 'school-chart-pair' });
            for (const [index, definition] of charts.entries()) {
                const value = (index === 0 ? group.mission : group.jejak) / group.count;
                const plot = createElement('div', { className: `school-chart-plot ${definition.accentClass}` });
                const bar = createElement('div', {
                    className: `chart-bar school-chart-bar${value === 0 ? ' chart-bar-zero' : ''}`,
                    attributes: { role: 'img', 'aria-label': `${school}, ${definition.title}: rata-rata ${format.format(value)} dari ${definition.maximum}, ${group.count} siswa` }
                });
                bar.style.setProperty('--bar-height', `${value / definition.maximum * 100}%`);
                bar.append(createElement('strong', { className: 'chart-value', text: `${format.format(value)}/${definition.maximum}` }));
                plot.append(bar);
                bars.append(plot);
            }
            item.append(bars,
                createElement('strong', { className: 'school-chart-name', text: school }),
                createElement('span', { className: 'school-chart-count', text: `${group.count} siswa` }));
            list.append(item);
        }
        if (groups.size === 0) list.append(createElement('li', { className: 'chart-empty', text: 'Belum ada data siswa untuk ditampilkan.' }));
        viewport.append(list);
        panel.append(viewport);
        return panel;
    }

    showError(message: string): void {
        const grid = this.element.querySelector<HTMLElement>('.charts-grid');
        if (!grid) return;
        replaceContent(grid, createElement('p', {
            className: 'chart-error',
            text: message,
            attributes: { role: 'status' }
        }));
    }

    private isAdmin(user: AdminUserListItem): boolean {
        if (user.isAdmin === true) return true;
        return this.adminUserId !== null
            ? user.userId === this.adminUserId
            : validateUsername(user.username) === validateUsername(this.adminUsername);
    }

    private toggleNameMode(): void {
        this.state = Object.freeze({ compactNames: !this.state.compactNames });
        this.element.classList.toggle('progress-charts-compact', this.state.compactNames);
        this.modeButton.textContent = this.state.compactNames ? 'Nama lengkap' : 'Mode ringkas';
        this.modeButton.setAttribute('aria-pressed', String(this.state.compactNames));
        this.renderCharts();
    }

    private createChart(
        definition: ChartDefinition,
        students: readonly AdminUserListItem[]
    ): HTMLElement {
        const panel = createElement('article', {
            className: `chart-panel ${definition.accentClass}`
        });
        panel.append(
            createElement('h3', { text: definition.title }),
            createElement('p', {
                className: 'chart-subtitle',
                text: `Format skor a/${definition.maximum}: a = poin yang didapat.`
            })
        );
        const viewport = createElement('div', {
            className: 'chart-scroll',
            attributes: { 'aria-label': definition.title }
        });
        const list = createElement('ol', {
            className: `chart-bars${students.length > 30 ? ' chart-bars-dense' : ''}`
        });
        list.style.setProperty('--chart-column-count', String(Math.max(students.length, 1)));
        for (const [index, student] of students.entries()) {
            const value = clampScore(definition.value(student), definition.maximum);
            const item = createElement('li', { className: 'chart-column' });
            const barArea = createElement('div', { className: 'chart-bar-area' });
            const plot = createElement('div', { className: 'chart-plot' });
            const bar = createElement('div', {
                className: `chart-bar${value === 0 ? ' chart-bar-zero' : ''}`,
                attributes: {
                    role: 'img',
                    'aria-label': `${student.displayName}: ${value} dari ${definition.maximum}`
                }
            });
            bar.style.setProperty('--bar-height', `${(value / definition.maximum) * 100}%`);
            bar.append(createElement('strong', {
                className: 'chart-value',
                text: `${value}/${definition.maximum}`
            }));
            plot.append(bar);
            barArea.append(plot);
            item.append(
                barArea,
                createElement('span', {
                    className: 'chart-name',
                    text: `${index + 1}. ${this.state.compactNames
                        ? compactName(student.displayName)
                        : student.displayName}`,
                    attributes: { title: student.displayName }
                })
            );
            list.append(item);
        }
        if (students.length === 0) {
            list.append(createElement('li', {
                className: 'chart-empty',
                text: 'Belum ada data siswa untuk ditampilkan.'
            }));
        }
        viewport.append(list);
        panel.append(viewport);
        return panel;
    }
}
