/**
 * Yorum parmak izleri — içe aktarıcı (Node) ve tarayıcı (src/scripts/reviews.ts) AYNI kodu kullanır.
 *
 * Amaç: canlı (Places API) yorumları statik (Takeout) listeyle eşleştirmek ve seçkide çıkarılan
 * yorumların API üzerinden geri gelmesini engellemek. Metnin/adın kendisi yerine kısa özetler (FNV-1a 32 bit)
 * saklanır; çıkarılan yorumların metni/adı sayfaya hiç yazılmaz (yalnızca özetler, bkz. guardRecord).
 *
 * Parmak izi türleri (önek harfiyle):
 *  - "t…"  textFp():   fold edilmiş metnin ilk PREFIX (40) karakteri (TR özgün ve EN çeviri ayrı ayrı).
 *                      Katlanmış hâli 40 karakterden kısa metinde tüm metin.
 *  - "i…"  idFp():     Google yorum kimliği (kaynak adının son parçası: …/reviews/{id}).
 *  - "m…"  authorMonthFp(): "ad + soyadın baş harfi" + yayın ayı (YYYY-MM, UTC). Takeout'ta oluşturma VE
 *                      güncelleme ayı ayrı ayrı yazılır. Kısa ad TEK BAŞINA hiçbir anahtar üretmez.
 *  Kelime kümesi (wordSet): metnin fold edilmiş kelimeleri (≥ 2 karakter), her biri FNV-1a 32 bit (8 hex).
 *
 * KURALLAR (bkz. INTEGRATIONS.md §5). Eşleştirme KAYIT BAŞINADIR ve iki listede AYNI kuralla yapılır:
 *  - kartlar: her statik kart ve kabul edilen her canlı yorum (kendi t/i/m anahtarları + metinlerinin kelime kümeleri);
 *  - koruma (guard): seçkide çıkarılan her yorum TEK kayıt (kendi t/i/m anahtarları + TR/EN metinlerinin
 *    kelime kümesi özetleri; metin yok).
 *  Canlı yorum L, kayıt c ile EŞLEŞİR ⇔ aşağıdakilerden biri AYNI kayıt c için doğruysa:
 *    (1) L'nin t'si c'nin t'lerinden biri VE
 *        – uzun metin (L'nin katlanmış metni ≥ 40 karakter): L ile c'nin metinlerinden biri arasında kelime
 *          kümesi Jaccard benzerliği ≥ TEXT_SIMILARITY_MIN (0,6) → 'text';
 *        – kısa metin (< 40 karakter): L'nin m'si de c'nin m'lerinden biri → 'text-author-month';
 *    (2) L'nin i'si c'nin i'lerinden biri → 'id' (yalnızca Worker kimlik verdiyse; kimliğin Takeout kimliğiyle aynı
 *        olduğu KANITLANMADI → eşleşme olumlu işarettir, eşleşmemesi "farklı yorum" anlamına gelmez);
 *    (3) L'nin m'si c'nin m'lerinden biri VE L'nin metni ile c'nin metinlerinden biri arasında
 *        Jaccard ≥ SIMILARITY_MIN (0,35) → 'author-month-similar'.
 *  Koşullar farklı kayıtlardan TOPLANMAZ (ör. kayıt A'da t, kayıt B'de m → eşleşme değil). Kısa ad + ay TEK BAŞINA,
 *  40 karakterlik açılış TEK BAŞINA hiçbir yorumu elemez (ne tekrar ne de çıkarılmış yorum olarak).
 *  Kaydın metinleri: statik kartta sayfada görünen metin (+ EN sayfasında kartın özgün TR metni, data-alt-text);
 *  canlı kartta kendi metni; koruma kaydında TR özgün + EN çeviri (yalnızca kelime kümesi özetleri).
 *  Karar: önce koruma kayıtları ('blocked'), sonra kartlar ('duplicate'); her listede sıra (1) → (2) → (3).
 *  publishTime yoksa ya da yazar anonimse m üretilmez → (1)-kısa ve (3) uygulanamaz.
 */
