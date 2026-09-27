import { describe, it, expect } from 'vitest';
import { originalText, starValue, normalizeReview, reviewsFromJson, buildDataset, applyDisplayNames } from '../scripts/lib/reviews-normalize.mjs';
import { fold, textFp, idFp, authorKey, authorMonthFp, monthOf, similarity, wordSet, reviewFps, guardRecord, parseGuard, buildIndex, classifyLive, selectFreshReviews, SIMILARITY_MIN, TEXT_SIMILARITY_MIN } from '../scripts/lib/review-fingerprint.mjs';
import data from '../src/content/reviews-data.json';
import curation from '../src/content/reviews-curation.json';
import { tr as trContent } from '../src/content/tr';
import { en as enContent } from '../src/content/en';
import { reviewsFor, reviewsGuard, snapshotAgeDays, warnIfSnapshotStale, resolveReviewsMode, SNAPSHOT_MAX_AGE_DAYS } from '../src/content/reviews';

const takeout = {
  reviews: [
    { reviewer: { displayName: 'Semra E.' }, starRating: 'FIVE', comment: 'Emre bey, bilgili ve ilgili.', createTime: '2024-12-02T10:00:00Z' },
    { reviewer: { displayName: 'Anon', isAnonymous: true }, starRating: 'FOUR', comment: '(Translated by Google) Very good\n\n(Original)\nÇok iyi', createTime: '2025-06-01T10:00:00Z' },
    { reviewer: { displayName: 'Yalnız Puan' }, starRating: 'FIVE', createTime: '2025-01-01T10:00:00Z' },
    { reviewer: { displayName: 'Semra E.' }, starRating: 'FIVE', comment: 'Emre bey, bilgili ve ilgili.', createTime: '2024-12-02T10:00:00Z' },
    { reviewer: { displayName: 'Boş' }, starRating: 'STAR_RATING_UNSPECIFIED', comment: 'x' },
  ],
};

