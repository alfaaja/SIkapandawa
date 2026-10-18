import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildInternalAuthEmail, validateUsername } from '../shared/auth/username';
import { parseMonitoringHistory, record, text, type MonitoringHistory, type MonitoringInput } from '../shared/monitoring';
import type { ParentContext } from '../parent/backend';

export interface TeacherBackend {
    login(username: string, password: string): Promise<ParentContext[]>;
    restore(): Promise<ParentContext[] | null>;
    logout(): Promise<void>;
    submit(userId: string, input: MonitoringInput, id: string): Promise<void>;
    history(userId: string, offset: number): Promise<MonitoringHistory>;
}
export function parseTeacherRoster(value: unknown): ParentContext[] {
    const source = record(value);
    if (!Array.isArray(source.students)) throw new Error('Daftar siswa tidak valid.');
    const ids = new Set<string>();
    return source.students.map(value => {
        const row = record(value); const userId = text(row.userId);
        if (ids.has(userId) || !Array.isArray(row.completedPoints) || row.completedPoints.some(n => !Number.isInteger(n) || n < 1 || n > 12)) throw new Error('Daftar siswa tidak valid.');
        ids.add(userId);
        return { userId, displayName: text(row.displayName), username: text(row.username), schoolName: text(row.schoolName), completedPoints: row.completedPoints as number[] };
    });
}
export function createTeacherBackend(sharedClient?: SupabaseClient): TeacherBackend {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim(); const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!sharedClient && (!url || !key)) throw new Error('Layanan monitoring belum dikonfigurasi. Hubungi pengelola sekolah.');
    const client = sharedClient ?? createClient(url!, key!, { auth: { storageKey: 'sikapandawa.teacher.auth', storage: window.sessionStorage,
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let owner: string | null = null;
    async function rpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
        const { data } = await client.auth.getSession();
        if (!owner || data.session?.user.id !== owner) throw new Error('Sesi berakhir. Silakan masuk kembali.');
        const response = await client.rpc(name, args).setHeader('Authorization', 'Bearer ' + data.session.access_token);
        if (response.error) throw new Error(response.error.code === '42501' ? 'Gunakan akun guru untuk sekolah yang sesuai.' : 'Data belum dapat diproses. Periksa isian dan koneksi, lalu coba lagi.');
        return response.data;
    }
    async function roster(): Promise<ParentContext[]> { return parseTeacherRoster(await rpc('teacher_monitoring_context')); }
    return {
        async login(username, password) {
            if (!validateUsername(username) || !password) throw new Error('Username atau password salah.');
            const response = await client.auth.signInWithPassword({ email: await buildInternalAuthEmail(username), password });
            if (response.error || !response.data.user) throw new Error('Username atau password salah.');
            owner = response.data.user.id;
            try { return await roster(); } catch (error) { owner = null; await client.auth.signOut({ scope: 'local' }); throw error; }
        },
        async restore() {
            const response = await client.auth.getUser();
            if (response.error || !response.data.user) { owner = null; return null; }
            owner = response.data.user.id;
            try { return await roster(); } catch (error) { owner = null; await client.auth.signOut({ scope: 'local' }); throw error; }
        },
        async logout() { owner = null; await client.auth.signOut({ scope: 'local' }); },
        async submit(userId, input, id) {
            await rpc('submit_teacher_monitoring', { target_user_id: userId, submission_id: id, point_number: input.pointNumber,
                observed_at: input.observedAt, monitoring_period: input.monitoringPeriod ?? 'Periode 1', guardian_name: input.guardianName, student_class: input.studentClass,
                situation: input.situation, behavior: input.behavior, reinforcement: input.reinforcement, scores: input.scores });
        },
        async history(userId, offset) { return parseMonitoringHistory(await rpc('monitoring_history_v2', { reporter_type: 'teacher', target_user_id: userId, page_size: 25, page_offset: offset })); }
    };
}
