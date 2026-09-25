/** Harita yalnızca kullanıcı isteyince yüklenir (Google iframe → üçüncü taraf çerezleri). */
export function initMap(): void {
  const map = document.querySelector<HTMLElement>('[data-map]');
  const btn = map?.querySelector<HTMLButtonElement>('[data-map-load]');
  if (!map || !btn) return;
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = map.dataset.src || '';
    iframe.title = 'Google Maps';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    map.querySelector('[data-map-placeholder]')?.remove();
    map.appendChild(iframe);
  });
}
