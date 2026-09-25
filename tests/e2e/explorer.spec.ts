import { test, expect } from '@playwright/test';
import { dismissConsent } from './helpers';

test.describe('3B cihaz inceleme', () => {
  test('motor bölüm görünür olunca yüklenir; ayrışma, sıfırlama ve hotspot çalışır', async ({ page }) => {
    await page.goto('/');
    await dismissConsent(page);
    // İlk yüklemede three chunk'ı istenmemeli
    await page.locator('#incele').scrollIntoViewIfNeeded();
    const root = page.locator('[data-explorer]');
    await expect(root).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await expect(root.locator('[data-controls]')).toBeVisible();
    await expect(root.locator('.hs.is-visible').first()).toBeVisible({ timeout: 5000 });

    const range = root.locator('[data-explode-range]');
    await range.fill('100');
    await expect(root.locator('[data-explode-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await root.locator('[data-reset]').click();
    await expect(range).toHaveValue('0');

    // Hotspot tıklaması ilgili açıklamayı açar (önce otomatik döndürmeyi durdur: hareketli hedef)
    await root.locator('[data-autorotate]').click();
    await expect(root.locator('[data-autorotate]')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(800);
    const hs = root.locator('.hs.is-visible').first();
    const id = await hs.getAttribute('data-hotspot');
    await hs.click();
    await expect(root.locator(`[data-part="${id}"]`)).toHaveAttribute('open', '');

    // Klavye: canvas odaklanınca ok tuşları çalışır (hata vermez)
    await root.locator('[data-canvas]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('e');
    await page.waitForTimeout(700);
    await expect(range).toHaveValue('100');
    await expect(root.locator('[data-explode-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('r');
    await expect(range).toHaveValue('0');
    await expect(root.locator('[data-canvas]')).toHaveCSS('touch-action', 'pan-y');
  });

  test('prefers-reduced-motion: otomatik döndürme kapalı, açıklamalar erişilebilir', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await dismissConsent(page);
    await page.locator('#incele').scrollIntoViewIfNeeded();
    const root = page.locator('[data-explorer]');
    await expect(root).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await expect(root.locator('[data-autorotate]')).toHaveAttribute('aria-pressed', 'false');
    await expect(root.locator('[data-part]')).toHaveCount(7);
    await ctx.close();
  });

  test('WebGL yokken poster ve fallback metni kalır', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test stub
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return orig.call(this, type, ...rest);
      };
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await dismissConsent(page);
    await page.locator('[data-stage]').scrollIntoViewIfNeeded();
    const root = page.locator('[data-explorer]');
    await expect(root).toHaveAttribute('data-state', 'error', { timeout: 10_000 });
    await expect(root.locator('[data-fallback]')).toBeVisible();
    await expect(root.locator('[data-poster]')).toBeVisible();
    await expect(root.locator('[data-part]')).toHaveCount(7);
    await ctx.close();
  });
});
