/**
 * Google yorumları bölümü.
 *  - Statik seçki (src/content/reviews.ts) sunucuda HTML'e yazılır; burada yalnızca kaydırıcı çalışır.
 *  - PUBLIC_API_BASE varsa Worker üzerinden Places API (New) yorumları çekilir; statik listede OLMAYAN canlı yorumlar başa eklenir.
 *    Eleme (bkz. scripts/lib/review-fingerprint.mjs, INTEGRATIONS.md §5) kayıt başınadır ve iki listede aynı kuraldır:
 *    aynı kayıtla metin parmak izi (TR/EN, boşluk/emoji/noktalama duyarsız) + uzun metinde kelime benzerliği ≥ 0,6 ya da
 *    kısa metinde aynı kısa ad + ay; Worker verdiyse aynı yorum kimliği; ya da aynı kısa ad + ay + benzerlik ≥ 0,35.
 *    Önce seçkide çıkarılanların koruma kayıtları ([data-reviews-guard]; yalnızca özetler) → 'blocked', sonra statik
 *    kartlar → tekrar. Kısa ad + ay TEK BAŞINA, 40 karakterlik açılış TEK BAŞINA hiçbir yorumu elemez.
 *  - 'link' modunda bölümde [data-reviews] yoktur → kaydırıcı da API çağrısı da başlamaz.
 *  - Sahte veri üretilmez; API hata verirse statik seçki kalır.
 */
import type { RuntimeConfig } from './config';
import { prefersReducedMotion } from './config';
import { buildIndex, selectFreshReviews, type ReviewIndex } from '../../scripts/lib/review-fingerprint.mjs';

interface ReviewDto {
  /** Google yorum kimliği (Review.name son parçası; eski Worker sürümlerinde yok) */
  id?: string;
  author: string;
  authorUri?: string;
  authorPhoto?: string;
  rating: number;
  text: string;
  relativeTime?: string;
  publishTime?: string;
  reviewUri?: string;
  translated?: boolean;
}
interface ReviewsDto {
  ok: boolean;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: ReviewDto[];
}

