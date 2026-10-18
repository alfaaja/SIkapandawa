import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createParentBackend, type ParentBackend } from '../parent/backend';
import { createTeacherBackend, type TeacherBackend } from '../teacher/backend';
import { buildInternalAuthEmail, validateUsername } from '../shared/auth/username';
import { parseStaffAccess } from '../shared/auth/staff';

export type MonitoringRole = 'parent' | 'teacher';
export interface MonitoringPortalBackend {
    parent: ParentBackend; teacher: TeacherBackend;
    login(username: string, password: string): Promise<MonitoringRole>;
    restore(): Promise<MonitoringRole | null>;
    logout(): Promise<void>;
}

export async function resolveMonitoringRole(client: SupabaseClient): Promise<MonitoringRole | null> {
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) return null;
    const staff = await client.rpc('staff_access');
    if (!staff.error) {
        if (parseStaffAccess(staff.data).role === 'teacher') return 'teacher';
        throw new Error('Gunakan akun siswa atau guru. Akun admin masuk melalui panel admin.');
    }
    if (staff.error.code !== '42501') throw new Error('Hak akses monitoring belum dapat diperiksa. Coba lagi.');
    const parent = await client.rpc('parent_monitoring_context');
    if (parent.error) throw new Error('Akun ini tidak memiliki akses pengisian monitoring.');
    return 'parent';
}

export function createMonitoringPortalBackend(sharedClient?: SupabaseClient): MonitoringPortalBackend {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim(); const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!sharedClient && (!url || !key)) throw new Error('Layanan monitoring belum dikonfigurasi. Hubungi pengelola sekolah.');
    const client = sharedClient ?? createClient(url!, key!, { auth: { storageKey: 'sikapandawa.monitoring.auth', storage: window.sessionStorage,
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const logout = async () => { await client.auth.signOut({ scope: 'local' }); };
    return {
        parent: createParentBackend(client), teacher: createTeacherBackend(client), logout,
        async login(username, password) {
            if (!validateUsername(username) || !password) throw new Error('Username atau password salah.');
            const result = await client.auth.signInWithPassword({ email: await buildInternalAuthEmail(username), password });
            if (result.error || !result.data.user) { await logout(); throw new Error('Username atau password salah.'); }
            try { const role = await resolveMonitoringRole(client); if (!role) throw new Error('Sesi berakhir. Silakan masuk kembali.'); return role; }
            catch (error) { await logout(); throw error; }
        },
        async restore() {
            try { return await resolveMonitoringRole(client); }
            catch (error) { await logout(); throw error; }
        }
    };
}
