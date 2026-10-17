// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { MonitoringCharts } from './MonitoringCharts';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';
import { parseMonitoringSummary } from '../../shared/monitoring';
it('keeps missing observations as gaps, not zero or an interpolated connecting line', () => {
    const chart = new MonitoringCharts();
    const schools = parseMonitoringSummary([{ schoolName: '<img src=x>', studentCount: 2, participantCount: 1,
        points: Array.from({ length: 12 }, (_, i) => ({ pointNumber: i + 1,
            aspects: CHARACTER_ASPECTS.map((aspect, j) => ({ id: aspect.id,
                average: j === 0 && (i === 0 || i === 2) ? 3 : j === 1 && i < 2 ? 2 : null,
                studentCount: j === 0 && (i === 0 || i === 2) || j === 1 && i < 2 ? 1 : 0 })) })) }]);
    chart.render(schools);
    expect(chart.element.querySelector('img')).toBeNull();
    expect(chart.element.querySelectorAll('svg circle')).toHaveLength(4);
    expect(chart.element.querySelectorAll('polyline')).toHaveLength(1);
    expect(chart.element.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(chart.element.textContent).toContain('N/A');
    expect(chart.element.querySelector('circle title')?.textContent).toContain('3/4, 1 siswa');
    chart.render([]);
    expect(chart.element.textContent).toContain('Belum ada data siswa');
    chart.showError();
    expect(chart.element.textContent).toContain('belum dapat dimuat');
});
