export type StaffRole = 'master' | 'school' | 'forum' | 'teacher';
export interface StaffAccess { role: StaffRole; schoolName: string | null }
export interface StaffAccountInput {
    displayName: string; username: string; password: string;
    role: Exclude<StaffRole, 'master'>; schoolName?: string;
}
export interface StaffAccountItem {
    userId: string; displayName: string; username: string;
    role: StaffRole; schoolName: string | null;
}
export function parseStaffAccess(value: unknown): StaffAccess {
    if (!value || typeof value !== 'object') throw new Error('Hak akses staf tidak valid.');
    const data = value as Record<string, unknown>;
    if (typeof data.role !== 'string' || !['master','school','forum','teacher'].includes(data.role)) throw new Error('Hak akses staf tidak valid.');
    const scoped = data.role === 'school' || data.role === 'teacher';
    if (scoped ? typeof data.schoolName !== 'string' || !data.schoolName.trim() : data.schoolName !== null) {
        throw new Error('Sekolah staf tidak valid.');
    }
    return { role: data.role as StaffRole, schoolName: data.schoolName as string | null };
}
