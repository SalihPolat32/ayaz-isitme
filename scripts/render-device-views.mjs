// Temsili cihaz modellerinden şeffaf PNG görünüşler üretir (kulak illüstrasyonu ve ürün küçük resimleri için).
// Gereksinim: dev sunucusu açık — `window.__ayazRender` yalnızca /dev/viewer/ sayfasında (DEV) vardır:
//   ASTRO_DEV_BACKGROUND=0 npx astro dev --port 4323 --host 127.0.0.1   (veya çalışan dev sunucusu, ör. 4321)
// Kullanım: node scripts/render-device-views.mjs [http://127.0.0.1:4323/dev/viewer/] [--height=1400] [--pad=6] [--thumb=900]
//
// Çıktılar (src/assets/device/views/):
//   ric.png, bte.png, cic.png, ite.png, itc.png, iic.png   — tek dosya (BTE/RIC: takılı yönelim, yan görünüş)
//   ric-body.png + ric-front.png, bte-body.png + bte-front.png — aynı kameradan iki katman, ORTAK kırpma
//     kutusuyla kesilmiş (piksel-piksel üst üste biner; ric.png/bte.png de aynı kutuyla kesilir).
//   ear-bte-body.png, ear-bte-mold.png, ear-ric-body.png, ear-ric-receiver.png — hortum/kablo SVG ile
//     çizilsin diye ayrı parçalar (aynı yanal kamera, sabit ölçek, her biri kendi kutusuna kırpılmış) +
//     anchors.json: bağlantı noktalarının her PNG'nin KENDİ piksel uzayındaki koordinatları (sol-üst orijin).
//   thumb-{ric,bte,ite,itc,cic,iic}.png — ürün küçük resmi: 3/4 ana bakış (poster yönü), kapak kapalı,
//     900 px yükseklik, kırpılmış, şeffaf (ölçek türe göre değişir).
// Ölçek: views/ear-* render'larında aynı kamera uzaklığı ve fov (18°) → mm/piksel sabittir (model merkez düzleminde):
//   MM_PER_PX = 0.045 (22.2 px/mm); --height yalnızca kanvasın kaç mm'yi kapsadığını değiştirir (1400 px = 63 mm).
// anchors.json: BTE parçalarında ayrıca `tubeOuterMm` / `tubeInnerMm` (standart #13 hortum, modelden) — SVG hortumu
//   gerçek çapta çizmek için (px = mm / mmPerPx).
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:4323/dev/viewer/';
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const HEIGHT = flag('height', 1400);
const MM_PER_PX = 0.045;
const PAD = flag('pad', 6);
const THUMB_H = flag('thumb', 900);
const THUMB_RENDER = 2400;
const OUT = 'src/assets/device/views';
const SINGLE = ['ric', 'bte', 'cic', 'ite', 'itc', 'iic'];
const LAYERED = ['ric', 'bte'];
const THUMBS = ['ric', 'bte', 'ite', 'itc', 'cic', 'iic'];

/** Kulak illüstrasyonu için ayrı parçalar (hortum/kablo SVG yolu ile bağlanır). */
const EAR_PARTS = [
  {
    file: 'ear-bte-body',
    kind: 'bte',
    parts: ['mics', 'body', 'button', 'hook', 'battery-door', 'battery'],
    anchors: { hookTip: 'hookTip' },
    dims: ['tubeOuterMm', 'tubeInnerMm'],
  },
  { file: 'ear-bte-mold', kind: 'bte', parts: ['earmold'], anchors: { tubeInlet: 'tubeInlet', center: 'moldCenter' }, dims: ['tubeOuterMm', 'tubeInnerMm'] },
  {
    file: 'ear-ric-body',
    kind: 'ric',
    parts: ['mics', 'body', 'button', 'battery-door', 'battery', 'wire'],
    hideMeshes: ['wire-cable'],
    anchors: { wireExit: 'wireExit' },
  },
  { file: 'ear-ric-receiver', kind: 'ric', parts: ['receiver', 'dome'], anchors: { wireInlet: 'wireInlet', center: 'receiverCenter' } },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__ayazRender === 'function', null, { timeout: 60_000 });

