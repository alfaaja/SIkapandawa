// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ rpc: vi.fn(), headers: vi.fn(), auth: { signInWithPassword: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() } }));
const create = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: create }));
import { createParentBackend } from './backend';
const context = { userId: 'student', displayName: 'Siswa', username: 'siswa', schoolName: 'Sekolah', completedPoints: [1] };
beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co'); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-fixture');
    create.mockReturnValue(client);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'student' } }, error: null });
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'student' }, access_token: 'fixture-token-a' } } });
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'student' } }, error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    client.rpc.mockImplementation(() => ({ setHeader: (name: string, value: string) => { client.headers(name, value); return Promise.resolve({ data: context, error: null }); } }));
});
it('isolates the parent session, verifies its owner, and pins RPC reads', async () => {
    const backend = createParentBackend();
    expect(await backend.restore()).toEqual(context);
    expect(create.mock.calls[0][2].auth.storageKey).toBe('sikapandawa.parent.auth');
    expect(create.mock.calls[0][2].auth.storage).toBe(window.sessionStorage);
    expect(client.headers).toHaveBeenCalledWith('Authorization', 'Bearer fixture-token-a');
    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'other-student' }, access_token: 'fixture-token-b' } } });
    client.rpc.mockClear();
    await expect(backend.history(0)).rejects.toThrow('Sesi berakhir');
    expect(client.rpc).not.toHaveBeenCalled();
});
it('uses student credentials without storing a password and signs out locally', async () => {
    const backend = createParentBackend();
    await expect(backend.login('ab', 'secret-fixture')).rejects.toThrow('Username atau password salah.');
    await expect(backend.login('siswa', 'secret-fixture')).resolves.toEqual(context);
    expect(localStorage.length).toBe(0);
    await backend.logout();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
