import { expect, test, type Page } from '@playwright/test';

async function openMockLogin(page: Page, role = 'admin'): Promise<void> {
    await page.goto(`/admin/?mockAdmin=1&mockRole=${role}`);
    await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' })).toBeVisible();
}

async function login(page: Page): Promise<void> {
    await page.getByLabel('Nama pengguna').fill('budi');
    await page.getByLabel('Password').fill(crypto.randomUUID());
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
}

test.describe('panel admin mock contract', () => {
    test('shows login for an unauthenticated admin session', async ({ page }) => {
        await openMockLogin(page);

        await expect(page.getByLabel('Nama pengguna')).toBeFocused();
        await expect(page.getByLabel('Password')).toHaveAttribute(
            'autocomplete',
            'current-password'
        );
    });

    test('uses one generic message for invalid credentials', async ({ page }) => {
        await openMockLogin(page, 'invalid');

        await login(page);

        await expect(page.getByRole('alert')).toHaveText(
            'Nama pengguna atau password salah.'
        );
    });

    test('denies and signs out an authenticated non-admin player', async ({ page }) => {
        await openMockLogin(page, 'user');

        await login(page);

        await expect(page.getByRole('alert')).toHaveText(
            'Akun tidak memiliki akses admin'
        );
        await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' }))
            .toBeVisible();
        await expect.poll(() => page.evaluate(() => (
            sessionStorage.getItem('sikapandawa.admin.mock-session')
        ))).toBeNull();
    });

    test('shows summary, a 25-row first page, and server pagination', async ({ page }) => {
        await openMockLogin(page);
        await login(page);

        await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible();
        await expect(page.getByText('56', { exact: true })).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(25);
        await expect(page.getByText(/Halaman 1 dari 3/)).toBeVisible();
        await page.getByRole('button', { name: 'Berikutnya' }).click();
        await expect(page.getByText(/Halaman 2 dari 3/)).toBeVisible();
    });

    test('shows two whole-cohort score charts independent of table filters', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await openMockLogin(page);
        await login(page);

        await expect(page.getByRole('heading', { name: 'Capaian Misi Pandawa' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Capaian Jejak Pandawa' })).toBeVisible();
        const bars = page.locator('.chart-bar');
        await expect(bars).toHaveCount(112);

        await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
        await expect(page.locator('tbody tr')).toHaveCount(1);
        await expect(bars).toHaveCount(112);

        const layout = await page.locator('.progress-charts').evaluate((element) => ({
            insideViewport: element.getBoundingClientRect().right <= innerWidth,
            noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
            fixedCharts: [...element.querySelectorAll<HTMLElement>('.chart-scroll')]
                .every((chart) => chart.scrollWidth <= chart.clientWidth)
        }));
        expect(layout).toEqual({
            insideViewport: true,
            noPageOverflow: true,
            fixedCharts: true
        });

        const chartNames = page.locator('.chart-name');
        await expect(chartNames.first()).toHaveText('1. Arjuna Pratama');
        await page.getByRole('button', { name: 'Mode ringkas' }).click();
        await expect(chartNames.first()).toHaveText('1. AR');
        await expect(page.getByRole('button', { name: 'Nama lengkap' }))
            .toHaveAttribute('aria-pressed', 'true');
    });

    test('loads the admin stylesheet and gives usernames a visible identity treatment', async ({
        page
    }) => {
        await openMockLogin(page);
        const loginStyle = await page.locator('.login-panel').evaluate((element) => {
            const style = getComputedStyle(element);
            return { borderRadius: style.borderRadius };
        });
        expect(loginStyle.borderRadius).not.toBe('0px');
        await login(page);

        const username = page.locator('.player-username').first();
        await expect(username).toBeVisible();
        await expect(username).toContainText('@arjuna.pratama');
        await expect(page.getByText('Masuk sebagai @budi', { exact: true })).toBeVisible();
        await expect(page.getByText(/Mode demo.*data contoh/i)).toBeVisible();
        await expect(username).toHaveCSS('font-weight', /^(700|750|800|bold)$/);
        await expect(page.locator('.dashboard-header')).toHaveCSS(
            'background-color',
            'rgb(23, 76, 67)'
        );
    });

    test('restores an authorized admin session after reload', async ({ page }) => {
        await openMockLogin(page);
        await login(page);
        await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible();

        await page.reload();

        await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(25);
    });

    test('lets the signed-in admin change only their own password', async ({ page }) => {
        await openMockLogin(page);
        await login(page);
        const credential = `${crypto.randomUUID()}Aa!`;

        await page.getByRole('button', { name: 'Ganti password saya' }).click();
        await page.getByLabel('Password baru', { exact: true }).fill(credential);
        await page.getByLabel('Konfirmasi password').fill(`${credential}-beda`);
        await page.getByRole('button', { name: 'Ganti password', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('tidak sama');

        await page.getByLabel('Konfirmasi password').fill(credential);
        await page.getByRole('button', { name: 'Ganti password', exact: true }).click();
        await expect(page.getByText('Password admin berhasil diganti.')).toBeVisible();
        await expect(page.locator('body')).not.toContainText(credential);
    });

    test('denies and clears an unverified restored session', async ({ page }) => {
        await openMockLogin(page, 'user');
        await page.evaluate(() => {
            sessionStorage.setItem('sikapandawa.admin.mock-session', 'active');
        });

        await page.reload();

        await expect(page.getByRole('alert')).toHaveText(
            'Akun tidak memiliki akses admin'
        );
        await expect.poll(() => page.evaluate(() => (
            sessionStorage.getItem('sikapandawa.admin.mock-session')
        ))).toBeNull();
    });

    test('searches and filters through server-side list parameters', async ({ page }) => {
        await openMockLogin(page);
        await login(page);

        await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
        await expect(page.locator('tbody tr')).toHaveCount(1);
        await expect(page.locator('tbody')).toContainText('@drupadi.kirana.56');

        await page.getByLabel('Cari pemain').fill('');
        await page.getByLabel('Status progres').selectOption('completed');
        await expect(page.locator('tbody tr')).toHaveCount(5);
        await expect(page.locator('tbody')).toContainText('Selesai');
    });

    test('keeps every desktop account action inside the table at 1366px', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await openMockLogin(page);
        await login(page);

        const region = page.locator('.table-region');
        const firstActionCell = page.locator('td[data-label="Aksi"]').first();
        const deleteButton = firstActionCell.getByRole('button', { name: /^Hapus / });
        await expect(deleteButton).toBeVisible();
        const layout = await region.evaluate((element) => {
            const regionRect = element.getBoundingClientRect();
            const actionRect = element.querySelector<HTMLElement>('td[data-label="Aksi"]')!
                .getBoundingClientRect();
            const deleteRect = element.querySelector<HTMLElement>(
                'td[data-label="Aksi"] .button-danger-quiet'
            )!.getBoundingClientRect();
            const firstActionCell = element.querySelector<HTMLElement>(
                'td[data-label="Aksi"]'
            )!;
            const actionButtons = [...firstActionCell.querySelectorAll<HTMLElement>('button')]
                .map((button) => {
                    const rect = button.getBoundingClientRect();
                    return {
                        width: rect.width,
                        height: rect.height,
                        whiteSpace: getComputedStyle(button).whiteSpace
                    };
                });
            return {
                scrollLeft: element.scrollLeft,
                fitsWithoutScroll: element.scrollWidth <= element.clientWidth + 1,
                actionFits: actionRect.right <= regionRect.right + 1,
                deleteFits: deleteRect.right <= regionRect.right + 1,
                actionButtons
            };
        });

        expect(layout).toMatchObject({
            scrollLeft: 0,
            fitsWithoutScroll: true,
            actionFits: true,
            deleteFits: true
        });
        expect(layout.actionButtons).toHaveLength(4);
        expect(layout.actionButtons.every(({ width, height, whiteSpace }) => (
            width >= 72 && height <= 52 && whiteSpace === 'nowrap'
        ))).toBe(true);
    });

    test('uses compact readable account cards on tablet and phone', async ({ page }) => {
        for (const viewport of [
            { width: 768, height: 1024 },
            { width: 390, height: 844 }
        ]) {
            await page.setViewportSize(viewport);
            await openMockLogin(page);
            await login(page);

            const row = page.locator('tbody tr').first();
            const actionCell = row.locator('td[data-label="Aksi"]');
            await expect(row).toBeVisible();
            await expect(page.locator('thead')).toBeHidden();
            await expect(actionCell.getByRole('button')).toHaveCount(4);
            const layout = await row.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                const buttons = [...element.querySelectorAll<HTMLElement>(
                    'td[data-label="Aksi"] button'
                )].map((button) => button.getBoundingClientRect());
                return {
                    rowInsideViewport: rect.left >= 0 && rect.right <= innerWidth,
                    noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
                    readableButtons: buttons.every(({ width, height }) => (
                        width >= 72 && height >= 40 && height <= 56
                    ))
                };
            });
            expect(layout).toEqual({
                rowInsideViewport: true,
                noPageOverflow: true,
                readableButtons: true
            });
            await page.getByRole('button', { name: 'Keluar' }).click();
            await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' }))
                .toBeVisible();
        }
    });

    test('starts the mobile dashboard at the demo notice after login', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMockLogin(page);
        await login(page);

        const notice = page.getByText(/Mode demo.*data contoh/i);
        await expect(notice).toBeInViewport();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await expect(page.locator('.players-panel .data-source-notice'))
            .toContainText('bukan akun database');
    });

    test('shows exactly ten level rows in player detail', async ({ page }) => {
        await openMockLogin(page);
        await login(page);

        await page.getByRole('button', { name: 'Detail' }).first().click();

        const report = page.getByRole('dialog');
        await expect(report).toBeVisible();
        await expect(page.locator('.level-card')).toHaveCount(10);
        await expect(page.getByText('Level 1', { exact: true })).toBeVisible();
        await expect(page.getByText('Level 10', { exact: true })).toBeVisible();
        await expect(report.getByText('Total bintang')).toBeVisible();
        await expect(report.getByText(/\/30/)).toBeVisible();
        await expect(report.getByText('Predikat')).toBeVisible();
        await expect(report.getByText('Jejak Pandawa')).toBeVisible();
        await expect(report.getByText(/Nilai terbaik: \d\/3 bintang/).first()).toBeVisible();
        await expect(report).toHaveAttribute('aria-labelledby', /.+/);
        const closeReport = page.getByRole('button', { name: 'Tutup detail progres' });
        await expect(closeReport).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(closeReport).toBeFocused();
        await report.locator('.dialog-content').evaluate((element) => {
            element.scrollTop = element.scrollHeight;
        });
        await expect(closeReport).toBeInViewport();
    });

    test('creates, edits, resets, and deletes a player with confirmation and refresh', async ({
        page
    }) => {
        await openMockLogin(page);
        await login(page);
        const username = `uji.${crypto.randomUUID().slice(0, 8)}`;
        const renamedUsername = `${username}.baru`;
        const credential = crypto.randomUUID();

        await page.getByRole('button', { name: 'Tambah pemain' }).click();
        await page.getByLabel('Nama tampilan').fill('Pemain Uji');
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password awal').fill(credential);
        await page.getByRole('button', { name: 'Simpan pemain' }).click();
        await page.getByLabel('Cari pemain').fill(username);
        await expect(page.locator('tbody')).toContainText(`@${username}`);

        await page.getByRole('button', { name: `Edit @${username}` }).click();
        await expect(page.getByLabel('Username')).toHaveValue(username);
        await expect(page.getByLabel('Username')).toBeEnabled();
        await page.getByLabel('Nama tampilan').fill('Pemain Diperbarui');
        await page.getByLabel('Username').fill(renamedUsername);
        await page.getByRole('button', { name: 'Simpan perubahan' }).click();
        await expect(page.getByText('Profil pemain berhasil diperbarui')).toBeVisible();
        await page.getByLabel('Cari pemain').fill(renamedUsername);
        await expect(page.locator('tbody')).toContainText('Pemain Diperbarui');
        await expect(page.locator('tbody')).toContainText(`@${renamedUsername}`);

        await page.getByRole('button', { name: `Reset password @${renamedUsername}` }).click();
        const replacement = crypto.randomUUID();
        await page.getByLabel('Password baru', { exact: true }).fill(replacement);
        await page.getByLabel('Konfirmasi password').fill(crypto.randomUUID());
        await page.getByRole('button', { name: 'Reset password', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('tidak sama');
        await page.getByLabel('Konfirmasi password').fill(replacement);
        await page.getByRole('button', { name: 'Reset password', exact: true }).click();
        await expect(page.getByText('Password berhasil direset')).toBeVisible();

        await page.getByRole('button', { name: `Hapus @${renamedUsername}` }).click();
        const deleteButton = page.getByRole('button', { name: 'Hapus pemain' });
        await expect(deleteButton).toBeDisabled();
        await page.getByLabel(`Ketik ${renamedUsername} untuk konfirmasi`).fill(renamedUsername);
        await expect(deleteButton).toBeEnabled();
        await deleteButton.click();
        await expect(page.getByText(/Tidak ada pemain/)).toBeVisible();
    });

    test('supports refresh, empty, offline, and retry states', async ({ page, context }) => {
        await openMockLogin(page);
        await login(page);

        await page.getByRole('button', { name: 'Segarkan' }).click();
        await expect(page.locator('tbody tr')).toHaveCount(25);

        await page.getByLabel('Cari pemain').fill('tidak-ada-pemain-ini');
        await expect(page.getByText(/Tidak ada pemain/)).toBeVisible();

        await context.setOffline(true);
        await page.getByRole('button', { name: 'Segarkan' }).click();
        await expect(page.getByText(/Panel sedang offline/)).toBeVisible();
        await page.getByRole('button', { name: 'Coba lagi' }).click();
        await expect(page.getByText(/Panel sedang offline/)).toBeVisible();
        await context.setOffline(false);
        await expect(page.getByText(/Tidak ada pemain/)).toBeVisible();
    });

    test('logs out and returns to login', async ({ page }) => {
        await openMockLogin(page);
        await login(page);

        await page.getByRole('button', { name: 'Keluar' }).click();

        await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' })).toBeVisible();
        await expect.poll(() => page.evaluate(() => (
            sessionStorage.getItem('sikapandawa.admin.mock-session')
        ))).toBeNull();
    });
});

test('the game entry remains available at the root URL', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#game-container')).toBeVisible();
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 15_000 });
});
