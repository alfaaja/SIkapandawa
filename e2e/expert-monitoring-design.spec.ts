import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function capturePoster(dialog: Locator, path: string): Promise<void> {
    const styles = await dialog.evaluate(element => {
        const content = element.querySelector<HTMLElement>('.dialog-content')!;
        const header = element.querySelector<HTMLElement>('.dialog-header')!;
        const previous = [element, content, header].map(node => node.getAttribute('style'));
        (element as HTMLElement).style.cssText = 'max-height:none;position:absolute;top:0;margin-top:0;overflow:visible';
        content.style.cssText = 'max-height:none;overflow:visible';
        header.style.position = 'static';
        return previous;
    });
    try { await dialog.locator('.monitoring-comparison').screenshot({ path }); }
    finally {
        await dialog.evaluate((element, previous) => {
            const nodes = [element, element.querySelector('.dialog-content')!, element.querySelector('.dialog-header')!];
            nodes.forEach((node, i) => previous[i] === null ? node.removeAttribute('style') : node.setAttribute('style', previous[i]!));
        }, styles);
    }
}

for (const width of [375, 768, 1440]) test(`expert monitoring presentation and evidence at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        const rows = [];
        for (const period of [9001, 9002]) for (const reporter of ['parent', 'teacher']) for (let point = 1; point <= 12; point++) {
            const value = period === 9001 ? 3 : reporter === 'parent' ? 4 : 1 + point % 2;
            rows.push({ userId: '00000000-0000-4000-8000-000000000001', id: `${period}-${reporter}-${point}`, pointNumber: point,
                monitoringPeriod: 'periode ' + period, reporterType: reporter, observedAt: '2026-10-23T09:00:00Z', createdAt: '2026-10-23T09:01:00Z',
                guardianName: '[DATA UJI] Penguji', studentClass: 'TESTING', situation: '[DATA UJI] Pengujian tampilan', behavior: '[DATA UJI] Contoh sintetis', reinforcement: '',
                scores: { kejujuran: value, keberanian: value, kesopanan: value, kebijaksanaan: value, keadilan: value } });
        }
        localStorage.setItem('sikapandawa.monitoring.demo', JSON.stringify(rows));
    });
    await page.goto('/admin/?mockAdmin=1');
    await page.getByLabel('Nama pengguna').fill('admin.demo');
    await page.getByLabel('Password', { exact: true }).fill('local-test-only');
    await page.getByRole('button', { name: 'Masuk ke panel' }).click();
    await page.getByRole('tab', { name: 'Monitoring', exact: true }).click();
    await expect(page.getByText('Forward chaining', { exact: true })).toBeVisible();
    await page.getByLabel('Periode monitoring', { exact: true }).fill('9002');
    await page.getByRole('button', { name: 'Terapkan periode' }).click();
    await expect(page.locator('.dashboard-tab-panel [data-reporter="parent"]')).toContainText('1 dari 56 siswa');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`expert-overview-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Lihat analisis siswa' }).click();
    await expect(page.getByRole('tab', { name: 'Siswa', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Monitoring @arjuna.pratama', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Monitoring siswa', exact: true });
    await expect(dialog.getByText('5 aspek perlu klarifikasi', { exact: true })).toBeVisible();
    await expect(dialog.locator('.expert-test-notice')).toBeVisible();
    await expect(dialog.locator('.expert-period')).toHaveText('Periode 9002');
    await expect(dialog.locator('.comparison-card[data-status="review"]')).toHaveCount(5);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.screenshot({ path: info.outputPath(`expert-result-${width}.png`) });
    // Capture an expanded desktop panel for a poster, then restore the live dialog layout.
    if (width === 1440) {
        await capturePoster(dialog, info.outputPath('expert-analysis-poster-1440.png'));
    }
    const first = dialog.locator('.comparison-card').first();
    await first.getByText('Lihat penalaran dan selisih 12 titik').click();
    await expect(first).toContainText('R3: minimal 3 titik');
    await expect(first.locator('table tbody tr')).toHaveCount(12);
    await expect(first.locator('table tbody tr').first()).toContainText('4');
    expect(await first.locator('table').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await first.locator('tbody').evaluate(element => getComputedStyle(element).display)).toBe('table-row-group');
    await first.screenshot({ path: info.outputPath(`expert-evidence-${width}.png`) });
    await page.evaluate(readFileSync('release/qa-axe.min.js', 'utf8'));
    const violations = await page.evaluate(async () => {
        const engine = (window as unknown as { axe: { run: (root: Element, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
        return (await engine.run(document.querySelector('dialog[open]')!, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations;
    });
    expect(violations).toEqual([]);
    await dialog.getByText('Grafik & riwayat pengamatan', { exact: true }).click();
    await expect(dialog.locator('.monitoring-history')).toHaveCount(2);
    await expect(dialog.getByRole('heading', { name: 'Monitoring guru · 12 titik', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Tutup monitoring', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
    await page.getByRole('tab', { name: 'Monitoring', exact: true }).click();
    await page.getByLabel('Periode monitoring', { exact: true }).fill('9001');
    await page.getByRole('button', { name: 'Terapkan periode' }).click();
    await page.getByRole('button', { name: 'Lihat analisis siswa' }).click();
    await page.getByRole('button', { name: 'Monitoring @arjuna.pratama', exact: true }).click();
    await expect(dialog.locator('.expert-verdict')).toContainText('Pola selisih besar belum terdeteksi');
    await expect(dialog.locator('.comparison-card[data-status="no_repeated_large_gap"]')).toHaveCount(5);
    if (width === 1440) await capturePoster(dialog, info.outputPath('expert-aligned-poster-1440.png'));
    await dialog.locator('.monitoring-comparison').screenshot({ path: info.outputPath(`expert-aligned-${width}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Monitoring', exact: true }).click();
    await page.getByLabel('Periode monitoring', { exact: true }).fill('9');
    await page.getByRole('button', { name: 'Terapkan periode' }).click();
    await page.getByRole('button', { name: 'Lihat analisis siswa' }).click();
    await page.getByRole('button', { name: 'Monitoring @arjuna.pratama', exact: true }).click();
    await expect(dialog.locator('.expert-verdict')).toContainText('Lengkapi pasangan pengamatan');
    await expect(dialog.locator('.comparison-card[data-status="insufficient"]')).toHaveCount(5);
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
});
