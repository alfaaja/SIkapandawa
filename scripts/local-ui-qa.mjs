import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Uses disposable browser contexts and DEV fixtures. Never submits real account mutations.
const base = process.env.LOCAL_QA_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const report = [];
await fs.mkdir('release/local-qa', { recursive: true });
try {
    for (const width of [375, 768, 1440]) {
        for (const state of ['admin-login', 'admin-dashboard', 'parent-login', 'parent-form']) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            const page = await context.newPage(); const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                window.__localQa = { lcp: null, cls: 0 };
                new PerformanceObserver(list => { for (const item of list.getEntries()) window.__localQa.lcp = item.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
                new PerformanceObserver(list => { for (const item of list.getEntries()) if (!item.hadRecentInput) window.__localQa.cls += item.value; }).observe({ type: 'layout-shift', buffered: true });
            });
            const admin = state.startsWith('admin');
            await page.goto(base + (admin ? '/admin/?mockAdmin=1' : '/form/?mockMonitoring=1'));
            if (state === 'admin-dashboard' || state === 'parent-form') {
                await page.getByLabel(admin ? 'Nama pengguna' : 'Username siswa').fill(admin ? 'admin.demo' : 'arjuna.pratama');
                await page.getByLabel(admin ? 'Password' : 'Password siswa', { exact: true }).fill('local-test-only');
                await page.getByRole('button', { name: admin ? 'Masuk ke panel' : 'Masuk ke monitoring', exact: true }).click();
                await page.getByRole('heading', { name: admin ? 'Panel Admin' : 'Monitoring 12 titik', exact: true }).waitFor();
            }
            await page.addScriptTag({ url: '/release/qa-vendor/axe.min.js' });
            const audit = await page.evaluate(async () => {
                const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } });
                return result.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map(node => node.target) }));
            });
            const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, ...window.__localQa }));
            await page.screenshot({ path: `release/local-qa/${state}-${width}.png` });
            report.push({ state, width, errors, audit, ...layout, inp: 'Not measured: local scripted interactions do not establish field INP.' });
            console.log(JSON.stringify({ state, width, errors: errors.length, axeViolations: audit.map(item => item.id), ...layout }));
            await context.close();
        }
    }
} finally {
    await fs.writeFile('release/local-qa/report.json', JSON.stringify(report, null, 2));
    await browser.close();
}
if (report.some(item => item.errors.length || item.overflow || item.audit.length)) process.exitCode = 1;
