// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { TeacherPage } from './TeacherPage';
import type { TeacherBackend } from './backend';
const student = { userId: 'student', displayName: 'Siswa Satu', username: 'siswa.satu', schoolName: 'Sekolah A', completedPoints: [] };
function backend(): TeacherBackend { return { restore: vi.fn().mockResolvedValue([student]), login: vi.fn(), logout: vi.fn(), submit: vi.fn(), history: vi.fn().mockResolvedValue({ total: 0, pageOffset: 0, pageSize: 25, items: [] }) }; }
it('selects a scoped student and saves separately as a teacher, preserving retries and N/A', async () => {
    const service = backend(); vi.mocked(service.submit).mockRejectedValueOnce(new Error('Koneksi terputus')).mockResolvedValue(undefined);
    const root = document.createElement('main'); document.body.append(root); await new TeacherPage(root, service).start();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('Nama guru pengamat'));
    expect(root.textContent).not.toContain('Nama orang tua / wali');
    const form = root.querySelector<HTMLFormElement>('.observation-form')!;
    const period = form.elements.namedItem('monitoringPeriod') as HTMLInputElement;
    expect(period.type).toBe('number'); expect(period.value).toBe('1');
    period.stepUp(); expect(period.value).toBe('2'); period.stepDown();
    for (const [name, value] of Object.entries({ guardianName: 'Guru Satu', situation: 'Diskusi kelompok', kejujuran: '4', keberanian: 'na', kesopanan: '2', kebijaksanaan: '3', keadilan: '1' })) (form.elements.namedItem(name) as HTMLInputElement).value = value;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('Koneksi terputus'));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('Catatan titik 1 berhasil disimpan'));
    expect(service.submit).toHaveBeenCalledTimes(2); expect(vi.mocked(service.submit).mock.calls[0]).toEqual(vi.mocked(service.submit).mock.calls[1]);
    expect(vi.mocked(service.submit).mock.calls[0][0]).toBe(student.userId);
    expect(vi.mocked(service.submit).mock.calls[0][1].scores.keberanian).toBeNull();
    expect(vi.mocked(service.submit).mock.calls[0][1].monitoringPeriod).toBe('periode 1');
    const back = root.querySelector<HTMLButtonElement>('.parent-heading-actions button')!;
    expect(back.textContent).toBe('Pilih siswa lain'); back.click();
    await vi.waitFor(() => expect(root.textContent).toContain('Pilih siswa yang diamati'));
});
it('keeps teacher login separate and clears the entered password on errors', async () => {
    const service = backend(); vi.mocked(service.restore).mockResolvedValue(null); vi.mocked(service.login).mockRejectedValue(new Error('Gunakan akun guru'));
    const root = document.createElement('main'); await new TeacherPage(root, service).start();
    const password = root.querySelector<HTMLInputElement>('input[type=password]')!; password.value = 'temporary-test-only';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain('Gunakan akun guru')); expect(password.value).toBe('');
});