describe('Takeout review import', () => {
  it('maps star enums', () => {
    expect(starValue('FIVE')).toBe(5);
    expect(starValue('one')).toBe(1);
    expect(starValue('STAR_RATING_UNSPECIFIED')).toBe(0);
    expect(starValue(4)).toBe(4);
  });
  it('keeps the original text of Google-translated reviews', () => {
    expect(originalText('(Translated by Google) Very good\n\n(Original)\nÇok iyi')).toBe('Çok iyi');
    expect(originalText('  Harika   hizmet ')).toBe('Harika hizmet');
  });
  it('anonymises anonymous reviewers and extracts YYYY-MM', () => {
    const r = normalizeReview(takeout.reviews[1]);
    expect(r).toMatchObject({ author: 'Google kullanıcısı', rating: 4, text: 'Çok iyi', approxDate: '2025-06' });
  });
  it('dedups, counts rating-only reviews in the summary, shows only reviews with text', () => {
    const d = buildDataset(reviewsFromJson(takeout), '2026-09-26');
    expect(d.summary).toMatchObject({ count: 3, asOf: '2026-09-26', source: 'takeout' });
    expect(d.summary.rating).toBeCloseTo(4.7, 1);
    expect(d.reviews.map((r: { author: string }) => r.author)).toEqual(['Google kullanıcısı', 'Semra E.']);
  });
  it('applies pin/exclude and builds a separate English order (enPin, enExclude)', () => {
    const raw = {
      reviews: [
        { name: 'x/reviews/A', reviewer: { displayName: 'Ali Veli' }, starRating: 'FIVE', comment: 'Güzel (Translated by Google) Nice', createTime: '2025-01-01T10:00:00Z' },
        { name: 'x/reviews/B', reviewer: { displayName: 'Ayşe Kaya' }, starRating: 'FIVE', comment: 'Çok ilgili bir ekip, teşekkürler (Translated by Google) Very caring team, thanks', createTime: '2025-02-01T10:00:00Z' },
        { name: 'x/reviews/C', reviewer: { displayName: 'Can Er' }, starRating: 'FIVE', comment: 'Harika (Translated by Google) Great', createTime: '2025-03-01T10:00:00Z' },
        { name: 'x/reviews/D', reviewer: { displayName: 'Deniz Su' }, starRating: 'FIVE', comment: 'Süper (Translated by Google) Super', createTime: '2025-04-01T10:00:00Z' },
      ],
    };
    const d = buildDataset(reviewsFromJson(raw), '2026-09-26', { pin: ['C', 'A'], enPin: ['B'], exclude: [{ id: 'D', category: 'legal-risk', reason: 'test' }], enExclude: ['A'] });
    expect(d.reviews.map((r: { id: string }) => r.id)).toEqual(['C', 'A', 'B']);
    expect(d.reviews.find((r: { id: string }) => r.id === 'A').textEn).toBeUndefined();
    expect(d.enOrder).toEqual(['B', 'C']);
  });

  it('honours categories: legal-risk hidden, editorial shown but demoted; translation-error only hidden in EN', () => {
    const mk = (id: string, author: string, tr: string, en: string, month: string) => ({
      name: `x/reviews/${id}`, reviewer: { displayName: author }, starRating: 'FIVE', comment: `${tr} (Translated by Google) ${en}`, createTime: `2025-${month}-01T10:00:00Z`,
    });
    const raw = { reviews: [
      mk('A', 'Ali Veli', 'Çok ilgili, bilgili ve güler yüzlü; cihaz seçiminde ayrıntılı bilgilendirdiler, teşekkürler.', 'Very caring and knowledgeable.', '01'),
      mk('B', 'Ayşe Kaya', 'Babamın duyma sorunu kalmadı, diğer firmalardan iyi.', 'My father has no hearing problem any more.', '02'),
      mk('C', 'Can Er', 'Kulaklık aldık süper di, tavsiye ederim ilgili ekip ayar kontrol takip.', 'We bought headphones.', '03'),
      mk('D', 'Deniz Su', 'Gayet güzel ilgilendiler.', 'They took good care.', '04'),
      mk('E', 'Ece Ak', 'Eski kayıt.', 'Old entry.', '05'),
    ] };
    const d = buildDataset(reviewsFromJson(raw), '2026-09-26', {
      exclude: [
        { id: 'B', category: 'legal-risk', reason: 'sağlık sonucu' },
        { id: 'C', category: 'editorial', reason: 'kulaklık' },
        'E', // kategorisiz → güvenli taraf: gösterilmez
      ],
      enExclude: [{ id: 'C', category: 'translation-error', reason: 'headphones' }, { id: 'D', category: 'editorial', reason: 'küçük kayma' }],
    }, new Date('2026-09-26T00:00:00Z'));
    const ids = d.reviews.map((r: { id: string }) => r.id);
    expect(ids).not.toContain('B');
    expect(ids).not.toContain('E');
    // C editoryal olduğu için kalite puanından bağımsız olarak sonda
    expect(ids).toEqual(['A', 'D', 'C']);
    expect(d.enOrder).toEqual(['A', 'D']);
    expect(d.reviews.find((r: { id: string }) => r.id === 'C').textEn).toBeUndefined();
    // Koruma: çıkarılan HER yorum TEK kayıt. TR = legal-risk (B, E); EN = + çevirisi hatalı (C). Metin/ad değil, yalnızca özet.
    const bTexts = ['Babamın duyma sorunu kalmadı, diğer firmalardan iyi.', 'My father has no hearing problem any more.'];
    expect(d.guard.tr).toHaveLength(2);
    expect(d.guard.tr[0]).toEqual(guardRecord({ id: 'B', author: 'Ayşe Kaya', months: ['2025-02-01T10:00:00Z'], texts: bTexts }));
    expect(d.guard.tr[0].fp).toEqual(expect.arrayContaining([idFp('B'), authorMonthFp('Ayşe Kaya', '2025-02'), textFp(bTexts[0]), textFp(bTexts[1])]));
    expect(d.guard.tr[0].w).toEqual(bTexts.map((t) => [...wordSet(t)].sort().join(' ')));
    expect(d.guard.tr.flatMap((g: { fp: string[] }) => g.fp)).not.toContain(authorMonthFp('Can Er', '2025-03'));
    expect(d.guard.en).toEqual([...d.guard.tr, guardRecord({ id: 'C', author: 'Can Er', months: ['2025-03-01T10:00:00Z'], texts: ['Kulaklık aldık süper di, tavsiye ederim ilgili ekip ayar kontrol takip.', 'We bought headphones.'] })]);
    expect(JSON.stringify(d.guard)).not.toMatch(/Ayşe|duyma|hearing|Kaya|2025/);
    for (const g of d.guard.en as { fp: string[]; w: string[] }[]) {
      for (const k of g.fp) expect(k).toMatch(/^[tim][0-9a-f]{8}$/);
      for (const list of g.w) {
        const words = list.split(' ');
        for (const w of words) expect(w).toMatch(/^[0-9a-f]{8}$/);
        expect(words).toEqual([...words].sort()); // sıralı: metindeki kelime sırası yazılmaz
      }
    }
    for (const k of d.reviews.flatMap((r: { fp: string[] }) => r.fp)) expect(k).toMatch(/^[tim][0-9a-f]{8}$/);
    // Gösterilen her yorumun parmak izleri: Google kimliği + kısa ad·ay + TR + EN
    expect(d.reviews[0].fp).toEqual(reviewFps({ id: 'A', author: 'Ali Veli', months: ['2025-01-01T10:00:00Z'], texts: ['Çok ilgili, bilgili ve güler yüzlü; cihaz seçiminde ayrıntılı bilgilendirdiler, teşekkürler.', 'Very caring and knowledgeable.'] }));
  });

  it('writes author·month keys for both createTime and updateTime; local ids never contain the name', () => {
    const d = buildDataset(reviewsFromJson({ reviews: [
      { name: 'accounts/1/locations/2/reviews/Rid1', reviewer: { displayName: 'Mehmet Yılmaz' }, starRating: 'FIVE', comment: 'Çok ilgilendiler.', createTime: '2025-01-30T10:00:00Z', updateTime: '2025-03-02T10:00:00Z' },
      { reviewer: { displayName: 'Zeki Demir' }, starRating: 'FIVE', comment: 'Güzel bir yer.', createTime: '2025-05-01T10:00:00Z' },
    ] }), '2026-09-26');
    const m = d.reviews.find((r: { id: string }) => r.id === 'Rid1');
    expect(m.fp).toEqual(expect.arrayContaining([idFp('Rid1'), authorMonthFp('Mehmet Y.', '2025-01'), authorMonthFp('Mehmet Y.', '2025-03')]));
    const z = d.reviews.find((r: { id: string }) => r.id !== 'Rid1');
    expect(z.id).toMatch(/^x[0-9a-f]{8}$/); // yerel kimlik: ad içermez
    expect(z.fp.some((k: string) => k.startsWith('i'))).toBe(false); // Google kimliği yoksa kimlik parmak izi de yok
  });
});

