import { test, expect } from '@playwright/test';
import { watchRequests, watchConsole, dismissConsent } from './helpers';

test.describe('Ana sayfa', () => {
  test('yüklenir, tek H1, hatasız konsol, izinsiz üçüncü taraf isteği yok', async ({ page }) => {
    const reqs = watchRequests(page);
    const errors = watchConsole(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Ayaz İşitme Merkezi/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText("Keçiören'de");
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://keciorenisitme.com/');
    await expect(page.locator('link[hreflang=en]')).toHaveAttribute('href', 'https://keciorenisitme.com/en/');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
    // çerez paneli ilk ziyarette görünür
    await expect(page.locator('[data-consent]')).toBeVisible();
    await dismissConsent(page);
    await expect(page.locator('[data-consent]')).toBeHidden();
    await page.waitForTimeout(800);
    expect(reqs.thirdParty(), 'izinsiz üçüncü taraf isteği').toEqual([]);
    expect(errors().filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('TR/EN yatay taşma yok (320–1440)', async ({ page }) => {
    for (const path of ['/', '/en/']) {
      await page.goto(path);
      await dismissConsent(page);
      for (const w of [320, 360, 390, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(sw, `${path} viewport ${w}`).toBeLessThanOrEqual(w);
      }
    }
  });

  test('cihaz türü sekmeleri: tıklama ve klavye', async ({ page }) => {
    await page.goto('/#cihazlar');
    await dismissConsent(page);
    const tabs = page.locator('[data-tabs]').getByRole('tab');
    await expect(tabs).toHaveCount(6);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-ric')).toBeVisible();
    await expect(page.locator('#panel-bte')).toBeHidden();
    await tabs.nth(1).press('ArrowRight');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(2)).toBeFocused();
    await tabs.nth(2).press('End');
    await expect(page.locator('#panel-iic')).toBeVisible();
  });

  test('SSS akordeonu tek açık ve JSON-LD ile aynı sayıda', async ({ page }) => {
    await page.goto('/#sss');
    await dismissConsent(page);
    const items = page.locator('details.acc[name=faq]');
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(8);
    await items.nth(0).locator('summary').click();
    await items.nth(1).locator('summary').click();
    expect(await items.evaluateAll((els) => els.filter((e) => (e as HTMLDetailsElement).open).length)).toBe(1);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = ld.map((t) => JSON.parse(t)).find((o) => o['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBe(n);
  });

  test('galeri lightbox: aç, ilerle, Escape ile kapat, odak geri döner', async ({ page }) => {
    await page.goto('/#merkezimiz');
    await dismissConsent(page);
    const first = page.locator('.gal__btn').first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    const dlg = page.locator('[data-lightbox]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('img')).toHaveAttribute('src', /_astro\/ofis-6/);
    await page.keyboard.press('ArrowRight');
    await expect(dlg.locator('img')).toHaveAttribute('src', /_astro\/ofis-1/);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(first).toBeFocused();
  });

  test('harita doğrudan yüklenir (Google Maps iframe, işaretli konum)', async ({ page }) => {
    await page.goto('/#iletisim');
    await dismissConsent(page);
    const frame = page.locator('[data-map] iframe');
    await expect(frame).toHaveAttribute('src', /google\.com\/maps\?q=Ayaz/);
    await expect(frame).toHaveAttribute('title', /Google/);
    await expect(page.locator('[data-map] [data-track="directions_click"]')).toBeVisible();
  });

  test('robots, sitemap, og görseli ve 404', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('sitemap-index.xml');
    const sm = await request.get('/sitemap-index.xml');
    expect(sm.ok()).toBeTruthy();
    const og = await request.get('/og.jpg');
    expect(og.headers()['content-type']).toContain('image/jpeg');
    const ogEn = await request.get('/og-en.jpg');
    expect(ogEn.headers()['content-type']).toContain('image/jpeg');
    const nf = await request.get('/olmayan-sayfa/');
    expect(nf.status()).toBe(404);
  });
});

test.describe('Google yorumları (Takeout verisi)', () => {
  test('en iyi yorum önde, 30+ kart, özet 5,0 · 65, çok sayfada sayaç', async ({ page }) => {
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    expect(await cards.count()).toBeGreaterThanOrEqual(30);
    await expect(cards.first().locator('[data-author]')).toHaveText('Akın E.');
    await expect(page.locator('[data-score] [data-rating]')).toHaveText('5,0');
    await expect(page.locator('[data-score] [data-count]')).toContainText('65');
    await expect(page.locator('[data-progress]')).toBeVisible();
    await expect(page.locator('[data-progress-text]')).toHaveText(/^1 \/ \d+$/);
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-progress-text]')).not.toHaveText(/^1 \//, { timeout: 5000 });
    // Çıkar çatışması / sağlık sonucu iddiası / rakip kıyası içeren yorumlar gösterilmez
    await expect(page.locator('[data-list]')).not.toContainText('Salih P.');
    await expect(page.locator('[data-list]')).not.toContainText('sorunu kalmadı');
    await expect(page.locator('[data-list]')).not.toContainText('Diğer firmalara göre');
  });

  test('İngilizce sayfada Google çevirisi etiketiyle', async ({ page }) => {
    await page.goto('/en/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    const first = cards.first();
    await expect(first).toContainText('Translated by Google');
    await expect(first.locator('[data-text]')).toHaveAttribute('lang', 'en');
    // İngilizce sayfada yalnızca çevirisi olan yorumlar (Türkçe metin karışmaz)
    expect(await cards.count()).toBe(await page.locator('[data-list] > .rvc [data-text][lang="en"]').count());
  });
});
