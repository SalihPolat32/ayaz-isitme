// Ofis fotoğraflarının orijinal PNG'lerinden (77 MB) build için hafif JPEG "master" türevleri üretir.
// Orijinaller dokunulmadan kalır; Astro build sırasında bu masterlardan AVIF/WebP srcset üretir.
// Kullanım: node scripts/prepare-images.mjs [kaynakKlasör]
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const SRC = process.argv[2] ?? '../ayaz_isitme/assets/img/ofis';
const OUT = 'src/assets/ofis';
const MAX_W = 2000;

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
for (const f of files) {
  const input = join(SRC, f);
  const name = basename(f, extname(f));
  const out = join(OUT, `${name}.jpg`);
  const meta = await sharp(input).metadata();
  const landscape = (meta.width ?? 0) >= (meta.height ?? 0);
  await sharp(input)
    .rotate()
    .resize(landscape ? { width: MAX_W, withoutEnlargement: true } : { height: MAX_W, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true, progressive: true })
    .toFile(out);
  const s = await stat(out);
  const m2 = await sharp(out).metadata();
  console.log(`${f} ${meta.width}x${meta.height} -> ${out} ${m2.width}x${m2.height} ${(s.size / 1024).toFixed(0)} KB`);
}
