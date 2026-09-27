import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { LegalFacts } from '../src/config/business';
import { business } from '../src/config/business';
import {
  LEGAL_TEXT_VERSION,
  enforceLegalGate,
  legalContextSignature,
  legalContextFromEnv,
  PROVIDERS,
  awaitingApprovalOnly,
  escapeHtml,
  expectedTextApproval,
  missingLegalFacts as missingFor,
  textApprovalTemplate,
  type LegalBuildContext,
  type LegalEnv,
} from '../src/content/legal/facts';
import { legalTr, type LegalDoc } from '../src/content/legal/tr';
import { legalEn } from '../src/content/legal/en';
import { legalTextHash, legalTextMaterial, type LegalTextSources } from '../src/content/legal/text-hash';
import { buildLegalDoc } from '../src/content/legal';
import { consentView, CONSENT_SERVICE_NAMES } from '../src/content/legal/consent-view';
import { tr as trContent } from '../src/content/tr';
import { en as enContent } from '../src/content/en';

// Tamamen doldurulmuş ÖRNEK (yalnızca test). Gerçek değerler işletmeden gelir; business.ts'e kopyalanmaz.
const complete: LegalFacts = {
  retention: { appointmentRequestsMonths: 12, whatsappMonths: 12, technicalLogsDays: 7 },
  notificationChannels: ['resend', 'telegram'],
  crossBorderBasis: { tr: 'Örnek dayanak cümlesi.', en: 'Example basis sentence.' },
  legalBasesConfirmation: { by: 'Test', date: '2026-09-26' },
  textApproval: { by: 'Test', date: '2026-09-26', version: LEGAL_TEXT_VERSION, context: 'form=whatsapp;turnstile=0;live=0;ga4=0;gads=0;meta=0;openai=0', hash: '' },
};
/** Onay, derleme yapılandırmasının imzasına VE nihai metnin özetine bağlıdır: her bağlam için kendi imzası/özetiyle doldurulmuş örnek. */
const completeFor = (c: LegalBuildContext): LegalFacts => ({ ...complete, textApproval: { ...complete.textApproval!, context: legalContextSignature(c), hash: legalTextHash(c, complete) } });
/** Kapı, derlemede olduğu gibi bu bağlamın ve bu bilgilerin nihai metin özetiyle çalışır (index.ts ile aynı). */
const missingLegalFacts = (f: LegalFacts, c: LegalBuildContext) => missingFor(f, c, legalTextHash(c, f));
const gate = (f: LegalFacts, c: LegalBuildContext) => enforceLegalGate(f, c, legalTextHash(c, f));
const empty: LegalFacts = {
  retention: { appointmentRequestsMonths: null, whatsappMonths: null, technicalLogsDays: null },
  notificationChannels: null,
  crossBorderBasis: null,
  legalBasesConfirmation: null,
  textApproval: null,
};

const PROD_WA: LegalEnv = { PUBLIC_SITE_ENV: 'production' };
const PROD_WA_QA: LegalEnv = { ...PROD_WA, ALLOW_INCOMPLETE_LEGAL: '1' };
const PROD_API: LegalEnv = { PUBLIC_SITE_ENV: 'production', PUBLIC_API_BASE: 'https://api.example.test', PUBLIC_TURNSTILE_SITE_KEY: '0xTEST' };
const ctx = (env: LegalEnv, mode: 'carousel' | 'link' = 'carousel') => legalContextFromEnv(env, mode);

const render = (locale: 'tr' | 'en', c: LegalBuildContext, facts: LegalFacts): LegalDoc => {
  const missing = missingLegalFacts(facts, c);
  return locale === 'tr' ? legalTr(c, missing, facts) : legalEn(c, missing, facts);
};
const full = (d: LegalDoc) => [d.title, d.description, d.updated, d.draftNotice ?? '', ...d.sections.map((s) => s.title + s.html)].join('\n');
const plain = (d: LegalDoc) => full(d).replace(/<[^>]+>/g, ' ');

// Tamamlanmış çıktıda asla bulunmaması gereken taslak/yer tutucu işaretleri (GPT incelemesi, 26 Eyl 2026)
const MARKERS = ['[', '•', 'doğrulanacak', 'yazılacak', 'Hukuki inceleme', 'taslak', 'to be confirmed', 'pending', 'legal-todo', 'İşletme dolduracak', 'To be provided', 'Önizleme', 'Preview version', 'to verify', 'Legal review'];

