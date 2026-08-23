// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserManagementDialog } from './UserManagementDialog';

const user = {
    userId: '123e4567-e89b-42d3-a456-426614174000',
    displayName: 'Budi Santoso',
    username: 'budi'
};

function installDialogPolyfill(): void {
    Object.defineProperties(HTMLDialogElement.prototype, {
        showModal: {
            configurable: true,
            value() { this.setAttribute('open', ''); }
        },
        close: {
            configurable: true,
            value() { this.removeAttribute('open'); }
        }
    });
}

describe('UserManagementDialog', () => {
    beforeEach(installDialogPolyfill);

    it('validates create fields and refreshes state only after a successful create', async () => {
        const root = document.createElement('main');
        document.body.append(root);
        const onCreate = vi.fn().mockResolvedValue(undefined);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const dialog = new UserManagementDialog({
            onCreate,
            onUpdate: vi.fn(),
            onDelete: vi.fn(),
            onResetPassword: vi.fn(),
            onChangeOwnPassword: vi.fn(),
            onChanged
        });
        dialog.mount(root);
        dialog.showCreate();
        const nativeDialog = root.querySelector('dialog')!;

        expect(nativeDialog.getAttribute('aria-labelledby')).toBeTruthy();
        expect(document.activeElement).toBe(root.querySelector('#create-display-name'));
        root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        expect(onCreate).not.toHaveBeenCalled();

        root.querySelector<HTMLInputElement>('#create-display-name')!.value = 'Sinta Dewi';
        root.querySelector<HTMLInputElement>('#create-username')!.value = 'sinta';
        const credential = crypto.randomUUID();
        root.querySelector<HTMLInputElement>('#create-password')!.value = credential;
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());

        expect(onCreate).toHaveBeenCalledWith({
            displayName: 'Sinta Dewi',
            username: 'sinta',
            password: credential
        });
        expect(nativeDialog.hasAttribute('open')).toBe(false);
    });

    it('lets an admin edit display name and username before refreshing the list', async () => {
        const root = document.createElement('main');
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const dialog = new UserManagementDialog({
            onCreate: vi.fn(),
            onUpdate,
            onDelete: vi.fn(),
            onResetPassword: vi.fn(),
            onChangeOwnPassword: vi.fn(),
            onChanged
        });
        dialog.mount(root);
        dialog.showEdit(user);
        root.querySelector<HTMLInputElement>('#edit-display-name')!.value = 'Budi Baru';
        const username = root.querySelector<HTMLInputElement>('#edit-username')!;
        expect(username.value).toBe('budi');
        expect(username.readOnly || username.disabled).toBe(false);
        username.value = '  BUDI.BARU  ';
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());

        expect(onUpdate).toHaveBeenCalledWith(user.userId, {
            displayName: 'Budi Baru',
            expectedUsername: 'budi',
            username: '  BUDI.BARU  '
        });
    });

    it('requires typing the exact username before destructive deletion', async () => {
        const root = document.createElement('main');
        const onDelete = vi.fn().mockResolvedValue(undefined);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const dialog = new UserManagementDialog({
            onCreate: vi.fn(),
            onUpdate: vi.fn(),
            onDelete,
            onResetPassword: vi.fn(),
            onChangeOwnPassword: vi.fn(),
            onChanged
        });
        dialog.mount(root);
        dialog.showDelete(user);
        const confirmation = root.querySelector<HTMLInputElement>('#delete-confirmation')!;
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;

        expect(submit.disabled).toBe(true);
        confirmation.value = 'BUDI';
        confirmation.dispatchEvent(new Event('input', { bubbles: true }));
        expect(submit.disabled).toBe(true);
        confirmation.value = user.username;
        confirmation.dispatchEvent(new Event('input', { bubbles: true }));
        expect(submit.disabled).toBe(false);
        submit.click();
        await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
        expect(onDelete).toHaveBeenCalledWith(user.userId, user.username);
    });

    it('requires matching reset values and never renders the new credential afterward', async () => {
        const root = document.createElement('main');
        const onResetPassword = vi.fn().mockResolvedValue(undefined);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const dialog = new UserManagementDialog({
            onCreate: vi.fn(),
            onUpdate: vi.fn(),
            onDelete: vi.fn(),
            onResetPassword,
            onChangeOwnPassword: vi.fn(),
            onChanged
        });
        dialog.mount(root);
        dialog.showResetPassword(user);
        const credential = crypto.randomUUID();
        const first = root.querySelector<HTMLInputElement>('#reset-password')!;
        const confirmation = root.querySelector<HTMLInputElement>('#reset-password-confirmation')!;
        first.value = credential;
        confirmation.value = crypto.randomUUID();
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await Promise.resolve();
        expect(onResetPassword).not.toHaveBeenCalled();
        expect(root.getAttribute('role') ?? root.querySelector('[role="alert"]')?.getAttribute('role'))
            .toBe('alert');

        confirmation.value = credential;
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
        expect(onResetPassword).toHaveBeenCalledWith(user.userId, credential);
        expect(root.textContent).not.toContain(credential);
    });

    it('does not let an older mutation close a newer dialog', async () => {
        const root = document.createElement('main');
        document.body.append(root);
        let resolveCreate!: () => void;
        const createPending = new Promise<void>((resolve) => {
            resolveCreate = resolve;
        });
        const dialog = new UserManagementDialog({
            onCreate: vi.fn().mockReturnValue(createPending),
            onUpdate: vi.fn(),
            onDelete: vi.fn(),
            onResetPassword: vi.fn(),
            onChangeOwnPassword: vi.fn(),
            onChanged: vi.fn().mockResolvedValue(undefined)
        });
        dialog.mount(root);
        dialog.showCreate();
        root.querySelector<HTMLInputElement>('#create-display-name')!.value = 'Sinta Dewi';
        root.querySelector<HTMLInputElement>('#create-username')!.value = 'sinta';
        root.querySelector<HTMLInputElement>('#create-password')!.value = crypto.randomUUID();
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true })
        );

        dialog.showEdit(user);
        resolveCreate();
        await Promise.resolve();
        await Promise.resolve();

        expect(root.querySelector('dialog')?.hasAttribute('open')).toBe(true);
        expect(root.querySelector('h2')?.textContent).toBe('Ubah profil @budi');
    });
});
