import { createElement, replaceContent } from './dom';
import { normalizeSchoolName } from '../../shared/auth/school';
import type { AdminUpdateUserInput } from '../types';

export interface AdminAccessInput {
    displayName: string;
    username: string;
    password: string;
    role: 'school' | 'forum' | 'teacher';
    schoolName?: string;
}

export interface AdminAccessItem {
    userId: string;
    displayName: string;
    username: string;
    role: 'master' | 'school' | 'forum' | 'teacher';
    schoolName: string | null;
}

interface AdminAccessCallbacks {
    onCreate(input: AdminAccessInput): Promise<unknown>;
    onList(): Promise<AdminAccessItem[]>;
    onUpdate?(userId: string, input: AdminUpdateUserInput): Promise<unknown>;
    onResetPassword?(userId: string, password: string): Promise<unknown>;
    onDelete?(userId: string, expectedUsername: string): Promise<unknown>;
}

export class AdminAccessDialog {
    private readonly dialog = createElement('dialog', {
        className: 'management-dialog admin-access-dialog',
        attributes: { 'aria-labelledby': 'admin-access-title' }
    });
    private readonly content = createElement('div', { className: 'dialog-content' });
    private sequence = 0;
    private returnFocus: HTMLElement | null = null;
    private accounts: AdminAccessItem[] = [];
    private editorSequence = 0;
    private searchText = '';
    private mutationBusy = false;

