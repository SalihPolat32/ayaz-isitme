import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { dismissConsent } from './helpers';
import { authorMonthFp, fold, guardRecord, idFp, similarity, textFp, SIMILARITY_MIN, TEXT_SIMILARITY_MIN, type GuardRecord } from '../../scripts/lib/review-fingerprint.mjs';

const GUARD_RE = /(<script type="application\/json" data-reviews-guard>)[^<]*(<\/script>)/;
/**
 * Sayfa HTML'indeki çalışma zamanı ayarına sahte Worker adresi yazar (preview :4322 ya da E2E_BASE_URL dev sunucusu).
 * `guard` verilirse sayfadaki koruma listesi bu (sentetik) kayıtlarla değiştirilir: çıkarılmış yorumların düz metni
 * depoda yoktur, metin kuralları tarayıcıda sentetik bir çıkarılmış yorumla sınanır.
 */
async function withApi(page: Page, baseURL: string | undefined, guard?: GuardRecord[]) {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4322').origin;
  await page.route(url => url.origin === origin, async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    let html = (await response.text()).replace('"apiBase":""', '"apiBase":"https://api.ayaz.test"');
    if (guard) {
      expect(html).toMatch(GUARD_RE);
      html = html.replace(GUARD_RE, (_, a: string, b: string) => `${a}${JSON.stringify(guard)}${b}`);
    }
    await route.fulfill({ response, body: html });
  });
}

