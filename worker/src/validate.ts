/**
 * Randevu formu doğrulaması ve kötüye kullanım sezgileri. Saf fonksiyonlar: Worker
 * çalışma zamanına bağımlı değildir, Node'da doğrudan test edilir.
 */

export type Locale = 'tr' | 'en';

/** Tarayıcıdan gelen ham gövde (güvenilmez; her alan `unknown` kabul edilir). */
export interface AppointmentInput {
  name?: unknown;
  phone?: unknown;
  time?: unknown;
  consent?: unknown;
  website?: unknown; // honeypot
  t?: unknown; // formun açıldığı zaman (ms)
  turnstileToken?: unknown;
  locale?: unknown;
}

/** Doğrulanmış, normalize edilmiş veri. */
export interface AppointmentData {
  name: string;
  /** E.164, ör. +905071551151 */
  phone: string;
  time?: string;
  locale: Locale;
}

export type FieldName = 'name' | 'phone' | 'time' | 'consent';
export type FieldErrors = Partial<Record<FieldName, 'required' | 'invalid' | 'too_short' | 'too_long'>>;

export type ValidationResult = { ok: true; data: AppointmentData } | { ok: false; fields: FieldErrors };

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const TIME_MAX = 60;
export const MIN_FILL_MS = 3_000;

// ---------------------------------------------------------------------------
// Telefon
// ---------------------------------------------------------------------------

/**
 * Türkiye numarasını E.164'e çevirir: "0507 155 11 51", "5071551151", "+90 507 155 11 51",
 * "0090507...", "(0507) 155-11-51" → "+905071551151". Sabit hatlar (2xx–4xx) da kabul edilir.
 * Geçersizse null.
 */
export function normalizePhoneTR(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.length === 0 || s.length > 32) return null;

  // Görsel ayırıcıları at; baştaki + korunur.
  const plus = s.startsWith('+');
  s = s.replace(/[\s().\- ]/g, '');
  if (plus) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;

  // Uluslararası önekler
  if (s.startsWith('0090')) s = s.slice(4);
  else if (plus && s.startsWith('90')) s = s.slice(2);
  else if (!plus && s.length === 12 && s.startsWith('90')) s = s.slice(2);

  // Yurt içi başındaki 0
  if (s.length === 11 && s.startsWith('0')) s = s.slice(1);

  // Ulusal numara: 10 hane, alan/mobil kodu 2–5 ile başlar (0/1 geçersiz, 8xx/9xx servis numaraları kabul edilmez)
  if (!/^[2-5]\d{9}$/.test(s)) return null;
  // Bariz sahte: tüm haneler aynı
  if (/^(\d)\1{9}$/.test(s)) return null;

  return `+90${s}`;
}

/** Loglar için: +90507*****51 */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return '***';
  return `${e164.slice(0, 6)}${'*'.repeat(Math.max(0, e164.length - 8))}${e164.slice(-2)}`;
}

// ---------------------------------------------------------------------------
// Ad
// ---------------------------------------------------------------------------

// Harf (Türkçe dâhil her yazı), birleşik işaretler, boşluk, tire, kesme işareti (' ve ’) ve nokta (kısaltmalar).
const NAME_ALLOWED = /^[\p{L}\p{M}\s'’\-.]+$/u;

/** Adı temizler (boşlukları sadeleştirir) ve doğrular; geçersizse hata kodu döner. */
export function validateName(raw: unknown): { ok: true; value: string } | { ok: false; error: FieldErrors[FieldName] } {
  if (typeof raw !== 'string') return { ok: false, error: 'required' };
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length === 0) return { ok: false, error: 'required' };
  if (value.length < NAME_MIN) return { ok: false, error: 'too_short' };
  if (value.length > NAME_MAX) return { ok: false, error: 'too_long' };
  if (!NAME_ALLOWED.test(value)) return { ok: false, error: 'invalid' };
  // En az iki harf olsun ("--" veya "'." gibi girdiler elensin)
  const letters = value.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2) return { ok: false, error: 'invalid' };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Serbest metin (tercih edilen zaman)
// ---------------------------------------------------------------------------

/** Kontrol karakterlerini atar, boşlukları sadeleştirir; boşsa undefined. */
export function sanitizeTime(raw: unknown): { ok: true; value: string | undefined } | { ok: false; error: 'invalid' | 'too_long' } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined };
  if (typeof raw !== 'string') return { ok: false, error: 'invalid' };
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (value.length > TIME_MAX) return { ok: false, error: 'too_long' };
  return { ok: true, value: value || undefined };
}

export function parseLocale(raw: unknown): Locale {
  return raw === 'en' ? 'en' : 'tr';
}

// ---------------------------------------------------------------------------
// Bütün form
// ---------------------------------------------------------------------------

export function validateAppointment(body: unknown): ValidationResult {
  const input: AppointmentInput = body !== null && typeof body === 'object' ? (body as AppointmentInput) : {};
  const fields: FieldErrors = {};

  const name = validateName(input.name);
  if (!name.ok) fields.name = name.error;

  const phone = normalizePhoneTR(input.phone);
  if (phone === null) fields.phone = typeof input.phone === 'string' && input.phone.trim() ? 'invalid' : 'required';

  const time = sanitizeTime(input.time);
  if (!time.ok) fields.time = time.error;

  if (input.consent !== true) fields.consent = 'required';

  if (Object.keys(fields).length > 0 || !name.ok || phone === null || !time.ok) return { ok: false, fields };

  const data: AppointmentData = { name: name.value, phone, locale: parseLocale(input.locale) };
  if (time.value) data.time = time.value;
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Kötüye kullanım sezgileri
// ---------------------------------------------------------------------------

/** Gizli alan doluysa bot. Sadece boş dize / undefined / null insan kabul edilir. */
export function isHoneypotTriggered(website: unknown): boolean {
  if (website === undefined || website === null) return false;
  return !(typeof website === 'string' && website.trim() === '');
}

export type TimeTrapOutcome = 'ok' | 'too_fast' | 'invalid';

/**
 * Zaman tuzağı: form açıldıktan MIN_FILL_MS'den kısa sürede gönderildiyse bot.
 * `t` yoksa karar verilmez (ok). Negatif yaş (istemci saati ileri) da ok sayılır;
 * saat kayması olan gerçek kullanıcıları cezalandırmaktansa naif botları yakalamak hedeflenir.
 */
export function checkTimeTrap(t: unknown, now: number = Date.now(), minFillMs: number = MIN_FILL_MS): TimeTrapOutcome {
  if (t === undefined || t === null || t === '') return 'ok';
  const opened = typeof t === 'string' ? Number(t) : t;
  if (typeof opened !== 'number' || !Number.isFinite(opened)) return 'invalid';
  const age = now - opened;
  if (age >= 0 && age < minFillMs) return 'too_fast';
  return 'ok';
}

/** E.164 → okunur yurt içi biçim: +905071551151 → "0507 155 11 51" (e-posta gövdesi için). */
export function formatPhoneTR(e164: string): string {
  const m = e164.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