describe('Review fingerprints (live API de-duplication)', () => {
  it('folds case, Turkish letters, whitespace, emoji and punctuation', () => {
    expect(fold('  Çok  İYİ, teşekkürler!! 🙏 ')).toBe('cokiyitesekkurler');
    expect(textFp('Emre Bey işinde gerçekten uzman.')).toBe(textFp('emre bey  isinde gercekten UZMAN 👍'));
    expect(textFp('Aldık gayet güzel')).not.toBe(textFp('Aldık gayet iyi'));
    expect(textFp('!!')).toBe('');
  });
  it('author key = short name; it only exists combined with a month; anonymous names give no key', () => {
    expect(authorKey('Ayşe Yılmaz')).toBe('ayse y'); // tam ad → ad + soyadın baş harfi
    expect(authorKey('Akın E.')).toBe('akin e');
    expect(authorKey('OSMAN')).toBe('osman');
    expect(authorMonthFp('Deniz Su', '2025-04-02T10:00:00Z')).toBe(authorMonthFp('Deniz S.', '2025-04'));
    expect(authorMonthFp('Deniz S.', '2025-04')).not.toBe(authorMonthFp('Deniz S.', '2025-05'));
    expect(authorMonthFp('Deniz S.', '')).toBe(''); // ay yoksa anahtar yok
    expect(authorMonthFp('Google kullanıcısı', '2025-04')).toBe('');
    expect(authorMonthFp('A Google User', '2025-04')).toBe('');
    expect(monthOf('2026-09-10T08:15:30.123456Z')).toBe('2026-09');
    expect(monthOf('2026-09-30T23:30:00-02:00')).toBe('2026-10'); // UTC ayı
    expect(monthOf('bir hafta önce')).toBe('');
    expect(idFp('places/P/reviews/AbC123')).toBe(idFp('AbC123'));
    expect(idFp('accounts/1/locations/2/reviews/AbC123')).toBe(idFp('AbC123'));
    expect(idFp('')).toBe('');
  });

  // Statik kart (Takeout) — sayfada: data-fp + görünen metin
  const card = (id: string, author: string, month: string, texts: string[]) => ({ fp: reviewFps({ id, author, months: [month], texts }), texts });
  const yilmaz = card('Rid-Yilmaz', 'Mehmet Yılmaz', '2026-08', ['Emre bey çok ilgili ve bilgili, cihaz seçiminde bize yardımcı oldu. Teşekkürler.']);
  const akinEn = card('Rid-Akin', 'Akın E.', '2026-04', ['We truly came to the right place when buying a hearing aid for my grandfather. Mr. Emre welcomed us in a caring and friendly way and answered all our questions.']);
  // Seçkide çıkarılan (legal-risk) yorum: tek koruma kaydı (yalnızca özetler)
  const excludedRec = guardRecord({ id: 'Rid-Excl', author: 'Salih P.', months: ['2024-03'], texts: ['Emre Bey sayesinde süreç kolay geçti.', 'Thanks to Mr. Emre it was easy.'] });
  const index = () => buildIndex({ cards: [yilmaz, akinEn], guard: [excludedRec] });
  const live = (author: string, text: string, extra: { id?: string; publishTime?: string } = {}) => ({ author, text, ...extra });

  it("GPT case: static 'Mehmet Yılmaz' does NOT hide live 'Mehmet Yıldız' with a different text (same short name, even same month)", () => {
    const other = 'Annemin cihazının pilini değiştirmek için uğradık, hızlıca yardımcı oldular.';
    expect(similarity(other, yilmaz.texts[0]!)).toBeLessThan(SIMILARITY_MIN);
    for (const extra of [{}, { publishTime: '2026-08-20T09:00:00Z' }, { publishTime: '2026-09-02T09:00:00Z' }, { id: 'Rid-Yildiz', publishTime: '2026-08-20T09:00:00Z' }]) {
      expect(classifyLive(live('Mehmet Yıldız', other, extra), index())).toEqual(['new', '']);
    }
    expect(selectFreshReviews([live('Mehmet Yıldız', other, { publishTime: '2026-08-20T09:00:00Z' })], index())).toHaveLength(1);
  });

  it('same review re-translated / whitespace+emoji variant / edited in the same month → duplicate', () => {
    const idx = index();
    // yeniden çeviri (EN sayfası): kısa ad + aynı ay + benzerlik
    const retr = 'When buying a hearing aid for my grandpa we really came to the right place. Emre Bey greeted us attentively and sincerely, and left none of our questions unanswered.';
    expect(similarity(retr, akinEn.texts[0]!)).toBeGreaterThanOrEqual(SIMILARITY_MIN);
    expect(classifyLive(live('Akın E.', retr, { publishTime: '2026-04-11T08:00:00Z' }), idx)).toEqual(['duplicate', 'author-month-similar']);
    // boşluk + emoji + büyük harf gürültüsü: metin parmak izi (ad/tarih gerekmez)
    expect(classifyLive(live('Başka Biri', '  EMRE BEY çok   ilgili ve bilgili cihaz seçiminde 🙏🙏 bize yardımcı oldu!!'), idx)).toEqual(['duplicate', 'text']);
    // aynı ay içinde düzenlenmiş metin (baş kısmı değişmiş → metin parmak izi tutmaz; benzerlik tutar)
    const edited = 'Emre bey gerçekten çok ilgili, cihaz seçiminde bize çok yardımcı oldu. Teşekkür ederiz, kontrollerde de ilgilendiler.';
    expect(textFp(edited)).not.toBe(textFp(yilmaz.texts[0]));
    expect(classifyLive(live('Mehmet Yılmaz', edited, { publishTime: '2026-08-28T08:00:00Z' }), idx)).toEqual(['duplicate', 'author-month-similar']);
    // Worker kimlik verdiyse ve Takeout kimliğiyle aynıysa: metin tamamen değişse de tekrar
    expect(classifyLive(live('Mehmet Yılmaz', 'Tamamen yeniden yazılmış bir metin.', { id: 'Rid-Yilmaz' }), idx)).toEqual(['duplicate', 'id']);
  });

  it('an excluded (short) review coming back through the API is blocked by id, or by text + short name·month of the SAME record', () => {
    const idx = index();
    // kısa metin (< 40 katlanmış karakter): t + aynı kaydın m'si gerekir
    expect(classifyLive(live('Salih P.', 'Thanks to Mr. Emre, it was easy!', { publishTime: '2024-03-15T10:00:00Z' }), idx)).toEqual(['blocked', 'text-author-month']);
    expect(classifyLive(live('S. X', 'Thanks to Mr. Emre, it was easy!'), idx)).toEqual(['new', '']); // m yok → kısa metin izi tek başına yetmez
    expect(classifyLive(live('Salih P.', 'Yeniden yazılmış metin.', { id: 'Rid-Excl' }), idx)).toEqual(['blocked', 'id']);
    // kısa ad + aynı ay TEK BAŞINA yetmez (farklı metin → gösterilir)
    expect(classifyLive(live('Salih P.', 'Tamamen farklı bir metin.', { publishTime: '2024-03-15T10:00:00Z' }), idx)).toEqual(['new', '']);
  });

  it('different person with the same short name in a different month is shown (static and excluded)', () => {
    const idx = index();
    expect(classifyLive(live('Salih P.', 'Tamamen farklı bir metin.', { publishTime: '2026-09-15T10:00:00Z' }), idx)).toEqual(['new', '']);
    expect(classifyLive(live('Mehmet Yıldız', 'Emre bey çok ilgili, cihaz seçiminde bize çok yardımcı oldu. Teşekkür ederiz.', { publishTime: '2026-09-15T10:00:00Z' }), idx)).toEqual(['new', '']);
  });

  it('a review without publishTime: only text / id rules apply', () => {
    const idx = index();
    const edited = 'Emre bey gerçekten çok ilgili, cihaz seçiminde bize çok yardımcı oldu. Teşekkür ederiz, kontrollerde de ilgilendiler.';
    expect(classifyLive(live('Mehmet Yılmaz', edited), idx)).toEqual(['new', '']); // ay yok → benzerlik kuralı yok
    expect(classifyLive(live('Salih P.', 'Tamamen farklı bir metin.'), idx)).toEqual(['new', '']);
    // çıkarılmış KISA metin, tarih yok → m yok → gösterilir (bilinen sınır, INTEGRATIONS.md §5; şu anki koruma verisinde kısa metin yok)
    expect(classifyLive(live('Salih P.', 'Emre Bey sayesinde süreç kolay geçti 👍'), idx)).toEqual(['new', '']);
    expect(classifyLive(live('Mehmet Yılmaz', edited, { id: 'Rid-Yilmaz' }), idx)).toEqual(['duplicate', 'id']);
  });

  it('de-duplicates within the live list; a legacy flat-token guard is rejected (fail closed)', () => {
    const list = [
      live('Yeni Kişi', 'Yeni ve güzel bir yorum.', { id: 'L1', publishTime: '2026-09-01T10:00:00Z' }),
      live('Yeni Kişi', 'Yeni ve güzel bir yorum.', { id: 'L1' }), // aynı kimlik/metin
      live('Google kullanıcısı', 'Yeni ve güzel bir yorum!'), // aynı KISA metin, farklı yazar, tarih yok → tekrar sayılmaz (kısa metin izi tek başına yetmez)
      live('Yeni Kişi', 'Yeni ve çok güzel bir yorum, teşekkürler.', { publishTime: '2026-09-20T10:00:00Z' }), // aynı kişi, aynı ay, benzer
      live('Diğer Kişi', ''),
      live('Diğer Kişi', '👍'), // eşleştirilemez (metin/kimlik/tarih yok) → eklenmez
      live('Diğer Kişi', 'Bir yorum daha.'),
    ];
    expect(() => buildIndex({ cards: [], guard: ['a12345678', 'not-a-token'] })).toThrow();
    expect(() => selectFreshReviews(list, { cards: [], guard: [idFp('X')] })).toThrow();
    // kayıt içindeki tanınmayan önekli (eski "a…") anahtarlar yok sayılır
    const out = selectFreshReviews(list, buildIndex({ cards: [], guard: [{ fp: ['a12345678', idFp('Baska')], w: [] }] }));
    expect(out.map((r) => r.text)).toEqual(['Yeni ve güzel bir yorum.', 'Yeni ve güzel bir yorum!', 'Bir yorum daha.']);
    expect(selectFreshReviews(list, { cards: [], guard: [] }, 1)).toHaveLength(1);
  });
});

