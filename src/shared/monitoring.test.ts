import { expect, it } from 'vitest';
import { parseMonitoringScores, parseMonitoringHistory, parseMonitoringSummary, numberedMonitoringPeriod, monitoringPeriodNumber } from './monitoring';
const scores = { kejujuran: 4, keberanian: null, kesopanan: 2, kebijaksanaan: 3, keadilan: 1 };
it('maps integer-only period inputs to existing period identifiers without rewriting historical names', () => {
    expect(numberedMonitoringPeriod('1')).toBe('periode 1');
    expect(numberedMonitoringPeriod(' 002 ')).toBe('periode 2');
    expect(monitoringPeriodNumber('Periode 2')).toBe(2);
    expect(monitoringPeriodNumber('legacy')).toBeNull();
    expect(monitoringPeriodNumber('Siklus kedua')).toBeNull();
    for (const input of ['', '0', '-1', '1.5', '1e2', 'Periode 1', '9007199254740992']) expect(() => numberedMonitoringPeriod(input)).toThrow();
});
it('uses the book scale 1–4 and preserves N/A as null', () => {
    expect(parseMonitoringScores(scores)).toEqual(scores);
    for (const value of [0, 5, '4', undefined]) expect(() => parseMonitoringScores({ ...scores, kejujuran: value })).toThrow();
    expect(() => parseMonitoringScores({ kejujuran: 4 })).toThrow();
});
it('rejects incomplete 12-point chart data instead of showing fabricated zeroes', () => {
    expect(parseMonitoringSummary([])).toEqual([]);
    expect(() => parseMonitoringSummary([{ schoolName: 'School', points: [] }])).toThrow();
    expect(() => parseMonitoringHistory({ items: [], total: -1 })).toThrow();
});
