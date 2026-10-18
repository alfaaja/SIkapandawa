import { describe, expect, it } from 'vitest';
import { evaluateMonitoringComparison, parseMonitoringComparison, type MonitoringComparison, type MonitoringPair } from './monitoringComparison';
const pair = (pointNumber: number, parentAverage = 4, teacherAverage = 2, period = 'periode 1'): MonitoringPair => ({ pointNumber, period, aspect: 'kejujuran', parentAverage, teacherAverage, parentCount: 1, teacherCount: 1 });
const input = (cells: MonitoringPair[]): MonitoringComparison => ({ ruleVersion: 'draft-1', periodPolicy: 'same-point-monitoring-period', cells });
describe('draft forward chaining monitoring rules', () => {
    it('requires six distinct points rather than treating repeat submissions as more points', () => {
        const result = evaluateMonitoringComparison(input([{ ...pair(1), parentCount: 10, teacherCount: 10 }]))[0];
        expect(result.pairedPeriods).toBe(1); expect(result.pairedPoints).toBe(1); expect(result.status).toBe('insufficient');
        expect(result.trace[result.trace.length - 1]).toContain('data belum cukup');
    });
    it('triggers review only at the documented inclusive thresholds and preserves reasons', () => {
        const cells = Array.from({ length: 6 }, (_, i) => pair(i + 1, 4, i < 3 ? 2 : 4));
        const result = evaluateMonitoringComparison(input(cells))[0];
        expect(result.status).toBe('review'); expect(result.largeGapPoints).toBe(3);
        expect(result.exactAgreementPercent).toBe(50); expect(result.meanAbsoluteDifference).toBe(1); expect(result.signedBias).toBe(1);
        expect(result.trace[result.trace.length - 1]).toContain('perlu klarifikasi');
        cells[2].teacherAverage = 2.01;
        expect(evaluateMonitoringComparison(input(cells))[0].status).toBe('no_repeated_large_gap');
    });
    it('weights points equally and does not cancel opposite-direction discrepancies', () => {
        const result = evaluateMonitoringComparison(input([pair(1, 4, 1), pair(2, 1, 4), pair(3, 3, 3)]))[0];
        expect(result.meanAbsoluteDifference).toBe(2); expect(result.signedBias).toBe(0); expect(result.exactAgreementPercent).toBeCloseTo(100/3);
    });
    it('keeps absent aspects unknown rather than zero', () => {
        const results = evaluateMonitoringComparison(input([])); expect(results).toHaveLength(5);
        expect(results.every(r => r.status === 'insufficient' && r.meanAbsoluteDifference === null && r.exactAgreementPercent === null)).toBe(true);
    });
    it('rejects duplicate pairs, invented versions, mixed periods, N/A coercion and impossible score ranges', () => {
        for (const data of [input([pair(1), pair(1)]), { ...input([]), ruleVersion: 'final' }, input([pair(1), pair(2,4,2,'periode 2')]), input([pair(1,4,2,'legacy')]),
            input([{ ...pair(1), parentAverage: null as never }]), input([{ ...pair(1), teacherAverage: 5 }]), input([{ ...pair(1), pointNumber: 1.5 }])]) expect(() => parseMonitoringComparison(data)).toThrow();
    });
});
