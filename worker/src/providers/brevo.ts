import type { MailMessage, MailProvider, MailResult } from './types';
import { PROVIDER_TIMEOUT_MS, parseAddress, summarizeError } from './types';

/**
 * Brevo — POST https://api.brevo.com/v3/smtp/email (api-key başlığı). 201 → { messageId }.
 * Gönderici Brevo'da doğrulanmış olmalı; gmail.com gibi adresler kimliklendirilemez.
 */
export function brevoProvider(apiKey: string, fetchImpl: typeof fetch = fetch): MailProvider {
  return {
    name: 'brevo',
    async send(m: MailMessage): Promise<MailResult> {
      const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: parseAddress(m.from),
          to: [parseAddress(m.to)],
          subject: m.subject,
          textContent: m.text,
          htmlContent: m.html,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { messageId?: string };
        return { ok: true, provider: 'brevo', id: body.messageId };
      }
      const error = await summarizeError(res, (b) => [b.code, b.message].filter((x) => typeof x === 'string').join(' '));
      return { ok: false, provider: 'brevo', error };
    },
  };
}
