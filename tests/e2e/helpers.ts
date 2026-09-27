import type { Page } from '@playwright/test';

/** Üçüncü taraf ölçüm/reklam alan adları — izin yokken hiçbirine istek gitmemeli. */
export const THIRD_PARTY = ['googletagmanager.com', 'google-analytics.com', 'facebook.net', 'facebook.com/tr', 'openai.com', 'doubleclick.net', 'challenges.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

export function watchRequests(page: Page) {
  const urls: string[] = [];
  // Yalnızca sitenin kendi (ana) çerçevesi: iletişimdeki Google Haritalar gömmesi bilinçli bir üçüncü taraf
  // iframe'idir ve kendi alt isteklerini yapar; bu test sitenin izinsiz izleme betiği yüklemediğini doğrular.
  // TÜM çerçeveleri (harita iframe'i dahil) kapsayan izinsiz izleme kanıtı: privacy-all-frames.spec.ts
  page.on('request', (r) => {
    try {
      if (r.frame() === page.mainFrame()) urls.push(r.url());
    } catch {
      urls.push(r.url());
    }
  });
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
