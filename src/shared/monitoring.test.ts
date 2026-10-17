import { expect, it } from 'vitest';
import { parseMonitoringScores, parseMonitoringHistory, parseMonitoringSummary } from './monitoring';
const scores = { kejujuran: 4, keberanian: null, kesopanan: 2, kebijaksanaan: 3, keadilan: 1 };
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
