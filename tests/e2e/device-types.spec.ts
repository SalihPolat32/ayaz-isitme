import { test, expect } from '@playwright/test';
import { dismissConsent } from './helpers';

// Cihaz türleri: görünürlük noktaları (çok nokta = daha görünür), temsili çizim açıklamaları, BTE hortumu
test.describe('cihaz türleri görselleri', () => {
  test('görünürlük noktaları ve erişilebilir etiket', async ({ page }) => {
    await page.goto('/#cihazlar');
    await dismissConsent(page);
    const expected: Record<string, number> = { bte: 5, ric: 3, ite: 4, itc: 3, cic: 2, iic: 1 };
    for (const [id, n] of Object.entries(expected)) {
      const vis = page.locator(`#panel-${id} .tp__vis`);
      await expect(vis).toHaveAttribute('data-visibility', String(n));
      await expect(vis.locator('.dot.on')).toHaveCount(n);
      await expect(vis.locator('.dot')).toHaveCount(5);
      await expect(vis.locator('.dots')).toHaveAttribute('aria-label', new RegExp(`^Görünürlük: 5 üzerinden ${n} \\(`));
      await expect(vis.locator('.tp__vislabel')).not.toBeEmpty();
    }
    // "Dolu nokta arttıkça…" açıklaması hiçbir kartta yok
    await expect(page.locator('#cihazlar .tp__vishint')).toHaveCount(0);
    await expect(page.locator('#cihazlar')).not.toContainText('Dolu nokta arttıkça');
  });

  test('IIC bilgi kutusu özellik kartlarına yapışmıyor (≈1rem boşluk)', async ({ page }) => {
    await page.goto('/#cihazlar');
    await dismissConsent(page);
    await page.locator('#tab-iic').click();
    const note = page.locator('#panel-iic .tp__note');
    await expect(note).toContainText('Kulak kanalı ölçüsü ve şekli uygun olmalıdır.');
    const gap = await page.locator('#panel-iic').evaluate((panel) => {
      const spec = panel.querySelector('.spec')!.getBoundingClientRect();
      const n = panel.querySelector('.tp__note')!.getBoundingClientRect();
      return n.top - spec.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(14);
    expect(gap).toBeLessThanOrEqual(20);
  });

  test('temsili çizim açıklamaları; BTE hortumu gerçek çapta ve RIC kablosundan kalın', async ({ page }) => {
    await page.goto('/#cihazlar');
    await dismissConsent(page);
    for (const id of ['bte', 'ric']) {
      await expect(page.locator(`#panel-${id} .tp__cap`)).toContainText('yarı saydam');
    }
    for (const id of ['ite', 'itc', 'cic', 'iic']) {
      await expect(page.locator(`#panel-${id} .tp__cap`)).toContainText('Temsili çizim');
    }
    const earLabels = await page.locator('#cihazlar svg.earview').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(earLabels).toHaveLength(6);
    for (const l of earLabels) expect(l).toMatch(/^Temsili çizim/);
    const alts = await page.locator('#cihazlar .tp__thumb').evaluateAll((els) => els.map((e) => e.getAttribute('alt') ?? ''));
    for (const a of alts) {
      expect(a).toContain('temsili görsel');
      expect(a.toLowerCase()).not.toMatch(/foto|photo/);
    }
    // hortum: 3,3 mm × 7 birim/mm ≈ 23 birim; kablo 0,8 mm ≈ 5,6 birim (viewBox birimi)
    const tube = await page.locator('#panel-bte .ev-tube path').nth(1).getAttribute('stroke-width');
    expect(Number(tube)).toBeGreaterThan(20);
    const wire = await page.locator('#panel-ric svg.earview path[stroke="#7d868d"]').getAttribute('stroke-width');
    expect(Number(wire)).toBeLessThan(8);
    expect(Number(tube)).toBeGreaterThan(Number(wire) * 3);
  });

  test('karşılaştırma tablosu içerik genişliğine yayılır; başlıkta temsili görseller', async ({ page }) => {
    await page.goto('/#cihazlar');
    await dismissConsent(page);
    const acc = page.locator('.dt__compare');
    await acc.locator('summary').click();
    const w = await acc.evaluate((d) => ({
      acc: d.getBoundingClientRect().width,
      wrap: d.querySelector('.dt__tablewrap')!.getBoundingClientRect().width,
    }));
    // Önceden genel .acc__body 70ch sınırı tabloyu ~yarım genişlikte bırakıyordu
    expect(w.wrap).toBeGreaterThan(w.acc - 2);
    // Mobilde yatay kayan tablo klavyeyle odaklanıp kaydırılabilir
    await expect(acc.locator('.dt__tablewrap')).toHaveAttribute('tabindex', '0');
    await expect(acc.locator('.dt__tablewrap')).toHaveAttribute('role', 'region');
    await expect(acc.locator('thead .cmp__thumb')).toHaveCount(6);
    await expect(acc.locator('tbody tr').first().locator('.dot.on')).toHaveCount(5 + 3 + 4 + 3 + 2 + 1);
  });
});

