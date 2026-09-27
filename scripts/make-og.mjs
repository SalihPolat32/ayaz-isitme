// OG paylaşım görselleri (1200x630, TR + EN) + apple-touch-icon (180x180) üretir.
// Tur 10: mağaza vitrini fotoğrafı KULLANILMAZ — vitrindeki SGK logosu, "ücretsiz test" ve unvan yazıları
// doğrulanmamış iddialardır (business.ts > claims), sayfada gizlidir; paylaşım kartında da görünmemeli.
// Kart: lacivert zemin + logo + metin + temsili cihaz render'ları (3B modellerden, src/assets/device/views).
// Kullanım: node scripts/make-og.mjs
import sharp from 'sharp';

const W = 1200;
const H = 630;
const COPY = {
  tr: { file: 'public/og.jpg', name: 'Ayaz İşitme Merkezi', place: 'Keçiören · Ankara', l1: 'İşitme cihazı seçimi, kişiye özel uygulama,', l2: 'kulak kalıbı, pil ve bakım.', note: 'Temsili cihaz görselleri' },
  en: { file: 'public/og-en.jpg', name: 'Ayaz Hearing Center', place: 'Keçiören · Ankara', l1: 'Hearing aid selection, personalised fitting,', l2: 'ear moulds, batteries and servicing.', note: 'Representative device renders' },
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Temsili cihazlar: RIC, BTE (arkada), ITE (önde, küçük); sağ yarıda, başlıkla çakışmadan
const DEVICES = [
  { id: 'ric', h: 290, x: 700, y: 150 },
  { id: 'bte', h: 310, x: 905, y: 105 },
  { id: 'ite', h: 150, x: 1015, y: 405 },
];
const deviceLayers = await Promise.all(
  DEVICES.map(async (d) => ({
    input: await sharp(`src/assets/device/views/thumb-${d.id}.png`).resize({ height: d.h }).png().toBuffer(),
    left: d.x,
    top: d.y,
  })),
);
const logo = await sharp('src/assets/brand/ayaz-logo-full.png').resize({ height: 92 }).png().toBuffer();
const logoMeta = await sharp(logo).metadata();

for (const [lang, t] of Object.entries(COPY)) {
  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="r" cx="0.82" cy="0.35" r="0.62">
      <stop offset="0" stop-color="#1d4d5e"/>
      <stop offset="1" stop-color="#112b3c"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8fd3da" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#8fd3da" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#r)"/>
  <circle cx="900" cy="310" r="300" fill="url(#glow)"/>
  <rect x="72" y="0" width="6" height="${H}" fill="#087f8c"/>
  <rect x="104" y="92" width="${(logoMeta.width ?? 140) + 28}" height="${92 + 24}" rx="18" fill="#ffffff"/>
  <text x="110" y="300" font-family="Manrope, Inter, Arial, sans-serif" font-weight="800" font-size="60" fill="#ffffff">${esc(t.name)}</text>
  <text x="110" y="356" font-family="Inter, Arial, sans-serif" font-weight="500" font-size="30" fill="#a9bbc8">${esc(t.place)}</text>
  <text x="110" y="432" font-family="Inter, Arial, sans-serif" font-weight="400" font-size="26" fill="#e8eef2">${esc(t.l1)}</text>
  <text x="110" y="470" font-family="Inter, Arial, sans-serif" font-weight="400" font-size="26" fill="#e8eef2">${esc(t.l2)}</text>
  <text x="110" y="560" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="24" fill="#8fd3da">keciorenisitme.com · 0507 155 11 51</text>
  <text x="1128" y="596" text-anchor="end" font-family="Inter, Arial, sans-serif" font-weight="400" font-size="16" fill="#a9bbc8">${esc(t.note)}</text>
</svg>`);
  await sharp(bg)
    .composite([...deviceLayers, { input: logo, left: 118, top: 104 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(t.file);
}

// apple-touch-icon: logo beyaz zemin üzerinde
const icon = await sharp('src/assets/brand/ayaz-logo-full.png').resize(150, 150, { fit: 'inside' }).toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([{ input: icon, gravity: 'centre' }])
  .png()
  .toFile('public/apple-touch-icon.png');
console.log('og.jpg, og-en.jpg ve apple-touch-icon.png üretildi');
