import { CHARACTER_ASPECTS } from './game/characterAspects';
import { parseMonitoringHistory, type MonitoringEntry, type MonitoringHistory, type MonitoringSchool } from './monitoring';
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
export function demoHistory(userId: string, offset = 0): MonitoringHistory {
    const entries = demoEntries().filter(row => row.userId === userId).reverse();
    return parseMonitoringHistory({ total: entries.length, pageSize: 25, pageOffset: offset, items: entries.slice(offset, offset + 25) });
}
export function demoSummary(users: Array<{ userId: string; schoolName: string; isAdmin?: boolean }>, school: unknown, target?: unknown): MonitoringSchool[] {
    const students = users.filter(user => !user.isAdmin && (!school || user.schoolName === school) && (!target || user.userId === target));
    const rows = demoEntries();
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
