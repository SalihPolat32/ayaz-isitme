import { test, expect } from '@playwright/test';
import { watchRequests } from './helpers';

/** Panelde adı geçebilecek isteğe bağlı hizmetler ↔ çalışma zamanı ayarındaki kimlik alanı (Base.astro > runtimeConfig) */
const SERVICES = { ga4: 'Google Analytics', gads: 'Google Ads', meta: 'Meta Pixel', openai: 'OpenAI' } as const;

test.describe('Çerez izni', () => {
  test('ret/kapatma sonrası üçüncü taraf script yok; tercih kalıcı; yeniden açılabilir', async ({ page }) => {
    const reqs = watchRequests(page);
    await page.goto('/');
    const mode = await page.locator('[data-consent]').getAttribute('data-consent-mode');
    await page.locator('[data-consent-reject]').click();
    await page.waitForTimeout(500);
    expect(reqs.thirdParty()).toEqual([]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ayaz.consent.v1') || 'null'));
    expect(stored).toMatchObject({ necessary: true, analytics: false, marketing: false });
    await page.reload();
    await expect(page.locator('[data-consent]')).toBeHidden();
    await page.locator('[data-consent-open]').first().click();
    await expect(page.locator('[data-consent]')).toBeVisible();
    if (mode === 'notice') {
      // İsteğe bağlı hizmet yok: kategori/kabul/yönet yok, tek düğme odakta
      await expect(page.locator('[data-consent-cats], [data-consent-accept], [data-consent-manage], [data-consent-save]')).toHaveCount(0);
      await expect(page.locator('[data-consent-reject]')).toBeFocused();
      return;
    }
    await expect(page.locator('[data-consent-cats]')).toBeVisible();
    if ((await page.locator('[data-consent-cat=analytics]').count()) === 0) return;
    await page.locator('[data-consent-cat=analytics]').check();
    await page.locator('[data-consent-save]').click();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ayaz.consent.v1') || 'null'));
    expect(after.analytics).toBe(true);
    const dl = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer.map((a) => Array.from(a)));
    const updates = dl.filter((a) => a[0] === 'consent' && a[1] === 'update');
    const update = updates[updates.length - 1] as unknown[]; // son güncelleme
    expect(update?.[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_personalization: 'denied' });
  });

  // Doğrulayıcı bulgusu (27 Eyl 2026): panel, kimliği boş olan hiçbir hizmeti adlandırmaz ve onun için izin istemez.
  for (const path of ['/', '/en/']) {
    test(`panel yalnızca kimliği tanımlı hizmetleri adlandırır (${path})`, async ({ page }) => {
      await page.goto(path);
      const cfg = JSON.parse((await page.locator('#ayaz-config').textContent()) || '{}') as Record<string, string>;
      const banner = page.locator('[data-consent]');
      await expect(banner).toBeVisible();
      const text = ((await banner.textContent()) || '').replace(/\s+/g, ' '); // gizli kategori metinleri dahil
      const active = (Object.keys(SERVICES) as (keyof typeof SERVICES)[]).filter((k) => !!cfg[k]);
      for (const k of Object.keys(SERVICES) as (keyof typeof SERVICES)[]) {
        if (active.includes(k)) expect(text, k).toContain(SERVICES[k]);
        else expect(text, k).not.toContain(SERVICES[k]);
      }
      await expect(page.locator('[data-consent-cat=analytics]')).toHaveCount(cfg.ga4 ? 1 : 0);
      await expect(page.locator('[data-consent-cat=marketing]')).toHaveCount(cfg.gads || cfg.meta || cfg.openai ? 1 : 0);
      if (active.length === 0) {
        await expect(banner).toHaveAttribute('data-consent-mode', 'notice');
        expect(text).not.toMatch(/istatistik|reklam ölçümü için kullanılan|izin verirseniz yüklenir|statistics|only loaded if you give permission/i);
        await expect(page.locator('[data-consent-accept], [data-consent-manage]')).toHaveCount(0);
      }
      await expect(banner.locator('a')).toHaveAttribute('href', path === '/' ? '/gizlilik/#cerez' : '/en/privacy/#cerez');
    });
  }

  test('Consent Mode default komutu ilk script olarak var', async ({ page }) => {
    await page.goto('/');
    const dl = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer.map((a) => Array.from(a)));
    expect(dl[0]?.[0]).toBe('consent');
    expect(dl[0]?.[1]).toBe('default');
    expect(dl[0]?.[2]).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  });
});
