import { defineConfig, devices } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_TEST_PORT) || 8080;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: `http://127.0.0.1:${testPort}`,
        trace: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        // Starting Vite directly lets Playwright terminate the Windows process cleanly.
        command: `node ./node_modules/vite/bin/vite.js --config vite/config.dev.mjs --host 127.0.0.1 --port ${testPort}`,
        url: `http://127.0.0.1:${testPort}`,
        reuseExistingServer: false,
        timeout: 120_000
    }
});
