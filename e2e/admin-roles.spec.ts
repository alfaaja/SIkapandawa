import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, role: string) {
    await page.goto(`/admin/?mockAdmin=1&mockRole=${role}&mockSchools=2`);
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill(crypto.randomUUID());
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
}

test('master provisions school, forum, and teacher accounts without creating duplicate school administrators', async ({ page }, testInfo) => {
    await signIn(page, 'master');
    await page.getByRole('button', { name: 'Kelola admin', exact: true }).waitFor();
    await page.screenshot({ path: testInfo.outputPath('master-overview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Kelola admin', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Kelola admin', exact: true });
    for (const role of ['school', 'forum', 'teacher']) {
        await dialog.getByRole('tab', { name: 'Tambah akun', exact: true }).click();
        await dialog.getByLabel('Nama admin', { exact: true }).fill(`Pengelola ${role}`);
        await dialog.getByLabel('Username admin', { exact: true }).fill(`pengelola.${role}`);
        await dialog.getByLabel('Password awal', { exact: true }).fill(crypto.randomUUID());
        await dialog.getByLabel('Jenis akses', { exact: true }).selectOption(role);
        if (role !== 'forum') await dialog.getByLabel('Sekolah yang dikelola', { exact: true }).selectOption('SDN Kalibanteng Kulon 01');
        await dialog.getByRole('button', { name: 'Buat akun admin', exact: true }).click();
        await expect(dialog.locator('.admin-account-list')).toContainText(`@pengelola.${role}`);
        await expect(dialog.getByLabel('Password awal', { exact: true })).toHaveValue('');
    }
    await dialog.getByRole('tab', { name: 'Tambah akun', exact: true }).click();
    await dialog.getByLabel('Nama admin', { exact: true }).fill('Kepala Kedua');
    await dialog.getByLabel('Username admin', { exact: true }).fill('kepala.kedua');
    await dialog.getByLabel('Password awal', { exact: true }).fill(crypto.randomUUID());
    await dialog.getByLabel('Jenis akses', { exact: true }).selectOption('school');
    await dialog.getByLabel('Sekolah yang dikelola', { exact: true }).selectOption('__new_school__');
    await dialog.getByLabel('Nama sekolah baru', { exact: true }).fill('sdn kalibanteng kulon 01');
    await dialog.getByRole('button', { name: 'Buat akun admin', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('sudah dibuat');
    await expect(dialog.locator('.admin-account-card')).toHaveCount(4);
    await dialog.screenshot({ path: testInfo.outputPath('master-staff-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath('master-staff-mobile.png') });
});

test('school administrators see their own school and create students within the locked school', async ({ page }) => {
    await signIn(page, 'school');
    await expect(page.getByLabel('Sekolah', { exact: true })).toBeDisabled();
    await expect(page.locator('#school-filter option')).toHaveCount(1);
    await expect(page.locator('#school-filter')).toHaveValue('SDN Kalibanteng Kulon 01');
    await expect(page.locator('.summary-card').first()).toContainText('40');
    await expect(page.getByRole('button', { name: 'Kelola admin', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Siswa', exact: true }).click();
    await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tambah pemain', exact: true }).click();
    await expect(page.getByLabel('Nama sekolah', { exact: true })).toHaveValue('SDN Kalibanteng Kulon 01');
    await expect(page.getByLabel('Nama sekolah', { exact: true })).toHaveAttribute('readonly', '');
    await page.getByLabel('Nama tampilan', { exact: true }).fill('Siswa Sekolah');
    await page.getByLabel('Username', { exact: true }).fill('siswa.sekolah');
    await page.getByLabel('Password awal', { exact: true }).fill(crypto.randomUUID());
    await page.getByRole('button', { name: 'Simpan pemain', exact: true }).click();
    await page.getByLabel('Cari pemain').fill('siswa.sekolah');
    await expect(page.locator('.players-panel tbody')).toContainText('@siswa.sekolah');
    await expect(page.locator('td[data-label="Sekolah"]')).toHaveText('SDN Kalibanteng Kulon 01');
});

test('forum administrators can inspect either school without staff management access', async ({ page }) => {
    await signIn(page, 'forum');
    await expect(page.getByLabel('Sekolah', { exact: true })).toBeEnabled();
    await expect(page.locator('#school-filter option')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Kelola admin', exact: true })).toHaveCount(0);
    await page.getByLabel('Sekolah', { exact: true }).selectOption('SDN SEKOLAH KEDUA');
    await expect(page.locator('.summary-card').first()).toContainText('16');
    await page.getByRole('tab', { name: 'Siswa', exact: true }).click();
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(16);
    for (const school of await page.locator('td[data-label="Sekolah"]').allTextContents()) expect(school).toBe('SDN SEKOLAH KEDUA');
});

test('teacher accounts cannot enter the admin panel', async ({ page }) => {
    await signIn(page, 'teacher');
    await expect(page.getByRole('alert')).toHaveText('Akun tidak memiliki akses admin');
    await expect(page.getByRole('heading', { name: 'Panel Admin', exact: true })).toHaveCount(0);
});
