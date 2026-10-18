import { expect, test, type Locator } from '@playwright/test';

async function closePosition(dialog: Locator) {
    const close = dialog.locator('.dialog-header .icon-button');
    await expect(close).toBeVisible();
    const box = (await dialog.boundingBox())!; const button = (await close.boundingBox())!;
    expect(button.x).toBeGreaterThan(box.x + box.width / 2);
    expect(button.y).toBeLessThan(box.y + 100);
    expect(button.width).toBeGreaterThanOrEqual(40);
    await dialog.locator('.dialog-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const scrolled = (await close.boundingBox())!;
    expect(scrolled.y).toBeLessThan(box.y + 100);
    return close;
}

for (const width of [390, 768, 1366]) {
    test(`consistent dialog headers and monitoring forms at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/admin/?mockAdmin=1');
        await page.getByLabel('Nama pengguna').fill('admin.demo');
        await page.getByLabel('Password', { exact: true }).fill('local-test-only');
        await page.getByRole('button', { name: 'Masuk ke panel' }).click();
        await page.getByRole('button', { name: 'Kelola admin', exact: true }).click();
        const staff = page.getByRole('dialog', { name: 'Kelola admin', exact: true });
        const close = await closePosition(staff);
        expect(await staff.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await staff.locator('.dialog-content').evaluate(element => { element.scrollTop = 0; });
        await staff.screenshot({ path: info.outputPath(`admin-dialog-${width}.png`) });
        await staff.getByRole('tab', { name: 'Tambah akun', exact: true }).click();
        await closePosition(staff);
        await staff.locator('.dialog-content').evaluate(element => { element.scrollTop = 0; });
        await staff.screenshot({ path: info.outputPath(`admin-create-${width}.png`) });
        await close.click();
        await page.getByRole('tab', { name: 'Monitoring', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Catatan lama', exact: true })).toHaveCount(0);
        await expect(page.getByRole('spinbutton', { name: 'Periode monitoring', exact: true })).toBeVisible();
        await page.getByLabel('Periode monitoring', { exact: true }).press('ArrowUp');
        await expect(page.getByLabel('Periode monitoring', { exact: true })).toHaveValue('2');
        await page.getByLabel('Periode monitoring', { exact: true }).press('ArrowDown');
        await page.locator('.monitoring-period-filter').screenshot({ path: info.outputPath(`period-dropdown-${width}.png`) });
        await page.getByRole('tab', { name: 'Siswa', exact: true }).click();
        await page.getByRole('button', { name: 'Tambah pemain', exact: true }).click();
        await (await closePosition(page.locator('dialog[open]'))).click();
        await page.getByRole('button', { name: 'Monitoring @arjuna.pratama', exact: true }).click();
        const monitoring = page.getByRole('dialog', { name: 'Monitoring siswa', exact: true });
        await expect(monitoring.getByRole('heading', { name: 'Monitoring Arjuna Pratama · @arjuna.pratama', exact: true })).toBeVisible();
        await (await closePosition(monitoring)).click();
        await page.goto('/guru/?mockMonitoring=1');
        await page.getByLabel('Username', { exact: true }).fill('guru.demo');
        await page.getByLabel('Password', { exact: true }).fill('local-test-only');
        await page.getByRole('button', { name: 'Masuk ke monitoring' }).click();
        await page.getByRole('button', { name: 'Isi pengamatan siswa' }).click();
        await expect(page.locator('.parent-heading-actions').getByRole('button', { name: 'Pilih siswa lain' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const fields = await page.locator('.observation-details .parent-field').all();
        const first = (await fields[0].boundingBox())!; const second = (await fields[1].boundingBox())!;
        if (width > 600) expect(Math.abs(first.y - second.y)).toBeLessThan(2);
        else expect(second.y).toBeGreaterThan(first.y);
        await page.screenshot({ path: info.outputPath(`teacher-form-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Keluar', exact: true }).click();
        await page.goto('/form/?mockMonitoring=1');
        await page.getByLabel('Username', { exact: true }).fill('arjuna.pratama');
        await page.getByLabel('Password', { exact: true }).fill('local-test-only');
        await page.getByRole('button', { name: 'Masuk ke monitoring' }).click();
        await expect(page.getByRole('region', { name: 'Identitas dan waktu pengamatan' })).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: 'Periode monitoring', exact: true })).toHaveValue('1');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}
