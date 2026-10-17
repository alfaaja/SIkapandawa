import { expect, test } from '@playwright/test';

test('admin shows only observed aspect charts even with the retired simulation query flag', async ({ page }) => {
    await page.goto('/admin/?mockAdmin=1&mockSimulation=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    const chart = page.getByRole('region', { name: 'Rata-rata lima aspek', exact: true });
    await expect(chart).toBeVisible();
    await expect(chart.locator('.aspect-bar')).toHaveCount(10);
    await expect(chart).toContainText('rincian Jejak versi 2');
    await expect(page.locator('.jejak-simulation')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/simulasi|estimasi aspek/i);
});

test('student report shows independent Jejak meters, including zero, and a truthful empty state', async ({ page }, testInfo) => {
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    await page.getByRole('row').filter({ hasText: 'bima.adinata.11' }).getByRole('button', { name: /detail/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Bima Adinata', exact: true });
    const section = dialog.getByRole('region', { name: 'Aspek Jejak Pandawa' });
    await expect(section.locator('meter')).toHaveCount(5);
    await expect(section.getByRole('meter', { name: 'Kejujuran: 2 dari 2 poin' })).toHaveAttribute('value', '2');
    await expect(section.getByRole('meter', { name: 'Keberanian: 0 dari 2 poin' })).toHaveAttribute('value', '0');
    await section.scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: testInfo.outputPath('student-jejak-meters-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await section.scrollIntoViewIfNeeded();
    expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath('student-jejak-meters-mobile.png') });
    await dialog.getByRole('button', { name: 'Tutup detail progres' }).click();
    await page.getByRole('row').filter({ hasText: '@arjuna.pratama' }).first().getByRole('button', { name: /detail/i }).click();
    await expect(page.getByRole('dialog').getByRole('region', { name: 'Aspek Jejak Pandawa' })).toContainText('Belum ada rincian jawaban Jejak');
    await expect(page.getByRole('dialog').locator('meter')).toHaveCount(0);
});
