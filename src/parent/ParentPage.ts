import { createElement, replaceContent } from '../admin/ui/dom';
import { CHARACTER_ASPECTS } from '../shared/game/characterAspects';
import { MONITORING_SCALE, parseMonitoringScores } from '../shared/monitoring';
import { MonitoringHistoryView } from '../shared/ui/MonitoringHistoryView';
import type { ParentBackend, ParentContext } from './backend';

export class ParentPage {
    private guardianName = '';
    private studentClass = '';
    constructor(private readonly root: HTMLElement, private readonly backend: ParentBackend) {}

    async start(): Promise<void> {
        try { const context = await this.backend.restore(); if (context) { this.showForm(context); return; } }
        catch { /* Login remains available when session restoration fails. */ }
        this.showLogin();
    }
    private heading(title: string, description: string): HTMLElement {
        const header = createElement('header', { className: 'parent-heading' });
        header.append(createElement('p', { className: 'eyebrow', text: 'SIKAPANDAWA · ORANG TUA / WALI' }),
            createElement('h1', { text: title }), createElement('p', { text: description }));
        return header;
    }
    private field(parent: HTMLElement, label: string, name: string, type = 'text', required = true, maxLength = 100): HTMLInputElement | HTMLTextAreaElement {
        const wrapper = createElement('label', { className: 'parent-field', text: label });
        const input = type === 'textarea' ? createElement('textarea') : createElement('input');
        input.name = name; input.required = required; input.maxLength = maxLength;
        if (input instanceof HTMLInputElement) input.type = type;
        wrapper.append(input); parent.append(wrapper); return input;
    }
    private showLogin(): void {
        const form = createElement('form', { className: 'parent-card parent-login' });
        const username = this.field(form, 'Username siswa', 'username') as HTMLInputElement;
        username.autocomplete = 'username'; username.maxLength = 20;
        const password = this.field(form, 'Password siswa', 'password', 'password') as HTMLInputElement;
        password.autocomplete = 'current-password'; password.maxLength = 128;
        const error = createElement('p', { className: 'parent-status', attributes: { role: 'alert' } });
        const button = createElement('button', { className: 'button button-primary', text: 'Masuk ke monitoring', attributes: { type: 'submit' } });
        form.append(error, button);
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (button.disabled) return; button.disabled = true;
            try { const context = await this.backend.login(username.value, password.value); password.value = ''; this.showForm(context); }
            catch (e) { password.value = ''; error.textContent = e instanceof Error ? e.message : 'Belum dapat masuk. Coba lagi.'; }
            finally { button.disabled = false; }
        });
        replaceContent(this.root, this.heading('Monitoring di rumah', 'Masuk menggunakan username dan password akun game siswa. Isi pengamatan sesuai buku monitoring.'), form);
    }
    private showForm(context: ParentContext, message = ''): void {
        const identity = this.heading('Monitoring 12 titik', context.displayName + ' · @' + context.username + ' · ' + context.schoolName);
        const logout = createElement('button', { className: 'button button-secondary', text: 'Keluar', attributes: { type: 'button' } });
        identity.append(logout);
        const form = createElement('form', { className: 'parent-card observation-form' });
        form.append(createElement('h2', { text: 'Catat satu kesempatan observasi' }),
            createElement('p', { text: 'Tidak harus 12 hari berturut-turut. Isi bertahap pada situasi nyata. N/A berarti tidak ada kesempatan mengamati; jangan menebak skor.' }),
            createElement('p', { className: 'parent-progress', text: context.completedPoints.length + ' dari 12 titik sudah memiliki catatan.' }));
        const guardian = this.field(form, 'Nama orang tua / wali', 'guardianName') as HTMLInputElement;
        guardian.value = this.guardianName; guardian.minLength = 2;
        const studentClass = this.field(form, 'Kelas siswa (opsional)', 'studentClass', 'text', false, 50);
        studentClass.value = this.studentClass;
        const pointLabel = createElement('label', { className: 'parent-field', text: 'Titik observasi' });
        const point = createElement('select', { attributes: { name: 'pointNumber', required: '', 'aria-label': 'Titik observasi' } });
        for (let i = 1; i <= 12; i++) point.append(createElement('option', { text: 'Titik ' + i + (context.completedPoints.includes(i) ? ' — sudah ada catatan' : ''), attributes: { value: String(i) } }));
        point.value = String(Array.from({ length: 12 }, (_, i) => i + 1).find(i => !context.completedPoints.includes(i)) ?? 1);
        pointLabel.append(point); form.append(pointLabel);
        const observedAt = this.field(form, 'Tanggal dan waktu observasi', 'observedAt', 'datetime-local');
        observedAt.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const situation = this.field(form, 'Situasi yang diamati', 'situation', 'textarea', true, 1500);
        const ratings = createElement('fieldset', { className: 'parent-ratings' });
        ratings.append(createElement('legend', { text: 'Nilai kelima aspek' }));
        const inputs = CHARACTER_ASPECTS.map(aspect => {
            const label = createElement('label', { className: 'parent-field', text: aspect.label });
            const select = createElement('select', { attributes: { name: aspect.id, required: '', 'aria-label': aspect.label } });
            select.append(createElement('option', { text: 'Pilih nilai', attributes: { value: '' } }));
            for (const [value, description] of MONITORING_SCALE) select.append(createElement('option', { text: description, attributes: { value } }));
            label.append(select); ratings.append(label); return { id: aspect.id, select };
        });
        form.append(ratings);
        const behavior = this.field(form, 'Contoh perilaku nyata (opsional)', 'behavior', 'textarea', false, 2000);
        const reinforcement = this.field(form, 'Penguatan / arahan orang tua (opsional)', 'reinforcement', 'textarea', false, 2000);
        const status = createElement('p', { className: 'parent-status', text: message, attributes: { role: 'status', 'aria-live': 'polite' } });
        const submit = createElement('button', { className: 'button button-primary', text: 'Simpan catatan', attributes: { type: 'submit' } });
        form.append(createElement('p', { className: 'parent-note', text: 'Pengisian ulang titik yang sama menjadi catatan baru. Catatan lama tetap tersimpan.' }), status, submit);
        const history = new MonitoringHistoryView();
        let active = true;
        let pendingId: string | null = null;
        form.addEventListener('input', () => { pendingId = null; });
        logout.addEventListener('click', async () => {
            if (submit.disabled) return; logout.disabled = true;
            try { await this.backend.logout(); active = false; this.guardianName = ''; this.studentClass = ''; this.showLogin(); }
            catch { logout.disabled = false; status.textContent = 'Belum dapat keluar. Coba lagi.'; }
        });
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (submit.disabled) return;
            submit.disabled = true; logout.disabled = true;
            const controls = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')];
            try {
                const input = { pointNumber: Number(point.value), observedAt: new Date(observedAt.value).toISOString(),
                    guardianName: guardian.value.trim(), studentClass: studentClass.value.trim(), situation: situation.value.trim(),
                    behavior: behavior.value.trim(), reinforcement: reinforcement.value.trim(),
                    scores: parseMonitoringScores(Object.fromEntries(inputs.map(({ id, select }) => [id, select.value === 'na' ? null : Number(select.value)]))) };
                pendingId ??= crypto.randomUUID();
                controls.forEach(control => { control.disabled = true; });
                await this.backend.submit(input, pendingId);
                active = false; this.guardianName = input.guardianName; this.studentClass = input.studentClass;
                this.showForm({ ...context, completedPoints: [...new Set([...context.completedPoints, input.pointNumber])] }, 'Catatan titik ' + input.pointNumber + ' berhasil disimpan sebagai catatan baru.');
            } catch (e) { status.textContent = e instanceof Error ? e.message : 'Catatan belum tersimpan. Coba lagi.'; }
            finally { submit.disabled = false; logout.disabled = false; controls.forEach(control => { control.disabled = false; }); }
        });
        replaceContent(this.root, identity, form, history.element);
        void this.backend.history(0).then(page => { if (active) history.render(page, offset => this.backend.history(offset)); })
            .catch(() => { if (active) history.element.textContent = 'Riwayat belum dapat dimuat. Catatan yang sudah berhasil disimpan tetap aman; muat ulang halaman untuk mencoba lagi.'; });
    }
}
