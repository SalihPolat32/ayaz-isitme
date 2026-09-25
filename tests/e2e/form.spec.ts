import { test, expect } from '@playwright/test';
import { dismissConsent } from './helpers';

test.describe('Randevu formu (API yok → WhatsApp modu)', () => {
  test('boş gönderim hata verir, geçerli gönderim WhatsApp bağlantısı üretir', async ({ page, context }) => {
    await page.goto('/#iletisim');
    await dismissConsent(page);
    const form = page.locator('[data-appointment-form]');
    await expect(form.locator('[data-fallback-notice]')).toBeVisible();
    await expect(form.locator('[data-submit]')).toContainText('WhatsApp');

    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-error-for=name]')).not.toBeEmpty();
    await expect(form.locator('[data-error-for=phone]')).not.toBeEmpty();
    await expect(form.locator('[data-error-for=consent]')).not.toBeEmpty();
    await expect(form.locator('#f-name')).toHaveAttribute('aria-invalid', 'true');

    await form.locator('#f-name').fill('Test Kullanıcı');
    await form.locator('#f-phone').fill('0507 155 11 51');
    await form.locator('#f-time').selectOption({ index: 1 });
    await form.locator('input[name=consent]').check();
    const popup = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await form.locator('[data-submit]').click();
    const p = await popup;
    const url = p ? p.url() : page.url();
    // wa.me → api.whatsapp.com/send/?phone=… yönlendirmesi olabilir; her iki biçim kabul
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).toMatch(/wa\.me\/905071551151|phone=905071551151/);
    expect(decoded).toContain('905071551151');
    expect(decoded).toContain('Test Kullanıcı');
    await expect(form.locator('[data-status]')).toContainText('WhatsApp');
    // sahte "alındı" yok
    await expect(form.locator('[data-status]')).not.toContainText('Talebiniz alındı');
    if (p) await p.close();
  });

  test('bot tuzağı doluysa hiçbir şey olmaz', async ({ page, context }) => {
    await page.goto('/#iletisim');
    await dismissConsent(page);
    const form = page.locator('[data-appointment-form]');
    await form.locator('#f-name').fill('Bot');
    await form.locator('#f-phone').fill('05071551151');
    await form.locator('input[name=consent]').check();
    await form.locator('#f-website').fill('http://spam', { force: true });
    let popup = false;
    context.once('page', () => (popup = true));
    await form.locator('[data-submit]').click();
    await page.waitForTimeout(400);
    expect(popup).toBe(false);
    await expect(form.locator('[data-status]')).toBeEmpty();
  });
});