describe('Imported dataset (src/content/reviews-data.json + curation)', () => {
  type Entry = { id: string; category: string; reason: string };
  const exclude = curation.exclude as Entry[];
  const legal = exclude.filter((e) => e.category === 'legal-risk').map((e) => e.id);
  it('every exclude entry is categorised with a reason; only legal-risk ones are hidden', () => {
    for (const e of exclude) {
      expect(['legal-risk', 'editorial']).toContain(e.category);
      expect(e.reason.length).toBeGreaterThan(20);
    }
    for (const e of curation.enExclude as Entry[]) expect(['translation-error', 'legal-risk', 'editorial']).toContain(e.category);
    const shown = new Set(data.reviews.map((r) => r.id));
    for (const e of exclude) expect(shown.has(e.id), e.id).toBe(e.category !== 'legal-risk');
    expect(data.reviews.length).toBe(data.summary.withText - legal.length);
  });
  it('conflict-of-interest entry is worded as unconfirmed and stays hidden', () => {
    const salih = exclude.find((e) => e.reason.startsWith('Salih P.'))!;
    expect(salih.category).toBe('legal-risk');
    expect(salih.reason).toMatch(/TEYİT EDİLMEDİ/);
    expect(salih.reason).toMatch(/sahibi teyit etmeli/);
    // Çıkarılan her yorum TEK koruma kaydı: kimlik + 1–2 ay anahtarı + TR metin + EN çeviri izi, TR + EN kelime özetleri
    const tr = reviewsGuard('tr');
    expect(tr).toHaveLength(legal.length);
    expect(reviewsGuard('en').slice(0, tr.length)).toEqual(tr);
    for (const id of legal) expect(tr.filter((g) => g.fp.includes(idFp(id)))).toHaveLength(1);
    for (const g of reviewsGuard('en')) {
      expect(g.fp.filter((k) => k.startsWith('i'))).toHaveLength(1);
      expect(g.fp.filter((k) => k.startsWith('t'))).toHaveLength(2);
      expect(g.fp.filter((k) => k.startsWith('m')).length).toBeGreaterThanOrEqual(1);
      expect(g.fp.filter((k) => k.startsWith('m')).length).toBeLessThanOrEqual(2);
      expect(g.w).toHaveLength(2);
      for (const k of g.fp) expect(k).toMatch(/^[tim][0-9a-f]{8}$/);
      for (const list of g.w) expect(list).toMatch(/^[0-9a-f]{8}( [0-9a-f]{8})*$/);
    }
    expect(() => parseGuard(reviewsGuard('en'))).not.toThrow();
    // GPT'nin bağımsız örneği (gerçek veri): çıkarılmış Salih P. kaydıyla AYNI kısa ad + AYNI ay, farklı metin ve kimlik → gösterilir
    const months = Array.from({ length: 8 * 12 }, (_, i) => `${2019 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
    const salihRec = tr.find((g) => g.fp.includes(idFp(salih.id)))!;
    const month = months.find((m) => salihRec.fp.includes(authorMonthFp('Salih P.', m)));
    expect(month).toBeTruthy();
    const idx = buildIndex({ cards: [], guard: reviewsGuard('tr') });
    const other = { id: 'Rid-Baska', author: 'Salih P.', text: 'Pil almak için uğradım, hızlıca ilgilendiler ve kalıbı da temizlediler. Teşekkürler.', publishTime: `${month}-15T10:00:00Z` };
    expect(classifyLive(other, idx)).toEqual(['new', '']);
    // aynı kimlik → engellenir
    expect(classifyLive({ ...other, id: salih.id }, idx)).toEqual(['blocked', 'id']);
    // koruma listesindeki kayıtlarla hiçbir statik kart (TR/EN) eşleşmez
    const trIdx = buildIndex({ cards: [], guard: reviewsGuard('tr') });
    const enIdx = buildIndex({ cards: [], guard: reviewsGuard('en') });
    for (const r of data.reviews) {
      expect(classifyLive({ author: 'Q W', text: r.text }, trIdx)[0]).toBe('new');
      if (r.textEn) expect(classifyLive({ author: 'Q W', text: r.textEn }, enIdx)[0]).toBe('new');
    }
  });
  it('pins stay first; EN page only has reviews with a translation', () => {
    expect(data.reviews.slice(0, curation.pin.length).map((r) => r.id)).toEqual(curation.pin);
    expect(reviewsFor('en').every((r) => !!r.textEn)).toBe(true);
    expect(reviewsFor('en').slice(0, curation.enPin.length).map((r) => r.id)).toEqual(curation.enPin);
    for (const r of data.reviews) {
      expect(r.fp.length).toBeGreaterThanOrEqual(3);
      expect(r.fp).toContain(idFp(r.id));
    }
    // Mevcut veride iki statik yorum aynı "kısa ad + ay" anahtarını paylaşmıyor
    const monthKeys = data.reviews.flatMap((r) => [...new Set(r.fp.filter((k) => k.startsWith('m')))]);
    expect(new Set(monthKeys).size).toBe(monthKeys.length);
  });
});

describe('Snapshot age guard and display mode', () => {
  it('warns once when the Takeout snapshot is older than 90 days', () => {
    const asOf = data.summary.asOf;
    const t = Date.parse(`${asOf}T00:00:00Z`);
    expect(snapshotAgeDays(asOf, new Date(t + 10 * 86_400_000))).toBe(10);
    const logs: string[] = [];
    expect(warnIfSnapshotStale(new Date(t + SNAPSHOT_MAX_AGE_DAYS * 86_400_000), (m) => logs.push(m))).toBe(false);
    expect(warnIfSnapshotStale(new Date(t + (SNAPSHOT_MAX_AGE_DAYS + 1) * 86_400_000), (m) => logs.push(m))).toBe(true);
    expect(warnIfSnapshotStale(new Date(t + 200 * 86_400_000), (m) => logs.push(m))).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/91 günlük.*import-google-reviews/);
  });
  it('resolves the display mode: prop > PUBLIC_REVIEWS_DISPLAY > business default', () => {
    expect(resolveReviewsMode(undefined, 'link', 'carousel')).toBe('link');
    expect(resolveReviewsMode(undefined, '', 'carousel')).toBe('carousel');
    expect(resolveReviewsMode(undefined, 'yanlis', 'link')).toBe('link');
    expect(resolveReviewsMode('carousel', 'link', 'link')).toBe('carousel');
  });
});

describe('Canlı API notu', () => {
  it('listeyi işletmenin seçkisi olarak tanımlar, "Google tarafından seçilen" demez (TR + EN)', () => {
    const tr = trContent.reviews.apiNote;
    const en = enContent.reviews.apiNote;
    expect(tr).toContain('bir seçki');
    expect(tr).toContain('canlı eklenir');
    expect(en).toContain('A selection of reviews from our Google Business Profile');
    expect(en).toContain('also added live');
    // Worker Place Details'ı sıralamasız çağırır (Google en fazla 5 yorumu kendisi seçer) → 'en yeni' iddiası yok
    expect(tr).not.toMatch(/en yeni/i);
    expect(en).not.toMatch(/newest/i);
    expect(tr).not.toMatch(/Google tarafından seçil/i);
    expect(en).not.toMatch(/selected by Google/i);
  });
});

describe('Kısa metinler: metin izi tek başına farklı kişiyi elemez', () => {
  it('aynı kısa metni yazan farklı kişi gösterilir; aynı kişi aynı ay yazarsa tekrar sayılır', async () => {
    const { buildIndex, classifyLive, reviewFps } = await import('../scripts/lib/review-fingerprint.mjs');
    const shortText = 'Çok iyi, teşekkürler';
    const idx = buildIndex({ cards: [{ fp: reviewFps({ author: 'Ali V.', months: ['2026-05'], texts: [shortText] }), texts: [shortText] }] });
    expect(classifyLive({ author: 'Deniz S.', text: shortText, publishTime: '2026-05-10T10:00:00Z' }, idx)[0]).toBe('new');
    expect(classifyLive({ author: 'Deniz S.', text: shortText }, idx)[0]).toBe('new');
    expect(classifyLive({ author: 'Ali V.', text: shortText, publishTime: '2026-05-20T10:00:00Z' }, idx)[0]).toBe('duplicate');
    // Uzun metin: aynı 40 karakterlik iz + aynı kartla benzerlik ≥ 0,6 (yeniden gönderilen aynı yorum; ad/tarih gerekmez)
    const long = 'Emre Bey sayesinde cihaz seçimi ve deneme süreci çok kolay geçti, teşekkürler.';
    const idx2 = buildIndex({ cards: [{ fp: reviewFps({ author: 'Ali V.', months: ['2026-05'], texts: [long] }), texts: [long] }] });
    expect(classifyLive({ author: 'Google kullanıcısı', text: long }, idx2)[0]).toBe('duplicate');
  });
});

describe('Kart başına eşleştirme (uzun metinde 40 karakterlik açılış tek başına yetmez)', () => {
  const card = (id: string, author: string, month: string, texts: string[]) => ({ fp: reviewFps({ id, author, months: [month], texts }), texts });
  const longStatic = 'Annem için işitme cihazı almaya geldik, Emre bey çok ilgilendi, ayarları sabırla yaptı ve her kontrolde yanımızdaydı.';
  const shortStatic = 'Çok iyi, teşekkürler';
  const cardA = card('Rid-A', 'Ali V.', '2026-05', [shortStatic]);
  const cardB = card('Rid-B', 'Deniz S.', '2026-05', ['Kulak kalıbı için uğradık, randevu saatine tam uydular ve çok nazik davrandılar.']);
  const cardL = card('Rid-L', 'Kaan Y.', '2026-03', [longStatic]);
  const idx = () => buildIndex({ cards: [cardA, cardB, cardL], guard: [] });

  it("GPT örneği: statik 'Mehmet Yılmaz' ile canlı 'Mehmet Yıldız' (farklı metin) → gösterilir", () => {
    const yilmaz = card('Rid-Y', 'Mehmet Yılmaz', '2026-08', ['Emre bey çok ilgili ve bilgili, cihaz seçiminde bize yardımcı oldu. Teşekkürler.']);
    const i = buildIndex({ cards: [yilmaz] });
    const r = { author: 'Mehmet Yıldız', text: 'Annemin cihazının pilini değiştirmek için uğradık, hızlıca yardımcı oldular.', publishTime: '2026-08-20T09:00:00Z' };
    expect(authorMonthFp(r.author, r.publishTime)).toBe(authorMonthFp('Mehmet Yılmaz', '2026-08')); // aynı kısa ad + ay
    expect(classifyLive(r, i)).toEqual(['new', '']);
    expect(selectFreshReviews([r], i)).toHaveLength(1);
  });

  it('aynı 8 kelimeyle başlayıp farklı süren başka birinin uzun yorumu → gösterilir (t eşleşir, benzerlik düşük)', () => {
    const other = 'Annem için işitme cihazı almaya geldik, Emre bey bugün izindeydi; mağaza kapalıydı, pazartesi randevu alıp tekrar geleceğiz.';
    expect(other.split(/\s+/).slice(0, 8).join(' ')).toBe(longStatic.split(/\s+/).slice(0, 8).join(' '));
    expect(textFp(other)).toBe(textFp(longStatic)); // ilk 40 katlanmış karakter aynı
    expect(fold(other).length).toBeGreaterThanOrEqual(40);
    expect(similarity(other, longStatic)).toBeLessThan(TEXT_SIMILARITY_MIN);
    expect(classifyLive({ author: 'Selin T.', text: other }, idx())).toEqual(['new', '']);
    expect(classifyLive({ author: 'Selin T.', text: other, publishTime: '2026-03-12T10:00:00Z' }, idx())).toEqual(['new', '']);
  });

  it('aynı metnin birebir / emoji / büyük harf / noktalama varyantı → tekrar (ad ve tarih gerekmez)', () => {
    for (const v of [longStatic, `  ${longStatic.toLocaleUpperCase('tr-TR')} 🙏🙏`, longStatic.replace(/[,.;]/g, '').replace(/\s+/g, '   ')]) {
      expect(classifyLive({ author: 'Google kullanıcısı', text: v }, idx())).toEqual(['duplicate', 'text']);
    }
    // sonuna kısa bir cümle eklenmiş aynı yorum da tekrar (benzerlik ≥ eşik)
    expect(classifyLive({ author: 'Kaan Y.', text: `${longStatic} Herkese tavsiye ederim.` }, idx())).toEqual(['duplicate', 'text']);
  });

  it('kısa metin: aynı kısa ad + ay AYNI kartta → tekrar; t kart A\'da, m kart B\'de → gösterilir', () => {
    expect(classifyLive({ author: 'Ali V.', text: 'çok iyi teşekkürler!', publishTime: '2026-05-20T10:00:00Z' }, idx())).toEqual(['duplicate', 'text-author-month']);
    // Deniz S. (kart B ile aynı kısa ad + ay) kart A'nın kısa metnini yazdı → koşullar farklı kartlarda → yeni
    const mixed = { author: 'Deniz S.', text: shortStatic, publishTime: '2026-05-10T10:00:00Z' };
    expect(textFp(mixed.text)).toBe(textFp(shortStatic));
    expect(authorMonthFp(mixed.author, mixed.publishTime)).toBe(authorMonthFp('Deniz S.', '2026-05'));
    expect(classifyLive(mixed, idx())).toEqual(['new', '']);
    // kısa metin, tarih yok ya da anonim yazar → m yok → gösterilir (bilinen kozmetik sınır)
    expect(classifyLive({ author: 'Ali V.', text: shortStatic }, idx())).toEqual(['new', '']);
    expect(classifyLive({ author: 'Google kullanıcısı', text: shortStatic, publishTime: '2026-05-20T10:00:00Z' }, idx())).toEqual(['new', '']);
  });

  it('kabul edilen canlı yorumlar da kendi kartı olur: iki canlı yorumun koşulları birleştirilmez', () => {
    const list = [
      { author: 'Ece K.', text: 'Harika bir ekip', publishTime: '2026-09-01T10:00:00Z' },
      { author: 'Nur A.', text: 'Pil almak için uğradık, çok hızlı ve güler yüzlü hizmet verdiler.', publishTime: '2026-09-03T10:00:00Z' },
      { author: 'Nur A.', text: 'Harika bir ekip!', publishTime: '2026-09-05T10:00:00Z' }, // t: 1. canlı, m: 2. canlı → gösterilir
      { author: 'Ece K.', text: 'harika bir EKİP 👍', publishTime: '2026-09-28T10:00:00Z' }, // t ve m aynı canlı kartta → tekrar
    ];
    expect(selectFreshReviews(list, { cards: [], guard: [] }).map((r) => r.author)).toEqual(['Ece K.', 'Nur A.', 'Nur A.']);
  });

  it('EN sayfası: kartın özgün TR metni (data-alt-text) de benzerliğe girer; metni sayfada olmayan t tek başına yetmez', () => {
    const tr = 'Dedem için araştırma yapıyorduk, Emre bey her şeyi detaylıca anlattı ve kontrollerimizi düzenli yaptı.';
    const en = 'We were doing research for my grandfather; Mr. Emre explained everything in detail and did our check-ups regularly.';
    const fp = reviewFps({ id: 'Rid-E', author: 'Zeynep M.', months: ['2025-11'], texts: [tr, en] });
    const live = { author: 'Başka Biri', text: tr };
    expect(classifyLive(live, buildIndex({ cards: [{ fp, texts: [en, tr] }] }))).toEqual(['duplicate', 'text']);
    expect(classifyLive(live, buildIndex({ cards: [{ fp, texts: [en] }] }))).toEqual(['new', '']);
  });

  it('çıkarılmış yorum koruması da kayıt başına, AYNI kurallarla (GPT tur 6)', () => {
    const excluded = 'Bir kaç işitme merkezine gitmemize rağmen sorunu çözememiştik, burada ilk seferde çözüldü; Emre bey çok sabırlı davrandı ve ayarları defalarca yaptı.';
    const excludedEn = 'Although we went to several hearing centers we could not solve the problem, here it was solved the first time; Mr. Emre was very patient and did the settings many times.';
    const rec = guardRecord({ id: 'Rid-X', author: 'Nesrin T.', months: ['2024-06-03T10:00:00Z'], texts: [excluded, excludedEn] });
    const i = buildIndex({ cards: [cardL], guard: [rec] });
    // GPT'nin bağımsız örneği: aynı kısa ad + aynı ay, farklı metin ve farklı kimlik → GÖSTERİLİR (eskiden 'author-month' ile engelleniyordu)
    const gpt = { id: 'Rid-Diger', author: 'Nesrin T.', text: 'Kulak kalıbım için uğradım, randevu saatine tam uydular ve çok nazik davrandılar.', publishTime: '2024-06-30T20:00:00Z' };
    expect(authorMonthFp(gpt.author, gpt.publishTime)).toBe(authorMonthFp('Nesrin T.', '2024-06'));
    expect(classifyLive(gpt, i)).toEqual(['new', '']);
    expect(selectFreshReviews([gpt], i)).toHaveLength(1);
    // aynı yorum yeniden geldi (birebir / emoji-büyük harf-boşluk varyantı; ad ve tarih gerekmez) → ENGELLENİR
    for (const v of [excluded, `  ${excluded.toLocaleUpperCase('tr-TR').replace(/\s+/g, '   ')} 🙏🙏`, excludedEn, `${excluded} Herkese tavsiye ederim.`]) {
      expect(classifyLive({ author: 'Google kullanıcısı', text: v }, i)).toEqual(['blocked', 'text']);
    }
    // EN yeniden çevirisi (açılış farklı → t tutmaz): aynı kısa ad + ay + benzerlik ≥ 0,35 → ENGELLENİR
    const retr = 'We had visited several hearing centres but the problem was not solved; here it was solved the first time. Mr. Emre was very patient and did the settings many times.';
    expect(textFp(retr)).not.toBe(textFp(excludedEn));
    expect(similarity(retr, excludedEn)).toBeGreaterThanOrEqual(SIMILARITY_MIN);
    expect(classifyLive({ author: 'Nesrin T.', text: retr, publishTime: '2024-06-12T10:00:00Z' }, i)).toEqual(['blocked', 'author-month-similar']);
    expect(classifyLive({ author: 'Nesrin T.', text: retr }, i)).toEqual(['new', '']); // ay yok → (3) uygulanamaz (bilinen sınır)
    // aynı kimlik → ENGELLENİR (metin tamamen farklı olsa da)
    expect(classifyLive({ author: 'Başka Biri', text: 'Tamamen farklı.', id: 'Rid-X' }, i)).toEqual(['blocked', 'id']);
    // aynı 40 karakterlik açılışla başlayıp bambaşka süren başka birinin yorumu → GÖSTERİLİR (açılış tek başına yetmez)
    const sameOpening = 'Bir kaç işitme merkezine gitmemize rağmen sorunlu kalan cihazım için bugün ilk kez geldik, personel çok kibar ve yardımseverdi.';
    expect(textFp(sameOpening)).toBe(textFp(excluded));
    expect(fold(sameOpening).length).toBeGreaterThanOrEqual(40);
    expect(similarity(sameOpening, excluded)).toBeLessThan(TEXT_SIMILARITY_MIN);
    expect(classifyLive({ author: 'Başka Biri', text: sameOpening }, i)).toEqual(['new', '']);
    expect(classifyLive({ author: 'Nesrin T.', text: sameOpening, publishTime: '2024-06-12T10:00:00Z' }, i)).toEqual(['new', '']); // + aynı kısa ad·ay, benzerlik < 0,35
    // engelleme tekrar kontrolünden önce gelir
    expect(classifyLive({ author: 'Kaan Y.', text: longStatic, id: 'Rid-X' }, i)).toEqual(['blocked', 'id']);
  });

  it('çıkarılmış KISA metin: yalnızca aynı kaydın kısa ad·ayı ile engellenir; koşullar kayıtlar arasında birleştirilmez', () => {
    const recA = guardRecord({ id: 'Rid-KA', author: 'Ayten B.', months: ['2025-01'], texts: ['Tek adres burası!', 'The only address!'] });
    const recB = guardRecord({ id: 'Rid-KB', author: 'Burak C.', months: ['2025-02'], texts: ['Uzun ve bambaşka bir metin: randevu saatine uydular, pil ve bakım için geldik, teşekkürler.'] });
    const i = buildIndex({ cards: [], guard: [recA, recB] });
    expect(classifyLive({ author: 'Ayten B.', text: 'tek ADRES burası 👍', publishTime: '2025-01-20T10:00:00Z' }, i)).toEqual(['blocked', 'text-author-month']);
    expect(classifyLive({ author: 'Ayten Bulut', text: 'The only address.', publishTime: '2025-01-05T10:00:00Z' }, i)).toEqual(['blocked', 'text-author-month']);
    expect(classifyLive({ author: 'Ayten B.', text: 'Tek adres burası!' }, i)).toEqual(['new', '']); // m yok
    expect(classifyLive({ author: 'Ayten B.', text: 'Tek adres burası!', publishTime: '2025-03-01T10:00:00Z' }, i)).toEqual(['new', '']); // başka ay
    // t kayıt A'da, m kayıt B'de → birleştirilmez → gösterilir
    expect(classifyLive({ author: 'Burak C.', text: 'Tek adres burası!', publishTime: '2025-02-10T10:00:00Z' }, i)).toEqual(['new', '']);
  });

  it('bozuk koruma listesi reddedilir (çağıran API\'yi çağırmaz)', () => {
    for (const bad of [null, {}, 'x', [null], ['t12345678'], [{ fp: ['t12345678'] }], [{ fp: [], w: [] }], [{ fp: ['t12345678'], w: ['XYZ'] }], [{ fp: ['t12345678'], w: [1] }]]) {
      expect(() => parseGuard(bad), JSON.stringify(bad)).toThrow();
    }
    expect(parseGuard([{ fp: ['t12345678', 'a12345678'], w: ['', '0000000a 0000000b'] }])).toEqual([{ t: new Set(['t12345678']), i: new Set(), m: new Set(), words: [new Set(['0000000a', '0000000b'])] }]);
    expect(parseGuard([])).toEqual([]);
  });
});

describe('Görünen ad düzeltmeleri (curation.displayNames)', () => {
  const short = (full: string) => {
    const p = full.trim().split(/\s+/);
    return p.length < 2 ? p[0]! : `${p[0]} ${p[p.length - 1]!.charAt(0).toLocaleUpperCase('tr-TR')}.`;
  };
  const rows = [
    { id: 'R1', author: 'Ayşe Yılmaz', fp: ['m00000001'] },
    { id: 'R2', author: 'tekkelimelikad', fp: ['m00000002'] },
  ];
  // Tur 10: ad ve soyadın bitişik yazıldığı tek kelimelik kullanıcı adı tam ad sayılır → yalnız "Ad S." kısaltması eklenir.
  it('seçki haritasındaki her değer "Ad S." kısaltmasıdır ve veride gerçekten olan bir yoruma aittir', () => {
    const map = (curation as { displayNames?: Record<string, string> }).displayNames ?? {};
    const ids = new Set((data as { reviews: { id: string }[] }).reviews.map((r) => r.id));
    for (const [id, name] of Object.entries(map)) {
      expect(name, id).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\.$/u);
      expect(ids.has(id), id).toBe(true);
    }
    // Veri dosyasında (herkese açık depo) hiçbir tek kelimelik, bitişik ad-soyad kalmaz
    for (const r of (data as { reviews: { id: string; author: string }[] }).reviews) {
      if (Object.hasOwn(map, r.id)) expect(r.author).toBe(map[r.id]);
    }
  });
  it('boş harita: varsayılan biçim; kayıt varsa yalnız o yorumun görünen adı değişir, parmak izi değişmez', () => {
    expect(applyDisplayNames(rows, {}, short).reviews.map((r: { author: string }) => r.author)).toEqual(['Ayşe Y.', 'tekkelimelikad']);
    const res = applyDisplayNames(rows, { R2: '  Deneme  A. ', R9: 'Yok Y.', R1: '   ' }, short);
    expect(res.reviews.map((r: { author: string }) => r.author)).toEqual(['Ayşe Y.', 'Deneme A.']);
    expect(res.reviews.map((r: { fp: string[] }) => r.fp)).toEqual(rows.map((r) => r.fp));
    expect(res.unknown.sort()).toEqual(['R1', 'R9']);
    expect(applyDisplayNames(rows, undefined, short).unknown).toEqual([]);
  });
});

describe('Koruma kaydı: kelime özeti olmayan metin/ay anahtarlı kayıt bozuk sayılır (fail-closed)', () => {
  it('parseGuard, t ya da m anahtarı olup w listesi boş olan kaydı reddeder; yalnız kimlikli kayıt geçer', async () => {
    const { parseGuard } = await import('../scripts/lib/review-fingerprint.mjs');
    expect(() => parseGuard([{ fp: ['t0123abcd'], w: [] }])).toThrow(/no word hashes/);
    expect(() => parseGuard([{ fp: ['m0123abcd'], w: [''] }])).toThrow(/no word hashes/);
    expect(parseGuard([{ fp: ['i0123abcd'], w: [] }])).toHaveLength(1);
  });
});

