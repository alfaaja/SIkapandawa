import { chromium } from '@playwright/test';

// Fresh browser context: no credentials, no production account mutations.
const base = process.env.LOCAL_QA_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage(); const paths = []; const failures = [];
    page.on('request', request => { if (request.url().includes('__admin_api')) paths.push(new URL(request.url()).pathname); });
    page.on('requestfailed', request => failures.push(new URL(request.url()).pathname));
    await page.goto(base + '/admin/');
    await page.getByRole('button', { name: 'Masuk ke panel', exact: true }).waitFor();
    const results = await page.evaluate(async () => {
        const { getAdminBackend } = await import('/src/admin/services/AdminSupabaseClient.ts');
        const backend = getAdminBackend(); const results = [];
        for (const action of ['create', 'update', 'reset_password', 'delete']) {
            const response = await backend.invokeAdminFunction(action, {});
            results.push({ action, status: response.error?.status });
        }
        return results;
    });
    if (results.some(item => item.status !== 401) || paths.length !== 4 || failures.length) throw Error(JSON.stringify({ results, paths, failures }));
    await page.goto(base + '/form/');
    const username = page.getByLabel('Username', { exact: true });
    await page.keyboard.press('Tab');
    if (!await username.evaluate(element => element === document.activeElement)) throw Error('Parent username keyboard focus missing');
    await page.keyboard.press('Tab');
    if (!await page.getByLabel('Password', { exact: true }).evaluate(element => element === document.activeElement)) throw Error('Parent password keyboard focus missing');
    await page.keyboard.press('Tab');
    if (!await page.getByRole('button', { name: 'Masuk ke monitoring', exact: true }).evaluate(element => element === document.activeElement)) throw Error('Parent submit keyboard focus missing');
    console.log(JSON.stringify({ results, localRequests: paths.length, failedRequests: failures.length, parentKeyboardLogin: 'PASS' }));
} finally { await browser.close(); }
