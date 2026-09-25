import { test, expect } from '@playwright/test';
import { watchRequests } from './helpers';

test.describe('Çerez izni', () => {
  test('ret sonrası üçüncü taraf script yok; tercih kalıcı; yeniden açılabilir', async ({ page }) => {
    const reqs = watchRequests(page);
    await page.goto('/');
    await page.locator('[data-consent-reject]').click();
    await page.waitForTimeout(500);
    expect(reqs.thirdParty()).toEqual([]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ayaz.consent.v1') || 'null'));
    expect(stored).toMatchObject({ necessary: true, analytics: false, marketing: false });
    await page.reload();
    await expect(page.locator('[data-consent]')).toBeHidden();
    await page.locator('[data-consent-open]').first().click();
    await expect(page.locator('[data-consent]')).toBeVisible();
    await expect(page.locator('[data-consent-cats]')).toBeVisible();
    await page.locator('[data-consent-cat=analytics]').check();
    await page.locator('[data-consent-save]').click();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ayaz.consent.v1') || 'null'));
    expect(after.analytics).toBe(true);
    const dl = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer.map((a) => Array.from(a)));
    const updates = dl.filter((a) => a[0] === 'consent' && a[1] === 'update');
    const update = updates[updates.length - 1] as unknown[]; // son güncelleme
    expect(update?.[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_personalization: 'denied' });
    // Kimlik tanımlı olmadığından izin verilse bile gtag.js yüklenmez
    await page.waitForTimeout(400);
    expect(reqs.thirdParty()).toEqual([]);
  });

  test('Consent Mode default komutu ilk script olarak var', async ({ page }) => {
    await page.goto('/');
    const dl = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer.map((a) => Array.from(a)));
    expect(dl[0]?.[0]).toBe('consent');
    expect(dl[0]?.[1]).toBe('default');
    expect(dl[0]?.[2]).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  });
});
