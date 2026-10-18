import { expect, test } from '@playwright/test';

test('only registered schools appear; selection scopes accounts, summary and student charts', async ({ page }) => {
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    const school = page.getByLabel('Sekolah', { exact: true });
    await expect(school).toHaveValue('');
    await expect(page.locator('.school-chart-bar')).toHaveCount(2);
    await expect(page.locator('#school-filter option')).toHaveCount(2);
    await expect(page.locator('.summary-card').first()).toContainText('56');
    await school.selectOption('SDN Kalibanteng Kulon 01');
    await expect(page.locator('.summary-card').first()).toContainText('56');
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(25);
    await expect(page.locator('.progress-charts:not(.aspect-charts) .chart-bar')).toHaveCount(112);
    for (const row of await page.locator('td[data-label="Sekolah"]').allTextContents()) {
        expect(row).toBe('SDN Kalibanteng Kulon 01');
    }
    await page.getByRole('tab', { name: 'Siswa', exact: true }).click();
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(25);
    await school.selectOption('');
    await school.selectOption('SDN Kalibanteng Kulon 01');
    await expect(page.getByText(/Halaman 1 dari 3/)).toBeVisible();
    await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(1);
    await expect(page.locator('.progress-charts:not(.aspect-charts) .chart-bar')).toHaveCount(112);
    await school.selectOption('');
    await expect(page.locator('.school-chart-bar')).toHaveCount(2);
    await expect(page.locator('.summary-card').first()).toContainText('56');
    await expect(page.locator('#school-filter option')).toHaveCount(2);
});

test('school overview fits desktop and phone and keeps school selector visible', async ({ page }) => {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/admin/?mockAdmin=1');
        if (await page.getByRole('button', { name: 'Masuk ke panel' }).isVisible()) {
            await page.getByLabel('Nama pengguna').fill('admin.demo');
            await page.getByLabel('Password', { exact: true }).fill('local-test-only');
            await page.getByRole('button', { name: 'Masuk ke panel' }).click();
        }
        await expect(page.getByLabel('Sekolah', { exact: true })).toBeVisible();
        await expect(page.locator('.school-chart-bar')).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});

test('a new school appears only after a player is created for it', async ({ page }) => {
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    await page.getByRole('tab', { name: 'Siswa', exact: true }).click();
    await expect(page.locator('#school-filter option')).toHaveCount(2);
    await page.getByRole('button', { name: 'Tambah pemain' }).click();
    await page.getByLabel('Nama tampilan').fill('Siswa Sekolah Baru');
    await page.getByLabel('Nama sekolah').fill('SDN Sekolah Baru');
    await page.getByLabel('Username').fill('sekolah.baru');
    await page.getByLabel('Password awal').fill(crypto.randomUUID());
    await page.getByRole('button', { name: 'Simpan pemain' }).click();
    await expect(page.locator('#school-filter option')).toHaveCount(3);
    await expect(page.locator('.school-chart-bar')).toHaveCount(4);
    await page.getByLabel('Sekolah', { exact: true }).selectOption('SDN SEKOLAH BARU');
    await expect(page.locator('.summary-card').first()).toContainText('1');
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(1);
    await expect(page.locator('.progress-charts:not(.aspect-charts) .chart-bar')).toHaveCount(2);
    await expect(page.locator('.players-panel tbody')).toContainText('@sekolah.baru');
});
