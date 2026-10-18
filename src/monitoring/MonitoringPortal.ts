import { createElement, replaceContent } from '../admin/ui/dom';
import { ParentPage } from '../parent/ParentPage';
import { TeacherPage } from '../teacher/TeacherPage';
import type { MonitoringPortalBackend, MonitoringRole } from './backend';

export class MonitoringPortal {
    constructor(private readonly root: HTMLElement, private readonly backend: MonitoringPortalBackend) {}
    async start(): Promise<void> {
        try { const role = await this.backend.restore(); if (role) { await this.show(role); return; } }
        catch { /* The common login remains available if a previous session cannot be restored. */ }
        this.login();
    }
    private async show(role: MonitoringRole): Promise<void> {
        const onSignedOut = () => this.login();
        if (role === 'teacher') await new TeacherPage(this.root, this.backend.teacher, onSignedOut).start();
        else await new ParentPage(this.root, this.backend.parent, false, undefined, onSignedOut).start();
    }
    private login(): void {
        const header = createElement('header', { className: 'parent-heading' });
        const copy = createElement('div', { className: 'parent-heading-copy' });
        copy.append(createElement('p', { className: 'eyebrow', text: 'SIKAPANDAWA · MONITORING' }), createElement('h1', { text: 'Monitoring orang tua dan guru' }),
            createElement('p', { text: 'Gunakan akun siswa untuk pengamatan orang tua, atau akun guru untuk pengamatan di sekolah.' }));
        header.append(copy);
        const form = createElement('form', { className: 'parent-card parent-login' });
        const username = createElement('input', { attributes: { required: '', autocomplete: 'username', maxlength: '20' } });
        const password = createElement('input', { attributes: { required: '', type: 'password', autocomplete: 'current-password', maxlength: '128' } });
        for (const [label, input] of [['Username', username], ['Password', password]] as const) {
            const field = createElement('label', { className: 'parent-field', text: label }); field.append(input); form.append(field);
        }
        const status = createElement('p', { className: 'parent-status', attributes: { role: 'alert' } });
        const submit = createElement('button', { className: 'button button-primary', text: 'Masuk ke monitoring', attributes: { type: 'submit' } });
        form.append(status, submit);
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (submit.disabled) return; submit.disabled = true;
            try { const role = await this.backend.login(username.value, password.value); password.value = ''; await this.show(role); }
            catch (error) { password.value = ''; status.textContent = error instanceof Error ? error.message : 'Belum dapat masuk. Coba lagi.'; }
            finally { submit.disabled = false; }
        });
        replaceContent(this.root, header, form);
    }
}
