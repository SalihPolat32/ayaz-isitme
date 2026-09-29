import { test, expect, type Page } from '@playwright/test';
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

test('3B sahne üzerinde fare tekerleği sayfayı kaydırır (yakınlaştırma yalnız Ctrl/⌘ ile)', async ({ page, isMobile }) => {
  // Fare tekerleği masaüstü senaryosudur; mobil WebKit'te page.mouse.wheel desteklenmez (dokunmatikte tekerlek yok)
  test.skip(isMobile, 'Telefon: fare tekerleği yok');
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

// GPT bulguları (29 Eyl 2026): klavye odağı yorum kaydırıcısındayken sekmeye dönülünce otomatik kaydırma yeniden başlıyordu.
// Düzeltmenin ilk hâlinde de düğme "durdur" kalıyordu (başlatmak için iki basış gerekiyordu) ve bir kez başlatınca izin sıfırlanmıyordu.
test.describe('yorum kaydırıcısı: otomatik kaydırma ve odak (WAI-ARIA APG)', () => {
  // Sekme değişimi, tarayıcıların gönderdiği sırayla: ayrılırken odaktaki öğeye blur/focusout, pencereye blur, gizlenme;
  // dönünce görünme, pencereye focus ve aynı öğeye yeniden focus/focusin
  const switchTab = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement;
      const setHidden = (h: boolean) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      el?.dispatchEvent(new FocusEvent('blur'));
      el?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      window.dispatchEvent(new FocusEvent('blur'));
      setHidden(true);
      setHidden(false);
      window.dispatchEvent(new FocusEvent('focus'));
      el?.dispatchEvent(new FocusEvent('focus'));
      el?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
  const setup = async (page: Page) => {
    await page.goto('/#yorumlar');
    // Çerez bildirimi (açılıştan kısa süre sonra görünür) klavyeyle, Escape ile kapatılır; fare imleci sayfaya girmez.
    // Playwright'ın WebKit'inde pointerleave gelmediği için imleç kaydırıcının üstüne düşerse kaydırma hiç başlamazdı.
    const banner = page.locator('[data-consent]');
    if (await banner.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)) {
      await page.keyboard.press('Escape');
      await expect(banner).toBeHidden();
    }
    // Otomatik kaydırma yalnız bölüm görünürken çalışır. Yük altındaki WebKit emülasyonu bazen #yorumlar'a kaydırmadan
    // sayfayı en üstte bırakıyor (18 yüklemede 2); ön koşul olarak kaydırıcı görünür yapılır.
    await page.locator('#yorumlar [data-carousel]').scrollIntoViewIfNeeded();
    const play = page.locator('#yorumlar [data-play]');
    const track = page.locator('#yorumlar [data-list]');
    const labels = await play.evaluate((b) => ({ pause: b.dataset.labelPause!, play: b.dataset.labelPlay! }));
    return {
      play,
      track,
      labels,
      // Otomatik kaydırma çalışırken sayaç okunmaz (aria-live="off"); durunca "polite"
      live: page.locator('#yorumlar [data-progress-text]'),
      score: page.locator('#yorumlar [data-score]'),
      // Klavyeyle giriş: kaydırıcıdan önceki puan bağlantısından Tab → kart şeridi
      enterByKeyboard: async () => {
        await page.locator('#yorumlar [data-score]').focus();
        await page.keyboard.press('Tab');
        await expect(track).toBeFocused();
      },
      // Sondan giriş: kaydırıcıdan sonraki bağlantıdan Shift+Tab → Chromium'da doğrudan başlat/durdur düğmesi
      // (53 yorumda sayfa noktaları gizli), WebKit'te kart şeridi (Tab düğmeleri atlar)
      enterBackwards: async () => {
        await page.locator('#yorumlar .rv__actions a').first().focus();
        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('[data-carousel]'))).toBe(true);
      },
      // Düğmenin ikon dışındaki kenarına tık: olaylar düğmenin kendisine düşer (ikonun üstüne tıklamadan farklı)
      clickRing: async () => {
        await play.scrollIntoViewIfNeeded();
        const box = (await play.boundingBox())!;
        const position = { x: 5, y: Math.round(box.height / 2) };
        expect(await play.evaluate((b, p) => document.elementFromPoint(b.getBoundingClientRect().x + p.x, b.getBoundingClientRect().y + p.y) === b, position)).toBe(true);
        await play.click({ position });
      },
    };
  };
  type Carousel = Awaited<ReturnType<typeof setup>>;
  const expectStopped = async (c: Carousel) => {
    await expect(c.live).toHaveAttribute('aria-live', 'polite');
    await expect(c.play).toHaveAttribute('aria-label', c.labels.play);
  };
  const expectRunning = async (c: Carousel) => {
    await expect(c.live).toHaveAttribute('aria-live', 'off');
    await expect(c.play).toHaveAttribute('aria-label', c.labels.pause);
  };

  test('klavye odağı durdurur ve düğme "başlat" olur; tek basış başlatır; yeniden odakta yine durur, sekmeye dönüş başlatmaz', async ({ page }) => {
    test.slow();
    const c = await setup(page);
    await expect(c.live).toHaveAttribute('aria-live', 'off', { timeout: 10_000 });
    await expect(c.play).toHaveAttribute('aria-label', c.labels.pause);

    await c.enterByKeyboard();
    await expectStopped(c);
    await switchTab(page);
    await c.score.focus(); // odak çıkışı da başlatmaz
    await page.waitForTimeout(300);
    await expectStopped(c);

    // Tek Enter başlatır ve gerçekten kaydırır (5 sn aralık)
    await c.play.focus();
    await page.keyboard.press('Enter');
    await expectRunning(c);
    const x0 = await c.track.evaluate((el) => el.scrollLeft);
    await expect.poll(() => c.track.evaluate((el) => el.scrollLeft), { timeout: 9000 }).not.toBe(x0);
    // Odak başlat/durdur düğmesindeyken sekmeye dönüş, kullanıcının başlattığı kaydırmayı durdurmaz
    await switchTab(page);
    await expectRunning(c);

    // Başlat → yeniden odaklan → sekmeye dön: durmuş kalır (önceki başlatma izni sıfırlandı)
    await c.enterBackwards();
    await expectStopped(c);
    await switchTab(page);
    await page.waitForTimeout(1000); // süren yumuşak kaydırma bitsin
    await expectStopped(c);
    const x1 = await c.track.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(5600);
    expect(await c.track.evaluate((el) => el.scrollLeft)).toBe(x1);
  });

  // Fare ya da ekran okuyucu basarken düğme önce odak alır (Chromium); o odak durdursaydı tıklama durumu geri çevirir,
  // ikon yenilenirse de tıklama yutulurdu
  test('fareyle tek tık: "durdur" durdurur, "başlat" başlatır (sonraki/önceki ile durduktan sonra da)', async ({ page, browserName }) => {
    const c = await setup(page);
    // İmleç ayrılınca kaydırma sürer. Playwright'ın WebKit'i fare hareketinde pointerleave göndermiyor (gerçek Safari gönderir).
    const leaveAndExpectRunning = async () => {
      await expect(c.play).toHaveAttribute('aria-label', c.labels.pause);
      if (browserName === 'webkit') return;
      await page.mouse.move(0, 0);
      await expectRunning(c);
    };
    await expect(c.live).toHaveAttribute('aria-live', 'off', { timeout: 10_000 });
    await c.clickRing();
    await page.mouse.move(0, 0); // imleç ayrılınca da durmuş kalır
    await page.waitForTimeout(300);
    await expectStopped(c);
    await c.clickRing();
    await leaveAndExpectRunning();
    await page.locator('#yorumlar [data-next]').click();
    await expectStopped(c);
    await c.play.click(); // ikonun üstüne
    await leaveAndExpectRunning();
  });

  // Klavye dışı sayılan odak da (ör. Firefox'ta ekran okuyucunun taşıdığı odak, :focus-visible değil) şeritte durdurur
  test('kart şeridine gelen her odak durdurur', async ({ page }) => {
    const c = await setup(page);
    await expect(c.live).toHaveAttribute('aria-live', 'off', { timeout: 10_000 });
    await c.track.dispatchEvent('focusin');
    await expectStopped(c);
  });

  test('hareket azaltma: başta durur; "başlat" başlatır, klavyeyle yeniden odakta durur ve sekmeye dönüş başlatmaz', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const c = await setup(page);
    await expectStopped(c);
    await c.play.focus();
    await page.keyboard.press('Enter');
    await expectRunning(c);
    await c.enterByKeyboard();
    await expectStopped(c);
    await switchTab(page);
    await page.waitForTimeout(300);
    await expectStopped(c);
  });

  // Chrome'un "odaklanan öğeyi vurgula" erişilebilirlik ayarında fareyle gelen odak da :focus-visible olur;
  // "durdur"a tek tık yine durdurmalı. Ayar tarayıcı açılışında verilir → bu test kendi Chromium'unu açar.
  test('Chrome "odaklanan öğeyi vurgula" açıkken fareyle tek tık "durdur" durdurur', async ({ playwright, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'Chromium ayarı');
    const browser = await playwright.chromium.launch({ args: ['--blink-settings=accessibilityAlwaysShowFocus=true'] });
    try {
      const page = await (await browser.newContext({ baseURL, locale: 'tr-TR', viewport: { width: 1280, height: 800 } })).newPage();
      const c = await setup(page);
      await expect(c.live).toHaveAttribute('aria-live', 'off', { timeout: 10_000 });
      await c.clickRing();
      expect(await c.play.evaluate((b) => b.matches(':focus-visible'))).toBe(true); // ayar gerçekten etkin
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await expectStopped(c);
    } finally {
      await browser.close();
    }
  });
});
