/** Türkiye telefon numarasını E.164'e çevirir; geçersizse null. Sabit hat (2xx–4xx) ve GSM (5xx) kabul edilir. */
export function normalizeTrPhone(raw: string): string | null {
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
export function isValidName(v: string): boolean {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 80 && /^[\p{L}\p{M}\s'’\-.]+$/u.test(s) && (s.match(/\p{L}/gu)?.length ?? 0) >= 2;
}
