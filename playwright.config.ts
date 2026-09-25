import { defineConfig, devices } from '@playwright/test';

// Build çıktısını (dist/) astro preview ile sunar; gerçek dış servislere istek atılmaz.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'tr-TR',
  },
  webServer: {
    command: 'npx astro preview --host 127.0.0.1 --port 4322 --ignore-lock',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
