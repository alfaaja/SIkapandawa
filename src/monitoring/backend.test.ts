import { expect, it, vi } from 'vitest';
import { resolveMonitoringRole, createMonitoringPortalBackend } from './backend';
function client(staff: unknown, error: unknown = null, parentError: unknown = null) {
    return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user', user_metadata: { role: 'teacher' } } }, error: null }) },
        rpc: vi.fn().mockResolvedValueOnce({ data: staff, error }).mockResolvedValueOnce({ data: {}, error: parentError }) };
}
it('resolves teacher from verified staff membership and ignores user metadata for students', async () => {
    const teacher = client({ role: 'teacher', schoolName: 'SEKOLAH A' });
    expect(await resolveMonitoringRole(teacher as never)).toBe('teacher'); expect(teacher.rpc).toHaveBeenCalledOnce();
    const parent = client(null, { code: '42501' });
    expect(await resolveMonitoringRole(parent as never)).toBe('parent'); expect(parent.rpc).toHaveBeenLastCalledWith('parent_monitoring_context');
});
it.each(['master','school','forum'])('rejects %s from the monitoring form', async role => {
    await expect(resolveMonitoringRole(client({ role, schoolName: role === 'school' ? 'SEKOLAH A' : null }) as never)).rejects.toThrow('akun siswa atau guru');
});
it('fails closed on transient role errors, missing student access, malformed membership, and expired identity', async () => {
    const offline = client(null, { code: 'XX000' });
    await expect(resolveMonitoringRole(offline as never)).rejects.toThrow('belum dapat diperiksa'); expect(offline.rpc).toHaveBeenCalledOnce();
    await expect(resolveMonitoringRole(client(null, { code: '42501' }, { code: '42501' }) as never)).rejects.toThrow('tidak memiliki akses');
    await expect(resolveMonitoringRole(client({ role: 'teacher', schoolName: null }) as never)).rejects.toThrow('Sekolah');
    const expired = client(null); expired.auth.getUser.mockResolvedValue({ data: { user: null }, error: {} } as never);
    expect(await resolveMonitoringRole(expired as never)).toBeNull(); expect(expired.rpc).not.toHaveBeenCalled();
});

it.each(['parent','teacher'] as const)('shares one verified Auth session with the %s backend', async role => {
    const user = { id:'student' }; const context = { userId:'student',username:'siswa.uji',displayName:'Siswa',schoolName:'SEKOLAH A',completedPoints:[] };
    const rpc = vi.fn((name: string) => {
        const response = Promise.resolve(name === 'staff_access'
            ? role === 'teacher' ? { data:{ role:'teacher',schoolName:'SEKOLAH A' },error:null } : { data:null,error:{ code:'42501' } }
            : { data:name === 'teacher_monitoring_context' ? { students:[context] } : context,error:null });
        return Object.assign(response,{ setHeader: () => response });
    });
    const auth = { getUser:vi.fn().mockResolvedValue({ data:{ user },error:null }),
        signInWithPassword:vi.fn().mockResolvedValue({ data:{ user },error:null }), signOut:vi.fn().mockResolvedValue({ error:null }),
        getSession:vi.fn().mockResolvedValue({ data:{ session:{ user,access_token:'unit-test-token' } },error:null }) };
    const backend = createMonitoringPortalBackend({ auth,rpc } as never);
    expect(await backend.login('siswa.uji', crypto.randomUUID())).toBe(role);
    if (role === 'teacher') expect(await backend.teacher.restore()).toEqual([context]); else expect(await backend.parent.restore()).toEqual(context);
    expect(auth.signInWithPassword).toHaveBeenCalledOnce(); await backend.logout(); expect(auth.signOut).toHaveBeenCalledWith({ scope:'local' });
});
