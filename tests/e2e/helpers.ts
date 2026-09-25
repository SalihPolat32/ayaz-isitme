import type { Page } from '@playwright/test';

/** Üçüncü taraf ölçüm/reklam alan adları — izin yokken hiçbirine istek gitmemeli. */
export const THIRD_PARTY = ['googletagmanager.com', 'google-analytics.com', 'facebook.net', 'facebook.com/tr', 'openai.com', 'doubleclick.net', 'challenges.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

export function watchRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return {
    thirdParty: () => urls.filter((u) => THIRD_PARTY.some((d) => u.includes(d))),
    all: () => urls,
  };
}

export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return () => errors;
}

export async function dismissConsent(page: Page) {
  const btn = page.locator('[data-consent-reject]');
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) await btn.click();
}
