// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createExpertAnalysis } from './MonitoringExpertView';
import type { MonitoringComparison } from '../../shared/monitoringComparison';
import { CHARACTER_ASPECTS } from '../../shared/game/characterAspects';

function sample(parent: number, teacher: number, count = 12): MonitoringComparison {
    return { ruleVersion: 'draft-1', periodPolicy: 'same-point-monitoring-period', cells: CHARACTER_ASPECTS.flatMap(aspect =>
        Array.from({ length: count }, (_, i) => ({ aspect: aspect.id, pointNumber: i + 1, period: 'periode 9002',
            parentAverage: parent, teacherAverage: teacher, parentCount: 1, teacherCount: 1 }))) };
}
it('makes expert findings and their evidence visible without asserting manipulation', () => {
    const view = createExpertAnalysis(sample(4, 1));
    expect(view.querySelector('.expert-verdict')?.textContent).toContain('5 aspek perlu klarifikasi');
    expect(view.querySelectorAll('.comparison-card[data-status="review"]')).toHaveLength(5);
    expect(view.textContent).toContain('Forward chaining');
    expect(view.textContent).toContain('Periode 9002');
    expect(view.querySelectorAll('.expert-pair-table tbody tr')).toHaveLength(60);
    expect(view.querySelectorAll('.expert-pair-table tbody tr')[0].textContent).toContain('4');
    expect(view.textContent).toContain('bukan bukti manipulasi');
    expect(view.textContent).not.toContain('Terbukti manipulasi');
});
it('keeps agreement distinct from missing evidence and gives follow-up for both', () => {
    const aligned = createExpertAnalysis(sample(3, 3));
    expect(aligned.querySelector('.expert-verdict')?.textContent).toContain('Pola selisih besar belum terdeteksi');
    expect(aligned.querySelectorAll('[data-status="no_repeated_large_gap"]')).toHaveLength(5);
    expect(aligned.textContent).toContain('100%');
    const empty = createExpertAnalysis(sample(4, 1, 0));
    expect(empty.querySelector('.expert-verdict')?.textContent).toContain('Lengkapi pasangan pengamatan');
    expect(empty.querySelectorAll('[data-status="insufficient"]')).toHaveLength(5);
    expect(empty.textContent).toContain('0/12 titik berpasangan');
    expect(empty.textContent).not.toContain('0%');
    expect(empty.textContent).toContain('minimal 6 titik');
});
it('does not promote sparse disagreements into a review verdict or mutate the source', () => {
    const input = sample(4, 1, 2); const original = JSON.stringify(input);
    const view = createExpertAnalysis(input);
    expect(view.querySelector('.expert-verdict')?.textContent).toContain('Lengkapi pasangan pengamatan');
    expect(view.querySelectorAll('[data-status="review"]')).toHaveLength(0);
    expect(JSON.stringify(input)).toBe(original);
});
