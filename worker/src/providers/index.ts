import type { Env, MailProviderName } from '../env';
import { brevoProvider } from './brevo';
import { mockProvider } from './mock';
import { resendProvider } from './resend';
import type { MailProvider } from './types';

export type { MailMessage, MailProvider, MailResult } from './types';

/**
 * MAIL_PROVIDER + mevcut anahtarlara göre sağlayıcı seçer.
 *  - "resend"/"brevo" seçili ama anahtarı yoksa: uyarır ve mock'a düşer (500 yerine dürüst delivered:false).
 *  - MAIL_PROVIDER boşsa: anahtarı olan ilk sağlayıcı (resend → brevo), yoksa mock.
 */
export function selectMailProvider(env: Pick<Env, 'MAIL_PROVIDER' | 'RESEND_API_KEY' | 'BREVO_API_KEY'>): MailProvider {
  const wanted = (env.MAIL_PROVIDER ?? '').trim().toLowerCase() as MailProviderName | '';

  switch (wanted) {
    case 'resend':
      if (env.RESEND_API_KEY) return resendProvider(env.RESEND_API_KEY);
      console.warn('[mail] MAIL_PROVIDER=resend ama RESEND_API_KEY yok; mock kullanılıyor');
      return mockProvider;
    case 'brevo':
      if (env.BREVO_API_KEY) return brevoProvider(env.BREVO_API_KEY);
      console.warn('[mail] MAIL_PROVIDER=brevo ama BREVO_API_KEY yok; mock kullanılıyor');
      return mockProvider;
    case 'mock':
      return mockProvider;
    default:
      if (wanted) console.warn(`[mail] bilinmeyen MAIL_PROVIDER "${wanted}"`);
      if (env.RESEND_API_KEY) return resendProvider(env.RESEND_API_KEY);
      if (env.BREVO_API_KEY) return brevoProvider(env.BREVO_API_KEY);
      return mockProvider;
  }
}
