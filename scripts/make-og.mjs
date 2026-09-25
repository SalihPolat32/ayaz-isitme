// OG paylaşım görseli (1200x630) + apple-touch-icon (180x180) üretir.
// Kaynak: gerçek mağaza cephesi fotoğrafı + logo. Kullanım: node scripts/make-og.mjs
import sharp from 'sharp';


const W = 1200, H = 630;
const photo = await sharp('src/assets/ofis/ofis-6.jpg').resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0c1f2c" stop-opacity="0.94"/>
      <stop offset="0.62" stop-color="#112b3c" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#112b3c" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="72" y="0" width="6" height="${H}" fill="#087f8c"/>
  <text x="110" y="250" font-family="Manrope, Inter, Arial, sans-serif" font-weight="800" font-size="64" fill="#ffffff">Ayaz İşitme Merkezi</text>
  <text x="110" y="318" font-family="Inter, Arial, sans-serif" font-weight="500" font-size="30" fill="#a9bbc8">Keçiören · Ankara</text>
  <text x="110" y="400" font-family="Inter, Arial, sans-serif" font-weight="400" font-size="26" fill="#e8eef2">İşitme cihazı seçimi, kişiye özel uygulama,</text>
  <text x="110" y="438" font-family="Inter, Arial, sans-serif" font-weight="400" font-size="26" fill="#e8eef2">kulak kalıbı, pil ve bakım.</text>
  <text x="110" y="540" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="24" fill="#8fd3da">keciorenisitme.com · 0507 155 11 51</text>
</svg>`);
await sharp(photo).composite([{ input: overlay }]).jpeg({ quality: 82, mozjpeg: true }).toFile('public/og.jpg');

// apple-touch-icon: logo beyaz zemin üzerinde
const logo = await sharp('src/assets/brand/ayaz-logo-full.png').resize(150, 150, { fit: 'inside' }).toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([{ input: logo, gravity: 'centre' }])
  .png()
  .toFile('public/apple-touch-icon.png');
console.log('og.jpg ve apple-touch-icon.png üretildi');
