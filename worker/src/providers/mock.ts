import type { MailMessage, MailProvider, MailResult } from './types';

/**
 * Sahte sağlayıcı: hiçbir yere göndermez, yalnızca konuyu loglar. Çağıran taraf
 * `delivered:false` döndürür; ön yüz bunu başarı olarak GÖSTERMEZ.
 */
export const mockProvider: MailProvider = {
  name: 'mock',
  async send(m: MailMessage): Promise<MailResult> {
    // Gövde kişisel veri içerdiği için loglanmaz; yalnızca konu ve uzunluk.
    console.log(`[mail:mock] "${m.subject}" → ${m.to} (${m.text.length} karakter, gönderilmedi)`);
    return { ok: true, provider: 'mock', id: 'mock' };
  },
};
