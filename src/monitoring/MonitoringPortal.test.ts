// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { MonitoringPortal } from './MonitoringPortal';
const student = { userId: 'student', displayName: 'Siswa Uji', username: 'siswa.uji', schoolName: 'SEKOLAH A', completedPoints: [] };
function backend(role: 'parent' | 'teacher') {
    const history = vi.fn().mockResolvedValue({ items: [], total: 0, pageSize: 25, pageOffset: 0 });
    return { login: vi.fn().mockResolvedValue(role), restore: vi.fn().mockResolvedValue(null), logout: vi.fn(),
        parent: { login: vi.fn(), restore: vi.fn().mockResolvedValue(student), logout: vi.fn(), submit: vi.fn(), history },
        teacher: { login: vi.fn(), restore: vi.fn().mockResolvedValue([student]), logout: vi.fn(), submit: vi.fn(), history } };
}
it.each(['parent','teacher'] as const)('uses a common login then opens the %s form and returns to common login on logout', async role => {
    const service = backend(role); const root = document.createElement('main'); document.body.append(root);
    await new MonitoringPortal(root, service).start();
    const password = root.querySelector<HTMLInputElement>('input[type=password]')!; password.value = crypto.randomUUID();
    root.querySelector<HTMLInputElement>('input[autocomplete=username]')!.value = 'akun.uji';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain(role === 'teacher' ? 'Pilih siswa yang diamati' : 'Nama orang tua / wali'));
    expect(password.value).toBe('');
    if (role === 'teacher') { root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await vi.waitFor(() => expect(root.textContent).toContain('Nama guru pengamat')); }
    [...root.querySelectorAll('button')].find(button => button.textContent === 'Keluar')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain('Monitoring orang tua dan guru'));
});
it('clears the password and shows a safe login failure', async () => {
    const service = backend('parent'); service.login.mockRejectedValue(new Error('Username atau password salah.'));
    const root = document.createElement('main'); await new MonitoringPortal(root, service).start();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.querySelector('[role=alert]')?.textContent).toContain('Username atau password salah'));
});
