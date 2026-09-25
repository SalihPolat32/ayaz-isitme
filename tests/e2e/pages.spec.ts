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
  await expect(page.locator('h1')).toContainText('Gizlilik');
  await expect(page.locator('#aydinlatma')).toBeVisible();
  await expect(page.locator('#cerez')).toBeVisible();
  await page.goto('/en/privacy/');
  await expect(page.locator('h1')).toContainText('Privacy');
  await page.goto('/#iletisim');
  await dismissConsent(page);
  const link = page.locator('.cx__consent a');
  await expect(link).toHaveAttribute('href', '/gizlilik/#aydinlatma');
});

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
