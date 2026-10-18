import { CHARACTER_ASPECTS, type CharacterAspect } from './game/characterAspects';
import { normalizeMonitoringPeriod, record, text } from './monitoring';

export const COMPARISON_RULE_VERSION = 'draft-1' as const;
export const COMPARISON_POLICY = 'same-point-monitoring-period' as const;
export interface MonitoringPair {
    pointNumber: number; period: string; aspect: CharacterAspect;
    parentAverage: number; teacherAverage: number; parentCount: number; teacherCount: number;
}
export interface MonitoringComparison { ruleVersion: typeof COMPARISON_RULE_VERSION; periodPolicy: typeof COMPARISON_POLICY; cells: MonitoringPair[] }
export interface AspectComparison {
    id: CharacterAspect; pairedPoints: number; pairedPeriods: number; exactAgreementPercent: number | null;
    meanAbsoluteDifference: number | null; signedBias: number | null; largeGapPoints: number;
    status: 'insufficient' | 'review' | 'no_repeated_large_gap'; trace: string[];
    points: Array<{ pointNumber: number; meanAbsoluteDifference: number; signedBias: number; exactAgreement: number }>;
}
function validNumber(value: unknown, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Pasangan monitoring tidak valid.');
    return value;
}
export function parseMonitoringComparison(value: unknown): MonitoringComparison {
    const source = record(value);
    if (source.ruleVersion !== COMPARISON_RULE_VERSION || source.periodPolicy !== COMPARISON_POLICY || !Array.isArray(source.cells)) throw new Error('Versi perbandingan monitoring tidak didukung.');
    const seen = new Set<string>();
    const cells = source.cells.map(value => {
        const cell = record(value); const aspect = text(cell.aspect) as CharacterAspect;
        const pointNumber = validNumber(cell.pointNumber, 1, 12); const period = text(cell.period);
        if (!Number.isInteger(pointNumber) || !CHARACTER_ASPECTS.some(a => a.id === aspect) || normalizeMonitoringPeriod(period) !== period || period === 'legacy') throw new Error('Periode monitoring tidak valid.');
        const key = pointNumber + ':' + period + ':' + aspect;
        if (seen.has(key)) throw new Error('Pasangan monitoring duplikat.'); seen.add(key);
        const parentCount = validNumber(cell.parentCount, 1, Number.MAX_SAFE_INTEGER);
        const teacherCount = validNumber(cell.teacherCount, 1, Number.MAX_SAFE_INTEGER);
        if (!Number.isInteger(parentCount) || !Number.isInteger(teacherCount)) throw new Error('Jumlah pengamatan tidak valid.');
        return { pointNumber, period, aspect, parentCount, teacherCount,
            parentAverage: validNumber(cell.parentAverage, 1, 4), teacherAverage: validNumber(cell.teacherAverage, 1, 4) };
    });
    if (new Set(cells.map(cell => cell.period)).size > 1) throw new Error('Pilih satu periode monitoring untuk dibandingkan.');
    return { ruleVersion: COMPARISON_RULE_VERSION, periodPolicy: COMPARISON_POLICY, cells };
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
/** Each period first averages repeated submissions, then each point receives equal weight.
 * Draft rules support review, never infer dishonesty or manipulation. */
export function evaluateMonitoringComparison(input: MonitoringComparison): AspectComparison[] {
    const data = parseMonitoringComparison(input);
    return CHARACTER_ASPECTS.map(aspect => {
        const cells = data.cells.filter(cell => cell.aspect === aspect.id);
        const points = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(pointNumber => {
            const pairs = cells.filter(cell => cell.pointNumber === pointNumber);
            if (!pairs.length) return [];
            return [{ pointNumber, meanAbsoluteDifference: mean(pairs.map(p => Math.abs(p.parentAverage - p.teacherAverage))),
                signedBias: mean(pairs.map(p => p.parentAverage - p.teacherAverage)),
                exactAgreement: mean(pairs.map(p => Math.abs(p.parentAverage - p.teacherAverage) < 1e-9 ? 1 : 0)) }];
        });
        const largeGapPoints = points.filter(p => p.meanAbsoluteDifference >= 2).length;
        const status = points.length < 6 ? 'insufficient' : largeGapPoints >= 3 ? 'review' : 'no_repeated_large_gap';
        const trace = ['R0: ' + cells.length + ' pasangan periode pada ' + points.length + ' titik; hanya periode monitoring dan nomor titik yang sama, tanggal observasi boleh berbeda.'];
        if (points.length < 6) trace.push('R1: kurang dari 6 titik berpasangan → data belum cukup.');
        else {
            trace.push('R1: minimal 6 titik berpasangan → data memenuhi batas awal.');
            trace.push('R2: ' + largeGapPoints + ' titik memiliki rata-rata selisih absolut ≥2 kategori.');
            trace.push(status === 'review' ? 'R3: minimal 3 titik berselisih besar → perlu klarifikasi.' : 'R3: kurang dari 3 titik berselisih besar → pola selisih besar berulang belum terdeteksi.');
        }
        return { id: aspect.id, pairedPoints: points.length, pairedPeriods: cells.length, largeGapPoints, status, trace, points,
            exactAgreementPercent: points.length ? mean(points.map(p => p.exactAgreement)) * 100 : null,
            meanAbsoluteDifference: points.length ? mean(points.map(p => p.meanAbsoluteDifference)) : null,
            signedBias: points.length ? mean(points.map(p => p.signedBias)) : null };
    });
}
