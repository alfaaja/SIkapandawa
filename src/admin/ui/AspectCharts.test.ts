// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AspectCharts } from './AspectCharts';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

describe('school aspect averages', () => {
    it('combines five aspect pairs on one shared percentage axis per school', () => {
        const charts = new AspectCharts();
        charts.render([{ schoolName: 'SDN Satu', studentCount: 4, jejakKnownCount: 3,
            aspects: CHARACTER_ASPECTS.map(aspect => ({ id: aspect.id, missionAverage: 3, jejakAverage: 1 })) }]);
        expect(charts.element.querySelectorAll('.aspect-chart-panel')).toHaveLength(1);
        expect(charts.element.querySelectorAll('.aspect-chart-group')).toHaveLength(5);
        expect(charts.element.querySelectorAll('.aspect-y-axis')).toHaveLength(1);
        expect(charts.element.querySelectorAll('.aspect-bar')).toHaveLength(10);
        expect(charts.element.textContent).toContain('3 dari 4');
        expect(charts.element.querySelector('.chart-misi .aspect-bar')?.getAttribute('style')).toContain('50%');
        expect(charts.element.querySelector('.chart-jejak .aspect-bar')?.getAttribute('style')).toContain('50%');
        expect(charts.element.textContent).toContain('Kejujuran');
        expect(charts.element.textContent).toContain('Keadilan');
        expect(charts.element.querySelector('.aspect-bar')?.textContent).toBe('50%');
        expect(charts.element.querySelector('.aspect-bar')?.getAttribute('aria-label')).toContain('3 dari 6');
    });
    it('shows missing data explicitly and treats names as text', () => {
        const charts = new AspectCharts();
        charts.render([{ schoolName: '<img src=x>', studentCount: 2, jejakKnownCount: 0,
            aspects: CHARACTER_ASPECTS.map(aspect => ({ id: aspect.id, missionAverage: 0, jejakAverage: null })) }]);
        expect(charts.element.querySelector('img')).toBeNull();
        expect(charts.element.textContent).toContain('Belum ada rincian');
        charts.showError();
        expect(charts.element.textContent).toContain('tidak dapat dimuat');
        charts.render([]);
        expect(charts.element.textContent).toContain('Belum ada data siswa');
    });
});
