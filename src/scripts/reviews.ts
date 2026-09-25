/** Google yorumları: Worker üzerinden Places API (New). API yoksa yalnızca bağlantı kartı kalır; sahte veri üretilmez. */
import type { RuntimeConfig } from './config';

interface ReviewDto {
  author: string;
  authorUri?: string;
  authorPhoto?: string;
  rating: number;
  translated?: boolean;
  text: string;
  relativeTime?: string;
  publishTime?: string;
  reviewUri?: string;
}
interface ReviewsDto {
  ok: boolean;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: ReviewDto[];
}

const safeHttps = (value?: string): string | null => {
  try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
};

const STAR = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const stars = (n: number) => STAR.repeat(Math.max(0, Math.min(5, Math.round(n))));

export function initReviews(cfg: RuntimeConfig): void {
  const root = document.querySelector<HTMLElement>('[data-reviews]');
  if (!root || !cfg.apiBase) return;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const tpl = root.querySelector<HTMLTemplateElement>('[data-review-tpl]')!;
  const score = root.querySelector<HTMLElement>('[data-score]')!;
  const foot = root.querySelector<HTMLElement>('[data-foot]')!;
  const countLabel = (n: number) => (cfg.locale === 'tr' ? `${n} yorum` : `${n} reviews`);

  const load = async () => {
    root.dataset.state = 'loading';
    try {
      const res = await fetch(`${cfg.apiBase.replace(/\/$/, '')}/api/reviews?lang=${cfg.locale}`, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ReviewsDto;
      if (!data.ok || !Array.isArray(data.reviews) || data.reviews.length === 0) throw new Error('empty');

      if (typeof data.rating === 'number') {
        score.querySelector('[data-rating]')!.textContent = data.rating.toFixed(1).replace('.', cfg.locale === 'tr' ? ',' : '.');
        score.querySelector('[data-stars]')!.innerHTML = stars(data.rating);
        score.querySelector('[data-count]')!.textContent = typeof data.userRatingCount === 'number' ? countLabel(data.userRatingCount) : '';
        score.hidden = false;
      }
      list.replaceChildren(
        ...data.reviews.slice(0, 5).map((r) => {
          const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
          const avatar = node.querySelector<HTMLElement>('[data-avatar]')!;
          if (safeHttps(r.authorPhoto)) {
            const img = document.createElement('img');
            img.src = safeHttps(r.authorPhoto)!;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            img.loading = 'lazy';
            img.width = 42;
            img.height = 42;
            avatar.replaceChildren(img);
          } else avatar.textContent = (r.author || '?').trim().charAt(0).toUpperCase();
          const a = node.querySelector<HTMLAnchorElement>('[data-author]')!;
          a.textContent = r.author || (cfg.locale === 'tr' ? 'Google kullanıcısı' : 'Google user');
          if (safeHttps(r.authorUri)) a.href = safeHttps(r.authorUri)!;
          else a.removeAttribute('href');
          node.querySelector('[data-time]')!.textContent = r.relativeTime || '';
          const rating = node.querySelector('[data-stars]')!;
          rating.innerHTML = stars(r.rating);
          rating.removeAttribute('aria-hidden');
          rating.setAttribute('role', 'img');
          rating.setAttribute('aria-label', cfg.locale === 'tr' ? `5 üzerinden ${r.rating}` : `${r.rating} out of 5`);
          node.querySelector('[data-text]')!.textContent = r.text || '';
          if (r.translated) {
            const note = document.createElement('p');
            note.className = 'small muted';
            note.textContent = cfg.locale === 'tr' ? 'Google tarafından çevrildi' : 'Translated by Google';
            node.querySelector('[data-text]')!.after(note);
          }
          const link = node.querySelector<HTMLAnchorElement>('[data-link]')!;
          if (safeHttps(r.reviewUri)) link.href = safeHttps(r.reviewUri)!;
          else if (safeHttps(data.googleMapsUri)) link.href = safeHttps(data.googleMapsUri)!;
          else link.remove();
          return node;
        }),
      );
      if (safeHttps(data.googleMapsUri)) root.querySelectorAll<HTMLAnchorElement>('[data-track="reviews_click"]').forEach((el) => (el.href = safeHttps(data.googleMapsUri)!));
      foot.hidden = false;
      root.dataset.state = 'ready';
    } catch {
      root.dataset.state = 'idle'; // çevrimdışı kart görünür kalır
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (en) => {
        if (en.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(root);
  } else void load();
}
