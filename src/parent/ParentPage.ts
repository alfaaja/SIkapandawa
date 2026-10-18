import { createElement, replaceContent } from '../admin/ui/dom';
import { CHARACTER_ASPECTS } from '../shared/game/characterAspects';
import { MONITORING_SCALE, numberedMonitoringPeriod, parseMonitoringScores } from '../shared/monitoring';
import { MonitoringHistoryView } from '../shared/ui/MonitoringHistoryView';
import type { ParentBackend, ParentContext } from './backend';

export class ParentPage {
    private guardianName = '';
    private studentClass = '';
    private monitoringPeriod = '1';
    constructor(private readonly root: HTMLElement, private readonly backend: ParentBackend, private readonly teacherMode = false,
        private readonly chooseStudent?: () => Promise<void>, private readonly onSignedOut?: () => void) {}

    async start(): Promise<void> {
        try { const context = await this.backend.restore(); if (context) { this.showForm(context); return; } }
        catch { /* Login remains available when session restoration fails. */ }
        this.showLogin();
    }
    private heading(title: string, description: string): HTMLElement {
        const header = createElement('header', { className: 'parent-heading' });
        const copy = createElement('div', { className: 'parent-heading-copy' });
        copy.append(createElement('p', { className: 'eyebrow', text: this.teacherMode ? 'SIKAPANDAWA · GURU' : 'SIKAPANDAWA · ORANG TUA / WALI' }),
            createElement('h1', { text: title }), createElement('p', { text: description }));
        header.append(copy);
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
        if (this.onSignedOut) { this.onSignedOut(); return; }
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
        const actions = createElement('div', { className: 'parent-heading-actions' }); actions.append(logout); identity.append(actions);
        const form = createElement('form', { className: 'parent-card observation-form' });
        form.append(createElement('h2', { text: 'Catat satu kesempatan observasi' }),
            createElement('p', { text: 'Tidak harus 12 hari berturut-turut. Isi bertahap pada situasi nyata. N/A berarti tidak ada kesempatan mengamati; jangan menebak skor.' }),
            createElement('p', { className: 'parent-progress', text: context.completedPoints.length + ' dari 12 titik sudah memiliki catatan. Cakupan ini mencakup seluruh periode; periode tiap catatan tercantum dalam riwayat.' }));
        const details = createElement('section', { className: 'observation-details', attributes: { 'aria-label': 'Identitas dan waktu pengamatan' } });
        details.append(createElement('h3', { text: 'Identitas dan waktu pengamatan' })); form.append(details);
        const guardian = this.field(details, this.teacherMode ? 'Nama guru pengamat' : 'Nama orang tua / wali', 'guardianName') as HTMLInputElement;
        guardian.value = this.guardianName; guardian.minLength = 2;
        const studentClass = this.field(details, 'Kelas siswa (opsional)', 'studentClass', 'text', false, 50);
        studentClass.value = this.studentClass;
        const monitoringPeriod = this.field(details, 'Periode monitoring', 'monitoringPeriod', 'number') as HTMLInputElement;
        monitoringPeriod.value = this.monitoringPeriod; monitoringPeriod.min = '1'; monitoringPeriod.step = '1';
        monitoringPeriod.max = String(Number.MAX_SAFE_INTEGER); monitoringPeriod.inputMode = 'numeric';
        const pointLabel = createElement('label', { className: 'parent-field', text: 'Titik observasi' });
        const point = createElement('select', { attributes: { name: 'pointNumber', required: '', 'aria-label': 'Titik observasi' } });
        for (let i = 1; i <= 12; i++) point.append(createElement('option', { text: 'Titik ' + i + (context.completedPoints.includes(i) ? ' — sudah ada catatan' : ''), attributes: { value: String(i) } }));
        point.value = String(Array.from({ length: 12 }, (_, i) => i + 1).find(i => !context.completedPoints.includes(i)) ?? 1);
        pointLabel.append(point); details.append(pointLabel);
        const observedAt = this.field(details, 'Tanggal dan waktu observasi', 'observedAt', 'datetime-local');
        observedAt.parentElement!.classList.add('observation-wide');
        observedAt.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const contextFields = createElement('section', { className: 'observation-context', attributes: { 'aria-label': 'Konteks pengamatan' } });
        contextFields.append(createElement('h3', { text: 'Konteks pengamatan' })); form.append(contextFields);
        const situation = this.field(contextFields, 'Situasi yang diamati', 'situation', 'textarea', true, 1500);
        const behavior = this.field(contextFields, 'Contoh perilaku nyata (opsional)', 'behavior', 'textarea', false, 2000);
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
        const reinforcement = this.field(form, this.teacherMode ? 'Penguatan / arahan guru (opsional)' : 'Penguatan / arahan orang tua (opsional)', 'reinforcement', 'textarea', false, 2000);
        const status = createElement('p', { className: 'parent-status', text: message, attributes: { role: 'status', 'aria-live': 'polite' } });
        const submit = createElement('button', { className: 'button button-primary', text: 'Simpan catatan', attributes: { type: 'submit' } });
        if (this.chooseStudent) {
            const back = createElement('button', { className: 'button button-secondary', text: 'Pilih siswa lain', attributes: { type: 'button' } });
            actions.prepend(back);
            back.addEventListener('click', async () => {
                if (submit.disabled || back.disabled) return;
                back.disabled = true;
                try { await this.chooseStudent!(); }
                catch { status.textContent = 'Daftar siswa belum dapat dimuat. Coba lagi.'; }
                finally { back.disabled = false; }
            });
        }
        form.append(createElement('p', { className: 'parent-note', text: 'Pengisian ulang menjadi catatan baru. Isi nomor periode yang disepakati sekolah dan orang tua, misalnya 1. Perbandingan memasangkan nomor titik dan nomor periode yang sama; tanggal pengamatan boleh berbeda. Catatan lama tetap tersimpan terpisah.' }), status, submit);
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
                    guardianName: guardian.value.trim(), studentClass: studentClass.value.trim(), monitoringPeriod: numberedMonitoringPeriod(monitoringPeriod.value), situation: situation.value.trim(),
                    behavior: behavior.value.trim(), reinforcement: reinforcement.value.trim(),
                    scores: parseMonitoringScores(Object.fromEntries(inputs.map(({ id, select }) => [id, select.value === 'na' ? null : Number(select.value)]))) };
                pendingId ??= crypto.randomUUID();
                controls.forEach(control => { control.disabled = true; });
                await this.backend.submit(input, pendingId);
                active = false; this.guardianName = input.guardianName; this.studentClass = input.studentClass; this.monitoringPeriod = String(monitoringPeriod.valueAsNumber);
                this.showForm({ ...context, completedPoints: [...new Set([...context.completedPoints, input.pointNumber])] }, 'Catatan titik ' + input.pointNumber + ' berhasil disimpan sebagai catatan baru.');
            } catch (e) { status.textContent = e instanceof Error ? e.message : 'Catatan belum tersimpan. Coba lagi.'; }
            finally { submit.disabled = false; logout.disabled = false; controls.forEach(control => { control.disabled = false; }); }
        });
        replaceContent(this.root, identity, form, history.element);
        void this.backend.history(0).then(page => { if (active) history.render(page, offset => this.backend.history(offset)); })
            .catch(() => { if (active) history.element.textContent = 'Riwayat belum dapat dimuat. Catatan yang sudah berhasil disimpan tetap aman; muat ulang halaman untuk mencoba lagi.'; });
    }
}