const STAR = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const stars = (n: number) => STAR.repeat(Math.max(0, Math.min(5, Math.round(n))));
/** "Ad S." (src/content/reviews.ts > shortName ile aynı kural; veri dosyasını istemci paketine çekmemek için burada). */
const shortAuthor = (full: string): string => {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toLocaleUpperCase('tr-TR')}.`;
};
const safeHttps = (value?: string): string | null => {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

/** Erişilebilir, otomatik kayan yatay kaydırıcı (scroll-snap tabanlı). */
function initCarousel(root: HTMLElement, track: HTMLElement, locale: 'tr' | 'en') {
  const prev = root.querySelector<HTMLButtonElement>('[data-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  const play = root.querySelector<HTMLButtonElement>('[data-play]');
  const dots = root.querySelector<HTMLElement>('[data-dots]');
  const reduced = prefersReducedMotion();
  let timer: number | null = null;
  let playing = !reduced;
  /** Hareket azaltma tercihine rağmen kullanıcı otomatik kaydırmayı kendisi başlattıysa (kullanıcı durdurunca sıfırlanır) */
  let userStarted = false;
  let hovered = false;

  const cards = () => Array.from(track.children) as HTMLElement[];
  const step = () => {
    const first = cards()[0];
    return first ? first.getBoundingClientRect().width + 16 : track.clientWidth;
  };
  /** Görünür kart sayısı ve sayfa hesabı kart adımına göre (aralık payı dahil) */
  const perView = () => Math.max(1, Math.round((track.clientWidth + 16) / Math.max(1, step())));
  const pageCount = () => Math.max(1, Math.ceil(cards().length / perView()));
  const pageIndex = () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) return pageCount() - 1;
    return Math.min(pageCount() - 1, Math.round(track.scrollLeft / Math.max(1, step() * perView())));
  };

  const progress = root.querySelector<HTMLElement>('[data-progress]');
  const progressText = root.querySelector<HTMLElement>('[data-progress-text]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const MAX_DOTS = 8;
  const renderProgress = () => {
    const n = pageCount();
    const i = Math.min(n, pageIndex() + 1);
    if (progressText) progressText.textContent = locale === 'tr' ? `${i} / ${n}` : `${i} of ${n}`;
    if (progressBar) progressBar.style.width = `${(i / n) * 100}%`;
  };
  const renderDots = () => {
    if (!dots) return;
    const n = pageCount();
    const many = n > MAX_DOTS;
    dots.hidden = many;
    if (progress) progress.hidden = !many;
    if (many) {
      dots.replaceChildren();
      renderProgress();
      return;
    }
    dots.replaceChildren(
      ...Array.from({ length: n }, (_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `${locale === 'tr' ? 'Sayfa' : 'Page'} ${i + 1} / ${n}`);
        if (i === pageIndex()) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => {
          track.scrollTo({ left: i * step() * perView(), behavior: reduced ? 'auto' : 'smooth' });
          pause(true);
        });
        return b;
      }),
    );
  };
  const syncDots = () => {
    if (progress && !progress.hidden) renderProgress();
    const cur = pageIndex();
    dots?.querySelectorAll('button').forEach((b, i) => {
      if (i === cur) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  };

  /** Önceki/sonraki ve otomatik kaydırma bir SAYFA ilerler (masaüstünde 3, mobilde 1 kart) → sayaç her adımda değişir. */
  const advance = () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) track.scrollTo({ left: 0, behavior: 'smooth' });
    else track.scrollBy({ left: step() * perView(), behavior: 'smooth' });
  };
  // Otomatik kaydırırken sayaç okunmaz (her 5 sn'de "2 / 18" duyurusu olmasın); durunca/elle gezinmede duyurulur
  const setLive = (on: boolean) => progressText?.setAttribute('aria-live', on ? 'polite' : 'off');
  const start = () => {
    // Odak kaydırıcıya girince playing=false olur (bkz. focusin): sekmeye dönüş, bölümün yeniden görünmesi ya da
    // imlecin ayrılması kaydırmayı yeniden başlatmaz; yalnızca "başlat" düğmesi başlatır
    if (timer || (reduced && !userStarted) || !playing || hovered || document.hidden) return;
    timer = window.setInterval(advance, 5000);
    setLive(false);
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
    setLive(true);
  };
  // Etiket eylemi söyler ("durdur" / "başlat"); ayrıca aria-pressed kullanılmaz (durum iki kez, çelişkili okunmasın)
  const setPlayUi = () => {
    // Durum değişmediyse düğmenin içi yenilenmez: basılı tutulan ikon silinirse tarayıcı tıklamayı yutar
    if (!play || play.dataset.shown === String(playing)) return;
    play.dataset.shown = String(playing);
    play.setAttribute('aria-label', playing ? play.dataset.labelPause || '' : play.dataset.labelPlay || '');
    play.innerHTML = playing
      ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  };
  const pause = (user = false) => {
    if (user) {
      playing = false;
      userStarted = false;
    }
    stop();
    setPlayUi();
  };
  /** Odak Tab ile mi geliyor? Sıralı odak geçişi, Tab'ın keydown varsayılan eylemi olarak aynı görevde olur. */
  let tabNav = false;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    tabNav = true;
    window.setTimeout(() => (tabNav = false));
  }, true);

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: -step() * perView(), behavior: reduced ? 'auto' : 'smooth' });
    pause(true);
  });
  next?.addEventListener('click', () => {
    track.scrollBy({ left: step() * perView(), behavior: reduced ? 'auto' : 'smooth' });
    pause(true);
  });
  play?.addEventListener('click', () => {
    playing = !playing;
    userStarted = playing;
    if (playing) start();
    else stop();
    setPlayUi();
  });
  root.addEventListener('pointerenter', () => {
    hovered = true;
    stop();
  });
  root.addEventListener('pointerleave', () => {
    hovered = false;
    start();
  });
  // WAI-ARIA APG: odak kaydırıcıya (kart şeridi, önceki/sonraki, sayfa noktaları) gelince otomatik kaydırma durur ve düğme
  // "başlat" olur; önceki başlatma izni silinir. Odak çıkışı, sekmeye dönüş ya da bölümün yeniden görünmesi başlatmaz; tek
  // "başlat" basışı başlatır. Bölümün kaydırıcı dışındaki bağlantıları sayılmaz. Başlat/durdur düğmesi yalnız Tab ile
  // odaklanınca durdurur: fare ya da ekran okuyucu basarken düğme önce odak alır (Chromium, Firefox) ve o odak durdursaydı
  // ardından gelen tıklama durumu geri çevirirdi. Sekmeye/pencereye dönünce aynı düğmeye yeniden gelen odak da durdurmaz.
  (root.querySelector<HTMLElement>('[data-carousel]') ?? root).addEventListener('focusin', (e) => {
    if (!(e.target instanceof Node && play?.contains(e.target)) || tabNav) pause(true);
  });
  track.addEventListener('pointerdown', () => pause(true), { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  let raf = 0;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncDots();
    });
  }, { passive: true });
  window.addEventListener('resize', renderDots, { passive: true });

  // Yalnızca görünürken otomatik kaydır
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => (en.some((e) => e.isIntersecting) ? start() : stop()), { threshold: 0.2 });
    io.observe(root);
  } else start();

  renderDots();
  setPlayUi();
  return { refresh: () => { renderDots(); track.scrollTo({ left: 0 }); } };
}

/**
 * Canlı yorum eşleştirme dizini: sayfadaki statik kartlar (data-fp parmak izleri + görünen metin ve data-alt-text, benzerlik için)
 * ve seçkide çıkarılan yorumların koruma kayıtları (data-reviews-guard; derlemede üretilir). Görünen kısa ad KULLANILMAZ.
 * Koruma listesi yoksa, JSON değilse ya da bir kaydı bozuksa hata fırlatır (parseGuard).
 */
export function reviewIndex(root: HTMLElement, track: HTMLElement): ReviewIndex {
  const cards = Array.from(track.children).map((el) => ({
    fp: (el.getAttribute('data-fp') || '').split(/\s+/).filter(Boolean),
    // görünen metin + (EN sayfasında) kartın özgün TR metni: kartın her t anahtarının metni benzerlik için elde olsun
    texts: [el.querySelector('[data-text]')?.textContent || '', el.getAttribute('data-alt-text') || ''].filter((t) => t.trim()),
  }));
  // Koruma listesi yoksa ya da bozuksa hata fırlatılır → çağıran canlı yorum EKLEMEZ (güvenli taraf).
  const guard = JSON.parse(root.querySelector('[data-reviews-guard]')?.textContent || 'null') as unknown;
  if (!Array.isArray(guard)) throw new Error('reviews guard missing');
  return buildIndex({ cards, guard });
}

export function initReviews(cfg: RuntimeConfig): void {
  const root = document.querySelector<HTMLElement>('[data-reviews]');
  if (!root) return;
  const track = root.querySelector<HTMLElement>('[data-list]');
  if (!track) return;
  const carousel = initCarousel(root, track, cfg.locale);
  if (!cfg.apiBase) return;

  const tpl = root.querySelector<HTMLTemplateElement>('[data-review-tpl]')!;
  const score = root.querySelector<HTMLElement>('[data-score]')!;
  const note = root.querySelector<HTMLElement>('[data-note]');
  const countLabel = (n: number) => (cfg.locale === 'tr' ? `${n} yorum` : `${n} reviews`);
  const slideLabel = cfg.locale === 'tr' ? 'Yorum' : 'Review';

  const fullNames = root.dataset.fullNames === 'true';
  const load = async () => {
    root.dataset.state = 'loading';
    try {
      // Eleme listesi çağrıdan ÖNCE hazırlanır; koruma listesi okunamazsa API hiç çağrılmaz.
      const index = reviewIndex(root, track);
      const res = await fetch(`${cfg.apiBase.replace(/\/$/, '')}/api/reviews?lang=${cfg.locale}`, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ReviewsDto;
      if (!data.ok || !Array.isArray(data.reviews) || data.reviews.length === 0) throw new Error('empty');

      // Statik liste (Takeout) korunur; Places API'nin döndürdüğü (en fazla 5) yorumdan yalnızca yeni olanlar başa eklenir.
      // Alan doğrulaması: metinsiz, puanı 1–5 dışında ya da yazar alanı metin olmayan kayıtlar atlanır (tek kötü kayıt tüm listeyi düşürmez).
      const valid = data.reviews.filter(
        (r): r is ReviewDto =>
          !!r && typeof r.text === 'string' && r.text.trim().length > 0 && typeof r.rating === 'number' && Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5 && (r.author === undefined || typeof r.author === 'string') &&
          (r.id === undefined || typeof r.id === 'string') && (r.publishTime === undefined || typeof r.publishTime === 'string'),
      );
      const list = selectFreshReviews(valid, index, 5);
      const nodes = list.map((r, i) => {
          const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
          node.setAttribute('aria-label', `${slideLabel} ${i + 1}`);
          const avatar = node.querySelector<HTMLElement>('[data-avatar]')!;
          if (safeHttps(r.authorPhoto)) {
            const img = document.createElement('img');
            img.src = safeHttps(r.authorPhoto)!;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            img.loading = 'lazy';
            img.width = 38;
            img.height = 38;
            avatar.replaceChildren(img);
          } else avatar.textContent = (r.author || '?').trim().charAt(0).toUpperCase();
          const a = node.querySelector<HTMLAnchorElement>('[data-author]')!;
          // Statik kartlarla aynı KVKK varsayılanı: kısa ad ("Ad S."), business.reviewsShowFullNames açıksa tam ad
          const name = (r.author || '').trim();
          a.textContent = name ? (fullNames ? name : shortAuthor(name)) : cfg.locale === 'tr' ? 'Google kullanıcısı' : 'Google user';
          if (safeHttps(r.authorUri)) a.href = safeHttps(r.authorUri)!;
          else a.removeAttribute('href');
          node.querySelector('[data-time]')!.textContent = r.relativeTime || '';
          const rating = node.querySelector('[data-stars]')!;
          rating.innerHTML = stars(Math.round(r.rating));
          rating.removeAttribute('aria-hidden');
          rating.setAttribute('role', 'img');
          const rv = Math.round(r.rating);
          rating.setAttribute('aria-label', cfg.locale === 'tr' ? `5 üzerinden ${rv}` : `${rv} out of 5`);
          node.querySelector('[data-text]')!.textContent = r.text || '';
          if (r.translated) {
            const t = document.createElement('p');
            t.className = 'small muted';
            t.textContent = cfg.locale === 'tr' ? 'Google tarafından çevrildi' : 'Translated by Google';
            node.querySelector('[data-text]')!.after(t);
          }
          const link = node.querySelector<HTMLAnchorElement>('[data-link]')!;
          if (safeHttps(r.reviewUri)) link.href = safeHttps(r.reviewUri)!;
          else if (safeHttps(data.googleMapsUri)) link.href = safeHttps(data.googleMapsUri)!;
          else link.removeAttribute('href');
          return node;
        });
      // Kartlar hatasız kurulduktan SONRA DOM ve puan kartı güncellenir (yarım güncelleme olmaz).
      track.prepend(...nodes);
      if (typeof data.rating === 'number' && Number.isFinite(data.rating) && data.rating >= 1 && data.rating <= 5) {
        score.querySelector('[data-rating]')!.textContent = data.rating.toFixed(1).replace('.', cfg.locale === 'tr' ? ',' : '.');
        score.querySelector('[data-stars]')!.innerHTML = stars(data.rating);
        score.querySelector('[data-count]')!.textContent = typeof data.userRatingCount === 'number' ? countLabel(data.userRatingCount) : '';
        const asof = score.querySelector('[data-asof]');
        if (asof) asof.textContent = cfg.locale === 'tr' ? 'Google · güncel' : 'Google · live';
        // Erişilebilir ad görünen metinden oluşur (ayrı aria-label yok): güncellenen değerler kendiliğinden okunur
        score.hidden = false;
      }
      // Kart etiketlerini yeni toplamla yeniden numarala ("Yorum 3 / 55")
      const all = Array.from(track.children);
      all.forEach((el, i) => el.setAttribute('aria-label', `${slideLabel} ${i + 1} / ${all.length}`));
      if (safeHttps(data.googleMapsUri)) root.querySelectorAll<HTMLAnchorElement>('[data-track="reviews_click"]').forEach((el) => (el.href = safeHttps(data.googleMapsUri)!));
      // Canlı not yalnızca gerçekten yeni yorum eklendiyse; hepsi tekrar/elenmişse görünen kartların tümü
      // işletmenin seçkisidir → statik seçki notu (selectionNote) aynen kalır.
      if (note) note.textContent = list.length > 0 ? note.dataset.apiNote || '' : note.dataset.staticNote || note.textContent || '';
      root.dataset.state = 'ready';
      carousel.refresh();
    } catch {
      root.dataset.state = 'static'; // statik seçki görünür kalır
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
