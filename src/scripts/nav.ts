export function initNav(): void {
  const legacyAnchors: Record<string, string> = { home: 'ana', about: 'merkezimiz', services: 'hizmetler', products: 'cihazlar', gallery: 'merkezimiz', blog: 'sss', faq: 'sss', contact: 'iletisim' };
  const followLegacyAnchor = () => {
    const target = legacyAnchors[location.hash.slice(1)];
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'instant' });
  };
  followLegacyAnchor();
  window.addEventListener('hashchange', followLegacyAnchor);
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (header) {
    const setH = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    setH();
    window.addEventListener('resize', setH, { passive: true });
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Aktif bölüm vurgusu
  // Yalnız sayfa içi (#…) bağlantılar; gizlilik/404'te bağlantılar '/#…' olur ve bölüm yoktur
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')).filter((a) => (a.getAttribute('href') || '').startsWith('#'));
  const sections = links
    .map((a) => document.querySelector<HTMLElement>(a.getAttribute('href') || ''))
    .filter((s): s is HTMLElement => !!s);
  if (sections.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) {
          // Bant içinde bölüm kalmadıysa (ör. sayfa başı) vurguyu kaldır
          const leaving = entries.map((e) => `#${e.target.id}`);
          links.forEach((a) => {
            if (leaving.includes(a.getAttribute('href') || '')) a.removeAttribute('aria-current');
          });
          return;
        }
        links.forEach((a) => {
          const on = a.getAttribute('href') === `#${visible.target.id}`;
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((s) => io.observe(s));
  }

  // Mobil menü
  const dlg = document.getElementById('mobileMenu') as HTMLDialogElement | null;
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (dlg && openBtn && typeof dlg.showModal === 'function') {
    const open = () => {
      dlg.showModal();
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('has-dialog');
    };
    const close = () => {
      if (dlg.open) dlg.close();
    };
    openBtn.addEventListener('click', open);
    dlg.addEventListener('close', () => {
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('has-dialog');
    });
    dlg.querySelectorAll('[data-menu-close], [data-menu-link]').forEach((el) => el.addEventListener('click', close));
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close();
    });
  }
}