    constructor(private readonly callbacks: AdminAccessCallbacks, private readonly teacherSchool: string | null = null) {
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
        this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.close(); });
        this.dialog.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const controls = [...this.dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
                .filter(control => !control.closest('[hidden]'));
            const first = controls[0]; const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
    }

    mount(parent: HTMLElement): void { this.dialog.append(this.content); parent.append(this.dialog); }

    async show(schools: readonly string[]): Promise<void> {
        const sequence = ++this.sequence;
        this.mutationBusy = false;
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const heading = createElement('header', { className: 'dialog-header' });
        const title = createElement('h2', { text: this.teacherSchool ? 'Kelola guru' : 'Kelola admin', attributes: { id: 'admin-access-title', tabindex: '-1' } });
        const close = createElement('button', { className: 'icon-button', text: '×', attributes: { type: 'button', 'aria-label': this.teacherSchool ? 'Tutup kelola guru' : 'Tutup kelola admin' } });
        close.addEventListener('click', () => this.close());
        heading.append(title, close);
        const body = createElement('div', { className: 'admin-access-content' });
        const status = createElement('p', { text: this.teacherSchool ? 'Memuat akun guru…' : 'Memuat akun admin…', attributes: { role: 'status', 'aria-live': 'polite' } });
        replaceContent(this.content, heading, status, body);
        if (!this.dialog.open) this.dialog.showModal();
        title.focus();
        try {
            const accounts = await this.callbacks.onList();
            if (sequence !== this.sequence) return;
            this.accounts = this.visibleAccounts(accounts);
            status.textContent = '';
            const navigation = createElement('nav', { className: 'staff-navigation', attributes: { role: 'tablist', 'aria-label': 'Kelola akun pengelola' } });
            const list = createElement('section', { attributes: { id: 'staff-panel-list', role: 'tabpanel', 'aria-labelledby': 'staff-tab-list' } });
            const create = createElement('section', { attributes: { id: 'staff-panel-create', role: 'tabpanel', 'aria-labelledby': 'staff-tab-create', hidden: '' } });
            for (const [key, label] of [['list', this.teacherSchool ? 'Daftar guru' : 'Daftar akun'], ['create', this.teacherSchool ? 'Tambah guru' : 'Tambah akun']] as const) {
                const button = createElement('button', { className: 'staff-tab', text: label, attributes: { type: 'button', id: `staff-tab-${key}`, role: 'tab', 'aria-controls': `staff-panel-${key}` } });
                button.addEventListener('click', () => { if (this.mutationBusy) return; this.clearStatus(); this.closeEditor(); this.setMode(key); });
                button.addEventListener('keydown', event => {
                    if (this.mutationBusy) return;
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault(); const next = event.key === 'Home' ? 'list' : event.key === 'End' ? 'create' : key === 'list' ? 'create' : 'list';
                    this.clearStatus(); this.closeEditor(); this.setMode(next); this.content.querySelector<HTMLElement>(`#staff-tab-${next}`)?.focus();
                });
                navigation.append(button);
            }
            const searchGroup = createElement('div', { className: 'field-group staff-search' });
            const search = createElement('input', { attributes: { id: 'staff-account-search', type: 'search', maxlength: '100', placeholder: 'Nama, username, atau sekolah' } });
            searchGroup.append(createElement('label', { text: 'Cari akun', attributes: { for: search.id } }), search);
            search.addEventListener('input', () => { this.searchText = search.value; this.replaceAccounts(); });
            this.searchText = '';
            list.append(searchGroup, this.createAccounts(this.accounts));
            create.append(this.createForm(schools, this.accounts, status, sequence));
            body.append(navigation, list, create); this.setMode('list');
        } catch {
            if (sequence !== this.sequence) return;
            status.textContent = 'Daftar admin belum dapat dimuat. Tutup dan coba lagi.';
        }
    }

    close(): void {
        ++this.sequence;
        ++this.editorSequence;
        for (const input of this.dialog.querySelectorAll<HTMLInputElement>('input[type="password"]')) input.value = '';
        this.dialog.close();
        replaceContent(this.content);
        this.returnFocus?.focus();
    }

    private createForm(schools: readonly string[], accounts: AdminAccessItem[], status: HTMLElement, sequence: number): HTMLFormElement {
        const form = createElement('form', { className: 'management-form admin-access-form' });
        form.append(createElement('p', { className: 'muted', text: this.teacherSchool
            ? 'Buat akun guru untuk mengisi monitoring siswa di sekolah Anda. Akun guru masuk melalui /form/.'
            : 'Master membuat akun admin sekolah, forum, atau guru. Admin sekolah juga dapat membuat akun guru khusus sekolahnya. Monitoring orang tua dan guru diakses melalui /form/.' }));
        const displayName = this.field(form, 'admin-access-name', this.teacherSchool ? 'Nama guru' : 'Nama admin', 'text', 2, 24);
        const username = this.field(form, 'admin-access-username', this.teacherSchool ? 'Username guru' : 'Username admin', 'text', 3, 20);
        const password = this.field(form, 'admin-access-password', 'Password awal', 'password', 12, 128);
        const roleGroup = createElement('div', { className: 'field-group' });
        const roleLabel = createElement('label', { text: 'Jenis akses', attributes: { for: 'admin-access-role' } });
        const role = createElement('select', { attributes: { id: 'admin-access-role' } });
        if (!this.teacherSchool) role.append(createElement('option', { text: 'Admin sekolah', attributes: { value: 'school' } }), createElement('option', { text: 'Admin forum / dinas', attributes: { value: 'forum' } }));
        role.append(createElement('option', { text: 'Guru', attributes: { value: 'teacher' } }));
        roleGroup.append(roleLabel, role);
        if (this.teacherSchool) {
            const context = createElement('aside', { className: 'staff-scope-context', attributes: { 'aria-label': 'Akses akun guru' } });
            context.append(createElement('span', { className: 'pill', text: 'Guru' }), createElement('strong', { text: this.teacherSchool }), createElement('p', { className: 'muted', text: 'Guru hanya mengisi monitoring siswa di sekolah ini.' }));
            form.append(context);
        } else form.append(roleGroup);
        const schoolGroup = createElement('div', { className: 'field-group' });
        const school = createElement('select', { attributes: { id: 'admin-access-school', required: '' } });
        const newSchoolOption = createElement('option', { text: 'Tambah sekolah baru…', attributes: { value: '__new_school__' } });
        school.append(createElement('option', { text: 'Pilih sekolah', attributes: { value: '' } }), newSchoolOption);
        const addSchool = (value: string | null) => {
            const name = normalizeSchoolName(value);
            if (name && ![...school.options].some(option => option.value === name)) {
                school.insertBefore(createElement('option', { text: name, attributes: { value: name } }), newSchoolOption);
            }
        };
        for (const name of [...schools, ...accounts.map(account => account.schoolName)]) addSchool(name);
        if (this.teacherSchool) replaceContent(school, createElement('option', { text: this.teacherSchool, attributes: { value: this.teacherSchool } }));
        schoolGroup.append(createElement('label', { text: 'Sekolah yang dikelola', attributes: { for: school.id } }), school);
        if (!this.teacherSchool) form.append(schoolGroup);
        const newSchool = this.teacherSchool ? createElement('input') : this.field(form, 'admin-access-new-school', 'Nama sekolah baru', 'text', 2, 100);
        const scopeHint = createElement('p', { className: 'muted', attributes: { id: 'admin-access-scope-hint' } });
        form.append(scopeHint);
        const updateScope = () => {
            const scoped = role.value !== 'forum'; const adding = scoped && school.value === '__new_school__';
            school.required = scoped; school.disabled = !scoped || this.teacherSchool !== null; schoolGroup.hidden = !scoped;
            newSchool.required = adding; newSchool.disabled = !adding;
            const newSchoolGroup = newSchool.closest<HTMLElement>('.field-group');
            if (newSchoolGroup) newSchoolGroup.hidden = !adding;
            scopeHint.textContent = role.value === 'teacher' ? 'Satu sekolah boleh memiliki lebih dari satu akun guru. Guru hanya mengisi monitoring siswa di sekolahnya.'
                : scoped ? 'Maksimal satu akun admin sekolah untuk setiap sekolah.' : 'Admin forum / dinas dapat mengakses semua sekolah.';
        };
        role.addEventListener('change', updateScope); school.addEventListener('change', updateScope); updateScope();
        const alert = createElement('p', { className: 'form-alert', attributes: { role: 'alert', hidden: '' } });
        const submit = createElement('button', { className: 'button button-primary', text: this.teacherSchool ? 'Buat akun guru' : 'Buat akun admin', attributes: { type: 'submit' } });
        form.append(alert, submit);
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (this.mutationBusy || submit.disabled || !form.reportValidity()) return;
            const selectedRole = this.teacherSchool ? 'teacher' : role.value === 'forum' ? 'forum' : role.value === 'teacher' ? 'teacher' : 'school';
            const schoolName = normalizeSchoolName(this.teacherSchool ?? (school.value === '__new_school__' ? newSchool.value : school.value));
            if (selectedRole !== 'forum' && !schoolName) {
                alert.hidden = false; alert.textContent = 'Pilih sekolah atau masukkan nama sekolah baru yang valid.'; return;
            }
            if (selectedRole === 'school' && accounts.some(account => account.role === 'school' && normalizeSchoolName(account.schoolName) === schoolName)) {
                alert.hidden = false; alert.textContent = 'Admin untuk sekolah ini sudah dibuat.'; return;
            }
            alert.hidden = true; submit.disabled = true;
            this.setMutationBusy(true);
            form.setAttribute('aria-busy', 'true');
            const input: AdminAccessInput = { displayName: displayName.value.trim(), username: username.value.trim(), password: password.value, role: selectedRole, ...(selectedRole !== 'forum' && schoolName ? { schoolName } : {}) };
            void this.callbacks.onCreate(input).then(async () => {
                input.password = ''; password.value = '';
                if (sequence !== this.sequence) return;
                status.textContent = this.teacherSchool ? 'Akun guru berhasil dibuat.' : 'Akun admin berhasil dibuat.';
                if (selectedRole !== 'forum') addSchool(schoolName);
                form.reset(); updateScope();
                try {
                    const refreshed = this.visibleAccounts(await this.callbacks.onList());
                    if (sequence !== this.sequence) return;
                    accounts.splice(0, accounts.length, ...refreshed);
                    this.searchText = '';
                    const search = this.content.querySelector<HTMLInputElement>('#staff-account-search'); if (search) search.value = '';
                    this.replaceAccounts();
                } catch { status.textContent = 'Akun berhasil dibuat. Buka kembali menu ini untuk memperbarui daftar.'; }
                if (sequence === this.sequence) this.setMode('list');
            }).catch((error: unknown) => {
                if (sequence !== this.sequence) return;
                alert.hidden = false;
                alert.textContent = error instanceof Error ? error.message : 'Akun admin belum dapat dibuat. Silakan coba lagi.';
            }).finally(() => {
                input.password = ''; password.value = '';
                if (sequence === this.sequence) { this.setMutationBusy(false); submit.disabled = false; form.removeAttribute('aria-busy'); }
            });
        });
        return form;
    }

    private field(form: HTMLFormElement, id: string, label: string, type: string, min: number, max: number): HTMLInputElement {
        const group = createElement('div', { className: 'field-group' });
        const input = createElement('input', { attributes: { id, type, required: '', minlength: String(min), maxlength: String(max), autocomplete: type === 'password' ? 'new-password' : 'off' } });
        group.append(createElement('label', { text: label, attributes: { for: id } }), input); form.append(group); return input;
    }

    private createAccounts(accounts: readonly AdminAccessItem[]): HTMLElement {
        const section = createElement('section', { className: 'admin-account-list', attributes: { 'aria-label': 'Akun admin terdaftar' } });
        const search = this.searchText.trim().toLocaleLowerCase('id');
        const visible = this.visibleAccounts(accounts).filter(account => !search || `${account.displayName} ${account.username} ${account.schoolName ?? ''}`.toLocaleLowerCase('id').includes(search));
        section.append(createElement('h3', { text: `${this.teacherSchool ? 'Guru terdaftar' : 'Akun terdaftar'} · ${visible.length}` }));
        if (!visible.length) section.append(createElement('p', { className: 'muted', text: search ? 'Tidak ada akun yang cocok dengan pencarian.' : this.teacherSchool ? 'Belum ada akun guru di sekolah ini.' : 'Belum ada akun admin tambahan.' }));
        const grid = createElement('div', { className: 'staff-card-grid' });
        for (const account of visible) {
            const item = createElement('article', { className: 'admin-account-card' });
            item.append(createElement('strong', { text: account.displayName }), createElement('span', { className: 'muted', text: `@${account.username}` }), createElement('span', { className: 'pill', text: account.role === 'master' ? 'Master' : account.role === 'school' ? 'Admin sekolah' : account.role === 'teacher' ? 'Guru' : 'Forum / dinas' }), createElement('p', { text: account.schoolName ?? 'Semua sekolah' }));
            if (this.canManage(account)) {
                const actions = createElement('div', { className: 'row-actions' });
                const entries = [
                    ['edit', 'Edit', this.callbacks.onUpdate],
                    ['password', 'Reset password', this.callbacks.onResetPassword],
                    ['delete', 'Hapus', this.callbacks.onDelete]
                ] as const;
                for (const [action, label, callback] of entries) {
                    if (!callback || (account.role === 'master' && action === 'delete')) continue;
                    const button = createElement('button', { className: `button button-compact ${action === 'delete' ? 'button-danger-quiet' : 'button-secondary'}`, text: label, attributes: { type: 'button', 'aria-label': `${label} @${account.username}` } });
                    button.disabled = this.mutationBusy;
                    button.addEventListener('click', () => this.showAccountEditor(account, action)); actions.append(button);
                }
                item.append(actions);
            }
            grid.append(item);
        }
        section.append(grid);
        return section;
    }

    private visibleAccounts(accounts: readonly AdminAccessItem[]): AdminAccessItem[] {
        return accounts.filter(account => !this.teacherSchool || (account.role === 'teacher' && normalizeSchoolName(account.schoolName) === normalizeSchoolName(this.teacherSchool)));
    }

    private canManage(account: AdminAccessItem): boolean { return this.visibleAccounts([account]).length === 1; }

    private replaceAccounts(): void { this.content.querySelector('.admin-account-list')?.replaceWith(this.createAccounts(this.accounts)); }

    private clearStatus(): void { const status = this.content.querySelector('[role="status"]'); if (status) status.textContent = ''; }

    private setMutationBusy(busy: boolean): void {
        this.mutationBusy = busy;
        for (const control of this.content.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.staff-navigation button, .admin-account-card button, #staff-account-search')) control.disabled = busy;
    }

    private setMode(mode: 'list' | 'create' | 'editor'): void {
        for (const key of ['list', 'create'] as const) {
            const panel = this.content.querySelector<HTMLElement>(`#staff-panel-${key}`); if (panel) panel.hidden = mode !== key;
            const tab = this.content.querySelector<HTMLButtonElement>(`#staff-tab-${key}`);
            if (tab) { tab.setAttribute('aria-selected', String(mode === key)); tab.tabIndex = mode === key ? 0 : -1; }
        }
        const navigation = this.content.querySelector<HTMLElement>('.staff-navigation'); if (navigation) navigation.hidden = mode === 'editor';
        if (mode !== 'create') for (const input of this.content.querySelectorAll<HTMLInputElement>('#staff-panel-create input[type="password"]')) input.value = '';
    }

    private closeEditor(): void {
        ++this.editorSequence;
        const editor = this.content.querySelector('.admin-access-editor');
        for (const field of editor?.querySelectorAll<HTMLInputElement>('input[type="password"]') ?? []) field.value = '';
        editor?.remove();
        this.setMode('list');
    }

    private showAccountEditor(account: AdminAccessItem, action: 'edit' | 'password' | 'delete'): void {
        if (this.mutationBusy || !this.canManage(account) || (account.role === 'master' && action === 'delete')) return;
        this.clearStatus();
        this.closeEditor();
        const sequence = this.sequence; const editorSequence = this.editorSequence;
        const form = createElement('form', { className: 'management-form admin-access-editor', attributes: { 'aria-label': `${action === 'edit' ? 'Edit' : action === 'password' ? 'Reset password' : 'Hapus'} akun @${account.username}` } });
        const title = createElement('h3', { text: `${action === 'edit' ? 'Edit' : action === 'password' ? 'Reset password' : 'Hapus'} @${account.username}` });
        form.append(title);
        const fields: HTMLInputElement[] = [];
        if (action === 'edit') {
            form.append(createElement('p', { className: 'muted', text: 'Ubah nama dan username. Jenis akses serta sekolah tetap mengikuti akun ini.' }));
            fields.push(this.field(form, 'staff-edit-name', 'Nama pengelola', 'text', 2, 24), this.field(form, 'staff-edit-username', 'Username pengelola', 'text', 3, 20));
            fields[0].value = account.displayName; fields[1].value = account.username;
        } else if (action === 'password') {
            form.append(createElement('p', { className: 'muted', text: 'Tetapkan password sementara dan sampaikan kepada pemilik akun melalui kanal yang aman.' }));
            fields.push(this.field(form, 'staff-new-password', 'Password baru pengelola', 'password', 12, 128), this.field(form, 'staff-confirm-password', 'Konfirmasi password pengelola', 'password', 12, 128));
        } else {
            form.append(createElement('p', { className: 'muted', text: 'Akun dan akses login pengelola akan dihapus permanen. Data siswa tetap dipertahankan.' }));
            fields.push(this.field(form, 'staff-delete-confirmation', `Ketik ${account.username} untuk konfirmasi`, 'text', 1, 20));
        }
        const alert = createElement('p', { className: 'form-alert', attributes: { role: 'alert', hidden: '' } });
        const buttons = createElement('div', { className: 'dialog-actions' });
        const cancel = createElement('button', { className: 'button button-secondary', text: 'Kembali ke daftar', attributes: { type: 'button' } });
        const submit = createElement('button', { className: `button ${action === 'delete' ? 'button-danger' : 'button-primary'}`, text: action === 'edit' ? 'Simpan perubahan pengelola' : action === 'password' ? 'Reset password pengelola' : 'Hapus akun pengelola', attributes: { type: 'submit' } });
        cancel.addEventListener('click', () => { this.closeEditor(); this.content.querySelector<HTMLElement>('#admin-access-title')?.focus(); });
        if (action === 'delete') {
            submit.disabled = true;
            fields[0].addEventListener('input', () => { submit.disabled = fields[0].value !== account.username; });
        }
        buttons.append(cancel, submit); form.append(alert, buttons);
        this.content.querySelector('.admin-access-content')!.append(form); this.setMode('editor'); fields[0].focus();
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (this.mutationBusy || submit.disabled || !form.reportValidity() || (action === 'delete' && fields[0].value !== account.username)) return;
            if (action === 'password' && fields[0].value !== fields[1].value) {
                alert.hidden = false; alert.textContent = 'Password dan konfirmasi tidak sama.'; return;
            }
            const operation = action === 'edit'
                ? () => this.callbacks.onUpdate!(account.userId, { displayName: fields[0].value.trim(), username: fields[1].value.trim(), expectedUsername: account.username })
                : action === 'password' ? () => this.callbacks.onResetPassword!(account.userId, fields[0].value)
                    : () => this.callbacks.onDelete!(account.userId, account.username);
            submit.disabled = true; cancel.disabled = true; form.setAttribute('aria-busy', 'true'); alert.hidden = true;
            this.setMutationBusy(true);
            const clearPasswords = () => { for (const field of fields) if (field.type === 'password') field.value = ''; };
            const current = () => sequence === this.sequence && editorSequence === this.editorSequence;
            void (async () => {
                try {
                    await operation(); clearPasswords(); if (!current()) return;
                    const status = this.content.querySelector('[role="status"]')!;
                    status.textContent = action === 'edit' ? 'Profil pengelola berhasil diperbarui.' : action === 'password' ? 'Password pengelola berhasil direset.' : 'Akun pengelola berhasil dihapus.';
                    try {
                        const refreshed = this.visibleAccounts(await this.callbacks.onList()); if (!current()) return;
                        this.accounts.splice(0, this.accounts.length, ...refreshed);
                        this.content.querySelector('.admin-account-list')?.replaceWith(this.createAccounts(this.accounts));
                    } catch { if (current()) status.textContent += ' Buka kembali menu ini untuk memperbarui daftar.'; }
                    if (current()) { this.closeEditor(); this.content.querySelector<HTMLElement>('#admin-access-title')?.focus(); }
                } catch (error) {
                    if (!current()) return;
                    alert.hidden = false; alert.textContent = error instanceof Error ? error.message : 'Perubahan akun belum dapat disimpan. Silakan coba lagi.';
                } finally {
                    clearPasswords();
                    if (sequence === this.sequence) this.setMutationBusy(false);
                    if (current()) { submit.disabled = action === 'delete' && fields[0].value !== account.username; cancel.disabled = false; form.removeAttribute('aria-busy'); }
                }
            })();
        });
    }
}