const PREFIX = 40;
const MIN_TEXT = 4;
/**
 * (3) kısa ad + ay kuralının Jaccard eşiği. Ölçüm (26 Eyl 2026, bu işletmenin 53 TR + 47 EN statik yorumu, farklı
 * yorum çiftleri): ≥ 0,35 olan çift oranı %1,26 (en yüksek 0,53, kısa "çok iyi, teşekkürler" türü metinler).
 * Aynı yorumun elle yazılmış yeniden çevirileri 0,27–0,53 (8 örneğin 5'i 0,35'in altında → gösterilir, kozmetik;
 * önceki bağımsız ölçüm 0,33–0,48),
 * aynı ay içinde düzenlenmiş metinler 0,57–0,64. Kural yalnızca kısa ad VE yayın ayı aynı kartta eşleştiğinde çalışır.
 */
export const SIMILARITY_MIN = 0.35;
/**
 * (1) uzun metin kuralının Jaccard eşiği: 40 karakterlik ortak açılış tek başına yetmez. Ölçüm (26 Eyl 2026, 91 uzun
 * statik metin): gürültü (emoji/boşluk/büyük harf) varyantı 1,0; sonuna cümle eklenmiş aynı metin en az 0,64 (91/91 ≥ 0,6);
 * son cümlesi atılmış 46/59 ≥ 0,6. Aynı açılışla başlayıp başka bir yorumun gövdesiyle süren 8.190 sentetik metnin
 * ≥ 0,5 olanı %12,3, ≥ 0,6 olanı %4,6; bunların hepsi katlanmış uzunluğu 41–136 (ortanca 64) karakter olan, açılışı
 * metnin büyük kısmını oluşturan (kelimelerin ortanca %67'si) statik metinlerde. Yüksek eşik = gösterme yönünde.
 */
export const TEXT_SIMILARITY_MIN = 0.6;

