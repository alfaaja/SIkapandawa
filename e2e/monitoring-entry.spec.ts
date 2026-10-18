import { expect, test } from '@playwright/test';

test('school administrators create only teachers of their own locked school', async ({ page }, info) => {
    await page.goto('/admin/?mockAdmin=1&mockRole=school&mockSchools=2');
    await page.getByLabel('Nama pengguna').fill('admin.demo'); await page.getByLabel('Password', { exact:true }).fill('local-test-only');
    await page.getByRole('button', { name:'Masuk ke panel' }).click();
    await page.getByRole('button', { name:'Kelola guru', exact:true }).click();
    const dialog = page.getByRole('dialog', { name:'Kelola guru', exact:true });
    await dialog.getByRole('tab', { name:'Tambah guru', exact:true }).click();
    await expect(dialog.locator('.staff-scope-context')).toContainText('Guru');
    await expect(dialog.locator('.staff-scope-context')).toContainText('SDN Kalibanteng Kulon 01');
    await expect(dialog.getByLabel('Jenis akses')).toHaveCount(0);
    await expect(dialog.getByLabel('Sekolah yang dikelola')).toHaveCount(0);
    await dialog.getByLabel('Nama guru').fill('Guru Sekolah'); await dialog.getByLabel('Username guru').fill('guru.sekolah');
    await dialog.getByLabel('Password awal').fill(crypto.randomUUID());
    await dialog.getByRole('button', { name:'Buat akun guru' }).click();
    await expect(dialog.locator('.admin-account-list')).toContainText('@guru.sekolah');
    await expect(dialog.locator('.admin-account-card')).toHaveCount(1);
    await expect(dialog.getByLabel('Password awal')).toHaveValue('');
    await dialog.screenshot({ path:info.outputPath('school-teacher-management.png') });
});

for (const viewport of [{ width:1366,height:900 },{ width:844,height:390 }]) {
    test(`game Monitoring button uses the game style and opens the common form at ${viewport.width}px`, async ({ page }, info) => {
        await page.setViewportSize(viewport); await page.goto('/');
        await page.waitForFunction(() => (window as any).__sikaGame?.scene.isActive('MainMenu'));
        const menu = await page.evaluate(() => {
            const game=(window as any).__sikaGame; const scene=game.scene.getScene('MainMenu');
            const names=['main-menu-register','main-menu-login','main-menu-monitoring'];
            const buttons=names.map(name => { const button=scene.children.getByName(name); const bounds=button.getBounds(); return { x:bounds.x,right:bounds.right,top:bounds.top,bottom:bounds.bottom,centerX:button.x,centerY:button.y }; });
            const label=scene.children.getByName('main-menu-monitoring-label');
            const button=scene.children.getByName('main-menu-monitoring'); const camera=scene.cameras.main;
            return { buttons,text:label.text,font:label.style.fontFamily,
                x:(button.x-camera.worldView.x)*camera.zoom/game.scale.width,
                y:(button.y-camera.worldView.y)*camera.zoom/game.scale.height };
        });
        expect(menu.text).toBe('MONITORING'); expect(menu.font).toContain('Press Start 2P');
        expect(menu.buttons[0].right).toBeLessThan(menu.buttons[1].x);
        expect(menu.buttons[0].centerY).toBe(menu.buttons[1].centerY);
        expect(menu.buttons[2].centerX).toBe((menu.buttons[0].centerX+menu.buttons[1].centerX)/2);
        expect(menu.buttons[2].top).toBeGreaterThan(Math.max(menu.buttons[0].bottom,menu.buttons[1].bottom)+10);
        // White panel is x=410..885 through this button row; its bottom is y=648.
        for(const button of menu.buttons) { expect(button.x).toBeGreaterThan(410); expect(button.right).toBeLessThan(885); expect(button.bottom).toBeLessThan(648); }
        await page.screenshot({ path:info.outputPath(`main-menu-monitoring-${viewport.width}.png`) });
        const canvas=(await page.locator('canvas').boundingBox())!;
        await page.mouse.click(canvas.x+menu.x*canvas.width,canvas.y+menu.y*canvas.height);
        await expect(page).toHaveURL(/\/form\/$/);
        await expect(page.getByRole('heading', { name:'Monitoring orang tua dan guru' })).toBeVisible();
    });
}

test('old teacher URL redirects to the shared form entry', async ({ page }) => {
    await page.goto('/guru/?mockMonitoring=1'); await expect(page).toHaveURL(/\/form\/\?mockMonitoring=1$/);
    await expect(page.getByLabel('Username', { exact:true })).toBeVisible();
    await expect(page.getByRole('button', { name:'Masuk ke monitoring' })).toBeVisible();
});

test('a remembered student can reach monitoring from LevelSelect without logging out of the game', async ({ page }, info) => {
    await page.goto('/'); await page.waitForFunction(() => (window as any).__sikaGame?.scene.isActive('MainMenu'));
    await page.evaluate(async () => {
        const { AuthService } = await import('/src/game/services/AuthService.ts');
        const { ProgressService } = await import('/src/game/services/ProgressService.ts');
        const account={ id:'local-monitoring-fixture',username:'siswa.uji',displayName:'Siswa Uji',schoolName:'SEKOLAH A',createdAt:'2026-10-17T00:00:00Z' };
        AuthService.restoreSession=async()=>account; AuthService.getActiveAccount=()=>account;
        ProgressService.hydrate=async()=>{};
        ProgressService.getProgress=()=>({ highestUnlockedLevel:1,levelStars:{},introSeen:[],completedLevels:[],jejakPandawaUnlocked:false,jejakPandawaBestScore:0 });
        (window as any).__sikaGame.scene.getScene('MainMenu').scene.restart();
    });
    await page.waitForFunction(() => (window as any).__sikaGame?.scene.isActive('LevelSelect'));
    const position=await page.evaluate(()=>{
        const game=(window as any).__sikaGame; const scene=game.scene.getScene('LevelSelect'); const camera=scene.cameras.main;
        const button=scene.children.getByName('level-select-monitoring');
        return { x:(button.x-camera.worldView.x)*camera.zoom/game.scale.width,y:(button.y-camera.worldView.y)*camera.zoom/game.scale.height };
    });
    await page.screenshot({ path:info.outputPath('level-select-monitoring.png') });
    const canvas=(await page.locator('canvas').boundingBox())!;
    await page.mouse.click(canvas.x+position.x*canvas.width,canvas.y+position.y*canvas.height);
    await expect(page).toHaveURL(/\/form\/$/);
});
