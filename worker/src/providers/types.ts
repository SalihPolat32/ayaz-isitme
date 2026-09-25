import type { MailProviderName } from '../env';

export interface MailMessage {
  /** "Ad <adres@alan>" — sağlayıcıda doğrulanmış alan adı olmalı. */
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  ok: boolean;
  provider: MailProviderName;
  /** Sağlayıcının mesaj kimliği (loglama için). */
  id?: string;
  /** Kısa hata özeti; kişisel veri içermez. */
  error?: string;
}

export interface MailProvider {
  readonly name: MailProviderName;
  send(message: MailMessage): Promise<MailResult>;
}

export const PROVIDER_TIMEOUT_MS = 10_000;

/** "Ad <adres>" → { name, email }. Brevo yapısal gönderici ister. */
export function parseAddress(value: string): { email: string; name?: string } {
  const m = value.trim().match(/^(.*?)\s*<([^>]+)>$/);
  if (!m) return { email: value.trim() };
  const name = (m[1] ?? '').replace(/^"|"$/g, '').trim();
  const email = (m[2] ?? '').trim();
  return name ? { email, name } : { email };
}

/** Sağlayıcı hata gövdesinden yalnızca kısa, kişisel veri içermeyen bir özet çıkarır. */
export async function summarizeError(res: Response, pick: (body: Record<string, unknown>) => string): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as Record<string, unknown>;
    detail = pick(body);
  } catch {
    /* gövde JSON değil */
  }
  return `${res.status}${detail ? ` ${detail}` : ''}`.slice(0, 200);
}