/** @returns {Promise<{buf: Buffer, mmPerPx: number, width: number, height: number, triangleCount: number, connectors: Record<string, {x:number,y:number,dx?:number,dy?:number}>}>} */
async function render(kind, opts) {
  // Başka biri dosya düzenlerse Vite sayfayı yeniden yükleyebilir → bekle ve yeniden dene.
  for (let attempt = 0; ; attempt++) {
    try {
      return await renderOnce(kind, opts);
    } catch (e) {
      if (attempt >= 4 || !/context was destroyed|navigation|__ayazRender/i.test(String(e))) throw e;
      console.warn(`(sayfa yeniden yüklendi, tekrar: ${kind})`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForFunction(() => typeof window.__ayazRender === 'function', null, { timeout: 60_000 });
    }
  }
}
async function renderOnce(kind, opts) {
  const r = await page.evaluate(
    ([k, o]) => {
      const res = window.__ayazRender(k, { doorOpen: false, explode: 0, groundShadow: false, ...o });
      return { dataUrl: res.dataUrl, mmPerPx: res.mmPerPx, width: res.width, height: res.height, triangleCount: res.triangleCount, connectors: res.connectors, dims: res.dims ?? {} };
    },
    [kind, opts],
  );
  return { ...r, buf: Buffer.from(r.dataUrl.split(',')[1], 'base64') };
}
const renderFixed = (kind, extra = {}) => render(kind, { height: HEIGHT, width: HEIGHT, viewHeightMm: HEIGHT * MM_PER_PX, ...extra });

/** Alfa > eşik piksellerin sınır kutusu. */
async function alphaBox(buf, threshold = 8) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, canvasW: info.width, canvasH: info.height };
}

/** Silüet kanvas kenarına değiyorsa (kırpılmış render) uyar. */
const edgeGuard = (name, b) => {
  if (b && (b.left <= 1 || b.top <= 1 || b.left + b.width >= b.canvasW - 1 || b.top + b.height >= b.canvasH - 1)) console.warn(`UYARI: ${name} kanvas kenarına değiyor — --height'ı artırın`);
};
const union = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.left + a.width, b.left + b.width);
  const bottom = Math.max(a.top + a.height, b.top + b.height);
  return { left, top, width: right - left, height: bottom - top, canvasW: a.canvasW, canvasH: a.canvasH };
};
const pad = (box, p) => {
  const left = Math.max(0, box.left - p);
  const top = Math.max(0, box.top - p);
  const right = Math.min(box.canvasW, box.left + box.width + p);
  const bottom = Math.min(box.canvasH, box.top + box.height + p);
  return { ...box, left, top, width: right - left, height: bottom - top };
};

// Dosyalar tarayıcı kapandıktan SONRA yazılır: src/assets altına yazmak Vite'ın sayfayı yeniden
// yüklemesine yol açar ve sonraki evaluate çağrıları düşer.
const pending = [];
async function writeCrop(file, buf, box) {
  const out = await sharp(buf)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  pending.push({ file: `${OUT}/${file}`, out });
  return out.length;
}

const fmtBox = (b) => `x=${b.left} y=${b.top} w=${b.width} h=${b.height} (canvas ${b.canvasW}×${b.canvasH})`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

let mmPerPx = 0;

/* ---- 1) Kulak illüstrasyonu görünüşleri (sabit ölçek) ---- */
for (const kind of SINGLE) {
  const layered = LAYERED.includes(kind);
  const all = await renderFixed(kind, { layer: 'all' });
  mmPerPx = all.mmPerPx;
  let box = await alphaBox(all.buf);
  if (!box) throw new Error(`${kind}: boş render`);
  edgeGuard(kind, box);
  if (layered) {
    const body = await renderFixed(kind, { layer: 'body' });
    const front = await renderFixed(kind, { layer: 'front' });
    box = pad(union(union(box, await alphaBox(body.buf)), await alphaBox(front.buf)), PAD);
    const sizes = [];
    sizes.push(await writeCrop(`${kind}.png`, all.buf, box));
    sizes.push(await writeCrop(`${kind}-body.png`, body.buf, box));
    sizes.push(await writeCrop(`${kind}-front.png`, front.buf, box));
    console.log(
      `${kind}: ${kind}.png / ${kind}-body.png / ${kind}-front.png → ${box.width}×${box.height} px, ortak kırpma kutusu ${fmtBox(box)}, ` +
        `${(box.width * mmPerPx).toFixed(1)}×${(box.height * mmPerPx).toFixed(1)} mm, ${sizes.map(kb).join(' / ')}, ${all.triangleCount} üçgen`,
    );
  } else {
    box = pad(box, PAD);
    const size = await writeCrop(`${kind}.png`, all.buf, box);
    console.log(
      `${kind}: ${kind}.png → ${box.width}×${box.height} px, kırpma ${fmtBox(box)}, ${(box.width * mmPerPx).toFixed(1)}×${(box.height * mmPerPx).toFixed(1)} mm, ${kb(size)}, ${all.triangleCount} üçgen`,
    );
  }
}

