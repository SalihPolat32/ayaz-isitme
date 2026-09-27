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

  const noticeOnly = root.dataset.consentMode === 'notice';
  /** Panel kapanınca odağın döneceği öğe (açan düğme ya da panele girmeden önceki öğe) */
  let returnTo: HTMLElement | null = null;
  root.addEventListener('focusin', (e) => {
    const from = e.relatedTarget as HTMLElement | null;
    if (from && !root.contains(from)) returnTo = from;
  });
  // Görünürken sabit panel odaklanan öğeyi örtmesin (WCAG 2.4.11): panelin kapladığı alt bant kadar kaydırma payı ve
  // sayfa sonunda aynı kadar boşluk (en alttaki bağlantılar da panelin üstüne kaydırılabilsin). Yükseklik geometriden ölçülür,
  // panel büyüyüp küçülünce (tercihler açılınca, yeniden boyutlama, font) ResizeObserver ile güncellenir.
  const setPad = (on: boolean) => {
    const box = root.firstElementChild?.getBoundingClientRect();
    const h = on && box ? Math.max(0, Math.ceil(window.innerHeight - box.top + 8)) : 0;
    document.documentElement.style.setProperty('--consent-h', `${h}px`);
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => !root.hidden && setPad(true)) : null;
  const onDocKey = (e: KeyboardEvent) => {
    // Panel görünürken Escape, odak neredeyse orada çalışır (klavye kullanıcısı panele ulaşmak için sayfayı dolaşmasın)
    if (e.key !== 'Escape' || root.hidden) return;
    // Açık bir iletişim kutusu (mobil menü, fotoğraf büyütme) varsa Escape önce onu kapatsın
    if (document.querySelector('dialog[open]')) return;
    if (!getConsent()) setConsent(false, false);
    hide();
  };
  const show = (manage = false) => {
    const cur = getConsent();
    if (cbA) cbA.checked = cur?.analytics ?? false;
    if (cbM) cbM.checked = cur?.marketing ?? false;
    setManage(manage);
    root.hidden = false;
    setPad(true);
    ro?.observe(root);
    document.addEventListener('keydown', onDocKey);
    // Kullanıcı açtıysa ilk denetime odaklanılır. İlk ziyarette yalnız bilgilendirme (isteğe bağlı hizmet yok) varsa
    // odak çalınmaz; izin gerektiren modda karar düğmesine gidilir.
    if (manage) {
      returnTo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      (cbA ?? cbM ?? btnSave ?? btnReject)?.focus({ preventScroll: true });
    } else if (!noticeOnly && document.activeElement === document.body) {
      // İzin gerektiren modda karar düğmesine gidilir; kullanıcı o sırada bir öğeye odaklanmışsa odak çalınmaz
      returnTo = null;
      (btnAccept ?? btnReject)?.focus({ preventScroll: true });
    }
  };
  const hide = () => {
    const hadFocus = root.contains(document.activeElement);
    root.hidden = true;
    setPad(false);
    ro?.disconnect();
    document.removeEventListener('keydown', onDocKey);
    if (hadFocus) {
      const target = returnTo && document.contains(returnTo) ? returnTo : document.getElementById('icerik');
      target?.focus({ preventScroll: true });
    }
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
    // Yalnızca panelde gösterilen (bu derlemede kimliği tanımlı) kategoriler için izin kaydedilir
    setConsent(!!cbA, !!cbM);
    hide();
  });
  btnReject?.addEventListener('click', () => {
    setConsent(false, false);
    hide();
  });
  btnManage?.addEventListener('click', () => {
    setManage(true);
    setPad(true);
    // Tıklanan "Tercihleri yönet" gizlenir: odak ilk kategoriye taşınır (body'ye düşmesin)
    (cbA ?? cbM ?? btnSave)?.focus({ preventScroll: true });
  });
  btnSave?.addEventListener('click', () => {
    setConsent(!!cbA?.checked, !!cbM?.checked);
    hide();
  });
  document.querySelectorAll<HTMLElement>('[data-consent-open]').forEach((b) => b.addEventListener('click', () => show(true)));
  // Escape (panel görünürken belge düzeyinde, onDocKey): karar varsa yalnız kapatır; ilk ziyarette "isteğe bağlı izin yok"
  // olarak kaydedip kapatır (en gizlilik dostu seçenek).

  if (!existing) {
    // İlk ziyaret: içerik görünür olduktan kısa süre sonra göster
    window.setTimeout(() => show(false), 600);
  }
}
