export function initLightbox(): void {
  const gallery = document.querySelector<HTMLElement>('[data-gallery]');
  const dlg = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (!gallery || !dlg || typeof dlg.showModal !== 'function') return;
  const img = dlg.querySelector<HTMLImageElement>('[data-lb-img]')!;
  const cap = dlg.querySelector<HTMLElement>('[data-lb-cap]')!;
  const items = Array.from(gallery.querySelectorAll<HTMLButtonElement>('.gal__btn'));
  let idx = 0;
  let opener: HTMLElement | null = null;

  const show = (i: number) => {
    idx = (i + items.length) % items.length;
    const b = items[idx]!;
    img.src = b.dataset.full || '';
    img.alt = b.dataset.alt || '';
    cap.textContent = b.dataset.caption || '';
    // Komşuları önden yükle
    [idx + 1, idx - 1].forEach((j) => {
      const src = items[(j + items.length) % items.length]?.dataset.full;
      if (src) new Image().src = src;
    });
  };
  items.forEach((b, i) =>
    b.addEventListener('click', () => {
      opener = b;
      show(i);
      dlg.showModal();
      document.body.classList.add('has-dialog');
    }),
  );
  dlg.querySelector('[data-lb-close]')?.addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-lb-prev]')?.addEventListener('click', () => show(idx - 1));
  dlg.querySelector('[data-lb-next]')?.addEventListener('click', () => show(idx + 1));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  });
  dlg.addEventListener('close', () => {
    img.src = '';
    document.body.classList.remove('has-dialog');
    opener?.focus();
  });
}
