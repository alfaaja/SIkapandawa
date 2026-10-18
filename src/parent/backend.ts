import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildInternalAuthEmail, validateUsername } from '../shared/auth/username';
import { parseMonitoringHistory, record, text, type MonitoringInput, type MonitoringHistory } from '../shared/monitoring';

export interface ParentContext { userId: string; displayName: string; username: string; schoolName: string; completedPoints: number[] }
export interface ParentBackend {
    login(username: string, password: string): Promise<ParentContext>;
    restore(): Promise<ParentContext | null>;
    logout(): Promise<void>;
    submit(input: MonitoringInput, id: string): Promise<void>;
    history(offset: number): Promise<MonitoringHistory>;
}

export function createParentBackend(sharedClient?: SupabaseClient): ParentBackend {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!sharedClient && (!url || !key)) throw new Error('Layanan monitoring belum dikonfigurasi. Hubungi pengelola sekolah.');
    const client = sharedClient ?? createClient(url!, key!, { auth: { storageKey: 'sikapandawa.parent.auth', storage: window.sessionStorage,
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let owner: string | null = null;
    async function rpc(name: string, args?: Record<string, unknown>) {
        const { data } = await client.auth.getSession();
        if (!owner || data.session?.user.id !== owner) throw new Error('Sesi berakhir. Silakan masuk kembali.');
        const response = await client.rpc(name, args).setHeader('Authorization', 'Bearer ' + data.session.access_token);
        if (response.error) {
            if (response.error.code === '42501') throw new Error('Gunakan akun siswa yang sesuai untuk mengisi monitoring.');
            throw new Error('Data belum dapat diproses. Periksa isian dan koneksi, lalu coba lagi.');
        }
        return response.data;
    }
    async function context(): Promise<ParentContext> {
        const source = record(await rpc('parent_monitoring_context'));
        if (!Array.isArray(source.completedPoints) || source.completedPoints.some(n => !Number.isInteger(n) || n < 1 || n > 12)) throw new Error('Data monitoring tidak valid.');
        return { userId: text(source.userId), displayName: text(source.displayName), username: text(source.username),
            schoolName: text(source.schoolName), completedPoints: source.completedPoints as number[] };
    }
    return {
        async login(username, password) {
            if (!validateUsername(username) || !password) throw new Error('Username atau password salah.');
            const response = await client.auth.signInWithPassword({ email: await buildInternalAuthEmail(username), password });
            if (response.error || !response.data.user) throw new Error('Username atau password salah.');
            owner = response.data.user.id;
            try { return await context(); } catch (error) { owner = null; await client.auth.signOut({ scope: 'local' }); throw error; }
        },
        async restore() {
            const response = await client.auth.getUser();
            if (response.error || !response.data.user) { owner = null; return null; }
            owner = response.data.user.id;
            return context();
        },
        async logout() { owner = null; await client.auth.signOut({ scope: 'local' }); },
        async submit(input, id) {
            await rpc('submit_parent_monitoring_v2', { submission_id: id, point_number: input.pointNumber, observed_at: input.observedAt, monitoring_period: input.monitoringPeriod ?? 'Periode 1',
                guardian_name: input.guardianName, student_class: input.studentClass, situation: input.situation,
                behavior: input.behavior, reinforcement: input.reinforcement, scores: input.scores });
        },
        async history(offset) { return parseMonitoringHistory(await rpc('monitoring_history', { page_size: 25, page_offset: offset })); }
    };
}
