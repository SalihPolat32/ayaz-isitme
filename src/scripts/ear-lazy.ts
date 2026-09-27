/**
 * Kulak illüstrasyonu katmanları (EarView.astro) için tembel yükleme.
 * SVG <image> öğeleri tarayıcıda `loading="lazy"` desteklemez ve gizli sekmelerde bile iner; sayfa açılışında
 * hero görseliyle bant genişliği yarıştırmamak için adresler `data-href` olarak gelir ve cihaz türleri bölümü
 * görüş alanına ≈ 800 px kala (ya da bir sekmeye tıklanınca / odaklanınca) `href`'e taşınır.
 */
export function initEarLazy(): void {
  const images = Array.from(document.querySelectorAll<SVGImageElement>('svg.earview image[data-href]'));
  if (!images.length) return;
  let done = false;
  const load = () => {
    if (done) return;
    done = true;
    for (const img of images) {
      const href = img.getAttribute('data-href');
      if (href) img.setAttribute('href', href);
      img.removeAttribute('data-href');
    }
  };
  const section = images[0]!.closest('section') ?? document.body;
  section.addEventListener('pointerdown', load, { once: true, passive: true });
  section.addEventListener('focusin', load, { once: true });
  if (!('IntersectionObserver' in window)) return load();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        load();
      }
    },
    { rootMargin: '800px 0px' },
  );
  io.observe(section);
}