type StaticReview = { id: string; author: string; text: string; textEn?: string; approxDate: string };
const data = JSON.parse(readFileSync(new URL('../../src/content/reviews-data.json', import.meta.url), 'utf8')) as { reviews: StaticReview[]; enOrder: string[]; guard: { tr: GuardRecord[]; en: GuardRecord[] } };
type Entry = { id: string; category: string; reason: string };
const curation = JSON.parse(readFileSync(new URL('../../src/content/reviews-curation.json', import.meta.url), 'utf8')) as { exclude: Entry[]; enExclude: Entry[] };
const legalIds = curation.exclude.filter(e => e.category === 'legal-risk').map(e => e.id);
const translationErrorIds = curation.enExclude.filter(e => e.category === 'translation-error').map(e => e.id);
/** Çıkarılmış bir yorumun yayın ayı: kendi koruma kaydındaki özetten (kısa ad + ay) bulunur; düz tarih depoda yok. */
const MONTHS = Array.from({ length: 10 * 12 }, (_, i) => `${2017 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
const guardMonth = (shortName: string, id: string) => {
  const rec = data.guard.tr.find(g => g.fp.includes(idFp(id)));
  return rec ? MONTHS.find(m => rec.fp.includes(authorMonthFp(shortName, m))) : undefined;
};
const salihId = curation.exclude.find(e => e.reason.startsWith('Salih P.'))!.id;
const midMonth = (ym: string) => `${ym}-15T10:00:00Z`;
const live = (author: string, text: string, extra: Record<string, unknown> = {}) => ({ author, rating: 5, text, relativeTime: 'bir hafta önce', reviewUri: 'https://maps.google.com/', ...extra });
/** Emoji/noktalama/boşluk/büyük harf "gürültüsü": parmak izi bunlara duyarsız olmalı */
const noisy = (t: string) => `  ${t.toLocaleUpperCase('tr-TR').replace(/\s+/g, '   ').replace(/[.,!]/g, '')} 🙏!!`;

test('API form can deliver a second request after resetting, with a fresh start time', async ({ page, baseURL }) => {
  await withApi(page, baseURL);
  const submitted: Record<string, unknown>[] = [];
  await page.route('https://api.ayaz.test/api/appointment', async route => {
    const body = route.request().postDataJSON();
    submitted.push(body);
    expect(Date.now() - body.t).toBeGreaterThanOrEqual(3000);
    await route.fulfill({ json: { ok: true, delivered: true } });
  });
  await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ status: 503, json: { ok: false } }));
  await page.goto('/#iletisim');
  await dismissConsent(page);
  const form = page.locator('[data-appointment-form]');
  for (let i = 0; i < 2; i++) {
    await form.locator('#f-name').fill('Test Kullanıcı');
    await form.locator('#f-phone').fill('05071234567');
    await form.locator('[name=consent]').check();
    await page.waitForTimeout(3100);
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-status]')).toContainText('Talebiniz alındı');
    await expect(form.locator('#f-name')).toHaveValue('');
  }
  expect(submitted).toHaveLength(2);
  expect(Number(submitted[1].t)).toBeGreaterThan(Number(submitted[0].t));
});

test('English API errors and translated reviews remain English and accessible', async ({ page, baseURL }) => {
  await withApi(page, baseURL);
  await page.route('https://api.ayaz.test/api/appointment', r => r.fulfill({ status: 422, json: { ok: false, fields: { phone: 'invalid' } } }));
  await page.route('https://api.ayaz.test/api/reviews*', r => {
    expect(new URL(r.request().url()).searchParams.get('lang')).toBe('en');
    return r.fulfill({ json: { ok: true, rating: 4.5, userRatingCount: 2, reviews: [{ author: 'Test author', rating: 4, text: 'A translated test review.', translated: true, relativeTime: 'a month ago', reviewUri: 'https://maps.google.com/' }] } });
  });
  await page.goto('/en/#yorumlar');
  await dismissConsent(page);
  // Yorumlar bölüm görünür olunca yüklenir; yavaş (yazılımsal GPU) ortamda 3B motor yüklemesi bunu geciktirebilir.
  // Canlı API yorumu statik (Takeout) listenin BAŞINA eklenir; statik liste korunur.
  const first = page.locator('[data-list] > .rvc').first();
  await expect(first).toContainText('A translated test review.', { timeout: 20_000 });
  await expect(first).toContainText('Translated by Google');
  await expect(first.locator('[data-stars]')).toHaveAttribute('aria-label', '4 out of 5');
  await expect(first.locator('[data-author]')).toHaveText('Test A.'); // canlı yorumda da kısa ad (KVKK varsayılanı)
  expect(await page.locator('[data-list] > .rvc').count()).toBeGreaterThan(20);
  // Özet kartı canlı veriyle güncellenir
  await expect(page.locator('[data-score] [data-rating]')).toHaveText('4.5');
  const form = page.locator('[data-appointment-form]');
  await form.locator('#f-name').fill('Test User');
  await form.locator('#f-phone').fill('05071234567');
  await form.locator('[name=consent]').check();
  await form.locator('[data-submit]').click();
  await expect(form.locator('[data-error-for=phone]')).toContainText('Please enter a valid phone number');
});

test.describe('Canlı yorumlar (Places API) — tekrar ve çıkarılmış yorum eleme', () => {
  test('TR: statik yorumun kopyası (metin gürültülü / kimlik / aynı kişi+ay benzer metin) ve canlı tekrar eklenmez; çıkarılmış yorum kimliğiyle geri gelmez; aynı kısa ad + ay tek başına kimseyi elemez', async ({ page, baseURL }) => {
    await withApi(page, baseURL);
    const [first, second, third, fourth] = data.reviews;
    const salihMonth = guardMonth('Salih P.', salihId);
    expect(salihMonth, 'çıkarılmış yorumun ay anahtarı kendi koruma kaydında').toBeTruthy();
    const calls: string[] = [];
    await page.route('https://api.ayaz.test/api/reviews*', r => {
      calls.push(r.request().url());
      return r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
        live(first!.author, noisy(first!.text)), // statik: aynı metin (gürültülü)
        live('Başka Biri', noisy(second!.text)), // statik: aynı metin, farklı ad
        live(third!.author, `Ek not: ${third!.text} Kontrollere de gidiyoruz.`, { publishTime: midMonth(third!.approxDate) }), // statik: aynı kişi, aynı ay, düzenlenmiş metin
        live('Kimlik Eşleşmesi', 'Worker kimliği statik yorumla aynı, metin tamamen farklı.', { id: fourth!.id }), // statik: aynı Google kimliği
        live('Kimlikli Çıkarılmış', 'Kimliği çıkarılmış yorumla aynı.', { id: legalIds[1] }), // çıkarılmış: kimlik → ENGELLENİR
        live(third!.author, 'Aynı kısa adlı başka bir kişi: bambaşka bir deneyim anlatıyor, pil ve bakım için geldik.', { publishTime: midMonth(third!.approxDate) }), // GPT örneği (statik): farklı kişi → EKLENİR
        live('Salih P.', 'Aynı kısa ad ve aynı ay, ama başka bir kişinin başka bir yorumu: kulak kalıbı için uğradık.', { id: 'LiveSalih2', publishTime: midMonth(salihMonth!) }), // GPT örneği (çıkarılmış): farklı metin + kimlik → EKLENİR
        live('Canlı Deneme', 'Yeni gelen bir canlı test yorumu, statik listede yok.', { id: 'LiveNew1', publishTime: '2026-09-20T10:00:00Z' }),
        live('Canlı Deneme', 'Yeni gelen bir canlı test yorumu — statik listede yok!'), // canlı listede tekrar
      ] } });
    });
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('bambaşka bir deneyim', { timeout: 20_000 });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!).searchParams.get('lang')).toBe('tr');
    await expect(cards).toHaveCount(data.reviews.length + 3);
    await expect(cards.first().locator('[data-author]')).toHaveText(third!.author);
    await expect(cards.nth(1)).toContainText('başka bir kişinin başka bir yorumu');
    await expect(cards.nth(1).locator('[data-author]')).toHaveText('Salih P.');
    await expect(cards.nth(2)).toContainText('Yeni gelen bir canlı test yorumu');
    const list = page.locator('[data-list]');
    for (const hidden of ['Başka Biri', 'Kimlik Eşleşmesi', 'Kimlikli Çıkarılmış', 'Ek not:']) await expect(list).not.toContainText(hidden);
    await expect(cards.nth(3).locator('[data-author]')).toHaveText('Akın E.');
    await expect(cards.first()).toHaveAttribute('aria-label', `Yorum 1 / ${data.reviews.length + 3}`);
    await expect(page.locator('[data-score] [data-count]')).toHaveText('66 yorum');
    // Canlı yorum eklendi → not, listenin işletmenin seçkisi olduğunu ve canlı eklemeyi söyler; "Google tarafından seçilen" demez
    const note = page.locator('[data-reviews] [data-note]');
    await expect(note).toHaveText(/bir seçki; Google'ın sunduğu bazı güncel yorumlar da canlı eklenir/);
    await expect(note).not.toContainText('Google tarafından seçilen');
    // Sayfada düz ad/metin yok: koruma listesi (yorum başına bir kayıt) ve kart parmak izleri yalnızca özet
    const guard = JSON.parse((await page.locator('[data-reviews-guard]').textContent()) || '[]') as GuardRecord[];
    expect(guard).toEqual(data.guard.tr);
    expect(guard).toHaveLength(legalIds.length);
    for (const g of guard) {
      expect(Object.keys(g).sort()).toEqual(['fp', 'w']);
      for (const k of g.fp) expect(k).toMatch(/^[tim][0-9a-f]{8}$/);
      for (const w of g.w) expect(w).toMatch(/^[0-9a-f]{8}( [0-9a-f]{8})*$/);
    }
    for (const fp of await cards.evaluateAll(els => els.map(e => e.getAttribute('data-fp') || ''))) for (const k of fp.split(/\s+/).filter(Boolean)) expect(k).toMatch(/^[tim][0-9a-f]{8}$/);
  });

  test('TR: kısa adı statik bir kartla aynı ama metni farklı canlı yorumlar (tarihli ya da tarihsiz) gösterilir', async ({ page, baseURL }) => {
    await withApi(page, baseURL);
    const s = data.reviews[0]!;
    await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
      live(s.author, 'Farklı bir kişi, aynı ay: randevu saatine uydular, çok memnun kaldık.', { publishTime: midMonth(s.approxDate) }),
      live(s.author, 'Farklı bir kişi, başka ay: cihaz temizliği için uğradım, hızlıca ilgilendiler.', { publishTime: '2026-09-18T10:00:00Z' }),
      live(s.author, 'Farklı bir kişi, tarih yok: kulak kalıbı için geldik, çok nazik davrandılar.'),
    ] } }));
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('aynı ay: randevu', { timeout: 20_000 });
    await expect(cards).toHaveCount(data.reviews.length + 3);
    await expect(cards.nth(1)).toContainText('başka ay');
    await expect(cards.nth(2)).toContainText('tarih yok');
  });

  test('TR: statik bir kartla aynı açılışla (ilk 40 katlanmış karakter) başlayıp farklı süren başka birinin uzun yorumu gösterilir; birebir kopyası gösterilmez', async ({ page, baseURL }) => {
    await withApi(page, baseURL);
    const s = data.reviews.find(r => fold(r.text).length >= 120)!;
    const words = s.text.split(/\s+/);
    let n = 1;
    while (fold(words.slice(0, n).join(' ')).length < 40) n++;
    const opening = words.slice(0, n).join(' ');
    const other = `${opening} ama bu yorum bambaşka sürüyor: pil değişimi için uğradık, beklemeden ilgilendiler ve kalıbı da temizlediler.`;
    expect(textFp(other)).toBe(textFp(s.text));
    await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
      live('Farklı Kişi', other, { publishTime: '2026-09-18T10:00:00Z' }),
      live('Kopya Kişi', noisy(s.text)),
    ] } }));
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('bambaşka sürüyor', { timeout: 20_000 });
    await expect(cards).toHaveCount(data.reviews.length + 1);
    await expect(cards.first().locator('[data-author]')).toHaveText('Farklı K.');
    await expect(page.locator('[data-list]')).not.toContainText('Kopya');
  });

  test('EN: statik çevirinin ya da özgün TR metnin kopyası, çıkarılmış ve çevirisi hatalı yorumlar eklenmez', async ({ page, baseURL }) => {
    await withApi(page, baseURL);
    const byId = new Map(data.reviews.map(r => [r.id, r]));
    const [e1, e2] = data.enOrder.map(id => byId.get(id)!);
    await page.route('https://api.ayaz.test/api/reviews*', r => {
      expect(new URL(r.request().url()).searchParams.get('lang')).toBe('en');
      return r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
        live('Someone Else', noisy(e1!.textEn!), { translated: true }), // statik EN çevirisi
        live('Another Person', e2!.text), // Google çevirmeden özgün TR metni döndürdü
        live('Third Person', 'Live translation of an excluded review (worded differently).', { translated: true, id: legalIds[0] }), // çıkarılmış (legal-risk): kimlik
        live('Fourth Person', 'Live translation of a mistranslated review (worded differently).', { translated: true, id: translationErrorIds[0] }), // EN'de çevirisi hatalı (yalnız TR): kimlik
        live('Live Tester', 'A brand-new live review that is not in the static list.', { translated: true }),
      ] } });
    });
    await page.goto('/en/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('A brand-new live review', { timeout: 20_000 });
    await expect(cards).toHaveCount(data.enOrder.length + 1);
    // özgün TR metin yalnızca öznitelikte (benzerlik için), görünür metinde değil
    await expect(cards.nth(1)).toHaveAttribute('data-alt-text', byId.get(data.enOrder[0]!)!.text);
    for (const name of ['Someone Else', 'Another Person', 'Third Person', 'Fourth Person']) await expect(page.locator('[data-list]')).not.toContainText(name);
    await expect(page.locator('[data-list]')).not.toContainText('Live translation of');
    expect(JSON.parse((await page.locator('[data-reviews-guard]').textContent()) || '[]')).toEqual(data.guard.en);
    const note = page.locator('[data-reviews] [data-note]');
    await expect(note).toContainText('A selection of reviews from our Google Business Profile; some current reviews provided by Google are also added live.');
    await expect(note).not.toContainText('selected by Google');
  });

  for (const loc of ['tr', 'en'] as const) {
    test(`${loc.toUpperCase()}: canlı yorumların hepsi tekrar/elenmişse kart eklenmez ve statik seçki notu kalır`, async ({ page, baseURL }) => {
      await withApi(page, baseURL);
      const byId = new Map(data.reviews.map(r => [r.id, r]));
      const shown = loc === 'tr' ? data.reviews : data.enOrder.map(id => byId.get(id)!);
      let called = 0;
      await page.route('https://api.ayaz.test/api/reviews*', r => {
        called++;
        return r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: shown.slice(0, 5).map(x => live(x.author, loc === 'tr' ? x.text : x.textEn!)) } });
      });
      await page.goto(loc === 'tr' ? '/#yorumlar' : '/en/#yorumlar');
      await dismissConsent(page);
      const root = page.locator('[data-reviews]');
      await expect(root).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
      expect(called).toBe(1);
      await expect(page.locator('[data-list] > .rvc')).toHaveCount(shown.length);
      const note = root.locator('[data-note]');
      const staticNote = await note.getAttribute('data-static-note');
      expect(staticNote).toBeTruthy();
      await expect(note).toHaveText(staticNote!);
      await expect(note).not.toContainText(loc === 'tr' ? 'canlı eklenir' : 'added live');
      await expect(note).not.toContainText(loc === 'tr' ? 'Google tarafından seçilen' : 'selected by Google');
    });
  }

  // Sentetik çıkarılmış yorumlar (gerçek çıkarılmış metinler depoda yoktur): sayfadaki koruma listesi bunlarla değiştirilir.
  const EXCL_TR = 'Birkaç işitme merkezini gezdikten sonra buraya geldik; Emre bey sabırla ilgilendi, ayarları defalarca yaptı ve sonunda sorunumuz tamamen çözüldü.';
  const EXCL_EN = 'After visiting several hearing centres we came here; Mr. Emre patiently took care of us, did the settings many times and finally our problem was completely solved.';
  const EXCL_SHORT = 'Ankara\'nın tek adresi!';
  const synthGuard = (): GuardRecord[] => [
    guardRecord({ id: 'SynthExclLong', author: 'Gül Tan', months: ['2025-05-03T10:00:00Z'], texts: [EXCL_TR, EXCL_EN] }),
    guardRecord({ id: 'SynthExclShort', author: 'Oya Kar', months: ['2025-06-03T10:00:00Z'], texts: [EXCL_SHORT, 'The only address in Ankara!'] }),
  ];

  test('TR (sentetik koruma): çıkarılmış yorum yeniden gelirse engellenir; aynı kısa ad + ay ya da aynı 40 karakterlik açılış tek başına engellemez', async ({ page, baseURL }) => {
    await withApi(page, baseURL, synthGuard());
    const sameOpening = 'Birkaç işitme merkezini gezdikten sonra buraya geldik ama bugün yalnızca pil almak için uğradık, beklemeden ilgilendiler.';
    expect(textFp(sameOpening)).toBe(textFp(EXCL_TR));
    expect(similarity(sameOpening, EXCL_TR)).toBeLessThan(TEXT_SIMILARITY_MIN);
    const gpt = 'Kulak kalıbım için uğradım, randevu saatine tam uydular ve çok nazik davrandılar.';
    expect(similarity(gpt, EXCL_TR)).toBeLessThan(SIMILARITY_MIN);
    await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
      live('Google kullanıcısı', noisy(EXCL_TR)), // aynı metin (emoji/büyük harf/boşluk varyantı) → ENGELLENİR
      live('Yeni Ad', 'Metin tamamen farklı ama kimlik çıkarılmış yorumunki.', { id: 'SynthExclLong' }), // aynı kimlik → ENGELLENİR
      live('Oya Kar', 'ankaranın TEK adresi 👍', { publishTime: '2025-06-20T10:00:00Z' }), // kısa metin + aynı kaydın kısa ad·ayı → ENGELLENİR
      live('Gül Tan', `GPT örneği: ${gpt}`, { id: 'SynthOther', publishTime: '2025-05-20T10:00:00Z' }), // aynı kısa ad + ay, farklı metin/kimlik → EKLENİR
      live('Selin Ay', sameOpening, { publishTime: '2025-05-21T10:00:00Z' }), // aynı açılış, bambaşka devam → EKLENİR
      live('Oya Kar', EXCL_SHORT), // kısa metin, tarih yok (m yok) → EKLENİR (bilinen sınır)
    ] } }));
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('GPT örneği', { timeout: 20_000 });
    await expect(cards).toHaveCount(data.reviews.length + 3);
    await expect(cards.first().locator('[data-author]')).toHaveText('Gül T.');
    await expect(cards.nth(1)).toContainText('pil almak için uğradık');
    await expect(cards.nth(2)).toContainText(EXCL_SHORT);
    const list = page.locator('[data-list]');
    for (const hidden of ['sorunumuz tamamen çözüldü', 'SORUNUMUZ', 'kimlik çıkarılmış', 'ankaranın TEK']) await expect(list).not.toContainText(hidden);
  });

  test('EN (sentetik koruma): çıkarılmış yorumun EN çevirisi ve yeterince benzer yeniden çevirisi (aynı kısa ad + ay) engellenir; benzemeyen yeniden çeviri gösterilir', async ({ page, baseURL }) => {
    await withApi(page, baseURL, synthGuard());
    const retr = 'We had visited several hearing centres before coming here; Mr. Emre took care of us patiently, did the settings many times and our problem was finally completely solved.';
    expect(textFp(retr)).not.toBe(textFp(EXCL_EN));
    expect(similarity(retr, EXCL_EN)).toBeGreaterThanOrEqual(SIMILARITY_MIN);
    const loose = 'A few centres later we ended up here and the specialist fixed it for us with lots of patience.';
    expect(similarity(loose, EXCL_EN)).toBeLessThan(SIMILARITY_MIN);
    await page.route('https://api.ayaz.test/api/reviews*', r => r.fulfill({ json: { ok: true, rating: 5, userRatingCount: 66, reviews: [
      live('Someone', EXCL_EN, { translated: true }), // statik EN çevirisiyle aynı → ENGELLENİR
      live('Gül Tan', retr, { translated: true, publishTime: '2025-05-11T10:00:00Z' }), // yeniden çeviri, benzerlik ≥ 0,35 + aynı kısa ad·ay → ENGELLENİR
      live('Gül Tan', `Loose retranslation: ${loose}`, { translated: true, publishTime: '2025-05-11T10:00:00Z' }), // benzerlik < 0,35 → GÖSTERİLİR (bilinen sınır)
    ] } }));
    await page.goto('/en/#yorumlar');
    await dismissConsent(page);
    const cards = page.locator('[data-list] > .rvc');
    await expect(cards.first()).toContainText('Loose retranslation', { timeout: 20_000 });
    await expect(cards).toHaveCount(data.enOrder.length + 1);
    await expect(page.locator('[data-list]')).not.toContainText('completely solved');
  });

  for (const variant of ['yoksa', 'eski düz biçimdeyse', 'bozuksa'] as const) test(`koruma listesi ${variant} canlı yorum API'si hiç çağrılmaz (güvenli taraf)`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://127.0.0.1:4322').origin;
    const body = { 'eski düz biçimdeyse': '["t12345678","i12345678"]', bozuksa: '[{"fp":["t12345678"],"w":["not-hex"]}]' } as Record<string, string>;
    await page.route(url => url.origin === origin, async route => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      const html = (await response.text()).replace('"apiBase":""', '"apiBase":"https://api.ayaz.test"').replace(GUARD_RE, (_, a: string, b: string) => (variant === 'yoksa' ? '' : `${a}${body[variant]}${b}`));
      await route.fulfill({ response, body: html });
    });
    let called = 0;
    await page.route('https://api.ayaz.test/api/reviews*', r => { called++; return r.fulfill({ json: { ok: true, reviews: [live('X Y', 'Hiç görünmemeli.')] } }); });
    // data-state geçişleri kaydedilir: load() gerçekten çalışıp ('loading') korumada durmalı ('static'); IO hiç tetiklenmese test geçmez
    await page.addInitScript(() => {
      const w = window as unknown as { __rvStates: string[] };
      w.__rvStates = [];
      new MutationObserver((recs) => {
        for (const r of recs) {
          const el = r.target as Element;
          // Aynı görevde art arda değişen değerler tek grupta gelir; getAttribute hep SON değeri verir → oldValue kaydedilir
          if (r.attributeName === 'data-state' && el.matches?.('[data-reviews]')) w.__rvStates.push(r.oldValue ?? '');
        }
      }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-state'] });
    });
    await page.goto('/#yorumlar');
    await dismissConsent(page);
    await expect(page.locator('[data-reviews-guard]')).toHaveCount(variant === 'yoksa' ? 0 : 1);
    await page.locator('[data-reviews]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-list] > .rvc').first()).toBeVisible();
    await page.waitForTimeout(3000); // bölüm görünür: normalde bu sürede çağrı yapılırdı (üstteki testler)
    expect(called).toBe(0);
    await expect(page.locator('[data-reviews]')).toHaveAttribute('data-state', 'static');
    const states = await page.evaluate(() => (window as unknown as { __rvStates: string[] }).__rvStates);
    // static → loading (load() çalıştı) → static (koruma listesi yok/bozuk, çağrı yapılmadı)
    expect(states, 'load() çalıştı ve koruma listesi okunamayınca durdu').toEqual(['static', 'loading']);
    await expect(page.locator('[data-list]')).not.toContainText('Hiç görünmemeli');
  });
});

