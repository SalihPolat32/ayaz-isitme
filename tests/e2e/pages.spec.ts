import { test, expect } from '@playwright/test';
import { watchConsole, dismissConsent } from './helpers';

test('İngilizce sayfa ve dil geçişi', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/en/');
  await expect(page).toHaveTitle(/Ayaz Hearing Center/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[hreflang="tr-TR"]')).toHaveAttribute('href', 'https://keciorenisitme.com/');
  await dismissConsent(page);
  await page.locator('.hdr__lang').click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors()).toEqual([]);
});

test('Gizlilik sayfaları ve aydınlatma bağlantısı', async ({ page }) => {
  await page.goto('/gizlilik/');
  // main h1: dev sunucusunda Astro geliştirici araç çubuğunun kendi h1'leri de var
  await expect(page.locator('main h1')).toContainText('Gizlilik');
  await expect(page.locator('#aydinlatma')).toBeVisible();
  await expect(page.locator('#cerez')).toBeVisible();
  await page.goto('/en/privacy/');
  await expect(page.locator('main h1')).toContainText('Privacy');
  await page.goto('/#iletisim');
  await dismissConsent(page);
  const link = page.locator('.cx__consent a');
  await expect(link).toHaveAttribute('href', '/gizlilik/#aydinlatma');
});

// GPT incelemesi (26 Eyl 2026): çelişkili çerez cümlesi ve eski taslak alanları kalmamalı; harita açıkça anlatılmalı.
for (const [path, lang] of [['/gizlilik/', 'tr'], ['/en/privacy/', 'en']] as const) {
  test(`gizlilik metni (${lang}): çelişki yok, harita açık, eksikler işaretli`, async ({ page }) => {
    await page.goto(path);
    const body = page.locator('.legal__body');
    const text = (await body.innerText()).replace(/\s+/g, ' ');
    // Eski taslak kalıpları hiçbir derlemede yok
    for (const bad of ['[•', '[Hukuki inceleme', '[Legal review', 'yazılacaktır', '[doğrulanacak]', '[to verify]', 'hiçbir çerezi izniniz olmadan', 'sets no cookies without your consent']) {
      expect(text, bad).not.toContain(bad);
    }
    if (lang === 'tr') {
      await expect(body).toContainText('Sitemizin kendi kodu çerez yazmaz');
      await expect(body).toContainText("IP adresiniz, tarayıcı bilgileriniz ve görüntülediğiniz sayfanın adresi Google'a iletilir");
      await expect(body).toContainText('Aşağı Eğlence Mah. Ayvalı Cad. No:26/A');
    } else {
      await expect(body).toContainText('Our own site code does not write cookies');
      await expect(body).toContainText('are sent to Google');
    }
    await expect(body.locator('a[href="https://policies.google.com/technologies/cookies"]').first()).toBeAttached();
    // Yapılandırmaya bağlı: bu derlemede ölçüm kimliği yoksa "etkin değil" yazar (dev/preview varsayılanı)
    // Eksik işletme bilgisi varsa: her eksik işaretli ve önizleme uyarısı görünür; yoksa ikisi de yok.
    const todos = body.locator('mark.legal-todo');
    const draft = body.locator('[data-legal-draft]');
    // Yer tutucu stili yalnızca yer tutucu basıldığında sayfaya eklenir; taslak metin her zaman noindex.
    const todoStyles = await page.evaluate(() => [...document.querySelectorAll('style')].filter((el) => el.textContent?.includes('legal-todo')).length);
    // Onaylanacak nesne (nihai metnin özetiyle) yalnızca onay dışındaki bilgiler tamamken gösterilir (GPT Tur 6).
    const approval = body.locator('[data-legal-approval]');
    if ((await todos.count()) > 0) {
      await expect(draft).toBeVisible();
      await expect(todos.first()).toBeVisible();
      await expect(todos.first()).toContainText('business.legal.');
      expect(todoStyles).toBe(1);
      await expect(todos.first()).toHaveCSS('outline-style', 'dashed');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      // Diğer bilgiler eksikken kopyalanacak özet yok (yer tutuculu metnin özeti olurdu)
      await expect(approval).toHaveCount(0);
      expect(await draft.innerText()).not.toMatch(/hash: '[0-9a-f]{16}'/);
    } else if ((await approval.count()) > 0) {
      // Bilgiler tamam, yalnızca onay bekliyor: nihai metin + onaylanacak tam nesne, sayfa yine noindex
      await expect(draft).toBeVisible();
      await expect(approval).toContainText(/textApproval: \{ by: '<rol\/kısa ad>', date: '<YYYY-AA-GG>', version: '[^']+', context: 'form=[^']+', hash: '[0-9a-f]{16}' \}/);
      expect(todoStyles).toBe(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    } else {
      await expect(draft).toHaveCount(0);
      expect(todoStyles).toBe(0);
    }
  });
}

test('mobil menü: aç, bağlantıya git, kapan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await dismissConsent(page);
  await page.locator('[data-menu-open]').click();
  const dlg = page.locator('#mobileMenu');
  await expect(dlg).toBeVisible();
  await expect(page.locator('[data-menu-open]')).toHaveAttribute('aria-expanded', 'true');
  await dlg.getByRole('link', { name: 'Hizmetler' }).click();
  await expect(dlg).not.toHaveAttribute('open', ''); // close() anında; görsel geçiş ~320 ms
  await expect(dlg).toBeHidden({ timeout: 10_000 });
  await expect(page).toHaveURL(/#hizmetler/);
  await expect(page.locator('[data-mobile-bar]')).toBeVisible();
});
