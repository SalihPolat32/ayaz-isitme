import { PROVIDER_TIMEOUT_MS } from './types';

/**
 * Telegram Bot API sendMessage — ücretsiz ikinci kanal. parse_mode kullanılmaz
 * (kaçış kuralı gerekmez); metin 4096 karakterle sınırlıdır.
 */
export async function sendTelegram(
  token: string | undefined,
  chatId: string | undefined,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[telegram] sendMessage HTTP', res.status);
      return false;
    }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return body.ok === true;
  } catch (e) {
    console.error('[telegram] erişilemedi', e instanceof Error ? e.message : e);
    return false;
  }
}
