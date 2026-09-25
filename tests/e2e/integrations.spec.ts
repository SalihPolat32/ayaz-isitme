import { test, expect, type Page } from '@playwright/test';
import { dismissConsent } from './helpers';

async function withApi(page: Page) {
  await page.route('http://127.0.0.1:4322/**', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const html = (await response.text()).replace('"apiBase":""', '"apiBase":"https://api.ayaz.test"');
    await route.fulfill({ response, body: html });
  });
}

test('API form can deliver a second request after resetting, with a fresh start time', async ({ page }) => {
  await withApi(page);
  const submitted: Record<string, unknown>[] = [];
  await page.route('https://api.ayaz.test/api/appointment', async route => {
    const body = route.request().postDataJSON();
    submitted.push(body);
    expect(Date.now() - body.t).toBeGreaterThanOrEqual(3000);
    await route.fulfill({ json: { ok: true, delivered: true } });
  });
  await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ status: 503, json: { ok: false } }));
  await page.goto('/#iletisim');
  await dismissConsent(page);
  const form = page.locator('[data-appointment-form]');
  for (let i = 0; i < 2; i++) {
    await form.locator('#f-name').fill('Test Kullanıcı');
    await form.locator('#f-phone').fill('05071234567');
    await form.locator('[name=consent]').check();
    await page.waitForTimeout(3100);
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-status]')).toContainText('Talebiniz alındı');
    await expect(form.locator('#f-name')).toHaveValue('');
  }
  expect(submitted).toHaveLength(2);
  expect(Number(submitted[1].t)).toBeGreaterThan(Number(submitted[0].t));
});

test('English API errors and translated reviews remain English and accessible', async ({ page }) => {
  await withApi(page);
  await page.route('https://api.ayaz.test/api/appointment', r => r.fulfill({ status: 422, json: { ok: false, fields: { phone: 'invalid' } } }));
  await page.route('https://api.ayaz.test/api/reviews*', r => {
    expect(new URL(r.request().url()).searchParams.get('lang')).toBe('en');
    return r.fulfill({ json: { ok: true, rating: 4.5, userRatingCount: 2, reviews: [{ author: 'Test author', rating: 4, text: 'A translated test review.', translated: true, relativeTime: 'a month ago', reviewUri: 'https://maps.google.com/' }] } });
  });
  await page.goto('/en/#yorumlar');
  await dismissConsent(page);
  // Yorumlar bölüm görünür olunca yüklenir; yavaş (yazılımsal GPU) ortamda 3B motor yüklemesi bunu geciktirebilir.
  await expect(page.locator('[data-list]')).toContainText('Translated by Google', { timeout: 20_000 });
  await expect(page.locator('[data-list] [data-stars]')).toHaveAttribute('aria-label', '4 out of 5');
  const form = page.locator('[data-appointment-form]');
  await form.locator('#f-name').fill('Test User');
  await form.locator('#f-phone').fill('05071234567');
  await form.locator('[name=consent]').check();
  await form.locator('[data-submit]').click();
  await expect(form.locator('[data-error-for=phone]')).toContainText('Please enter a valid phone number');
});
