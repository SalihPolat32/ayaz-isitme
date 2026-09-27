// Kulak kalıbı biçimlerinin temsili render'larını üretir (Kulak kalıbı bölümü, Hizmetler, sistem kartları).
// Gereksinim: dev sunucusu açık — `window.__ayazRenderMold` ve `window.__ayazRender` yalnızca /dev/viewer/ sayfasında (DEV) vardır.
// Kullanım: node scripts/render-mold-styles.mjs [http://127.0.0.1:4321/dev/viewer/] [--res=190]
//
// Çıktılar (src/assets/device/molds/):
//   {full-shell,half-shell,skeleton,semi-skeleton,canal,canal-lock,cros,micro}.png
//       — beyaz zeminde şeffaf akrilik (kanal içi / mikro kalıp: ten rengi akrilik, alıcı kablosu + çıkarma ipi). TÜMÜ AYNI ÖLÇEKTE ve AYNI TUVAL
//         boyutunda: kalıplar arasındaki gerçek boy farkı görünür (kanal kalıbı küçük, tam konka büyük).
//   half-shell-silicone.png — aynı biçim, yumuşak silikon (malzeme karşılaştırması; aynı ölçek)
//   dome.png                — RIC alıcısı + standart dome (3B RIC modelinden; kendi ölçeği)
// Model: src/scripts/viewer/molds.ts (SDF + MarchingCubes). Hepsi temsilidir; gerçek kalıp kulak izinden üretilir.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:4321/dev/viewer/';
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const RES = flag('res', 190);
const OUT = 'src/assets/device/molds';
const STYLES = ['full-shell', 'half-shell', 'skeleton', 'semi-skeleton', 'canal', 'canal-lock', 'cros', 'micro'];
/** Sabit ölçek: 1100 px yükseklik = 46 mm (≈ 23,9 px/mm) */
const VIEW = { width: 1400, height: 1100, viewMm: 46, res: RES };
const PAD = 24;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__ayazRenderMold === 'function', null, { timeout: 60_000 });

const toBuf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

/** Beyaz kenarları kırpar; kırpılmış görüntü + boyut */
async function trimWhite(buf) {
  const { data, info } = await sharp(buf).trim({ background: '#ffffff', threshold: 6 }).png().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const trimmed = [];
for (const style of STYLES) {
  const r = await page.evaluate(([s, o]) => window.__ayazRenderMold(s, o), [style, VIEW]);
  trimmed.push({ name: style, ...(await trimWhite(toBuf(r.dataUrl))) });
  console.log(`${style}: ${r.triangles} üçgen, ${r.ms} ms`);
}
{
  const r = await page.evaluate((o) => window.__ayazRenderMold('half-shell', { ...o, material: 'silicone' }), VIEW);
  trimmed.push({ name: 'half-shell-silicone', ...(await trimWhite(toBuf(r.dataUrl))) });
  console.log(`half-shell-silicone: ${r.triangles} üçgen`);
}

// Ortak tuval: en büyük kırpılmış boyut + kenar boşluğu → tüm biçimler aynı ölçekte, ortalanmış
const W = Math.max(...trimmed.map((t) => t.w)) + PAD * 2;
const H = Math.max(...trimmed.map((t) => t.h)) + PAD * 2;
for (const t of trimmed) {
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: t.data, left: Math.round((W - t.w) / 2), top: Math.round((H - t.h) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${t.name}.png`);
}
console.log(`ortak tuval ${W}×${H} px (${(VIEW.height / VIEW.viewMm).toFixed(1)} px/mm)`);

// RIC alıcısı + dome: RIC modelinin yalnız bu parçaları, şeffaf zemin → beyaza bindirilir
{
  // Vite dosya değişikliğinde sayfayı yeniden yükleyebilir → kanca hazır olana dek bekle
  await page.waitForFunction(() => typeof window.__ayazRender === 'function', null, { timeout: 60_000 });
  const r = await page.evaluate(() => window.__ayazRender('ric', { parts: ['receiver', 'dome'], fit: 0.8, height: 900, width: 900, dir: [0.55, 0.3, 1] }));
  const png = toBuf(r.dataUrl);
  const { data, info } = await sharp(png).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const side = Math.max(info.width, info.height) + PAD * 2;
  await sharp({ create: { width: side, height: side, channels: 3, background: '#ffffff' } })
    .composite([{ input: data, left: Math.round((side - info.width) / 2), top: Math.round((side - info.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/dome.png`);
  console.log(`dome: ${side}×${side}`);
}

await browser.close();
