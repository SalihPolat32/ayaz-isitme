import { describe, expect, it } from 'vitest';
import { parseAllowedOrigins, allowedHostnames, isAllowedOrigin } from '../src/cors';
import { pageUrlFrom, intFromEnv, escapeHtml } from '../src/http';
import { FIELD_MASK, fetchCoalesced, trimPlace, type PlaceDetails } from '../src/reviews';
import { buildNotification } from '../src/appointment';
import {
  checkTimeTrap,
  formatPhoneTR,
  isHoneypotTriggered,
  maskPhone,
  normalizePhoneTR,
  sanitizeTime,
  validateAppointment,
  validateName,
  MIN_FILL_MS,
} from '../src/validate';
import fixture from './fixtures/place-details.json';

// ---------------------------------------------------------------------------
describe('normalizePhoneTR', () => {
  const E164 = '+905071551151';

  it.each([
    ['0507 155 11 51', E164],
    ['05071551151', E164],
    ['5071551151', E164],
    ['507 155 11 51', E164],
    ['+90 507 155 11 51', E164],
    ['+905071551151', E164],
    ['905071551151', E164],
    ['00905071551151', E164],
    ['(0507) 155-11-51', E164],
    ['0507.155.11.51', E164],
    ['  +90 (507) 155 11 51  ', E164],
    ['0312 123 45 67', '+903121234567'], // Ankara sabit hat
    ['+90 212 123 45 67', '+902121234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhoneTR(input)).toBe(expected);
  });

  it.each([
    ['', 'boş'],
    ['   ', 'yalnızca boşluk'],
    ['507 155 11', 'çok kısa'],
    ['0507 155 11 511', 'çok uzun'],
    ['05071551151234', 'çok uzun (14 hane)'],
    ['0107 155 11 51', 'geçersiz alan kodu 1xx'],
    ['0007 155 11 51', 'geçersiz alan kodu 0xx'],
    ['0850 155 11 51', 'servis numarası 8xx'],
    ['+44 7911 123456', 'yabancı ülke kodu'],
    ['+1 555 123 4567', 'yabancı ülke kodu'],
    ['0555 555 55 55', 'tüm haneler aynı'],
    ['abc', 'harf'],
    ['0507 155 11 5a', 'harf içeriyor'],
    ['05071551151; DROP TABLE', 'enjeksiyon denemesi'],
  ])('reddeder: %s (%s)', (input) => {
    expect(normalizePhoneTR(input)).toBeNull();
  });

  it('dize olmayan girdileri reddeder', () => {
    expect(normalizePhoneTR(5071551151)).toBeNull();
    expect(normalizePhoneTR(null)).toBeNull();
    expect(normalizePhoneTR(undefined)).toBeNull();
    expect(normalizePhoneTR({ phone: '0507' })).toBeNull();
  });

  it('formatPhoneTR ve maskPhone', () => {
    expect(formatPhoneTR(E164)).toBe('0507 155 11 51');
    expect(formatPhoneTR('+441234')).toBe('+441234');
    expect(maskPhone(E164)).toBe('+90507*****51');
    expect(maskPhone(E164)).not.toContain('1551151');
  });
});

// ---------------------------------------------------------------------------
describe('validateName', () => {
  it.each([
    ['Ayşe Yılmaz', 'Ayşe Yılmaz'],
    ['  Emre   Dağlıoğlu ', 'Emre Dağlıoğlu'],
    ['Şükrü Çağrı Öztürk', 'Şükrü Çağrı Öztürk'],
    ["Nur'an", "Nur'an"],
    ['Ali-Rıza', 'Ali-Rıza'],
    ['Dr. Işıl Gündüz', 'Dr. Işıl Gündüz'],
    ['Zoë Müller', 'Zoë Müller'],
    ['Ali', 'Ali'],
    ['Al', 'Al'],
  ])('kabul eder: %s', (input, expected) => {
    expect(validateName(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    [undefined, 'required'],
    [42, 'required'],
    ['A', 'too_short'],
    ['A'.repeat(81), 'too_long'],
    ['Ali123', 'invalid'],
    ['<script>alert(1)</script>', 'invalid'],
    ['ali@example.com', 'invalid'],
    ['--', 'invalid'],
    ["'.", 'invalid'],
    ['A-', 'invalid'],
  ])('reddeder: %j → %s', (input, error) => {
    expect(validateName(input)).toEqual({ ok: false, error });
  });
});

// ---------------------------------------------------------------------------
describe('sanitizeTime', () => {
  it('boş değerleri undefined yapar', () => {
    expect(sanitizeTime(undefined)).toEqual({ ok: true, value: undefined });
    expect(sanitizeTime('')).toEqual({ ok: true, value: undefined });
    expect(sanitizeTime('   ')).toEqual({ ok: true, value: undefined });
  });
  it('kontrol karakterlerini ve fazla boşlukları temizler', () => {
    expect(sanitizeTime('Salı\u0000 14:00\n\n öğleden  sonra')).toEqual({ ok: true, value: 'Salı 14:00 öğleden sonra' });
  });
  it('uzunluk ve tip sınırı', () => {
    expect(sanitizeTime('x'.repeat(61))).toEqual({ ok: false, error: 'too_long' });
    expect(sanitizeTime(123)).toEqual({ ok: false, error: 'invalid' });
  });
});

// ---------------------------------------------------------------------------
describe('validateAppointment', () => {
  const valid = { name: 'Ayşe Yılmaz', phone: '0507 155 11 51', time: 'Hafta içi öğleden sonra', consent: true, locale: 'tr' };

  it('geçerli formu normalize eder', () => {
    expect(validateAppointment(valid)).toEqual({
      ok: true,
      data: { name: 'Ayşe Yılmaz', phone: '+905071551151', time: 'Hafta içi öğleden sonra', locale: 'tr' },
    });
  });

  it('konu (kart başlığı) varsa eklenir; geçersiz ya da çok uzunsa formu reddetmez, yalnızca atılır', () => {
    const ok = validateAppointment({ ...valid, topic: '  Kulak\u0007 kalıbı ' });
    expect(ok).toMatchObject({ ok: true, data: { topic: 'Kulak kalıbı' } });
    for (const topic of [42, 'x'.repeat(61), '', null]) {
      const r = validateAppointment({ ...valid, topic });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.topic).toBeUndefined();
    }
  });

  it('time verilmezse alan hiç yer almaz; locale varsayılanı tr', () => {
    const r = validateAppointment({ name: 'Ali Veli', phone: '5071551151', consent: true });
    expect(r).toEqual({ ok: true, data: { name: 'Ali Veli', phone: '+905071551151', locale: 'tr' } });
  });

  it("locale yalnızca 'en' ise en olur", () => {
    expect(validateAppointment({ ...valid, locale: 'en' })).toMatchObject({ ok: true, data: { locale: 'en' } });
    expect(validateAppointment({ ...valid, locale: 'de' })).toMatchObject({ ok: true, data: { locale: 'tr' } });
  });

  it('consent true olmalı (string "true" kabul edilmez)', () => {
    expect(validateAppointment({ ...valid, consent: 'true' })).toEqual({ ok: false, fields: { consent: 'required' } });
    expect(validateAppointment({ ...valid, consent: false })).toEqual({ ok: false, fields: { consent: 'required' } });
    expect(validateAppointment({ ...valid, consent: undefined })).toEqual({ ok: false, fields: { consent: 'required' } });
  });

  it('tüm alan hatalarını tek seferde ve değer sızdırmadan raporlar', () => {
    const r = validateAppointment({ name: 'A', phone: '123', time: 'x'.repeat(100), consent: false });
    expect(r).toEqual({ ok: false, fields: { name: 'too_short', phone: 'invalid', time: 'too_long', consent: 'required' } });
    expect(JSON.stringify(r)).not.toContain('123');
  });

  it('eksik telefonu required, bozuk telefonu invalid olarak ayırır', () => {
    expect(validateAppointment({ ...valid, phone: '' })).toEqual({ ok: false, fields: { phone: 'required' } });
    expect(validateAppointment({ ...valid, phone: '0107 155 11 51' })).toEqual({ ok: false, fields: { phone: 'invalid' } });
  });

  it('gövde nesne değilse her zorunlu alan hatalı', () => {
    expect(validateAppointment(null)).toEqual({ ok: false, fields: { name: 'required', phone: 'required', consent: 'required' } });
    expect(validateAppointment('x')).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
describe('honeypot', () => {
  it('boş / eksik alan insan', () => {
    expect(isHoneypotTriggered(undefined)).toBe(false);
    expect(isHoneypotTriggered(null)).toBe(false);
    expect(isHoneypotTriggered('')).toBe(false);
    expect(isHoneypotTriggered('   ')).toBe(false);
  });
  it('dolu alan bot', () => {
    expect(isHoneypotTriggered('https://spam.example')).toBe(true);
    expect(isHoneypotTriggered('x')).toBe(true);
    expect(isHoneypotTriggered(0)).toBe(true);
    expect(isHoneypotTriggered(false)).toBe(true);
  });
});

describe('checkTimeTrap', () => {
  const now = 1_800_000_000_000;

  it('t yoksa karar verilmez', () => {
    expect(checkTimeTrap(undefined, now)).toBe('ok');
    expect(checkTimeTrap(null, now)).toBe('ok');
    expect(checkTimeTrap('', now)).toBe('ok');
  });
  it('3 saniyeden hızlı gönderim bot', () => {
    expect(checkTimeTrap(now, now)).toBe('too_fast');
    expect(checkTimeTrap(now - 1_000, now)).toBe('too_fast');
    expect(checkTimeTrap(now - (MIN_FILL_MS - 1), now)).toBe('too_fast');
  });
  it('3 saniye ve üzeri insan', () => {
    expect(checkTimeTrap(now - MIN_FILL_MS, now)).toBe('ok');
    expect(checkTimeTrap(now - 45_000, now)).toBe('ok');
    expect(checkTimeTrap(String(now - 10_000), now)).toBe('ok'); // dize olarak gelen sayı
  });
  it('istemci saati ileriyse (negatif yaş) cezalandırılmaz', () => {
    expect(checkTimeTrap(now + 120_000, now)).toBe('ok');
  });
  it('sayı olmayan t geçersiz', () => {
    expect(checkTimeTrap('abc', now)).toBe('invalid');
    expect(checkTimeTrap(NaN, now)).toBe('invalid');
    expect(checkTimeTrap({}, now)).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
describe('trimPlace (Google Places → ön yüz)', () => {
  const fetchedAt = '2026-09-25T07:00:00.000Z';
  const out = trimPlace(fixture as PlaceDetails, fetchedAt);

  it('alan maskesi spesifikasyonla aynı ve boşluksuz', () => {
    expect(FIELD_MASK).toBe('id,displayName,rating,userRatingCount,googleMapsUri,reviews');
    expect(FIELD_MASK).not.toMatch(/\s/);
  });

  it('üst düzey alanlar ve Google atfı', () => {
    expect(out).toMatchObject({
      ok: true,
      attribution: 'Google',
      name: 'Örnek İşitme Merkezi',
      rating: 4.8,
      userRatingCount: 57,
      googleMapsUri: 'https://maps.google.com/?cid=1234567890',
      fetchedAt,
    });
    expect(out.reviews).toHaveLength(3);
  });

  it('yorum alanlarını doğru eşler', () => {
    expect(out.reviews[0]).toEqual({
      id: 'AbCdEf1',
      author: 'Ayşe Y.',
      authorUri: 'https://www.google.com/maps/contrib/1111111111111111111/reviews',
      authorPhoto: 'https://lh3.googleusercontent.com/a/example-1=s128-c0x00000000-cc-rp-mo',
      rating: 5,
      text: 'Çok ilgili ve güler yüzlü bir ekip. Cihazım için harika bir deneyim oldu.',
      translated: false,
      relativeTime: '2 hafta önce',
      publishTime: '2026-09-10T08:15:30.123456Z',
      reviewUri: 'https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1sAbCdEf1',
      flagUri: 'https://www.google.com/local/review/rap/report?postId=AbCdEf1',
    });
  });

  it('çevrilmiş yorumu işaretler, metinsiz yorumu boş metinle korur', () => {
    expect(out.reviews[1]).toMatchObject({ translated: true, text: 'Great service, translated text.' });
    expect(out.reviews[2]).toMatchObject({ author: 'Fatma D.', rating: 5, text: '', translated: false });
  });

  it('yorum kimliğini yalnızca kaynak adının son parçası olarak verir (geriye dönük uyumlu ek alan)', () => {
    expect(out.reviews.map((r) => r.id)).toEqual(['AbCdEf1', 'AbCdEf2', 'AbCdEf3']);
    expect(trimPlace({ reviews: [{ rating: 5 }] } as PlaceDetails, fetchedAt).reviews[0]).toMatchObject({ id: '', publishTime: '' });
    expect(trimPlace({ reviews: [{ name: 'places/P/reviews/a b<script>' }] } as PlaceDetails, fetchedAt).reviews[0]!.id).toBe('');
    // Eski alanların hepsi yerinde (eski istemciler kırılmaz)
    expect(Object.keys(out.reviews[0]!).sort()).toEqual(['author', 'authorPhoto', 'authorUri', 'flagUri', 'id', 'publishTime', 'rating', 'relativeTime', 'reviewUri', 'text', 'translated'].sort());
  });

  it('Google\'ın iç alanlarını (name, originalText, languageCode) sızdırmaz', () => {
    const s = JSON.stringify(out);
    expect(s).not.toContain('places/ChIJ');
    expect(s).not.toContain('originalText');
    expect(s).not.toContain('languageCode');
  });

  it('eksik / boş yanıtlara dayanıklı', () => {
    expect(trimPlace({}, fetchedAt)).toEqual({
      ok: true,
      attribution: 'Google',
      name: '',
      rating: null,
      userRatingCount: null,
      googleMapsUri: null,
      reviews: [],
      fetchedAt,
    });
    expect(trimPlace({ reviews: [{}] } as PlaceDetails, fetchedAt).reviews[0]).toMatchObject({ id: '', author: '', rating: 0, text: '' });
  });
});

// ---------------------------------------------------------------------------
describe('yardımcılar', () => {
  it('pageUrlFrom sorgu dizesini ve parçayı atar, Origin\'e düşer', () => {
    expect(pageUrlFrom('https://keciorenisitme.com/?gclid=abc&utm_source=x#randevu', null)).toBe('https://keciorenisitme.com/');
    expect(pageUrlFrom('https://keciorenisitme.com/en/?x=1', null)).toBe('https://keciorenisitme.com/en/');
    expect(pageUrlFrom(null, 'https://keciorenisitme.com')).toBe('https://keciorenisitme.com/');
    expect(pageUrlFrom('not a url', 'javascript:alert(1)')).toBe('-');
    expect(pageUrlFrom(null, null)).toBe('-');
  });

  it('parseAllowedOrigins varsayılanı ve temizliği', () => {
    expect([...parseAllowedOrigins(undefined)]).toEqual(['https://keciorenisitme.com', 'http://localhost:4321']);
    expect([...parseAllowedOrigins(' https://a.example/ , http://localhost:4321 ,, ')]).toEqual(['https://a.example', 'http://localhost:4321']);
    const allowed = parseAllowedOrigins(undefined);
    expect(isAllowedOrigin('https://keciorenisitme.com', allowed)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
    expect([...allowedHostnames(allowed)]).toEqual(['keciorenisitme.com', 'localhost']);
  });

  it('intFromEnv', () => {
    expect(intFromEnv(undefined, 21600, 60)).toBe(21600);
    expect(intFromEnv('', 21600, 60)).toBe(21600);
    expect(intFromEnv('abc', 21600, 60)).toBe(21600);
    expect(intFromEnv('30', 21600, 60)).toBe(60);
    expect(intFromEnv('3600.9', 21600, 60)).toBe(3600);
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});

// ---------------------------------------------------------------------------
describe('buildNotification', () => {
  const data = { name: 'Ayşe <b>Yılmaz</b>', phone: '+905071551151', time: 'Salı 14:00', locale: 'tr' as const };
  const meta = { pageUrl: 'https://keciorenisitme.com/', receivedAt: new Date('2026-09-25T07:05:00Z'), country: 'TR' };
  const n = buildNotification(data, meta);

  it('konu sabit, düz metin tüm alanları içerir', () => {
    expect(n.subject).toBe('Yeni randevu talebi — keciorenisitme.com');
    expect(n.text).toContain('Ad Soyad: Ayşe <b>Yılmaz</b>');
    expect(n.text).toContain('Telefon: 0507 155 11 51 (+905071551151)');
    expect(n.text).toContain('Tercih edilen zaman: Salı 14:00');
    expect(n.text).toContain('Dil: tr');
    expect(n.text).toContain('Sayfa: https://keciorenisitme.com/');
    expect(n.text).toContain('Ülke: TR');
  });

  it('zaman damgası Europe/Istanbul (UTC+3)', () => {
    expect(n.text).toMatch(/Alınma zamanı: 25 Eylül 2026 10:05 \(Europe\/Istanbul\)/);
  });

  it('HTML kaçışlı, tel: bağlantısı var', () => {
    expect(n.html).toContain('Ayşe &lt;b&gt;Yılmaz&lt;/b&gt;');
    expect(n.html).not.toContain('<b>Yılmaz</b>');
    expect(n.html).toContain('href="tel:+905071551151"');
  });
});

// ---------------------------------------------------------------------------
describe('fetchCoalesced (eşzamanlı istek birleştirme)', () => {
  const payload = (n: number) => trimPlace({ rating: n }, `2026-09-25T07:00:0${n}.000Z`);

  it('aynı anda gelen istekler tek yükleme paylaşır, bitince yeni yükleme yapılır', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const loader = async () => {
      calls++;
      await gate;
      return payload(calls);
    };

    const a = fetchCoalesced('place-A', loader);
    const b = fetchCoalesced('place-A', loader);
    const c = fetchCoalesced('place-A', loader);
    expect(calls).toBe(1);
    release();
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(ra).toBe(rb);
    expect(rb).toBe(rc);
    expect(ra.rating).toBe(1);

    // Tamamlandıktan sonra sonuç saklanmaz: yeni istek yeni yükleme
    const d = await fetchCoalesced('place-A', async () => (calls++, payload(calls)));
    expect(calls).toBe(2);
    expect(d.rating).toBe(2);
  });

  it('farklı Place ID\'ler birbirini beklemez', async () => {
    let calls = 0;
    const loader = async () => (calls++, payload(calls));
    await Promise.all([fetchCoalesced('p1', loader), fetchCoalesced('p2', loader)]);
    expect(calls).toBe(2);
  });

  it('hata sonraki isteğe sızmaz', async () => {
    await expect(fetchCoalesced('p3', async () => { throw new Error('places 500'); })).rejects.toThrow('places 500');
    await expect(fetchCoalesced('p3', async () => payload(9))).resolves.toMatchObject({ rating: 9 });
  });
});
