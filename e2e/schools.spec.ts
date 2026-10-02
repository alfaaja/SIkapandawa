import { expect, test } from '@playwright/test';

test('All compares schools; selection scopes accounts, summary and student charts', async ({ page }) => {
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    const school = page.getByLabel('Sekolah', { exact: true });
    await expect(school).toHaveValue('');
    await expect(page.locator('.school-chart-bar')).toHaveCount(4);
    await expect(page.locator('.summary-card').first()).toContainText('56');
    await school.selectOption('SDN Kalibanteng Kulon 01');
    await expect(page.locator('.summary-card').first()).toContainText('28');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await expect(page.locator('.chart-bar')).toHaveCount(56);
    for (const row of await page.locator('td[data-label="Sekolah"]').allTextContents()) {
        expect(row).toBe('SDN Kalibanteng Kulon 01');
    }
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await school.selectOption('SDN SEKOLAH KEDUA');
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
    await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('.chart-bar')).toHaveCount(56);
    await school.selectOption('');
    await expect(page.locator('.school-chart-bar')).toHaveCount(4);
    await expect(page.locator('.summary-card').first()).toContainText('56');
    await expect(page.locator('#school-filter option')).toHaveCount(3);
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
        await expect(page.locator('.school-chart-bar')).toHaveCount(4);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});
