#!/usr/bin/env node
/**
 * Google Takeout "Business Profile" dışa aktarımındaki yorumları siteye aktarır.
 *
 * İşletme sahibi/yöneticisi:
 *   1. https://takeout.google.com → "Tümünün seçimini kaldır" → yalnızca "Google Business Profile" → Dışa aktar
 *   2. E-postadaki zip'i açın (…/Google Business Profile/account-…/location-…/reviews.json)
 * Sonra:
 *   node scripts/import-google-reviews.mjs "<açılmış Takeout klasörü veya reviews.json>" [--as-of=YYYY-MM-DD] [--full-names]
 *   (Varsayılan: yazar adları dosyaya KISA yazılır — "Akın E." — çünkü depo herkese açıktır ve sitede de kısa ad
 *   gösterilir. Tam ad ancak işletme bunu seçerse: --full-names ve src/config/business.ts > reviewsShowFullNames = true.)
 *   (Tek kelimelik görünen adlar kısaltılamaz; işletme sahibi reviews-curation.json > displayNames ile yorum başına
 *   başka bir biçim verebilir. Varsayılan: boş — hiçbir ad uydurulmaz.)
 *   (--as-of: Takeout'un dışa aktarıldığı gün; verilmezse bugün. Sitedeki "Google · <tarih> itibarıyla" bu tarihtir.)
 *
 * Çıktı: src/content/reviews-data.json (tüm puanlar özet için; metinli yorumlar kaydırıcı için, en iyiler önce).
 * Sıralama: src/content/reviews-curation.json (pin/exclude/enExclude, kategorili; displayNames) + kalite puanı (scripts/lib/reviews-normalize.mjs).
 * 'legal-risk' çıkarılanların (EN: + 'translation-error') her biri `guard` alanına TEK koruma kaydı olarak yazılır: parmak izleri
 *   (metin / Google kimliği / kısa ad + ay) + TR/EN kelime kümesi özetleri (sıralı 8 hex; metin yok). Canlı API modu çıkarılmış
 *   yorumu da statik kart tekrarını da AYNI kayıt başına kurallarla eler: kısa ad + ay tek başına ya da 40 karakterlik açılış
 *   tek başına yetmez (kurallar: scripts/lib/review-fingerprint.mjs, INTEGRATIONS.md §5).
 * SINIR: dışa aktarım bir anlık görüntüdür; Google'da sonradan silinen/düzenlenen yorumları bilemez → düzenli yeniden içe aktarın
 * (derleme, görüntü 90 günden eskiyse uyarır; bkz. INTEGRATIONS.md §5).
 * Google çevirisi olan yorumlarda özgün metin alınır. Hiçbir ağ isteği yapılmaz.
 */
import { readFile, readdir, stat, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { reviewsFromJson, buildDataset, curationSets, applyDisplayNames } from './lib/reviews-normalize.mjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const asOfArg = args.find((a) => a.startsWith('--as-of='))?.slice('--as-of='.length);
if (!input || (asOfArg && !/^\d{4}-\d{2}-\d{2}$/.test(asOfArg))) {
  console.error('Kullanım: node scripts/import-google-reviews.mjs <Takeout klasörü | reviews.json> [--as-of=YYYY-MM-DD]');
  process.exit(1);
}

async function findJson(p) {
  const st = await stat(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const e of await readdir(p, { withFileTypes: true })) {
    const full = join(p, e.name);
    if (e.isDirectory()) out.push(...(await findJson(full)));
    else if (/^reviews.*\.json$/i.test(e.name)) out.push(full);
  }
  return out;
}

const files = await findJson(input);
if (!files.length) {
  console.error('reviews*.json bulunamadı:', input);
  process.exit(1);
}
const all = [];
for (const f of files) {
  const list = reviewsFromJson(JSON.parse(await readFile(f, 'utf8')));
  console.log(`${f}: ${list.length} yorum`);
  all.push(...list);
}
const asOf = asOfArg || new Date().toISOString().slice(0, 10);
// İsteğe bağlı seçim dosyası: öne sabitlenenler (pin), gösterilmeyenler (exclude), İngilizcede çevirisi gösterilmeyenler (enExclude)
const CURATION = 'src/content/reviews-curation.json';
let curation = {};
try { await access(CURATION); curation = JSON.parse(await readFile(CURATION, 'utf8')); } catch { /* yok */ }
const data = buildDataset(all, asOf, curation);
/** "Ad S." — src/content/reviews.ts > shortName ile aynı kural (parmak izi de ad + soyadın baş harfini kullanır). */
const shortName = (full) => {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase('tr-TR')}.`;
};
// Görünen ad: varsayılan "Ad S." (--full-names ile tam ad); curation.displayNames yorum başına ezer (işletme sahibinin kararı).
const names = applyDisplayNames(data.reviews, curation.displayNames, args.includes('--full-names') ? (a) => a : shortName);
data.reviews = names.reviews;
if (names.unknown.length) console.warn(`UYARI: displayNames içinde veride olmayan ya da boş ${names.unknown.length} kayıt yok sayıldı:`, names.unknown.join(', '));
await writeFile('src/content/reviews-data.json', JSON.stringify(data, null, 2) + '\n');
console.log(`Toplam ${data.summary.count} puan (ortalama ${data.summary.rating}), ${data.summary.withText} metinli, ${data.reviews.length} gösterilecek → src/content/reviews-data.json`);
console.log('İlk 10:', data.reviews.slice(0, 10).map((r) => `${r.author} (${r.score})`).join(' · '));
console.log(`İngilizce: ${data.enOrder.length} yorum`);
const { exclude, demote, enExclude } = curationSets(curation);
console.log(`Seçki: ${exclude.size} 'legal-risk' gösterilmiyor, ${demote.size} 'editorial' geride gösteriliyor; EN'de ${enExclude.size} kayıt yok (çeviri hatası/legal-risk).`);
console.log(`Canlı API koruması: TR ${data.guard.tr.length}, EN ${data.guard.en.length} kayıt. Görüntü tarihi (asOf): ${asOf}`);
