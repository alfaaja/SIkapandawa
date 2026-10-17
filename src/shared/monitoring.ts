import { CHARACTER_ASPECTS, type CharacterAspect } from './game/characterAspects';

export type MonitoringScores = Record<CharacterAspect, number | null>;
export interface MonitoringInput {
    pointNumber: number; observedAt: string; guardianName: string; studentClass: string;
    situation: string; behavior: string; reinforcement: string; scores: MonitoringScores;
}
export interface MonitoringEntry extends MonitoringInput { id: string; createdAt: string }
export interface MonitoringHistory { items: MonitoringEntry[]; total: number; pageOffset: number; pageSize: number }
export interface MonitoringPoint {
    pointNumber: number;
    aspects: Array<{ id: CharacterAspect; average: number | null; studentCount: number }>;
}
export interface MonitoringSchool {
    schoolName: string; studentCount: number; participantCount: number; points: MonitoringPoint[];
}
export const MONITORING_SCALE = [
    ['na', 'N/A — Tidak ada kesempatan yang cukup untuk mengamati nilai tersebut.'],
    ['1', '1 — Belum tampak meskipun sudah diberi pengingat.'],
    ['2', '2 — Muncul setelah diberi arahan atau contoh.'],
    ['3', '3 — Muncul dengan cukup mandiri, tetapi masih memerlukan pengingat ringan.'],
    ['4', '4 — Muncul atas kemauan sendiri pada situasi yang diamati.']
] as const;

export function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Data monitoring tidak valid.');
    return value as Record<string, unknown>;
}
export function text(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Data monitoring tidak valid.');
    return value;
}
function count(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error('Data monitoring tidak valid.');
    return value;
}
export function parseMonitoringScores(value: unknown): MonitoringScores {
    const source = record(value);
    if (Object.keys(source).length !== 5) throw new Error('Pilih nilai untuk kelima aspek.');
    return Object.fromEntries(CHARACTER_ASPECTS.map(aspect => {
        const score = source[aspect.id];
        if (score !== null) count(score, 1, 4);
        return [aspect.id, score];
    })) as MonitoringScores;
}
export function parseMonitoringHistory(value: unknown): MonitoringHistory {
    const source = record(value);
    if (!Array.isArray(source.items)) throw new Error('Riwayat monitoring tidak valid.');
    return { total: count(source.total), pageOffset: count(source.pageOffset), pageSize: count(source.pageSize, 1, 50),
        items: source.items.map(item => {
            const entry = record(item);
            return { id: text(entry.id), createdAt: text(entry.createdAt), pointNumber: count(entry.pointNumber, 1, 12),
                observedAt: text(entry.observedAt), guardianName: text(entry.guardianName), studentClass: text(entry.studentClass),
                situation: text(entry.situation), behavior: text(entry.behavior), reinforcement: text(entry.reinforcement), scores: parseMonitoringScores(entry.scores) };
        }) };
}
export function parseMonitoringSummary(value: unknown): MonitoringSchool[] {
    if (!Array.isArray(value)) throw new Error('Ringkasan monitoring tidak valid.');
    return value.map(item => {
        const school = record(item);
        const studentCount = count(school.studentCount, 1);
        if (!Array.isArray(school.points) || school.points.length !== 12) throw new Error('Ringkasan harus memiliki 12 titik.');
        const points = school.points.map((item, i) => {
            const point = record(item);
            if (point.pointNumber !== i + 1 || !Array.isArray(point.aspects) || point.aspects.length !== 5) throw new Error('Titik monitoring tidak valid.');
            const values = point.aspects;
            return { pointNumber: i + 1, aspects: CHARACTER_ASPECTS.map(aspect => {
                const score = record(values.find(item => record(item).id === aspect.id));
                const n = count(score.studentCount, 0, studentCount);
                if (score.average !== null && (typeof score.average !== 'number' || !Number.isFinite(score.average) || score.average < 1 || score.average > 4)) throw new Error('Rata-rata monitoring tidak valid.');
                if ((n === 0) !== (score.average === null)) throw new Error('Jumlah pengamatan tidak sesuai.');
                return { id: aspect.id, average: score.average as number | null, studentCount: n };
            }) };
        });
        return { schoolName: text(school.schoolName), studentCount, participantCount: count(school.participantCount, 0, studentCount), points };
    });
}