describe('hukuki metin kapısı (gate)', () => {
  it('WhatsApp modunda eksik anahtarları listeler; API-modu anahtarlarını istemez', () => {
    const keys = missingLegalFacts(empty, ctx(PROD_WA)).map((m) => m.key);
    expect(keys).toEqual([
      'retention.appointmentRequestsMonths',
      'retention.whatsappMonths',
      'crossBorderBasis.tr',
      'crossBorderBasis.en',
      'legalBasesConfirmation',
      'textApproval',
    ]);
  });
  it('API modunda teknik kayıt süresi ve bildirim kanalı da istenir', () => {
    const keys = missingLegalFacts(empty, ctx(PROD_API)).map((m) => m.key);
    expect(keys).toContain('retention.technicalLogsDays');
    expect(keys).toContain('notificationChannels');
    expect(keys).toHaveLength(8);
  });
  it('üretim + eksik + geçersiz kılma yok → Türkçe hata, her anahtar ve soru listede', () => {
    let msg = '';
    try { gate(empty, ctx(PROD_API)); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain('Üretim derlemesi durduruldu');
    expect(msg).toContain('src/config/business.ts');
    expect(msg).toContain('ALLOW_INCOMPLETE_LEGAL=1');
    for (const m of missingLegalFacts(empty, ctx(PROD_API))) {
      expect(msg).toContain(`business.legal.${m.key}`);
      expect(msg).toContain(m.question);
    }
  });
  it('geçersiz kılma (ALLOW_INCOMPLETE_LEGAL=1) ve önizleme derlemesi durmaz, yer tutucu basar', () => {
    for (const env of [{ ...PROD_WA, ALLOW_INCOMPLETE_LEGAL: '1' }, { ...PROD_WA, ALLOW_INCOMPLETE_LEGAL: 'true' }, { PUBLIC_SITE_ENV: 'preview' }, {}]) {
      const r = gate(empty, ctx(env));
      expect(r.placeholders).toBe(true);
      expect(r.missing.length).toBeGreaterThan(0);
    }
    expect(() => gate(empty, ctx({ ...PROD_WA, ALLOW_INCOMPLETE_LEGAL: '0' }))).toThrow();
  });
  it('tam doldurulmuş örnekle üretim derlemesi geçer (her iki modda)', () => {
    for (const env of [PROD_WA, PROD_API]) expect(gate(completeFor(ctx(env)), ctx(env))).toEqual({ missing: [], placeholders: false });
  });
  it('geçersiz değerler eksik sayılır: 0/negatif/kesirli süre, bilinmeyen kanal, hatalı tarih, eski sürüm onayı', () => {
    const bad: LegalFacts = {
      retention: { appointmentRequestsMonths: 0, whatsappMonths: 1.5, technicalLogsDays: -3 },
      notificationChannels: ['smtp' as never],
      crossBorderBasis: { tr: '  ', en: 'x' },
      legalBasesConfirmation: { by: 'x', date: '26.09.2026' },
      textApproval: { by: 'x', date: '2026-09-26', version: '2000-01-01', context: 'yanlis', hash: 'yanlis' },
    };
    expect(missingLegalFacts(bad, ctx(PROD_API)).map((m) => m.key)).toEqual([
      'retention.appointmentRequestsMonths', 'retention.whatsappMonths', 'retention.technicalLogsDays', 'notificationChannels', 'crossBorderBasis.tr', 'legalBasesConfirmation', 'textApproval',
    ]);
  });
  it('depodaki business.legal ile kapı tutarlı: eksik varsa üretim derlemesi durur ve hepsini listeler, yoksa geçer', () => {
    // İşletme bilgileri doldurulunca da geçerli kalır (ör. "henüz boş" varsayımı yok)
    const c = ctx(PROD_WA);
    const missing = missingLegalFacts(business.legal, c);
    if (missing.length) {
      let msg = '';
      try { gate(business.legal, c); } catch (e) { msg = String((e as Error).message); }
      for (const m of missing) expect(msg).toContain(`business.legal.${m.key}`);
    } else {
      expect(gate(business.legal, c)).toEqual({ missing: [], placeholders: false });
    }
  });
  it('onay yapılandırmaya bağlıdır: WhatsApp modu için verilen onay, sonradan ölçüm kimliği eklenince geçersizleşir', () => {
    const wa = ctx(PROD_WA);
    const withGa = ctx({ ...PROD_WA, PUBLIC_GA4_ID: 'G-X' });
    expect(missingLegalFacts(completeFor(wa), wa)).toEqual([]);
    expect(missingLegalFacts(completeFor(wa), withGa).map((m) => m.key)).toEqual(['textApproval']);
    let msg = '';
    try { gate(completeFor(wa), withGa); } catch (e) { msg = String((e as Error).message); }
    expect(msg).toContain(`context: '${legalContextSignature(withGa)}'`);
    expect(msg).toContain(`hash: '${legalTextHash(withGa, complete)}'`);
  });
  it("deploy.yml geçersiz kılmayı ASLA tanımlamaz ve üretim ortamında derler", () => {
    const yml = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
    expect(yml).not.toMatch(/ALLOW_INCOMPLETE_LEGAL/);
    expect(yml).toMatch(/PUBLIC_SITE_ENV:\s*production/);
  });
});

describe('hukuki metin çıktısı', () => {
  const variants: [string, LegalEnv][] = [
    ['whatsapp', PROD_WA],
    ['api+turnstile', PROD_API],
    ['api+tüm ölçüm', { ...PROD_API, PUBLIC_GA4_ID: 'G-X', PUBLIC_GADS_ID: 'AW-X', PUBLIC_META_PIXEL_ID: '1', PUBLIC_OPENAI_PIXEL_ID: 'o' }],
  ];
  for (const [name, env] of variants) {
    for (const locale of ['tr', 'en'] as const) {
      it(`tam örnek, ${name}, ${locale}: taslak/yer tutucu işareti yok, uyarı yok`, () => {
        const d = render(locale, ctx(env), completeFor(ctx(env)));
        expect(d.draftNotice).toBeNull();
        const out = full(d);
        for (const m of MARKERS) expect(out, m).not.toContain(m);
        expect(out).toContain(locale === 'tr' ? 'Örnek dayanak cümlesi.' : 'Example basis sentence.');
        expect(out).toContain('12');
      });
    }
  }

  it('eksik bilgiyle: işaretli yer tutucu + önizleme uyarısı (TR ve EN aynı anahtarlar)', () => {
    const c = ctx(PROD_API);
    const tr = render('tr', c, empty);
    const en = render('en', c, empty);
    expect(tr.draftNotice).toContain('business.legal.textApproval');
    expect(en.draftNotice).toContain('business.legal.textApproval');
    const keys = (d: LegalDoc) => [...full(d).matchAll(/data-legal-todo="([^"]+)"/g)].map((m) => m[1]!.replace(/\.(tr|en)$/, '')).sort();
    expect(keys(tr)).toEqual(keys(en));
    expect(full(tr)).toContain('<mark class="legal-todo"');
  });

  it('çelişki yok: "izin olmadan çerez yok" iddiası yerine harita açıkça anlatılır (TR)', () => {
    const t = plain(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    expect(t).not.toMatch(/hiçbir çerezi izniniz olmadan/);
    expect(t).not.toMatch(/zorunlu kayıtlar dışında/);
    expect(t).toMatch(/Sitemizin kendi kodu çerez yazmaz/);
    expect(t).toMatch(/izninizi beklemeden otomatik olarak yüklenir/);
    expect(t).toMatch(/IP adresiniz, tarayıcı bilgileriniz ve görüntülediğiniz sayfanın adresi Google'a iletilir/);
    expect(t).toMatch(/Google kendi çerezlerini yerleştirebilir/);
    expect(t).toContain(business.address.line);
    expect(t).toContain(business.phone.display);
    const h = full(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    expect(h).toContain('https://policies.google.com/privacy');
    expect(h).toContain('https://policies.google.com/technologies/cookies');
  });
  it('çelişki yok (EN)', () => {
    const t = plain(render('en', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    expect(t).not.toMatch(/sets no cookies without your consent/i);
    expect(t).not.toMatch(/Apart from strictly necessary storage/);
    expect(t).toMatch(/Our own site code does not write cookies/);
    expect(t).toMatch(/loads automatically when the page is viewed, without waiting for your consent/);
    expect(t).toMatch(/your IP address, browser information and the address of the page you are viewing are sent to Google/);
    expect(t).toContain(business.address.line);
  });
  it('çerez tablosu koddaki gerçek kayıtlarla aynı (anahtar adları ve 180 gün)', () => {
    const consentSrc = readFileSync(new URL('../src/scripts/consent.ts', import.meta.url), 'utf8');
    const trackSrc = readFileSync(new URL('../src/scripts/track.ts', import.meta.url), 'utf8');
    expect(consentSrc).toContain("const KEY = 'ayaz.consent.v1'");
    expect(consentSrc).toContain('180 * 24 * 60 * 60 * 1000');
    expect(trackSrc).toContain("const TOPIC_KEY = 'ayaz.topic'");
    for (const locale of ['tr', 'en'] as const) {
      const h = full(render(locale, ctx(PROD_WA), completeFor(ctx(PROD_WA))));
      expect(h).toContain('ayaz.consent.v1');
      expect(h).toContain('ayaz.topic');
      expect(h).toContain('180');
    }
  });

  it('WhatsApp modu ile API modu metni farklıdır', () => {
    const wa = plain(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    const api = plain(render('tr', ctx(PROD_API), completeFor(ctx(PROD_API))));
    expect(wa).toMatch(/hiçbir sunucumuza göndermez/);
    expect(wa).toMatch(/WhatsApp mesajına dönüştürülür/);
    expect(wa).not.toMatch(/Cloudflare/);
    expect(wa).not.toMatch(/teknik çalışma kayıtları/);
    expect(api).toMatch(/Cloudflare Workers/);
    expect(api).toMatch(/Resend ve Telegram aracılığıyla/);
    expect(api).toMatch(/Cloudflare Turnstile/);
    expect(api).toMatch(/7 gün sonra silinir/);
    expect(api).not.toMatch(/WhatsApp mesajına dönüştürülür/);
    const waEn = plain(render('en', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    const apiEn = plain(render('en', ctx(PROD_API), completeFor(ctx(PROD_API))));
    expect(waEn).toMatch(/does not send what you enter to any of our servers/);
    expect(waEn).not.toMatch(/Cloudflare/);
    expect(apiEn).toMatch(/Cloudflare Workers/);
    expect(apiEn).toMatch(/deleted after 7 days/);
    expect(apiEn).toMatch(/via Resend and Telegram\./);
  });
  it('bildirim kanalları düzgün listelenir: tek kanal, iki kanal "ve/and", üç kanal virgül + "ve/and"', () => {
    const c = ctx(PROD_API);
    const withCh = (ch: LegalFacts['notificationChannels']): LegalFacts => ({ ...completeFor(c), notificationChannels: ch });
    const tr = (ch: LegalFacts['notificationChannels']) => plain(render('tr', c, withCh(ch)));
    const en = (ch: LegalFacts['notificationChannels']) => plain(render('en', c, withCh(ch)));
    expect(tr(['brevo'])).toMatch(/talebinizi Brevo aracılığıyla/);
    expect(tr(['resend', 'brevo', 'telegram'])).toMatch(/talebinizi Resend, Brevo ve Telegram aracılığıyla/);
    expect(en(['telegram'])).toMatch(/notification via Telegram\./);
    expect(en(['resend', 'brevo', 'telegram'])).toMatch(/notification via Resend, Brevo and Telegram\./);
    for (const t of [tr(['resend', 'telegram']), en(['resend', 'telegram'])]) expect(t).not.toMatch(/Resend, Telegram/);
  });
  it('pazarlama hizmeti varken "reklam profili" cümlesi izinli ölçümle çelişmez (TR/EN)', () => {
    const none = ctx(PROD_WA);
    const gaOnly = ctx({ ...PROD_WA, PUBLIC_GA4_ID: 'G-X' });
    const mkt = ctx({ ...PROD_WA, PUBLIC_GADS_ID: 'AW-1', PUBLIC_META_PIXEL_ID: '1' });
    for (const c of [none, gaOnly]) {
      expect(plain(render('tr', c, completeFor(c)))).toContain('Kişisel verilerinizi satmayız, kiralamayız ve reklam amaçlı profil oluşturmak için kullanmayız.');
      expect(plain(render('en', c, completeFor(c)))).toContain('we do not use it to build advertising profiles');
    }
    const t = plain(render('tr', mkt, completeFor(mkt)));
    const e = plain(render('en', mkt, completeFor(mkt)));
    expect(t).not.toContain('reklam amaçlı profil oluşturmak için kullanmayız');
    expect(t).toContain('Kendimiz reklam amaçlı profil oluşturmayız; ancak pazarlama çerezlerine izin verirseniz pazarlama hizmetleri (Google Ads ve Meta Pixel)');
    expect(e).not.toContain('we do not use it to build advertising profiles');
    expect(e).toContain('We do not build advertising profiles ourselves; however, if you allow marketing cookies, the marketing services (Google Ads and Meta Pixel)');
  });
  it('Turnstile yalnızca API modunda ve site anahtarı varken anlatılır; canlı yorumlar yalnızca API + karusel', () => {
    expect(plain(render('tr', ctx({ ...PROD_WA, PUBLIC_TURNSTILE_SITE_KEY: 'k' }), completeFor(ctx({ ...PROD_WA, PUBLIC_TURNSTILE_SITE_KEY: 'k' }))))).not.toMatch(/Turnstile/);
    expect(plain(render('tr', ctx({ ...PROD_API, PUBLIC_TURNSTILE_SITE_KEY: '' }), completeFor(ctx({ ...PROD_API, PUBLIC_TURNSTILE_SITE_KEY: '' }))))).not.toMatch(/Turnstile/);
    expect(plain(render('tr', ctx(PROD_API, 'carousel'), completeFor(ctx(PROD_API, 'carousel'))))).toMatch(/Güncel yorumlar/);
    expect(plain(render('tr', ctx(PROD_API, 'link'), completeFor(ctx(PROD_API, 'link'))))).not.toMatch(/Güncel yorumlar/);
  });
  it('ölçüm hizmetleri yalnızca kimlik tanımlıysa listelenir', () => {
    const none = plain(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    expect(none).toMatch(/hiçbir analitik veya pazarlama hizmeti etkin değildir/);
    for (const w of ['Google Analytics', 'Google Ads', 'Meta Pixel', 'OpenAI', 'm.5/1']) expect(none).not.toContain(w);
    const ga = plain(render('tr', ctx({ ...PROD_WA, PUBLIC_GA4_ID: 'G-X' }), completeFor(ctx({ ...PROD_WA, PUBLIC_GA4_ID: 'G-X' }))));
    expect(ga).toContain('Google Analytics 4');
    expect(ga).toContain('m.5/1 açık rıza');
    expect(ga).not.toContain('Meta Pixel');
    const meta = plain(render('en', ctx({ ...PROD_WA, PUBLIC_META_PIXEL_ID: '1' }), completeFor(ctx({ ...PROD_WA, PUBLIC_META_PIXEL_ID: '1' }))));
    expect(meta).toContain('Meta Pixel');
    expect(meta).not.toContain('Google Analytics');
  });
  it('TR ve EN aynı bölüm yapısında', () => {
    for (const env of [PROD_WA, PROD_API]) {
      const tr = render('tr', ctx(env), completeFor(ctx(env)));
      const en = render('en', ctx(env), completeFor(ctx(env)));
      expect(tr.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
      const count = (d: LegalDoc, tag: string) => d.sections.map((s) => s.html.split(tag).length - 1);
      for (const tag of ['<p>', '<li>', '<tr>', '<h3>', '<a ']) expect(count(tr, tag), tag).toEqual(count(en, tag));
    }
  });
});

// Doğrulayıcı bulgusu (27 Eyl 2026): çerez paneli, kimliği boş hizmetleri adlandırmamalı ve onlar için izin istememeli.
describe('çerez paneli derleme yapılandırmasına bağlı', () => {
  const ALL = Object.values(CONSENT_SERVICE_NAMES);
  const paneText = (v: ReturnType<typeof consentView>) => [v.title, v.text, ...v.categories.map((c) => `${c.label} ${c.text}`)].join(' ');
  const envs: LegalEnv[] = [
    PROD_WA,
    { ...PROD_WA, PUBLIC_GA4_ID: 'G-X' },
    { ...PROD_WA, PUBLIC_META_PIXEL_ID: '1' },
    { ...PROD_WA, PUBLIC_OPENAI_PIXEL_ID: 'oai' },
    { ...PROD_WA, PUBLIC_GADS_ID: 'AW-1', PUBLIC_OPENAI_PIXEL_ID: 'oai' },
    { ...PROD_WA, PUBLIC_GA4_ID: 'G-X', PUBLIC_GADS_ID: 'AW-1', PUBLIC_META_PIXEL_ID: '1', PUBLIC_OPENAI_PIXEL_ID: 'oai' },
  ];
  const named = (c: LegalBuildContext) => [c.ga4 && CONSENT_SERVICE_NAMES.ga4, c.gads && CONSENT_SERVICE_NAMES.gads, c.meta && CONSENT_SERVICE_NAMES.meta, c.openai && CONSENT_SERVICE_NAMES.openai].filter(Boolean) as string[];

  for (const [lang, content] of [['tr', trContent], ['en', enContent]] as const) {
    it(`kimliği boş hizmet adlandırılmaz, tanımlı olan adlandırılır (${lang})`, () => {
      for (const env of envs) {
        const c = ctx(env);
        const v = consentView(content.consent, c);
        const t = paneText(v);
        for (const name of ALL) {
          if (named(c).includes(name)) expect(t, `${JSON.stringify(env)} → ${name}`).toContain(name);
          else expect(t, `${JSON.stringify(env)} → ${name}`).not.toContain(name);
        }
        expect(v.services).toEqual(named(c));
        expect(t).not.toContain('{services}');
        expect(v.categories.some((k) => k.key === 'analytics')).toBe(c.ga4);
        expect(v.categories.some((k) => k.key === 'marketing')).toBe(c.gads || c.meta || c.openai);
      }
    });
    it(`hiç isteğe bağlı hizmet yoksa yalnızca bilgilendirme: kategori ve izin cümlesi yok, harita notu var (${lang})`, () => {
      const v = consentView(content.consent, ctx(PROD_WA));
      expect(v.mode).toBe('notice');
      expect(v.categories).toEqual([]);
      const t = paneText(v);
      if (lang === 'tr') {
        expect(t).not.toMatch(/Ziyaret istatistikleri|reklam ölçümü için kullanılan|izin verirseniz yüklenir/);
        expect(t).toMatch(/analitik veya reklam ölçüm hizmeti çalışmaz/);
        expect(t).toMatch(/Google Haritalar haritası izin beklemeden yüklenir/);
      } else {
        expect(t).not.toMatch(/visit statistics|only loaded if you give permission/i);
        expect(t).toMatch(/no analytics or ad measurement service runs/);
        expect(t).toMatch(/Google Maps map in the contact section loads without waiting for consent/);
      }
    });
  }
  it('panel ile gizlilik sayfası aynı bağlamdan konuşur (hizmet yok ↔ "etkin değildir")', () => {
    for (const env of envs) {
      const c = ctx(env);
      const page = plain(render('tr', c, completeFor(c)));
      const v = consentView(trContent.consent, c);
      expect(v.mode === 'notice').toBe(/hiçbir analitik veya pazarlama hizmeti etkin değildir/.test(page));
      for (const name of v.services) expect(page).toContain(name);
    }
  });
  it('ConsentBanner paneli consentView ile üretir; yalnızca bilgilendirme modunda kabul/yönet düğmesi yoktur', () => {
    const src = readFileSync(new URL('../src/components/ConsentBanner.astro', import.meta.url), 'utf8');
    expect(src).toContain('consentView(c.consent, legalContextFromEnv(');
    expect(src).not.toMatch(/c\.consent\.categories\.map|c\.consent\.text\b/);
  });
});

// Doğrulayıcı bulgusu (27 Eyl 2026): KVKK m.11 bentleri Kanun lafzıyla; TR ve EN aynı dokuz bent.
describe('KVKK m.11 hakları', () => {
  const STATUTE = [
    'a) Kişisel veri işlenip işlenmediğini öğrenme,',
    'b) Kişisel verileri işlenmişse buna ilişkin bilgi talep etme,',
    'c) Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,',
    'ç) Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,',
    'd) Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,',
    "e) Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme,",
    'f) (d) ve (e) bentleri uyarınca yapılan işlemlerin, kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,',
    'g) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme,',
    'ğ) Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme',
  ];
  const rights = (d: LegalDoc) => {
    const html = d.sections.find((s) => s.id === 'aydinlatma')!.html;
    const ul = html.match(/<ul class="legal-lettered">([\s\S]*?)<\/ul>/)![1]!;
    return [...ul.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]!);
  };
  it('TR metni m.11 (a)–(ğ) bentlerini Kanun lafzıyla içerir', () => {
    expect(rights(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))))).toEqual(STATUTE);
  });
  it('EN metni aynı dokuz bendi aynı harflerle ve aynı öğelerle verir', () => {
    const en = rights(render('en', ctx(PROD_WA), completeFor(ctx(PROD_WA))));
    expect(en.map((r) => r.slice(0, 2))).toEqual(STATUTE.map((r) => r.slice(0, 2)));
    const joined = en.join(' ');
    for (const w of ['purpose of the processing', 'in Türkiye or abroad', 'exclusively through automated systems', 'processed unlawfully', 'Article 7']) expect(joined).toContain(w);
  });
  it('metin sürümü tarih (+ aynı gün revizyon eki) biçiminde ve bu değişiklikle artırıldı', () => {
    expect(LEGAL_TEXT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/);
    for (const old of ['2026-09-27', '2026-09-27.2']) expect(LEGAL_TEXT_VERSION).not.toBe(old);
    expect(render('tr', ctx(PROD_WA), completeFor(ctx(PROD_WA))).updated).toBe('27 Eylül 2026');
  });
});

// Doğrulayıcı bulgusu (27 Eyl 2026): onay metnin KENDİSİNE bağlı olmalı (yalnızca sürüm etiketi + bağlam değil).
// GPT Tur 6: özet sabit yer tutucularla değil, GERÇEK işletme bilgileriyle basılan NİHAİ metinden hesaplanır;
// sıra: bilgileri doldur → nihai metni oku → basılan özeti onayla.
describe('onay nihai metin özetine bağlı (textApproval.hash)', () => {
  const wa = ctx(PROD_WA);
  const api = ctx(PROD_API);
  /** Kaynağı değiştirilmiş metin: ifade değişikliğini benzetir. */
  const withPage = (edit: (html: string) => string): LegalTextSources => ({
    content: { tr: trContent, en: enContent },
    render: {
      tr: (c, m, f) => { const d = legalTr(c, m, f); return { ...d, sections: d.sections.map((s) => ({ ...s, html: edit(s.html) })) }; },
      en: legalEn,
    },
  });
  const withContent = (patch: (tr: typeof trContent) => typeof trContent): LegalTextSources => ({
    content: { tr: patch(trContent), en: enContent },
    render: { tr: legalTr, en: legalEn },
  });
  const gateMsg = (f: LegalFacts, c: LegalBuildContext, h = legalTextHash(c, f)): string => {
    try { enforceLegalGate(f, c, h); } catch (e) { return String((e as Error).message); }
    return '';
  };
  const HASH_LINE = /hash: '[0-9a-f]{16}'/;

  it('özet 16 onaltılık hane ve kararlı; business.ts içindeki anahtar sırası özeti etkilemez', () => {
    expect(legalTextHash(wa, complete)).toMatch(/^[0-9a-f]{16}$/);
    expect(legalTextHash(wa, complete)).toBe(legalTextHash(ctx(PROD_WA), structuredClone(complete)));
    const reordered = {
      textApproval: complete.textApproval,
      legalBasesConfirmation: { date: '2026-09-26', by: 'Test' },
      crossBorderBasis: { en: complete.crossBorderBasis!.en, tr: complete.crossBorderBasis!.tr },
      notificationChannels: complete.notificationChannels,
      retention: { technicalLogsDays: 7, whatsappMonths: 12, appointmentRequestsMonths: 12 },
    } as LegalFacts;
    expect(legalTextHash(wa, reordered)).toBe(legalTextHash(wa, complete));
  });
  it('hiçbir şey değişmediyse onay geçerli', () => {
    expect(missingLegalFacts(completeFor(wa), wa)).toEqual([]);
    expect(gate(completeFor(wa), wa)).toEqual({ missing: [], placeholders: false });
    expect(gate(completeFor(api), api)).toEqual({ missing: [], placeholders: false });
  });
  it('özet, sayfada gerçekten basılan değerleri içerir (sabit yer tutucu yok)', () => {
    const m = legalTextMaterial(api, complete);
    for (const v of ['Örnek dayanak cümlesi.', 'Example basis sentence.', PROVIDERS.resend.name, PROVIDERS.telegram.name]) expect(m).toContain(v);
    expect(m).not.toContain(PROVIDERS.brevo.name);
    expect(m).not.toContain('§');
    // Onay nesnesinin kendisi özete girmez (döngü olmaz): yalnızca onay değişince özet aynı kalır
    const other: LegalFacts = { ...complete, textApproval: { by: 'Başka', date: '2027-01-01', version: 'x', context: 'y', hash: 'z' } };
    expect(legalTextHash(api, other)).toBe(legalTextHash(api, complete));
    expect(legalTextHash(api, { ...complete, textApproval: null })).toBe(legalTextHash(api, complete));
  });
  it('onaydan sonra bir işletme bilgisi değişirse onay geçersizleşir ve üretim derlemesi durur', () => {
    const approved = completeFor(api);
    const changes: Array<(f: LegalFacts) => LegalFacts> = [
      (f) => ({ ...f, retention: { ...f.retention, appointmentRequestsMonths: 24 } }),
      (f) => ({ ...f, retention: { ...f.retention, whatsappMonths: 6 } }),
      (f) => ({ ...f, retention: { ...f.retention, technicalLogsDays: 30 } }),
      (f) => ({ ...f, notificationChannels: ['brevo'] }),
      (f) => ({ ...f, notificationChannels: ['telegram', 'resend'] }),
      (f) => ({ ...f, crossBorderBasis: { ...f.crossBorderBasis!, tr: 'Başka dayanak.' } }),
      (f) => ({ ...f, crossBorderBasis: { ...f.crossBorderBasis!, en: 'Another basis.' } }),
      (f) => ({ ...f, legalBasesConfirmation: { by: 'Test', date: '2026-10-01' } }),
    ];
    const hashes = new Set([legalTextHash(api, approved)]);
    for (const change of changes) {
      const f = change(approved);
      hashes.add(legalTextHash(api, f));
      expect(missingLegalFacts(f, api).map((m) => m.key)).toEqual(['textApproval']);
      const msg = gateMsg(f, api);
      expect(msg).toContain('Üretim derlemesi durduruldu');
      // Yalnızca onay eksik → yeni nihai metnin özetiyle tam nesne basılır
      expect(msg).toContain(`textApproval: ${textApprovalTemplate(api, legalTextHash(api, f))}`);
    }
    // Her farklı değer farklı özet verir
    expect(hashes.size).toBe(changes.length + 1);
    // WhatsApp modunda sayfada görünmeyen teknik kayıt süresi bile onayı yeniler
    const waApproved = completeFor(wa);
    expect(missingLegalFacts({ ...waApproved, retention: { ...waApproved.retention, technicalLogsDays: 1 } }, wa).map((m) => m.key)).toEqual(['textApproval']);
  });
  it('gizlilik sayfasında tek kelime değişirse onay geçersizleşir ve üretim derlemesi durur', () => {
    const src = withPage((h) => h.replace('Sağlık verisi istemiyoruz.', 'Sağlık verisi istemeyiz.'));
    const changed = legalTextHash(wa, complete, src);
    expect(changed).not.toBe(legalTextHash(wa, complete));
    expect(missingFor(completeFor(wa), wa, changed).map((m) => m.key)).toEqual(['textApproval']);
    const msg = gateMsg(completeFor(wa), wa, changed);
    expect(msg).toContain(`textApproval: ${textApprovalTemplate(wa, changed)}`);
    expect(msg).toContain(`{ by: '<rol/kısa ad>', date: '<YYYY-AA-GG>', version: '${LEGAL_TEXT_VERSION}', context: '${legalContextSignature(wa)}', hash: '${changed}' }`);
  });
  it('çerez paneli, harita notu veya form onay metni değişirse de onay geçersizleşir', () => {
    const banner = withContent((t) => ({ ...t, consent: { ...t.consent, textNoticeOnly: t.consent.textNoticeOnly.replace('Ayrıntılar', 'Detaylar') } }));
    const map = withContent((t) => ({ ...t, contact: { ...t.contact, info: { ...t.contact.info, mapNote: t.contact.info.mapNote + ' ' } } }));
    const button = withContent((t) => ({ ...t, consent: { ...t.consent, acknowledge: t.consent.acknowledge + '!' } }));
    // Randevu formunun KVKK onay cümlesi / bağlantısı / WhatsApp açıklaması da onaylanan metnin parçası
    const formConsent = withContent((t) => ({ ...t, contact: { ...t.contact, form: { ...t.contact.form, consent: t.contact.form.consent + ' ' } } }));
    const formLink = withContent((t) => ({ ...t, contact: { ...t.contact, form: { ...t.contact.form, consentLink: t.contact.form.consentLink + '.' } } }));
    const fallback = withContent((t) => ({ ...t, contact: { ...t.contact, form: { ...t.contact.form, fallbackNotice: t.contact.form.fallbackNotice + ' ' } } }));
    const consentError = withContent((t) => ({ ...t, contact: { ...t.contact, form: { ...t.contact.form, validation: { ...t.contact.form.validation, consent: t.contact.form.validation.consent + ' ' } } } }));
    for (const src of [banner, map, button, formConsent, formLink, fallback, consentError]) {
      const h = legalTextHash(wa, complete, src);
      expect(h).not.toBe(legalTextHash(wa, complete));
      expect(missingFor(completeFor(wa), wa, h).map((m) => m.key)).toEqual(['textApproval']);
    }
  });
  it('sürüm ve bağlam doğru ama özet yanlışsa onay geçersiz', () => {
    const f = completeFor(wa);
    expect(missingLegalFacts({ ...f, textApproval: { ...f.textApproval!, hash: '0000000000000000' } }, wa).map((m) => m.key)).toEqual(['textApproval']);
    const { hash: _omit, ...noHash } = f.textApproval!;
    expect(missingLegalFacts({ ...f, textApproval: noHash as never }, wa).map((m) => m.key)).toEqual(['textApproval']);
  });
  it('diğer bilgiler eksikken kopyalanacak özet BASILMAZ; önce doldurma talimatı verilir', () => {
    for (const [f, c] of [[empty, wa], [empty, api], [{ ...complete, crossBorderBasis: null }, wa], [{ ...complete, retention: { ...complete.retention, whatsappMonths: null } }, wa], [{ ...complete, notificationChannels: null }, api]] as const) {
      const msg = gateMsg(f, c);
      expect(msg).toContain('business.legal.textApproval');
      expect(msg).not.toMatch(HASH_LINE);
      expect(msg).not.toContain('→ textApproval:');
      expect(msg).not.toContain(legalTextHash(c, f));
      expect(msg).toContain('Önce yukarıdaki');
      expect(msg).toContain('bilgileri doldur → nihai metni önizlemede oku → basılan nesneyi onayla');
    }
  });
  it('diğer bilgiler eksikken, özeti tutan bir onay bile kabul edilmez (yer tutuculu metin onaylanamaz)', () => {
    const partial: LegalFacts = { ...complete, crossBorderBasis: null };
    const forged: LegalFacts = { ...partial, textApproval: { by: 'Test', date: '2026-09-26', version: LEGAL_TEXT_VERSION, context: legalContextSignature(wa), hash: legalTextHash(wa, partial) } };
    expect(missingLegalFacts(forged, wa).map((m) => m.key)).toEqual(['crossBorderBasis.tr', 'crossBorderBasis.en', 'textApproval']);
  });
  it('diğer bilgiler tamamlanınca derleme nihai metnin özetiyle tam nesneyi basar; o nesneyle derleme geçer', () => {
    for (const c of [wa, api]) {
      const unapproved: LegalFacts = { ...complete, textApproval: null };
      const missing = missingLegalFacts(unapproved, c);
      expect(missing.map((m) => m.key)).toEqual(['textApproval']);
      expect(awaitingApprovalOnly(missing)).toBe(true);
      const msg = gateMsg(unapproved, c);
      const printed = msg.match(/textApproval: (\{ by: .*? \})/)?.[1];
      expect(printed).toBe(textApprovalTemplate(c, legalTextHash(c, complete)));
      // Basılan nesne, by/date doldurularak olduğu gibi kopyalanır
      const e = expectedTextApproval(c, legalTextHash(c, complete));
      const approved: LegalFacts = { ...complete, textApproval: { by: 'İşletme sahibi', date: '2026-10-01', ...e } };
      expect(gate(approved, c)).toEqual({ missing: [], placeholders: false });
    }
    expect(awaitingApprovalOnly(missingLegalFacts(empty, wa))).toBe(false);
  });
  it('önizleme uyarısı: yalnızca onay eksikken onaylanacak nesneyi gösterir, uyarı özete girmez', () => {
    const unapproved: LegalFacts = { ...complete, textApproval: null };
    const obj = textApprovalTemplate(wa, legalTextHash(wa, complete));
    for (const locale of ['tr', 'en'] as const) {
      const doc = buildLegalDoc(locale, PROD_WA_QA, 'carousel', unapproved);
      expect(doc.draftNotice).toContain('data-legal-approval');
      expect(doc.draftNotice).toContain(escapeHtml(obj));
      // Sayfada eksik değer yok: metin nihai haliyle basılır
      expect(doc.sections.map((s) => s.html).join('')).not.toContain('legal-todo');
      const incomplete = buildLegalDoc(locale, PROD_WA_QA, 'carousel', empty);
      expect(incomplete.draftNotice).not.toContain('data-legal-approval');
      expect(incomplete.draftNotice).not.toMatch(/[0-9a-f]{16}/);
    }
    // Uyarının içeriği, onaylanan metni değiştirmez: özet, uyarı olmadan basılan metinden hesaplanır
    expect(legalTextMaterial(wa, unapproved)).not.toContain('data-legal-approval');
    expect(legalTextMaterial(wa, unapproved)).not.toContain('Önizleme sürümü');
  });
  it('özet bağlama göre farklı; önizleme/üretim ve QA bayrağı özeti değiştirmez', () => {
    const envs: LegalEnv[] = [
      PROD_WA,
      PROD_API,
      { ...PROD_API, PUBLIC_TURNSTILE_SITE_KEY: '' },
      { ...PROD_WA, PUBLIC_GA4_ID: 'G-X' },
      { ...PROD_WA, PUBLIC_META_PIXEL_ID: '1' },
      { ...PROD_WA, PUBLIC_GADS_ID: 'AW-1', PUBLIC_OPENAI_PIXEL_ID: 'o' },
    ];
    const hashes = envs.map((e) => legalTextHash(ctx(e), complete));
    expect(new Set(hashes).size).toBe(envs.length);
    expect(legalTextHash(ctx(PROD_API, 'carousel'), complete)).not.toBe(legalTextHash(ctx(PROD_API, 'link'), complete));
    expect(legalTextHash(ctx({ PUBLIC_SITE_ENV: 'preview' }), complete)).toBe(legalTextHash(wa, complete));
    expect(legalTextHash(ctx({ ...PROD_WA, ALLOW_INCOMPLETE_LEGAL: '1' }), complete)).toBe(legalTextHash(wa, complete));
    // Başka bağlamın onayı bu bağlamda geçmez
    expect(missingLegalFacts(completeFor(api), wa).map((m) => m.key)).toEqual(['textApproval']);
  });
  it('kapı gerçek derlemede nihai metnin özetiyle çalışır (index.ts), özet ayrı modülde (döngüsel içe aktarma yok)', () => {
    const idx = readFileSync(new URL('../src/content/legal/index.ts', import.meta.url), 'utf8');
    expect(idx).toContain('const textHash = legalTextHash(ctx, facts);');
    expect(idx).toContain('enforceLegalGate(facts, ctx, textHash)');
    const factsSrc = readFileSync(new URL('../src/content/legal/facts.ts', import.meta.url), 'utf8');
    expect(factsSrc).not.toMatch(/from '\.\/(text-hash|tr|en|consent-view)'/);
    const hashSrc = readFileSync(new URL('../src/content/legal/text-hash.ts', import.meta.url), 'utf8');
    expect(hashSrc).not.toMatch(/SENTINEL/);
  });
});

// Doğrulayıcı bulguları (27 Eyl 2026): yer tutucu stili, QA noindex, Workers Logs
describe('yayın çıktısı güvenceleri', () => {
  it('yer tutucu stili yalnızca yer tutucu basıldığında sayfaya eklenir (paylaşılan CSS paketinde yok)', () => {
    const src = readFileSync(new URL('../src/components/LegalPage.astro', import.meta.url), 'utf8');
    const scoped = src.slice(src.lastIndexOf('<style>'));
    expect(scoped).not.toContain('legal-todo');
    expect(src).toContain('{placeholders && <style is:inline set:html={todoCss} />}');
    expect(src).toContain(`const placeholders = legal.sections.some((s) => s.html.includes('class="legal-todo"'));`);
  });
  it('taslak hukuki metin ve QA geçersiz kılma derlemeleri noindex', () => {
    for (const f of ['../src/pages/gizlilik.astro', '../src/pages/en/privacy.astro']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8')).toContain('noindex={legal.draftNotice !== null}');
    }
    const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
    expect(base).toContain('const qaOverride = legalCtx.production && legalCtx.allowIncomplete;');
    expect(base).toMatch(/noindex \|\| !isProd \|\| qaOverride \? 'noindex, nofollow'/);
  });
  it('Worker otomatik çağrı logları kapalı (gizlilik metni yalnızca uygulamanın kendi log satırlarını anlatır)', () => {
    const w = readFileSync(new URL('../worker/wrangler.jsonc', import.meta.url), 'utf8');
    expect(w).toMatch(/"logs":\s*\{\s*"enabled":\s*true,\s*"invocation_logs":\s*false\s*\}/);
    expect(w).toMatch(/"traces":\s*\{\s*"enabled":\s*false\s*\}/);
  });
});
