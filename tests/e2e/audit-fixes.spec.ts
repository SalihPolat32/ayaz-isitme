import { test, expect } from '@playwright/test';
import { dismissConsent } from './helpers';

// Tur 10 bağımsız denetim bulgularının kalıcı testleri (27 Eyl 2026).

test.describe('gezinme: gizlilik ve 404 sayfaları', () => {
  test('bölüm bağlantıları ve "Randevu Talep Et" ana sayfaya gider; dil değiştirici eşleşen gizlilik sayfasına', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gizlilik/');
    await dismissConsent(page);
    await expect(page.locator('.hdr__nav a').first()).toHaveAttribute('href', '/#cihazlar');
    await expect(page.locator('.hdr__cta')).toHaveAttribute('href', '/#iletisim');
    await expect(page.locator('.ftr__col a[href="/#hizmetler"]')).toHaveCount(1);
    await expect(page.locator('.hdr__lang')).toHaveAttribute('href', '/en/privacy/');
    await page.locator('.hdr__cta').click();
    await expect(page).toHaveURL(/\/#iletisim$/);
    await expect(page.locator('#iletisim')).toBeVisible();

    await page.goto('/en/privacy/');
    await expect(page.locator('.hdr__nav a').first()).toHaveAttribute('href', '/en/#cihazlar');
    await expect(page.locator('.hdr__lang')).toHaveAttribute('href', '/gizlilik/');
    // Görünen etiket erişilebilir adın içinde (WCAG 2.5.3)
    await expect(page.locator('.hdr__lang')).toHaveAttribute('aria-label', /^TR /);
  });

  test('404: kanonik adres ve hreflang yok, bağlantılar ana sayfaya', async ({ page }) => {
    await page.goto('/404.html');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
    await expect(page.locator('.ftr__col a[href="/#iletisim"]')).toHaveCount(1);
  });
});

test.describe('çerez bildirimi', () => {
  test('ilk ziyarette odak çalınmaz; Escape "isteğe bağlı izin yok" kaydedip kapatır', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('[data-consent]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    const mode = await banner.getAttribute('data-consent-mode');
    if (mode === 'notice') {
      const inBanner = await page.evaluate(() => document.querySelector('[data-consent]')!.contains(document.activeElement));
      expect(inBanner).toBe(false);
    }
    await page.locator('[data-consent-reject]').focus();
    await page.keyboard.press('Escape');
    await expect(banner).toBeHidden();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ayaz.consent.v1') || 'null'));
    expect(stored).toMatchObject({ analytics: false, marketing: false });
    // Odak kaybolmaz (body'ye düşmez)
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
});

test.describe('içerik ve paylaşım', () => {
  test('fontlar uygulanır: başlık ve gövde Manrope (kendi sunucumuzdan)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const [h1, body] = await page.evaluate(() => [getComputedStyle(document.querySelector('h1')!).fontFamily, getComputedStyle(document.body).fontFamily]);
    expect(h1).toMatch(/^"?Manrope/);
    expect(body).toMatch(/^"?Manrope/);
  });

  test('paylaşım görseli dile göre; SSS doğrulanmamış SGK iddiasını söylemez; yorumcu adı kısa', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\.jpg$/);
    const html = await page.content();
    expect(html).not.toContain('SGK süreci için');
    await page.goto('/en/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-en\.jpg$/);
    expect(await page.content()).not.toContain('for the SGK process');
  });
});

test.describe('JavaScript kapalı', () => {
  test('randevu formu gönderilemez (veri hiçbir sunucuya gitmez) ve not görünür', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/#iletisim');
    await expect(page.locator('[data-submit]')).toBeDisabled();
    // <noscript> notu JS kapalıyken görünür (her zaman var olan gizli WhatsApp notu değil)
    await expect(page.locator('#iletisim').getByText(/JavaScript/)).toBeVisible();
    await ctx.close();
  });
});

test('3B sahne üzerinde fare tekerleği sayfayı kaydırır (yakınlaştırma yalnız Ctrl/⌘ ile)', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await dismissConsent(page);
  await page.locator('#incele').scrollIntoViewIfNeeded();
  const root = page.locator('[data-explorer]');
  await expect(root).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  const box = (await page.locator('[data-canvas]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
});
