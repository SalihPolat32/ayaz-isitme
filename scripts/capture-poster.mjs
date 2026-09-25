// 3B temsili modelden poster PNG üretir (hero ve 3B bölümü fallback görseli).
// Gereksinim: dev sunucusu açık (npm run dev) — __ayazViewer yalnızca DEV modda açığa çıkar.
// Kullanım: node scripts/capture-poster.mjs [http://127.0.0.1:4321/]
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const url = process.argv[2] ?? 'http://127.0.0.1:4321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem('ayaz.consent.v1', JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false, ts: Date.now() })));
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.querySelector('[data-stage]');
  window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' });
});
await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.state === 'ready', null, { timeout: 60_000 });
await page.waitForFunction(() => !!window.__ayazViewer, null, { timeout: 10_000 });
await page.waitForTimeout(1500);
const dataUrl = await page.evaluate(async () => {
  const v = window.__ayazViewer;
  v.setAutoRotate(false);
  v.reset();
  v.setExplode(0, false);
  await new Promise((r) => setTimeout(r, 900));
  return v.captureImage(1600, 1600);
});
await browser.close();
const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
const trimmed = await sharp(buf).trim({ threshold: 8 }).toBuffer();
const meta = await sharp(trimmed).metadata();
// Kare tuvale ortala (kenarlarda nefes payı), şeffaf arka plan
const size = Math.round(Math.max(meta.width, meta.height) * 1.18);
const out = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: trimmed, gravity: 'centre' }])
  .png({ compressionLevel: 9, palette: false })
  .toBuffer();
await writeFile('src/assets/device/ric-poster.png', out);
console.log(`ric-poster.png yazıldı: ${size}x${size}, ${(out.length / 1024).toFixed(0)} KB (trimmed ${meta.width}x${meta.height})`);
