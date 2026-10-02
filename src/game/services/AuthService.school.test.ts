// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => ({ configured: false, signUp: vi.fn(), from: vi.fn() }));
vi.mock('./SupabaseClient', () => ({
    getSupabaseClient: () => remote.configured ? { auth: { signUp: remote.signUp }, from: remote.from } : null,
    isSupabaseConfigured: () => remote.configured,
    isLocalFallbackAllowed: () => true,
    getSupabaseConfigurationError: () => 'Configuration missing'
}));
vi.mock('../../shared/auth/username', async importOriginal => ({
    ...await importOriginal<object>(), buildInternalAuthEmail: async () => 'test@example.test'
}));
import { AuthService } from './AuthService';

describe('registration school', () => {
    beforeEach(() => { localStorage.clear(); remote.configured = false; });
    it('requires a school before creating an account', async () => {
        expect(await AuthService.register('Siswa', 'siswa', 'password123', '')).toMatchObject({ ok: false });
        expect(localStorage.getItem('sikapandawa.accounts')).toBeNull();
    });
    it('keeps the school in local accounts and restored profiles', async () => {
        const result = await AuthService.register('Siswa', 'siswa', 'password123', 'SDN Sekolah Kedua');
        expect(result).toMatchObject({ ok: true, account: { schoolName: 'SDN SEKOLAH KEDUA' } });
        expect(AuthService.getActiveAccount()?.schoolName).toBe('SDN SEKOLAH KEDUA');
    });
    it('sends school metadata to Supabase signup and reads it back from profiles', async () => {
        remote.configured = true;
        remote.signUp.mockResolvedValue({ data: { user: { id: 'player-id' }, session: {} }, error: null });
        remote.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: {
            id: 'player-id', display_name: 'Siswa', username: 'siswa', school_name: 'SDN SEKOLAH KEDUA', created_at: '2026-10-02'
        }, error: null }) }) }) });
        expect(await AuthService.register('Siswa', 'siswa', 'password123', 'SDN Sekolah Kedua'))
            .toMatchObject({ ok: true, account: { schoolName: 'SDN SEKOLAH KEDUA' } });
        expect(remote.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: expect.objectContaining({ school_name: 'SDN SEKOLAH KEDUA' }) } }));
    });
});
