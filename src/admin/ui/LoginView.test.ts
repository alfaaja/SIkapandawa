// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { LoginView } from './LoginView';

describe('LoginView', () => {
    it('renders an accessible login form and submits raw field values', async () => {
        const root = document.createElement('div');
        document.body.append(root);
        let finishSubmit!: () => void;
        const pendingSubmit = new Promise<void>((resolve) => {
            finishSubmit = resolve;
        });
        const onSubmit = vi.fn().mockReturnValue(pendingSubmit);
        new LoginView(root, onSubmit).render();
        const username = root.querySelector<HTMLInputElement>('#admin-username');
        const password = root.querySelector<HTMLInputElement>('#admin-password');
        const form = root.querySelector('form');

        expect(root.querySelector('h2')?.textContent).toBe('Masuk sebagai admin');
        expect(username?.getAttribute('autocomplete')).toBe('username');
        expect(password?.getAttribute('autocomplete')).toBe('current-password');
        username!.value = 'budi';
        const credential = crypto.randomUUID();
        password!.value = credential;
        form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onSubmit).toHaveBeenCalledWith({ username: 'budi', password: credential });
        expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(true);

        finishSubmit();
        await pendingSubmit;
        await Promise.resolve();
        expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(false);
    });

    it('shows errors as text and restores the submit action', () => {
        const root = document.createElement('div');
        const view = new LoginView(root, vi.fn());
        view.render();
        const payload = '<img src=x onerror=alert(1)>';

        view.setLoading(true);
        view.showError(payload);

        const alert = root.querySelector('[role="alert"]');
        expect(alert?.textContent).toBe(payload);
        expect(alert?.querySelector('img')).toBeNull();
        expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(false);
    });

    it('restores the form after an unexpected submit rejection', async () => {
        const root = document.createElement('div');
        const view = new LoginView(
            root,
            vi.fn().mockRejectedValue(new Error('raw internal detail'))
        );
        view.render();

        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await new Promise((resolve) => window.setTimeout(resolve, 0));

        expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(false);
        expect(root.querySelector('[role="alert"]')?.textContent)
            .toBe('Panel admin tidak dapat diakses. Silakan coba lagi.');
    });
});
