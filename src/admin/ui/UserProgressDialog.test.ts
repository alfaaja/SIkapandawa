// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { UserProgressDialog } from './UserProgressDialog';

describe('UserProgressDialog', () => {
    it('shows five independent Jejak meters and preserves missing data instead of inventing scores', () => {
        const parent = document.createElement('main');
        const view = new UserProgressDialog();
        view.mount(parent);
        const progress = {
            user: { userId: 'id', displayName: 'Budi', username: 'budi' },
            summary: { completedLevelCount: 10, totalStars: 30, averageStars: 3,
                grade: 'Baik', jejakPandawaUnlocked: true, jejakPandawaBestScore: 10 },
            levels: [],
            jejakAspects: { kejujuran: 2, keberanian: 0, kesopanan: 1, kebijaksanaan: 2, keadilan: 1 }
        };
        view.show(progress);
        const meters = [...parent.querySelectorAll('meter')];
        expect(meters.map(meter => meter.value)).toEqual([2, 0, 1, 2, 1]);
        expect(meters.every(meter => meter.max === 2 && meter.min === 0)).toBe(true);
        expect(meters[1]?.getAttribute('aria-label')).toBe('Keberanian: 0 dari 2 poin');
        expect(parent.textContent).toContain('Aspek Jejak Pandawa');
        view.show({ ...progress, jejakAspects: null });
        expect(parent.querySelectorAll('meter')).toHaveLength(0);
        expect(parent.textContent).toContain('Belum ada rincian jawaban Jejak');
        expect(parent.textContent).toContain('10/10');
    });
    beforeEach(() => {
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
    });

    it('mounts, opens a loading state, and closes from the backdrop', () => {
        const parent = document.createElement('main');
        const view = new UserProgressDialog();
        view.mount(parent);
        view.showLoading();
        const dialog = parent.querySelector('dialog')!;

        expect(dialog.hasAttribute('open')).toBe(true);
        expect(dialog.textContent).toContain('Memuat progres');
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('renders errors as text and closes from its semantic button', () => {
        const parent = document.createElement('main');
        const view = new UserProgressDialog();
        view.mount(parent);
        view.showLoading();

        view.showError('<img src=x onerror=alert(1)>');

        expect(parent.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(parent.querySelector('img')).toBeNull();
        parent.querySelector<HTMLButtonElement>('button')!.click();
        expect(parent.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    });

    it('does not reopen an already open dialog while rendering progress', () => {
        const parent = document.createElement('main');
        const view = new UserProgressDialog();
        view.mount(parent);
        view.showLoading();

        view.show({
            user: { userId: 'id', displayName: 'Budi', username: 'budi' },
            summary: {
                completedLevelCount: 5,
                totalStars: 9,
                averageStars: 0.9,
                grade: 'Terus Belajar',
                jejakPandawaUnlocked: false,
                jejakPandawaBestScore: 0
            },
            levels: Array.from({ length: 10 }, (_, index) => ({
                level: index + 1,
                stars: index % 4,
                completed: index < 5,
                updatedAt: '2026-08-10T00:00:00.000Z'
            }))
        });

        expect(parent.querySelectorAll('.level-card')).toHaveLength(10);
        expect(parent.querySelector('[aria-label="Tutup detail progres"]')).not.toBeNull();
    });

    it('labels the modal from its visible heading and focuses its close control', () => {
        const parent = document.createElement('main');
        document.body.append(parent);
        const view = new UserProgressDialog();
        view.mount(parent);

        view.show({
            user: { userId: 'id', displayName: 'Budi', username: 'budi' },
            summary: {
                completedLevelCount: 0,
                totalStars: 0,
                averageStars: 0,
                grade: 'Belum mulai',
                jejakPandawaUnlocked: false,
                jejakPandawaBestScore: 0
            },
            levels: Array.from({ length: 10 }, (_, index) => ({
                level: index + 1,
                stars: 0,
                completed: false,
                updatedAt: '2026-08-10T00:00:00.000Z'
            }))
        });

        const dialog = parent.querySelector('dialog')!;
        const labelledBy = dialog.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        expect(parent.querySelector(`#${labelledBy}`)?.textContent).toBe('Budi');
        expect(document.activeElement?.getAttribute('aria-label'))
            .toBe('Tutup detail progres');
    });

    it('closes on an accessible dialog cancel event', () => {
        const parent = document.createElement('main');
        const view = new UserProgressDialog();
        view.mount(parent);
        view.showLoading();
        const dialog = parent.querySelector('dialog')!;
        const cancel = new Event('cancel', { cancelable: true });

        dialog.dispatchEvent(cancel);

        expect(cancel.defaultPrevented).toBe(true);
        expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('keeps keyboard focus inside the report dialog', () => {
        const parent = document.createElement('main');
        document.body.append(parent);
        const view = new UserProgressDialog();
        view.mount(parent);
        view.show({
            user: { userId: 'id', displayName: 'Budi', username: 'budi' },
            summary: {
                completedLevelCount: 0,
                totalStars: 0,
                averageStars: 0,
                grade: 'Awal Perjalanan',
                jejakPandawaUnlocked: false,
                jejakPandawaBestScore: 0
            },
            levels: Array.from({ length: 10 }, (_, index) => ({
                level: index + 1,
                stars: 0,
                completed: false,
                updatedAt: '2026-08-10T00:00:00.000Z'
            }))
        });
        const close = parent.querySelector<HTMLButtonElement>('[aria-label="Tutup detail progres"]')!;
        const tab = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        });

        close.dispatchEvent(tab);

        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(close);
    });
});
