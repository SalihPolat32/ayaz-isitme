// QA ekran görüntüleri (preview sunucusu 4322 açıkken): node scripts/qa-screenshots.mjs
import { chromium, devices } from '@playwright/test';
const base = process.argv[2] ?? 'http://127.0.0.1:4322';
const consent = { v: 1, necessary: true, analytics: false, marketing: false, ts: Date.now() };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function shoot(ctx, path, url, opts = {}) {
  const page = await ctx.newPage();
  await page.addInitScript((c) => localStorage.setItem('ayaz.consent.v1', JSON.stringify(c)), consent);
  await page.goto(base + url, { waitUntil: 'networkidle' });
  if (opts.scrollTo) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' }); }, opts.scrollTo);
    await page.waitForTimeout(600);
  }
  if (opts.wait3d) {
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('[data-explorer]')?.dataset.state ?? ''), null, { timeout: 60_000 });
    const st = await page.evaluate(() => document.querySelector('[data-explorer]')?.dataset.state);
    if (st !== 'ready') console.warn('UYARI: 3B durumu', st, '(WebGL bağlamı alınamadı olabilir)');
    await page.waitForTimeout(1500);
  }
  if (opts.full) {
    // reveal animasyonlarını tetiklemek için sayfayı baştan sona kaydır
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
  }
  if (opts.full) {
    // Çok uzun sayfalarda tek parça yakalama GPU sınırına takılabilir → bölüm bölüm viewport görüntüsü
    try {
      await page.screenshot({ path, fullPage: true, scale: 'css', timeout: 60_000 });
      console.log('yazıldı', path);
    } catch {
      const ids = ['#ana', '#incele', '#cihazlar', '#markalar', '#hizmetler', '#kulak-kalibi', '#surec', '#merkezimiz', '#yorumlar', '#sss', '#iletisim'];
      for (const id of ids) {
        await page.evaluate((sel) => { const el = document.querySelector(sel); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 80, behavior: 'instant' }); }, id);
        await page.waitForTimeout(500);
        const p2 = path.replace('-full.png', `-${id.slice(1)}.png`);
        await page.screenshot({ path: p2, scale: 'css' });
        console.log('yazıldı', p2);
      }
    }
  } else {
    await page.screenshot({ path, scale: 'css' });
    console.log('yazıldı', path);
  }
  await page.close();
}

// 3B sahneler kendi bağlamlarında (SwiftShader'da önceki WebGL bağlamı kapanınca yenisi alınamayabiliyor)
const d3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await shoot(d3, 'qa/screenshots/desktop-3d.png', '/', { scrollTo: '[data-stage]', wait3d: true });
await d3.close();
const m3 = await browser.newContext({ ...devices['Pixel 7'] });
await shoot(m3, 'qa/screenshots/mobile-3d.png', '/', { scrollTo: '[data-stage]', wait3d: true });
await m3.close();

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await shoot(desktop, 'qa/screenshots/desktop-home-full.png', '/', { full: true });
await shoot(desktop, 'qa/screenshots/desktop-en-hero.png', '/en/');
await shoot(desktop, 'qa/screenshots/desktop-gizlilik.png', '/gizlilik/');
await desktop.close();

const mobile = await browser.newContext({ ...devices['Pixel 7'] });
await shoot(mobile, 'qa/screenshots/mobile-home-full.png', '/', { full: true });
await mobile.close();

const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
await shoot(tablet, 'qa/screenshots/tablet-home.png', '/');
await tablet.close();
await browser.close();
