import { expect, test } from '@playwright/test';

test('one combined five-aspect chart per school stays independent of search and fits phones', async ({ page }, testInfo) => {
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    const charts = page.getByRole('region', { name: 'Rata-rata lima aspek', exact: true });
    await expect(charts.locator('.aspect-chart-panel')).toHaveCount(1);
    await expect(charts.locator('.aspect-chart-group')).toHaveCount(5);
    await expect(charts.locator('.aspect-bar')).toHaveCount(10);
    await expect(charts).toContainText('rincian Jejak');
    await expect(charts).toContainText('versi 2');
    const heights = await charts.locator('.chart-jejak .aspect-bar').evaluateAll(bars => bars.map(bar => (bar as HTMLElement).style.getPropertyValue('--bar-height')));
    expect(heights).toEqual(['100%','0%','50%','100%','50%']);
    const before = await charts.innerText();
    await page.getByLabel('Cari pemain').fill('drupadi.kirana.56');
    await expect(page.locator('.players-panel tbody tr')).toHaveCount(1);
    expect(await charts.innerText()).toBe(before);
    await page.getByLabel('Sekolah', { exact: true }).selectOption('SDN Kalibanteng Kulon 01');
    await expect(charts.locator('.aspect-bar')).toHaveCount(10);
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await charts.getByText('Keadilan', { exact: true }).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const colors = await charts.locator('.aspect-chart-panel').first().locator('.aspect-bar').evaluateAll(bars => bars.map(bar => getComputedStyle(bar).backgroundImage));
        expect(colors[0]).not.toBe(colors[1]);
        if (viewport.width === 1366) {
            await page.setViewportSize({ width: 1366, height: 1200 });
            await charts.screenshot({ path: testInfo.outputPath('five-aspects-desktop.png') });
        }
    }
});