/** Karşılaştırma için sadeleştirilmiş metin (yalnızca a–z, 0–9). */
export function fold(value) {
  return String(value ?? '')
    .replace(/[İIı]/g, 'i')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** FNV-1a 32 bit → 8 haneli onaltılık */
export function fnv1a(value) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function textFp(text) {
  const f = fold(text).slice(0, PREFIX);
  return f.length >= MIN_TEXT ? `t${fnv1a(f)}` : '';
}

/** Google yorum kimliği → "i" + 8 hex. Tam kaynak adı da verilebilir (son parça alınır). */
export function idFp(id) {
  const last = String(id ?? '').trim().split('/').pop() || '';
  return /^[A-Za-z0-9_-]+$/.test(last) ? `i${fnv1a(last)}` : '';
}

const ANON = new Set(['googlekullanicisi', 'googleuser', 'agoogleuser', 'anonim', 'anonymous']);

/** "Ali Veli" ve "Ali V." → "ali v"; tek kelimelik ad olduğu gibi; anonimse boş. Yalnızca başka bir işaretle BİRLİKTE kullanılır. */
export function authorKey(name) {
  const words = String(name ?? '').trim().split(/\s+/).map(fold).filter(Boolean);
  if (!words.length || ANON.has(words.join(''))) return '';
  return words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1].charAt(0)}`;
}

/** ISO zaman damgası → "YYYY-MM" (UTC); geçersizse boş. */
export function monthOf(value) {
  const s = String(value ?? '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}T[\d:.]+Z$/.test(s)) return s.slice(0, 7); // Google: RFC 3339, UTC ("Z")
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return '';
  const t = Date.parse(s); // saat dilimi ofsetli biçim → UTC ayına çevrilir
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : '';
}

/** Kısa ad + ay → "m" + 8 hex; ad anonimse ya da ay yoksa boş. */
export function authorMonthFp(name, month) {
  const k = authorKey(name);
  const m = monthOf(month);
  return k && m ? `m${fnv1a(`${k}|${m}`)}` : '';
}

/** Metnin kelime kümesi (fold edilmiş kelimeler, ≥ 2 karakter; FNV özetleri). Yalnızca bellekte kullanılır. */
export function wordSet(text) {
  const words = String(text ?? '')
    .replace(/[İIı]/g, 'i')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  return new Set(words.map(fnv1a));
}

/** İki kelime kümesinin Jaccard benzerliği (0–1). */
export function similarity(a, b) {
  const A = a instanceof Set ? a : wordSet(a);
  const B = b instanceof Set ? b : wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Bir yorumun tüm parmak izleri (boşlar atılır): kimlik + kısa ad·ay (her ay için) + metinler. */
export function reviewFps({ id = '', author = '', months = [], texts = [] } = {}) {
  return [...new Set([idFp(id), ...months.map((m) => authorMonthFp(author, m)), ...texts.map(textFp)].filter(Boolean))];
}

/**
 * Çıkarılan TEK yorumun koruma kaydı (sayfaya ve depoya yazılan biçim; metin/ad/tarih yok):
 *  { fp: [t (TR), t (EN), i, m…], w: ["<TR kelime özetleri>", "<EN kelime özetleri>"] }
 * w: her metnin kelime kümesi (wordSet) 8 hex özetler olarak, SIRALI (metindeki kelime sırası yazılmaz) ve boşlukla ayrılmış.
 * Gizlilik: özetler tuzsuzdur; bir sözlükle denenerek kelimeler (sırasız) geri bulunabilir. Metinler Google'da zaten
 * herkese açıktır. Derleme başına tuz koruma sağlamaz: tarayıcı canlı metni aynı tuzla özetleyebilmek için tuzu
 * sayfada taşımak zorundadır → saldırgan da aynı tuzu kullanır (bkz. INTEGRATIONS.md §5).
 */
export function guardRecord({ id = '', author = '', months = [], texts = [] } = {}) {
  return {
    fp: reviewFps({ id, author, months, texts }),
    w: texts.map((t) => [...wordSet(t)].sort().join(' ')).filter(Boolean),
  };
}

const KEY_RE = /^[tim][0-9a-f]{8}$/;
const WORD_RE = /^[0-9a-f]{8}$/;
const keysOf = (fp, p) => new Set(fp.filter((k) => typeof k === 'string' && KEY_RE.test(k) && k[0] === p));

/** Tek kartın dizin kaydı: kendi t/i/m anahtarları + metinlerinin kelime kümeleri. */
function indexCard(fp = [], texts = []) {
  const keys = Array.isArray(fp) ? fp : [];
  return {
    t: keysOf(keys, 't'),
    i: keysOf(keys, 'i'),
    m: keysOf(keys, 'm'),
    words: (Array.isArray(texts) ? texts : []).map(wordSet).filter((w) => w.size),
  };
}

/**
 * Koruma listesini doğrular ve dizin kayıtlarına çevirir. Biçim bozuksa HATA fırlatır (çağıran canlı yorum eklemez):
 * dizi değilse, bir öğe { fp: string[], w: string[] } değilse, hiç geçerli anahtar yoksa ya da bir kelime özeti
 * 8 hex değilse. Kayıt içindeki tanınmayan önekli anahtarlar (ör. eski "a…") yok sayılır.
 */
export function parseGuard(guard) {
  if (!Array.isArray(guard)) throw new TypeError('reviews guard: not an array');
  return guard.map((g, n) => {
    if (!g || typeof g !== 'object' || !Array.isArray(g.fp) || !Array.isArray(g.w)) throw new TypeError(`reviews guard: record ${n} malformed`);
    const rec = { t: keysOf(g.fp, 't'), i: keysOf(g.fp, 'i'), m: keysOf(g.fp, 'm'), words: [] };
    if (!rec.t.size && !rec.i.size && !rec.m.size) throw new TypeError(`reviews guard: record ${n} has no keys`);
    for (const list of g.w) {
      if (typeof list !== 'string') throw new TypeError(`reviews guard: record ${n} words malformed`);
      const words = list.split(' ').filter(Boolean);
      if (!words.every((w) => WORD_RE.test(w))) throw new TypeError(`reviews guard: record ${n} words malformed`);
      if (words.length) rec.words.push(new Set(words));
    }
    // Metin/ay anahtarı olan kaydın kelime özeti yoksa uzun metin ve (3) kuralı sessizce kapanırdı → bozuk sayılır (fail-closed)
    if ((rec.t.size || rec.m.size) && rec.words.length === 0) throw new TypeError(`reviews guard: record ${n} has keys but no word hashes`);
    return rec;
  });
}

const BUILT = new WeakSet();
/**
 * Eşleştirme dizini (kayıt başına).
 *  cards: sayfadaki statik kartlar → { fp: parmak izleri, texts: kartın metinleri (benzerlik için; sayfada görünen
 *         metin + varsa diğer dildeki metin) }
 *  guard: çıkarılan yorumların koruma kayıtları (guardRecord biçimi); bozuksa hata (parseGuard).
 */
export function buildIndex({ cards = [], guard = [] } = {}) {
  const idx = { cards: (Array.isArray(cards) ? cards : []).map((c) => indexCard(c?.fp, c?.texts)), guard: parseGuard(guard) };
  BUILT.add(idx);
  return idx;
}

/** Tek canlı yorumun parmak izleri. */
export function liveFps(r) {
  return {
    id: idFp(r?.id),
    month: authorMonthFp(r?.author, r?.publishTime),
    text: textFp(r?.text),
  };
}

/** Canlı yorumun eşleştirme görünümü: i, m, t, uzun metin mi, kelime kümesi. */
function liveView(r) {
  const { id, month, text } = liveFps(r);
  return { i: id, m: month, t: text, long: fold(r?.text).length >= PREFIX, w: wordSet(r?.text) };
}

const maxSimilarity = (w, rec) => rec.words.reduce((best, s) => Math.max(best, similarity(w, s)), 0);

/** Kurallar (1) → (2) → (3); her koşul TEK kayıtta aranır. Dönüş: gerekçe ya da ''. */
function matchRecords(L, recs) {
  if (L.t) {
    for (const c of recs) {
      if (!c.t.has(L.t)) continue;
      if (L.long ? maxSimilarity(L.w, c) >= TEXT_SIMILARITY_MIN : !!L.m && c.m.has(L.m)) return L.long ? 'text' : 'text-author-month';
    }
  }
  if (L.i && recs.some((c) => c.i.has(L.i))) return 'id';
  if (L.m && recs.some((c) => c.m.has(L.m) && maxSimilarity(L.w, c) >= SIMILARITY_MIN)) return 'author-month-similar';
  return '';
}

/**
 * Canlı yorum için karar: 'blocked' (çıkarılmış yorumun koruma kaydıyla eşleşti), 'duplicate' (statik kartta /
 * önceki canlı yorumda var) ya da 'new'. İkinci değer gerekçedir (test ve hata ayıklama için):
 * 'text' | 'text-author-month' | 'id' | 'author-month-similar'. Koruma ve kartlar AYNI kurallarla denetlenir.
 */
export function classifyLive(r, idx) {
  const L = liveView(r);
  const blocked = matchRecords(L, idx.guard);
  if (blocked) return ['blocked', blocked];
  const dup = matchRecords(L, idx.cards);
  if (dup) return ['duplicate', dup];
  return ['new', ''];
}

/**
 * Canlı yorumlardan gösterilecekleri seçer. `index`: buildIndex() sonucu ya da { cards, guard } (bozuk koruma → hata).
 * Seçilen her canlı yorum dizine KENDİ kartı olarak eklenir → canlı listedeki tekrarlar da aynı kurallarla elenir.
 */
export function selectFreshReviews(live, index, max = 5) {
  const idx = index && BUILT.has(index) ? index : buildIndex(index ?? {});
  const out = [];
  for (const r of Array.isArray(live) ? live : []) {
    if (out.length >= max) break;
    if (!r || typeof r.text !== 'string' || !r.text.trim()) continue;
    const { id, month, text } = liveFps(r);
    if (!id && !month && !text) continue; // eşleştirilemeyen (çok kısa, kimliksiz, tarihsiz) yorum eklenmez
    if (classifyLive(r, idx)[0] !== 'new') continue;
    idx.cards.push(indexCard([id, month, text].filter(Boolean), [r.text]));
    out.push(r);
  }
  return out;
}
