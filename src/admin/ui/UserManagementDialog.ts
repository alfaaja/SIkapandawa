import type {
    AdminCreateUserInput,
    AdminUpdateUserInput,
    AdminUserIdentity
} from '../types';
import { createElement, replaceContent } from './dom';

export interface UserManagementCallbacks {
    onCreate(input: AdminCreateUserInput): Promise<unknown>;
    onUpdate(userId: string, input: AdminUpdateUserInput): Promise<unknown>;
    onDelete(userId: string, expectedUsername: string): Promise<unknown>;
    onResetPassword(userId: string, password: string): Promise<unknown>;
    onChangeOwnPassword(password: string): Promise<unknown>;
    onChanged(): Promise<unknown>;
}

type SubmitHandler = (form: HTMLFormElement, alert: HTMLElement) => Promise<void>;

export class UserManagementDialog {
    private readonly dialog = createElement('dialog', { className: 'management-dialog' });
    private readonly content = createElement('div', { className: 'dialog-content' });
    private readonly success = createElement('p', {
        className: 'action-toast',
        attributes: { role: 'status', 'aria-live': 'polite', hidden: '' }
    });
    private dialogSequence = 0;

    constructor(private readonly callbacks: UserManagementCallbacks) {
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.close();
        });
        this.dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.close();
        });
    }

    mount(parent: HTMLElement): void {
        this.dialog.append(this.content);
        parent.append(this.dialog, this.success);
    }

    showCreate(): void {
        const form = this.createForm(
            'create-account-title',
            'Tambah pemain',
            'Buat akun login baru. Password sementara tidak disimpan di panel.',
            'Simpan pemain',
            async (submitted, alert) => {
                const input: AdminCreateUserInput = {
                    displayName: this.value(submitted, '#create-display-name'),
                    username: this.value(submitted, '#create-username'),
                    schoolName: this.value(submitted, '#create-school-name'),
                    password: this.value(submitted, '#create-password')
                };
                await this.runMutation(() => this.callbacks.onCreate(input), submitted, alert);
            }
        );
        form.dataset.successMessage = 'Pemain berhasil ditambahkan.';
        form.querySelector('.form-alert')!.before(
            this.field('create-display-name', 'Nama tampilan', 'text', { minlength: '2', maxlength: '24' }),
            this.field('create-username', 'Username', 'text', { minlength: '3', maxlength: '20' }),
            this.field('create-school-name', 'Nama sekolah', 'text', { minlength: '2', maxlength: '100' }),
            this.field('create-password', 'Password awal', 'password', { minlength: '12', maxlength: '128' })
        );
        this.open(form, '#create-display-name');
    }

    showEdit(user: AdminUserIdentity): void {
        const form = this.createForm(
            'edit-account-title',
            `Ubah profil @${user.username}`,
            'Username dapat diubah. Pemain harus memakai username baru saat login berikutnya.',
            'Simpan perubahan',
            async (submitted, alert) => {
                await this.runMutation(
                    () => this.callbacks.onUpdate(user.userId, {
                        displayName: this.value(submitted, '#edit-display-name'),
                        expectedUsername: user.username,
                        username: this.value(submitted, '#edit-username')
                    }),
                    submitted,
                    alert
                );
            }
        );
        const displayName = this.field('edit-display-name', 'Nama tampilan', 'text', {
            minlength: '2', maxlength: '24', value: user.displayName
        });
        const username = this.field('edit-username', 'Username', 'text', {
            minlength: '3', maxlength: '20', value: user.username
        });
        form.querySelector('.form-alert')!.before(displayName, username);
        form.dataset.successMessage = 'Profil pemain berhasil diperbarui.';
        this.open(form, '#edit-display-name');
    }

    showDelete(user: AdminUserIdentity): void {
        const form = this.createForm(
            'delete-account-title',
            `Hapus @${user.username}`,
            'Akun, akses login, dan seluruh progres pemain akan dihapus permanen.',
            'Hapus pemain',
            async (submitted, alert) => {
                await this.runMutation(
                    () => this.callbacks.onDelete(
                        user.userId,
                        this.value(submitted, '#delete-confirmation')
                    ),
                    submitted,
                    alert
                );
            },
            true
        );
        form.dataset.successMessage = 'Pemain berhasil dihapus.';
        const confirmation = this.field(
            'delete-confirmation',
            `Ketik ${user.username} untuk konfirmasi`,
            'text',
            { autocomplete: 'off' }
        );
        const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        submit.disabled = true;
        confirmation.querySelector('input')!.addEventListener('input', (event) => {
            submit.disabled = (event.currentTarget as HTMLInputElement).value !== user.username;
        });
        form.querySelector('.form-alert')!.before(confirmation);
        this.open(form, '#delete-confirmation');
    }

    showResetPassword(user: AdminUserIdentity): void {
        const form = this.createForm(
            'reset-account-title',
            `Reset password @${user.username}`,
            'Tetapkan password sementara dan sampaikan kepada pemain melalui kanal yang aman.',
            'Reset password',
            async (submitted, alert) => {
                const password = this.value(submitted, '#reset-password');
                const confirmation = this.value(submitted, '#reset-password-confirmation');
                if (password !== confirmation) {
                    this.showAlert(alert, 'Password dan konfirmasi tidak sama.');
                    return;
                }
                await this.runMutation(
                    () => this.callbacks.onResetPassword(user.userId, password),
                    submitted,
                    alert
                );
            }
        );
        form.dataset.successMessage = 'Password berhasil direset.';
        form.querySelector('.form-alert')!.before(
            this.field('reset-password', 'Password baru', 'password', { minlength: '12', maxlength: '128' }),
            this.field('reset-password-confirmation', 'Konfirmasi password', 'password', { minlength: '12', maxlength: '128' })
        );
        this.open(form, '#reset-password');
    }

    showChangeOwnPassword(username: string): void {
        const form = this.createForm(
            'change-own-password-title',
            `Ganti password @${username}`,
            'Ganti password akun admin yang sedang digunakan. Password tidak disimpan di panel.',
            'Ganti password',
            async (submitted, alert) => {
                const password = this.value(submitted, '#own-password');
                const confirmation = this.value(submitted, '#own-password-confirmation');
                if (password !== confirmation) {
                    this.showAlert(alert, 'Password dan konfirmasi tidak sama.');
                    return;
                }
                await this.runMutation(
                    () => this.callbacks.onChangeOwnPassword(password),
                    submitted,
                    alert
                );
            }
        );
        form.dataset.successMessage = 'Password admin berhasil diganti.';
        form.querySelector('.form-alert')!.before(
            this.field('own-password', 'Password baru', 'password', {
                minlength: '12', maxlength: '128'
            }),
            this.field('own-password-confirmation', 'Konfirmasi password', 'password', {
                minlength: '12', maxlength: '128'
            })
        );
        this.open(form, '#own-password');
    }

    private createForm(
        titleId: string,
        titleText: string,
        description: string,
        submitText: string,
        onSubmit: SubmitHandler,
        destructive = false
    ): HTMLFormElement {
        const form = createElement('form', { className: 'management-form' });
        const header = createElement('header', { className: 'dialog-header' });
        const heading = createElement('div');
        const eyebrow = createElement('p', { className: 'eyebrow', text: 'KELOLA AKUN' });
        const title = createElement('h2', { text: titleText });
        title.id = titleId;
        heading.append(eyebrow, title);
        header.append(heading, this.closeButton());
        const copy = createElement('p', { className: 'muted', text: description });
        const alert = createElement('p', {
            className: 'form-alert',
            attributes: { role: 'alert', 'aria-live': 'assertive', hidden: '' }
        });
        const actions = createElement('div', { className: 'form-actions' });
        const cancel = createElement('button', {
            className: 'button button-secondary',
            text: 'Batal',
            attributes: { type: 'button' }
        });
        cancel.addEventListener('click', () => this.close());
        const submit = createElement('button', {
            className: destructive ? 'button button-danger' : 'button button-primary',
            text: submitText,
            attributes: { type: 'submit' }
        });
        actions.append(cancel, submit);
        form.append(header, copy, alert, actions);
        const submitForm = (): void => {
            if (!form.checkValidity()) {
                this.showAlert(alert, 'Lengkapi semua field dengan format yang benar.');
                return;
            }
            void onSubmit(form, alert);
        };
        submit.addEventListener('click', (event) => {
            event.preventDefault();
            submitForm();
        });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitForm();
        });
        this.dialog.setAttribute('aria-labelledby', titleId);
        return form;
    }

    private field(
        id: string,
        labelText: string,
        type: 'text' | 'password',
        attributes: Record<string, string> = {}
    ): HTMLElement {
        const group = createElement('div', { className: 'field-group' });
        const label = createElement('label', { text: labelText });
        label.htmlFor = id;
        const input = createElement('input', {
            attributes: {
                id,
                type,
                required: '',
                autocomplete: type === 'password' ? 'new-password' : 'off',
                ...attributes
            }
        });
        group.append(label, input);
        return group;
    }

    private async runMutation(
        mutate: () => Promise<unknown>,
        form: HTMLFormElement,
        alert: HTMLElement
    ): Promise<void> {
        const sequence = this.dialogSequence;
        const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        submit.disabled = true;
        try {
            await mutate();
            form.querySelectorAll<HTMLInputElement>('input[type="password"]')
                .forEach((input) => { input.value = ''; });
            await this.callbacks.onChanged();
            if (sequence !== this.dialogSequence) return;
            this.success.textContent = form.dataset.successMessage ?? 'Perubahan berhasil disimpan.';
            this.success.hidden = false;
            this.close();
        } catch (error) {
            if (sequence !== this.dialogSequence) return;
            this.showAlert(alert, error instanceof Error ? error.message : 'Operasi akun gagal.');
            submit.disabled = false;
        }
    }

    private open(form: HTMLFormElement, focusSelector: string): void {
        this.dialogSequence += 1;
        replaceContent(this.content, form);
        if (!this.dialog.open) this.dialog.showModal();
        form.querySelector<HTMLElement>(focusSelector)?.focus();
    }

    private value(form: HTMLFormElement, selector: string): string {
        return form.querySelector<HTMLInputElement>(selector)?.value ?? '';
    }

    private showAlert(alert: HTMLElement, message: string): void {
        alert.textContent = message;
        alert.hidden = false;
    }

    private closeButton(): HTMLButtonElement {
        const button = createElement('button', {
            className: 'icon-button',
            text: '×',
            attributes: { type: 'button', 'aria-label': 'Tutup dialog kelola akun' }
        });
        button.addEventListener('click', () => this.close());
        return button;
    }

    private close(): void {
        this.dialogSequence += 1;
        if (this.dialog.open) this.dialog.close();
    }
}
