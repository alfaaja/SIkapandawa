import { createElement, replaceContent } from './dom';

export interface LoginSubmitPayload {
    username: string;
    password: string;
}

export class LoginView {
    private readonly error = createElement('p', {
        className: 'login-error',
        attributes: { role: 'alert' }
    });
    private readonly submitButton = createElement('button', {
        className: 'button button-primary',
        text: 'Masuk ke panel',
        attributes: { type: 'submit' }
    });

    constructor(
        private readonly root: HTMLElement,
        private readonly onSubmit: (payload: LoginSubmitPayload) => Promise<void>
    ) {}

    render(): void {
        const main = createElement('main', { className: 'login-layout' });
        const brand = createElement('section', { className: 'login-brand' });
        const eyebrow = createElement('p', {
            className: 'eyebrow',
            text: 'SIKAPANDAWA • RUANG ADMIN'
        });
        const title = createElement('h1', { text: 'Pantau perjalanan setiap pemain.' });
        const copy = createElement('p', {
            className: 'brand-copy',
            text: 'Ringkasan akun, progres sepuluh level, dan capaian Jejak Pandawa dalam satu panel baca-saja.'
        });
        const seal = createElement('div', {
            className: 'brand-seal',
            text: '10',
            attributes: { 'aria-label': 'Sepuluh level pembelajaran' }
        });
        brand.append(eyebrow, title, copy, seal);

        const panel = createElement('section', {
            className: 'login-panel',
            attributes: { 'aria-labelledby': 'login-title' }
        });
        const panelTitle = createElement('h2', { text: 'Masuk sebagai admin' });
        panelTitle.id = 'login-title';
        const panelCopy = createElement('p', {
            className: 'muted',
            text: 'Gunakan akun Sikapandawa yang telah diberi akses administrator.'
        });
        const form = createElement('form', { className: 'login-form' });
        const usernameLabel = createElement('label', { text: 'Nama pengguna' });
        usernameLabel.htmlFor = 'admin-username';
        const username = createElement('input', {
            attributes: {
                id: 'admin-username',
                name: 'username',
                type: 'text',
                autocomplete: 'username',
                minlength: '3',
                maxlength: '20',
                required: ''
            }
        });
        const passwordLabel = createElement('label', { text: 'Password' });
        passwordLabel.htmlFor = 'admin-password';
        const password = createElement('input', {
            attributes: {
                id: 'admin-password',
                name: 'password',
                type: 'password',
                autocomplete: 'current-password',
                required: ''
            }
        });
        form.append(
            usernameLabel,
            username,
            passwordLabel,
            password,
            this.error,
            this.submitButton
        );
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            this.showError('');
            this.setLoading(true);
            try {
                await this.onSubmit({ username: username.value, password: password.value });
            } catch {
                this.showError('Panel admin tidak dapat diakses. Silakan coba lagi.');
            } finally {
                this.setLoading(false);
            }
        });
        panel.append(panelTitle, panelCopy, form);
        main.append(brand, panel);
        replaceContent(this.root, main);
        username.focus();
    }

    setLoading(isLoading: boolean): void {
        this.submitButton.toggleAttribute('disabled', isLoading);
        this.submitButton.textContent = isLoading ? 'Memeriksa akses…' : 'Masuk ke panel';
    }

    showError(message: string): void {
        this.error.textContent = message;
        this.error.hidden = message.length === 0;
        this.setLoading(false);
    }
}
