// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ rpc: vi.fn(), headers: vi.fn(), auth: { signInWithPassword: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() } }));
const create = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: create }));
import { createTeacherBackend, parseTeacherRoster } from './backend';
const student = { userId: 'student', displayName: 'Siswa', username: 'siswa', schoolName: 'Sekolah', completedPoints: [1] };
beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co'); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-fixture');
    create.mockReturnValue(client); client.auth.getUser.mockResolvedValue({ data: { user: { id: 'teacher' } }, error: null });
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'teacher' }, access_token: 'fixture-token' } } });
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'teacher' } }, error: null }); client.auth.signOut.mockResolvedValue({ error: null });
    client.rpc.mockImplementation(() => ({ setHeader: (name: string, value: string) => { client.headers(name, value); return Promise.resolve({ data: { students: [student] }, error: null }); } }));
});
it('isolates teacher credentials, pins the authenticated RPC and rejects a switched session owner', async () => {
    const backend = createTeacherBackend(); expect(await backend.login('guru.satu', 'test-only')).toEqual([student]);
    expect(create.mock.calls[0][2].auth.storageKey).toBe('sikapandawa.teacher.auth'); expect(create.mock.calls[0][2].auth.storage).toBe(window.sessionStorage);
    expect(client.rpc).toHaveBeenCalledWith('teacher_monitoring_context', undefined); expect(client.headers).toHaveBeenCalledWith('Authorization', 'Bearer fixture-token');
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'other' }, access_token: 'other' } } });
    client.rpc.mockClear(); await expect(backend.history('student', 0)).rejects.toThrow('Sesi berakhir'); expect(client.rpc).not.toHaveBeenCalled();
});
it('signs out an unauthorized role instead of retaining access to the teacher form', async () => {
    client.rpc.mockReturnValue({ setHeader: () => Promise.resolve({ data: null, error: { code: '42501' } }) });
    const backend = createTeacherBackend(); await expect(backend.login('siswa', 'test-only')).rejects.toThrow('Gunakan akun guru');
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }); await expect(backend.history('student', 0)).rejects.toThrow('Sesi berakhir');
});
it('validates roster shapes and rejects impossible points and duplicate students', () => {
    expect(() => parseTeacherRoster({ students: [student, student] })).toThrow();
    expect(() => parseTeacherRoster({ students: [{ ...student, completedPoints: [13] }] })).toThrow();
});