/* ---- 2) Ayrı parçalar + bağlantı noktaları (anchors.json) ---- */
// Her giriş: PNG'nin kendi piksel uzayında (sol-üst orijin, y aşağı) bağlantı noktaları; *Dir = görüntü
// düzleminde birim yön. canvasBox: kırpılmamış ortak kanvastaki kutu (aynı tür için aynı kamera) —
// parçaları 3B modeldeki göreli konumlarıyla yerleştirmek isterseniz.
const anchors = {};
const r4 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
for (const E of EAR_PARTS) {
  const r = await renderFixed(E.kind, { parts: E.parts, hideMeshes: E.hideMeshes });
  const raw = await alphaBox(r.buf);
  edgeGuard(E.file, raw);
  const box = pad(raw, PAD);
  const size = await writeCrop(`${E.file}.png`, r.buf, box);
  const entry = {
    file: `${E.file}.png`,
    width: box.width,
    height: box.height,
    mmPerPx: Math.round(r.mmPerPx * 1e5) / 1e5,
    canvasBox: { x: box.left, y: box.top, w: box.width, h: box.height, canvas: box.canvasW },
  };
  for (const k of E.dims ?? []) {
    if (typeof r.dims[k] !== 'number') throw new Error(`${E.file}: ölçü yok: ${k}`);
    entry[k] = r.dims[k];
  }
  for (const [name, src] of Object.entries(E.anchors)) {
    const c = r.connectors[src];
    if (!c) throw new Error(`${E.file}: bağlantı noktası yok: ${src}`);
    entry[name] = { x: r4(c.x - box.left), y: r4(c.y - box.top) };
    if (c.dx !== undefined && name !== 'center') entry[`${name}Dir`] = { x: r3(c.dx), y: r3(c.dy) };
  }
  anchors[E.file] = entry;
  const pts = Object.entries(entry)
    .filter(([k]) => !['file', 'width', 'height', 'mmPerPx', 'canvasBox'].includes(k))
    .map(([k, v]) => (typeof v === 'number' ? `${k}=${v}` : `${k}=(${v.x}, ${v.y})`))
    .join(' ');
  console.log(`${E.file}.png → ${box.width}×${box.height} px, kırpma ${fmtBox(box)}, ${kb(size)}; ${pts}`);
}
pending.push({ file: `${OUT}/anchors.json`, out: Buffer.from(JSON.stringify(anchors, null, 2) + '\n') });

/* ---- 3) Ürün küçük resimleri (3/4 ana bakış, kırpılmış, THUMB_H px yükseklik) ---- */
for (const kind of THUMBS) {
  const r = await render(kind, { height: THUMB_RENDER, width: THUMB_RENDER, dir: 'home', fit: 0.92 });
  const box = await alphaBox(r.buf);
  const trimmed = await sharp(r.buf).extract({ left: box.left, top: box.top, width: box.width, height: box.height }).toBuffer();
  if (box.height < THUMB_H) console.warn(`uyarı: thumb-${kind} kırpılmış yükseklik ${box.height} < ${THUMB_H} (büyütülüyor)`);
  const out = await sharp(trimmed).resize({ height: THUMB_H, kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: false }).toBuffer();
  const meta = await sharp(out).metadata();
  pending.push({ file: `${OUT}/thumb-${kind}.png`, out });
  console.log(`thumb-${kind}.png → ${meta.width}×${meta.height} px (kaynak kırpma ${box.width}×${box.height}, ${(r.mmPerPx * (box.height / THUMB_H)).toFixed(4)} mm/px), ${kb(out.length)}`);
}

await browser.close();
for (const { file, out } of pending) await writeFile(file, out);
console.log(`Ölçek (views + ear-*): ${mmPerPx.toFixed(5)} mm/px (${(1 / mmPerPx).toFixed(2)} px/mm) — tüm dosyalarda aynı; canvas ${HEIGHT} px = ${(HEIGHT * mmPerPx).toFixed(1)} mm.`);
console.log(`Kompozit: BTE/RIC gövde solda (kulak arkası), kanca/kablo sağa (öne) kıvrılır; body ve front katmanları aynı kutuya kesildiğinden (0,0) hizalı bindirilir.`);
