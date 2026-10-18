import { expect, test } from '@playwright/test';

for (const role of ['school','teacher','forum']) test(`master manages ${role} identity, password and deletion while retaining students`, async ({ page }, info) => {
    await page.goto('/admin/?mockAdmin=1&mockRole=master');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password',{exact:true}).fill(crypto.randomUUID());
    await page.getByRole('button',{name:'Masuk ke panel'}).click();
    const studentsBefore = await page.locator('.summary-card').first().textContent();
    await page.getByRole('button',{name:'Kelola admin',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Kelola admin',exact:true});
    await dialog.getByRole('tab',{name:'Tambah akun',exact:true}).click();
    await dialog.getByLabel('Nama admin',{exact:true}).fill('Pengelola Uji');
    await dialog.getByLabel('Username admin',{exact:true}).fill(`${role}.awal`);
    await dialog.getByLabel('Password awal',{exact:true}).fill(crypto.randomUUID());
    await dialog.getByLabel('Jenis akses').selectOption(role);
    if(role!=='forum') await dialog.getByLabel('Sekolah yang dikelola').selectOption('SDN Kalibanteng Kulon 01');
    await dialog.getByRole('button',{name:'Buat akun admin',exact:true}).click();
    await expect(dialog.locator('.admin-account-list')).toContainText(`@${role}.awal`);
    await expect(dialog.getByRole('button',{name:'Hapus @admin.demo',exact:true})).toHaveCount(0);
    await dialog.getByRole('button',{name:`Edit @${role}.awal`,exact:true}).click();
    await dialog.getByLabel('Nama pengelola',{exact:true}).fill('Pengelola Baru');
    await dialog.getByLabel('Username pengelola',{exact:true}).fill(`${role}.baru`);
    await dialog.getByRole('button',{name:'Simpan perubahan pengelola'}).click();
    await expect(dialog.locator('.admin-account-list')).toContainText(`@${role}.baru`);
    await dialog.getByRole('button',{name:`Reset password @${role}.baru`,exact:true}).click();
    const password=crypto.randomUUID();
    await dialog.getByLabel('Password baru pengelola',{exact:true}).fill(password);
    await dialog.getByLabel('Konfirmasi password pengelola',{exact:true}).fill(`${password}x`);
    await dialog.getByRole('button',{name:'Reset password pengelola',exact:true}).click();
    await expect(dialog.locator('.admin-access-editor [role="alert"]')).toContainText('tidak sama');
    await dialog.getByLabel('Konfirmasi password pengelola',{exact:true}).fill(password);
    await dialog.getByRole('button',{name:'Reset password pengelola',exact:true}).click();
    await expect(dialog.locator('[role="status"]')).toContainText('berhasil direset');
    await expect(dialog.locator('.admin-access-editor')).toHaveCount(0);
    await page.setViewportSize({width:role==='forum'?390:1366,height:900});
    await dialog.screenshot({path:info.outputPath(`master-${role}-crud.png`)});
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await dialog.getByRole('button',{name:`Hapus @${role}.baru`,exact:true}).click();
    const deletion=dialog.getByRole('button',{name:'Hapus akun pengelola',exact:true});
    await expect(deletion).toBeDisabled();
    await dialog.getByLabel(`Ketik ${role}.baru untuk konfirmasi`).fill(`${role}.baru`);
    await deletion.click();
    await expect(dialog.locator('.admin-account-list')).not.toContainText(`@${role}.baru`);
    await dialog.getByRole('button',{name:'Tutup kelola admin'}).click();
    await expect(page.locator('.summary-card').first()).toHaveText(studentsBefore);
});

for(const action of ['edit','password']) test(`master can change own ${action} and returns to login`, async ({page}) => {
    await page.goto('/admin/?mockAdmin=1&mockRole=master');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password',{exact:true}).fill(crypto.randomUUID());
    await page.getByRole('button',{name:'Masuk ke panel'}).click();
    await page.getByRole('button',{name:'Kelola admin',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Kelola admin',exact:true});
    await expect(dialog.getByRole('button',{name:'Hapus @admin.demo',exact:true})).toHaveCount(0);
    if(action==='edit') {
        await dialog.getByRole('button',{name:'Edit @admin.demo',exact:true}).click();
        await dialog.getByLabel('Nama pengelola',{exact:true}).fill('Master Baru');
        await dialog.getByLabel('Username pengelola',{exact:true}).fill('master.baru');
        await dialog.getByRole('button',{name:'Simpan perubahan pengelola'}).click();
    } else {
        await dialog.getByRole('button',{name:'Reset password @admin.demo',exact:true}).click();
        const password=crypto.randomUUID();
        await dialog.getByLabel('Password baru pengelola',{exact:true}).fill(password);
        await dialog.getByLabel('Konfirmasi password pengelola',{exact:true}).fill(password);
        await dialog.getByRole('button',{name:'Reset password pengelola',exact:true}).click();
    }
    await expect(page.getByRole('button',{name:'Masuk ke panel'})).toBeVisible();
    await expect(page.getByText('Silakan masuk kembali.',{exact:false})).toBeVisible();
});
