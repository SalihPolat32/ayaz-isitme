/**
 * POST /api/appointment — randevu talebini doğrular, kötüye kullanımı eler ve işletmeye iletir.
 * Yanıtlar asla gönderilen kişisel veriyi geri yansıtmaz; loglarda telefon maskelenir.
 */
import { allowedHostnames } from './cors';
import type { Env } from './env';
import { clientIp, escapeHtml, fail, json, pageUrlFrom, readJson } from './http';
import { selectMailProvider, type MailMessage, type MailResult } from './providers';
import { sendTelegram } from './providers/telegram';
import { APPOINTMENT_RATE_LIMIT, checkRateLimit } from './ratelimit';
import { verifyTurnstile } from './turnstile';
import {
  checkTimeTrap,
  formatPhoneTR,
  isHoneypotTriggered,
  maskPhone,
  validateAppointment,
  type AppointmentData,
  type AppointmentInput,
} from './validate';

export const SUBJECT = 'Yeni randevu talebi — keciorenisitme.com';
const DEFAULT_FROM = 'Ayaz Isitme Randevu <randevu@keciorenisitme.com>';
const DEFAULT_TO = 'ayazisitmecihazlari@gmail.com';

export interface NotificationMeta {
  pageUrl: string;
  receivedAt: Date;
  country: string;
}

const istanbulFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatIstanbul(date: Date): string {
  return `${istanbulFormatter.format(date)} (Europe/Istanbul)`;
}

/** Düz metin + basit HTML bildirim gövdesi. */
export function buildNotification(data: AppointmentData, meta: NotificationMeta): { subject: string; text: string; html: string } {
  const rows: Array<[string, string]> = [
    ['Ad Soyad', data.name],
    ['Telefon', `${formatPhoneTR(data.phone)} (${data.phone})`],
    ['Tercih edilen zaman', data.time ?? '-'],
    ['Konu', data.topic ?? '-'],
    ['Dil', data.locale],
    ['Alınma zamanı', formatIstanbul(meta.receivedAt)],
    ['Sayfa', meta.pageUrl],
    ['Ülke', meta.country],
  ];

  const text = [SUBJECT, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', 'Bu ileti keciorenisitme.com randevu formundan otomatik oluşturuldu.'].join('\n');

  const tel = `tel:${data.phone}`;
  const html = [
    '<!doctype html><html lang="tr"><body style="font:15px/1.5 system-ui,sans-serif;color:#111">',
    `<h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(SUBJECT)}</h2>`,
    '<table cellpadding="6" style="border-collapse:collapse">',
    ...rows.map(([k, v]) => {
      const value = k === 'Telefon' ? `<a href="${escapeHtml(tel)}">${escapeHtml(v)}</a>` : escapeHtml(v);
      return `<tr><td style="color:#555;padding-right:16px;white-space:nowrap">${escapeHtml(k)}</td><td>${value}</td></tr>`;
    }),
    '</table>',
    '<p style="color:#777;font-size:12px;margin-top:16px">Bu ileti keciorenisitme.com randevu formundan otomatik oluşturuldu.</p>',
    '</body></html>',
  ].join('');

  return { subject: SUBJECT, text, html };
}

export async function handleAppointment(request: Request, env: Env, allowedOrigins: ReadonlySet<string>): Promise<Response> {
  const ip = clientIp(request);

  // 1) Hız sınırı (IP başına)
  const rate = await checkRateLimit({ limiter: env.APPT_LIMITER, kv: env.RATE_KV }, `appt:${ip}`, APPOINTMENT_RATE_LIMIT);
  if (!rate.allowed) return fail(429, 'rate_limited', {}, { 'Retry-After': '60' });

  // 2) Gövde
  const body = await readJson<AppointmentInput>(request);
  if (!body.ok) return fail(400, 'bad_request', { reason: body.reason });
  const input = body.value !== null && typeof body.value === 'object' ? body.value : {};

  // 3) Honeypot: sessizce kabul et (bot bir şey öğrenmesin), ama teslim edilmedi de.
  if (isHoneypotTriggered(input.website)) {
    console.log('[appointment] honeypot tetiklendi');
    return json({ ok: true, delivered: false, provider: 'none' });
  }

  // 4) Zaman tuzağı
  const trap = checkTimeTrap(input.t);
  if (trap === 'too_fast') return fail(400, 'too_fast');
  if (trap === 'invalid') return fail(400, 'bad_request', { reason: 'timestamp' });

  // 5) Alan doğrulaması (Turnstile'dan önce: token tek kullanımlık, form hatasında boşa harcanmasın)
  const validated = validateAppointment(input);
  if (!validated.ok) return fail(400, 'validation', { fields: validated.fields });
  const data = validated.data;

  // 6) Turnstile (TURNSTILE_SECRET_KEY tanımlıysa)
  const turnstile = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET_KEY,
    token: input.turnstileToken,
    remoteIp: ip,
    allowedHostnames: allowedHostnames(allowedOrigins),
  });
  if (turnstile.status === 'failed') return fail(403, 'turnstile', { codes: turnstile.codes });
  if (turnstile.status === 'unavailable') return fail(503, 'turnstile_unavailable', {}, { 'Retry-After': '30' });

  // 7) Bildirim
  const meta: NotificationMeta = {
    pageUrl: pageUrlFrom(request.headers.get('Referer'), request.headers.get('Origin')),
    receivedAt: new Date(),
    country: request.headers.get('CF-IPCountry') ?? '-',
  };
  const notification = buildNotification(data, meta);
  const message: MailMessage = {
    from: env.MAIL_FROM || DEFAULT_FROM,
    to: env.MAIL_TO || DEFAULT_TO,
    ...notification,
  };

  const provider = selectMailProvider(env);
  const [mailSettled, telegramSettled] = await Promise.allSettled([
    provider.send(message),
    sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, notification.text),
  ]);

  const mail: MailResult =
    mailSettled.status === 'fulfilled'
      ? mailSettled.value
      : { ok: false, provider: provider.name, error: mailSettled.reason instanceof Error ? mailSettled.reason.message : 'send_failed' };
  const mailDelivered = mail.ok && mail.provider !== 'mock';
  const telegramDelivered = telegramSettled.status === 'fulfilled' && telegramSettled.value === true;
  const delivered = mailDelivered || telegramDelivered;

  console.log(
    `[appointment] mail=${mail.provider}:${mail.ok ? 'ok' : 'fail'} telegram=${telegramDelivered ? 'ok' : 'off/fail'} ` +
      `phone=${maskPhone(data.phone)} country=${meta.country} turnstile=${turnstile.status} ratelimit=${rate.source}` +
      (mail.error ? ` error="${mail.error}"` : ''),
  );

  // Gerçek bir sağlayıcı denendi ve hiçbir kanal ulaşamadıysa: hata (kullanıcı WhatsApp'a yönlendirilsin).
  if (!delivered && provider.name !== 'mock') return fail(502, 'delivery_failed');

  return json({
    ok: true,
    delivered,
    provider: mailDelivered ? mail.provider : telegramDelivered ? 'telegram' : mail.provider,
    telegram: telegramDelivered,
  });
}
