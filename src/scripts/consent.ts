/**
 * Çerez/izin yöneticisi. Kategoriler: necessary (her zaman), analytics, marketing.
 * Karar localStorage'da tutulur; değişiklikte 'ayaz:consent' olayı yayılır ve
 * Google Consent Mode v2 güncellenir. Hiçbir isteğe bağlı script izin olmadan yüklenmez.
 */
export interface ConsentState {
  v: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}
const KEY = 'ayaz.consent.v1';
const EVT = 'ayaz:consent';
let memoryConsent: ConsentState | null = null;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function getConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memoryConsent;
    const s = JSON.parse(raw) as ConsentState;
    return s && s.v === 1 && s.necessary === true && typeof s.analytics === 'boolean' && typeof s.marketing === 'boolean' && Number.isFinite(s.ts) && s.ts <= Date.now() && Date.now() - s.ts < MAX_AGE_MS ? s : null;
  } catch {
    return memoryConsent;
  }
}

export function setConsent(analytics: boolean, marketing: boolean): ConsentState {
  const s: ConsentState = { v: 1, necessary: true, analytics, marketing, ts: Date.now() };
  memoryConsent = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* özel pencere vb. */
  }
  applyGoogleConsent(s);
  window.dispatchEvent(new CustomEvent<ConsentState>(EVT, { detail: s }));
  return s;
}

export function onConsent(cb: (s: ConsentState) => void): void {
  window.addEventListener(EVT, (e) => cb((e as CustomEvent<ConsentState>).detail));
}

function applyGoogleConsent(s: ConsentState) {
  window.gtag?.('consent', 'update', {
    analytics_storage: s.analytics ? 'granted' : 'denied',
    ad_storage: s.marketing ? 'granted' : 'denied',
    ad_user_data: s.marketing ? 'granted' : 'denied',
    ad_personalization: 'denied', // sağlık bağlamında kişiselleştirme her zaman kapalı
  });
}

export function initConsent(): void {
  const root = document.querySelector<HTMLElement>('[data-consent]');
  if (!root) return;
  const cats = root.querySelector<HTMLElement>('[data-consent-cats]');
  const btnAccept = root.querySelector<HTMLButtonElement>('[data-consent-accept]');
  const btnReject = root.querySelector<HTMLButtonElement>('[data-consent-reject]');
  const btnManage = root.querySelector<HTMLButtonElement>('[data-consent-manage]');
  const btnSave = root.querySelector<HTMLButtonElement>('[data-consent-save]');
  const cbA = root.querySelector<HTMLInputElement>('[data-consent-cat="analytics"]');
  const cbM = root.querySelector<HTMLInputElement>('[data-consent-cat="marketing"]');

  const existing = getConsent();
  if (existing) applyGoogleConsent(existing);

  const show = (manage = false) => {
    const cur = getConsent();
    if (cbA) cbA.checked = cur?.analytics ?? false;
    if (cbM) cbM.checked = cur?.marketing ?? false;
    setManage(manage);
    root.hidden = false;
    (manage ? cbA : btnAccept)?.focus({ preventScroll: true });
  };
  const hide = () => {
    root.hidden = true;
  };
  const setManage = (on: boolean) => {
    if (cats) cats.hidden = !on;
    if (btnSave) btnSave.hidden = !on;
    if (btnManage) {
      btnManage.hidden = on;
      btnManage.setAttribute('aria-expanded', String(on));
    }
  };

  btnAccept?.addEventListener('click', () => {
    setConsent(true, true);
    hide();
  });
  btnReject?.addEventListener('click', () => {
    setConsent(false, false);
    hide();
  });
  btnManage?.addEventListener('click', () => setManage(true));
  btnSave?.addEventListener('click', () => {
    setConsent(!!cbA?.checked, !!cbM?.checked);
    hide();
  });
  document.querySelectorAll<HTMLElement>('[data-consent-open]').forEach((b) => b.addEventListener('click', () => show(true)));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && getConsent()) hide();
  });

  if (!existing) {
    // İlk ziyaret: içerik görünür olduktan kısa süre sonra göster
    window.setTimeout(() => show(false), 600);
  }
}
