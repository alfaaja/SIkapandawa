// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { ParentPage } from './ParentPage';
import type { ParentBackend } from './backend';

const context = { userId: 'student', displayName: 'Siswa Uji', username: 'siswa.uji', schoolName: 'Sekolah Uji', completedPoints: [] };
function fill(root: HTMLElement, point = 1) {
    const form = root.querySelector<HTMLFormElement>('.observation-form')!;
    for (const [name, value] of Object.entries({ guardianName: 'Wali Uji', situation: 'Berbagi tugas', pointNumber: String(point), kejujuran: '3', keberanian: 'na', kesopanan: '2', kebijaksanaan: '4', keadilan: '1' })) {
        (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    return form;
}
function submit(form: HTMLFormElement) { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
function backend(): ParentBackend {
    return { restore: vi.fn().mockResolvedValue(context), login: vi.fn(), logout: vi.fn(), submit: vi.fn(), history: vi.fn().mockRejectedValue(new Error('Offline')) };
}

it('retries an uncertain save with the same intent and appends a deliberate repeat with a fresh intent', async () => {
    const service = backend();
    const save = vi.mocked(service.submit).mockRejectedValueOnce(new Error('Koneksi terputus')).mockResolvedValue(undefined);
    const root = document.createElement('main'); document.body.append(root);
    await new ParentPage(root, service).start();
    const form = fill(root); submit(form);
    await vi.waitFor(() => expect(root.textContent).toContain('Koneksi terputus'));
    expect(form.querySelector('button')!.disabled).toBe(false);
    submit(form);
    await vi.waitFor(() => expect(root.textContent).toContain('Catatan titik 1 berhasil disimpan'));
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
    expect(root.textContent).toContain('Riwayat belum dapat dimuat');
    expect(root.querySelector<HTMLSelectElement>('[name=pointNumber]')!.value).toBe('2');
    submit(fill(root, 1));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls[2][1]).not.toBe(save.mock.calls[0][1]);
});

it('prevents a second submission and logout while the first save is pending', async () => {
    const service = backend(); let finish!: () => void;
    vi.mocked(service.submit).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const root = document.createElement('main'); document.body.append(root);
    await new ParentPage(root, service).start();
    const form = fill(root); submit(form); submit(form);
    expect(service.submit).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLButtonElement>('header button')!.disabled).toBe(true);
    expect([...form.querySelectorAll<HTMLInputElement>('input,select,textarea')].every(input => input.disabled)).toBe(true);
    finish();
    await vi.waitFor(() => expect(root.textContent).toContain('1 dari 12 titik'));
    expect(root.querySelector<HTMLButtonElement>('header button')!.disabled).toBe(false);
});
