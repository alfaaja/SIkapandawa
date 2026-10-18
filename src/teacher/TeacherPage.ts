import { createElement, replaceContent } from '../admin/ui/dom';
import { ParentPage } from '../parent/ParentPage';
import type { ParentContext } from '../parent/backend';
import type { TeacherBackend } from './backend';

export class TeacherPage {
    constructor(private readonly root: HTMLElement, private readonly backend: TeacherBackend, private readonly onSignedOut?: () => void) {}
    async start(): Promise<void> {
        try { const students = await this.backend.restore(); if (students) { this.showStudents(students); return; } } catch { /* Show login again. */ }
        this.showLogin();
    }
    private showLogin(): void {
        if (this.onSignedOut) { this.onSignedOut(); return; }
        const form = createElement('form', { className: 'parent-card parent-login' });
        const username = createElement('input', { attributes: { name: 'username', required: '', autocomplete: 'username', maxlength: '20' } });
        const password = createElement('input', { attributes: { name: 'password', type: 'password', required: '', autocomplete: 'current-password', maxlength: '128' } });
        for (const [label, input] of [['Username guru', username], ['Password guru', password]] as const) { const field = createElement('label', { className: 'parent-field', text: label }); field.append(input); form.append(field); }
        const status = createElement('p', { attributes: { role: 'alert' } });
        const submit = createElement('button', { className: 'button button-primary', text: 'Masuk sebagai guru', attributes: { type: 'submit' } });
        form.append(status, submit);
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (submit.disabled) return; submit.disabled = true;
            try { const students = await this.backend.login(username.value, password.value); password.value = ''; this.showStudents(students); }
            catch (error) { password.value = ''; status.textContent = error instanceof Error ? error.message : 'Belum dapat masuk.'; }
            finally { submit.disabled = false; }
        });
        const header = createElement('header', { className: 'parent-heading' });
        const copy = createElement('div', { className: 'parent-heading-copy' });
        copy.append(createElement('p', { className: 'eyebrow', text: 'SIKAPANDAWA · GURU' }), createElement('h1', { text: 'Monitoring guru' }),
            createElement('p', { text: 'Masuk dengan akun guru dari admin master untuk mencatat pengamatan siswa di sekolah Anda.' }));
        header.append(copy); replaceContent(this.root, header, form);
    }
    private showStudents(students: ParentContext[]): void {
        const header = createElement('header', { className: 'parent-heading' });
        const copy = createElement('div', { className: 'parent-heading-copy' });
        copy.append(createElement('p', { className: 'eyebrow', text: 'SIKAPANDAWA · GURU' }), createElement('h1', { text: 'Pilih siswa yang diamati' }),
            createElement('p', { text: students.length ? students[0].schoolName : 'Belum ada siswa pada sekolah Anda.' })); header.append(copy);
        const status = createElement('p', { attributes: { role: 'alert' } });
        const logout = createElement('button', { className: 'button button-secondary', text: 'Keluar akun guru' });
        logout.addEventListener('click', async () => { logout.disabled = true; try { await this.backend.logout(); this.showLogin(); } catch { logout.disabled = false; status.textContent = 'Belum dapat keluar. Coba lagi.'; } }); header.append(logout);
        const form = createElement('form', { className: 'parent-card' });
        const field = createElement('label', { className: 'parent-field', text: 'Siswa di sekolah Anda' });
        const select = createElement('select', { attributes: { name: 'student', required: '' } });
        for (const student of students) select.append(createElement('option', { text: student.displayName + ' · @' + student.username, attributes: { value: student.userId } }));
        field.append(select); form.append(field);
        const choose = createElement('button', { className: 'button button-primary', text: 'Isi pengamatan siswa', attributes: { type: 'submit' } });
        choose.disabled = students.length === 0; form.append(choose);
        form.addEventListener('submit', event => { event.preventDefault(); const student = students.find(student => student.userId === select.value); if (student) this.showObservation(student); });
        replaceContent(this.root, header, status, form);
    }
    private showObservation(student: ParentContext): void {
        const formRoot = createElement('div');
        replaceContent(this.root, formRoot);
        void new ParentPage(formRoot, {
            restore: async () => student, login: async () => student,
            logout: async () => { await this.backend.logout(); this.showLogin(); },
            submit: (input, id) => this.backend.submit(student.userId, input, id),
            history: offset => this.backend.history(student.userId, offset)
        }, true, async () => {
            const students = await this.backend.restore(); if (students) this.showStudents(students); else this.showLogin();
        }, this.onSignedOut).start();
    }
}
