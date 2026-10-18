import { CHARACTER_ASPECTS } from './game/characterAspects';
import { normalizeMonitoringPeriod, parseMonitoringHistory, type MonitoringEntry, type MonitoringHistory, type MonitoringSchool, type MonitoringReporter } from './monitoring';
import type { MonitoringComparison, MonitoringPair } from './monitoringComparison';
const KEY = 'sikapandawa.monitoring.demo';
export const DEMO_STUDENT = '00000000-0000-4000-8000-000000000001';
export interface DemoEntry extends MonitoringEntry { userId: string }
export function demoEntries(): DemoEntry[] {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as DemoEntry[]; } catch { return []; }
}
export function appendDemoEntry(entry: DemoEntry): void {
    const rows = demoEntries();
    if (!rows.some(row => row.id === entry.id)) localStorage.setItem(KEY, JSON.stringify([...rows, entry]));
}
export function demoHistory(userId: string, offset = 0, reporterType: MonitoringReporter = 'parent', monitoringPeriod?: string | null): MonitoringHistory {
    const entries = demoEntries().filter(row => row.userId === userId && (row.reporterType ?? 'parent') === reporterType
        && (!monitoringPeriod || (row.monitoringPeriod ?? 'legacy') === normalizeMonitoringPeriod(monitoringPeriod))).reverse();
    return parseMonitoringHistory({ total: entries.length, pageSize: 25, pageOffset: offset, items: entries.slice(offset, offset + 25) });
}
export function demoSummary(users: Array<{ userId: string; schoolName: string; isAdmin?: boolean }>, school: unknown, target?: unknown, reporterType: MonitoringReporter = 'parent', monitoringPeriod?: string | null): MonitoringSchool[] {
    const students = users.filter(user => !user.isAdmin && (!school || user.schoolName === school) && (!target || user.userId === target));
    const rows = demoEntries().filter(row => (row.reporterType ?? 'parent') === reporterType
        && (!monitoringPeriod || (row.monitoringPeriod ?? 'legacy') === normalizeMonitoringPeriod(monitoringPeriod)));
    return [...new Set(students.map(user => user.schoolName))].sort().map(schoolName => {
        const cohort = students.filter(user => user.schoolName === schoolName);
        return { schoolName, studentCount: cohort.length, participantCount: cohort.filter(user => rows.some(row => row.userId === user.userId)).length,
            points: Array.from({ length: 12 }, (_, i) => ({ pointNumber: i + 1,
                aspects: CHARACTER_ASPECTS.map(aspect => {
                    const means = cohort.flatMap(user => {
                        const values = rows.filter(row => row.userId === user.userId && row.pointNumber === i + 1).map(row => row.scores[aspect.id]).filter((score): score is number => score !== null);
                        return values.length ? [values.reduce((a, b) => a + b, 0) / values.length] : [];
                    });
                    return { id: aspect.id, average: means.length ? means.reduce((a, b) => a + b, 0) / means.length : null, studentCount: means.length };
                }) })) };
    });
}
export function demoComparison(userId: string, monitoringPeriod = 'Periode 1'): MonitoringComparison {
    const selectedPeriod = normalizeMonitoringPeriod(monitoringPeriod);
    const rows = demoEntries().filter(row => row.userId === userId && row.monitoringPeriod === selectedPeriod);
    const groups = new Map<string, { pointNumber: number; period: string; aspect: MonitoringPair['aspect']; parent: number[]; teacher: number[] }>();
    for (const row of rows) {
        const period = selectedPeriod;
        for (const aspect of CHARACTER_ASPECTS) {
            const score = row.scores[aspect.id]; if (score === null) continue;
            const key = row.pointNumber + ':' + period + ':' + aspect.id;
            const group = groups.get(key) ?? { pointNumber: row.pointNumber, period, aspect: aspect.id, parent: [], teacher: [] };
            group[row.reporterType ?? 'parent'].push(score); groups.set(key, group);
        }
    }
    return { ruleVersion: 'draft-1', periodPolicy: 'same-point-monitoring-period', cells: [...groups.values()].flatMap(group => {
        if (!group.parent.length || !group.teacher.length) return [];
        const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
        return [{ pointNumber: group.pointNumber, period: group.period, aspect: group.aspect, parentAverage: mean(group.parent), teacherAverage: mean(group.teacher), parentCount: group.parent.length, teacherCount: group.teacher.length }];
    }) };
}
