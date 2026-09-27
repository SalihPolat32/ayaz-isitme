// 3B temsili modellerden poster PNG üretir (hero ve 3B bölümü fallback görselleri).
// Gereksinim: dev sunucusu açık — __ayazViewer yalnızca DEV modda açığa çıkar:
//   ASTRO_DEV_BACKGROUND=0 npx astro dev --port 4323 --host 127.0.0.1
// Kullanım: node scripts/capture-poster.mjs [http://127.0.0.1:4323/dev/viewer/] [ric|bte|cic|all]
// Çıktı: src/assets/device/{ric,bte,cic}-poster.png (kare, şeffaf, kapak kapalı, ana bakış).
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:4323/dev/viewer/';
const which = args.find((a) => !a.startsWith('http')) ?? 'all';
const kinds = which === 'all' ? ['ric', 'bte', 'cic'] : [which];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.addInitScript(() =>
  localStorage.setItem('ayaz.consent.v1', JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false, ts: Date.now() })),
);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ayazViewer, null, { timeout: 60_000 });
await page.waitForTimeout(1200);

const pending = [];
/** Vite yeniden yüklemesine dayanıklı değerlendirme (paralel düzenlemelerde sayfa yenilenebilir). */
async function evaluateRetry(fn, arg) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (attempt >= 4 || !/context was destroyed|navigation|__ayazViewer/i.test(String(e))) throw e;
      console.warn('(sayfa yeniden yüklendi, tekrar deneniyor)');
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForFunction(() => !!window.__ayazViewer, null, { timeout: 60_000 });
      await page.waitForTimeout(800);
    }
  }
}
for (const kind of kinds) {
  const dataUrl = await evaluateRetry(async (k) => {
    const v = window.__ayazViewer;
    v.setAutoRotate(false);
    await v.setDeviceType(k);
    v.reset();
    v.setExplode(0, false);
    v.setBatteryDoor(false, false);
    await new Promise((r) => setTimeout(r, 900)); // reset kamera tween'i bitsin
    return v.captureImage(1600, 1600);
  }, kind);
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const trimmed = await sharp(buf).trim({ threshold: 8 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  // Kare tuvale ortala (kenarlarda nefes payı), şeffaf arka plan
  const size = Math.round(Math.max(meta.width, meta.height) * 1.18);
  const out = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, gravity: 'centre' }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  // Yazma tarayıcı kapandıktan sonra (src/assets'e yazmak Vite'ı yeniden yüklemeye iter)
  pending.push({ file: `src/assets/device/${kind}-poster.png`, out, size, meta });
}

await browser.close();
for (const { file, out, size, meta } of pending) {
  await writeFile(file, out);
  console.log(`${file} yazıldı: ${size}x${size}, ${(out.length / 1024).toFixed(0)} KB (trimmed ${meta.width}x${meta.height})`);
}
