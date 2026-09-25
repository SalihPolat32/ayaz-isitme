import type { MailMessage, MailProvider, MailResult } from './types';
import { PROVIDER_TIMEOUT_MS, summarizeError } from './types';

/**
 * Resend — POST https://api.resend.com/emails (Bearer). Free: 3.000/ay, 100/gün.
 * `from` alanı Resend'de doğrulanmış bir alan adında olmalı.
 */
export function resendProvider(apiKey: string, fetchImpl: typeof fetch = fetch): MailProvider {
  return {
    name: 'resend',
    async send(m: MailMessage): Promise<MailResult> {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, provider: 'resend', id: body.id };
      }
      const error = await summarizeError(res, (b) => [b.name, b.message].filter((x) => typeof x === 'string').join(' '));
      return { ok: false, provider: 'resend', error };
    },
  };
}
