/**
 * Ölçüm adaptörleri — hepsi kapatılabilir, hepsi izinle yüklenir.
 *  - GA4 + Google Ads: analytics izni → gtag.js yüklenir; marketing izni → Ads config eklenir.
 *  - Meta Pixel: marketing izni → fbq yüklenir (Limited Data Use açık, otomatik yapılandırma kapalı).
 *  - OpenAI (ChatGPT Ads): kimlik ve koşullar doğrulanmadan yüklenmez (bkz. INTEGRATIONS.md).
 * PII (ad, telefon, form içeriği) hiçbir adaptöre gönderilmez.
 */
import type { RuntimeConfig } from './config';
import { getConsent, onConsent, type ConsentState } from './consent';

declare global {
  interface Window {
    oaiq?: ((...args: unknown[]) => void) & { q?: unknown[] };
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void; push?: unknown };
    _fbq?: unknown;
  }
}

let cfg: RuntimeConfig;
let gaLoaded = false;
let adsConfigured = false;
let analyticsConfigured = false;
let appliedConsent: ConsentState | null = null;
let metaLoaded = false;
let openaiLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`script failed: ${src}`));
    document.head.appendChild(s);
  });
}

function loadGoogle(s: ConsentState) {
  const id = (s.analytics && cfg.ga4) || (s.marketing && cfg.gads);
  if (!id) return;
  if (!gaLoaded) {
    gaLoaded = true;
    void loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`).catch(() => {
      gaLoaded = false;
      analyticsConfigured = false;
      adsConfigured = false;
    });
    window.gtag?.('js', new Date());
  }
  if (s.analytics && cfg.ga4 && !analyticsConfigured) {
    analyticsConfigured = true;
    window.gtag?.('config', cfg.ga4, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Do not forward query parameters or form values in page metadata.
      page_location: `${location.origin}${location.pathname}`,
      page_referrer: safePageUrl(document.referrer),
    });
  }
  if (s.marketing && cfg.gads && !adsConfigured) {
    adsConfigured = true;
    window.gtag?.('config', cfg.gads, { allow_ad_personalization_signals: false });
  }
}

function safePageUrl(value: string): string {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return ''; }
}

function loadMeta(s: ConsentState) {
  if (!cfg.meta || !s.marketing) return;
  if (metaLoaded) { window.fbq?.('consent', 'grant'); return; }
  metaLoaded = true;
  // Resmî temel kod (function stub) — otomatik gelişmiş eşleştirme kullanılmaz.
  const w = window;
  if (!w.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue?.push(args);
    } as NonNullable<Window['fbq']>;
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    w.fbq = n;
    w._fbq = n;
    void loadScript('https://connect.facebook.net/en_US/fbevents.js').catch(() => { metaLoaded = false; });
  }
  w.fbq?.('consent', 'grant');
  w.fbq?.('dataProcessingOptions', ['LDU'], 0, 0);
  w.fbq?.('set', 'autoConfig', false, cfg.meta);
  w.fbq?.('init', cfg.meta);
  w.fbq?.('track', 'PageView');
}

/**
 * OpenAI (ChatGPT Ads) ölçüm pikseli — resmî yükleyici (learn.chatgpt.com/ads/measurement-pixel).
 * Koşul: hesap onayı + kategori uygunluğu (ABD dışı sağlık hizmetleri genellikle yasak). Kimlik boşsa hiç yüklenmez.
 */
function loadOpenAI(s: ConsentState) {
  if (!cfg.openai) return;
  if (!openaiLoaded) {
    if (!s.marketing) return;
    openaiLoaded = true;
    const w = window;
    if (!w.oaiq) {
      const q = function (...args: unknown[]) {
        q.q?.push(args);
      } as NonNullable<Window['oaiq']>;
      q.q = [];
      w.oaiq = q;
      void loadScript('https://bzrcdn.openai.com/sdk/oaiq.min.js').catch(() => { openaiLoaded = false; });
    }
    w.oaiq?.('consent', false); // belge: izin, init'ten ÖNCE ayarlanır
    w.oaiq?.('init', { pixelId: cfg.openai });
    w.oaiq?.('consent', true);
    return;
  }
  window.oaiq?.('consent', s.marketing);
}

function apply(s: ConsentState) {
  const withdrawn = appliedConsent && (
    (appliedConsent.analytics && !s.analytics && analyticsConfigured) ||
    (appliedConsent.marketing && !s.marketing && (adsConfigured || metaLoaded || openaiLoaded))
  );
  appliedConsent = s;
  if (withdrawn) {
    window.fbq?.('consent', 'revoke');
    window.oaiq?.('consent', false);
    // Third-party scripts cannot be unloaded. Reload with the persisted preferences
    // so revoked adapters stop, including their automatic background activity.
    window.location.reload();
    return;
  }
  loadGoogle(s);
  loadMeta(s);
  loadOpenAI(s);
  if (!s.marketing && metaLoaded) window.fbq?.('consent', 'revoke');
}

export function initAnalytics(config: RuntimeConfig): void {
  cfg = config;
  const cur = getConsent();
  if (cur) apply(cur);
  onConsent(apply);
}

/** İç olay sözlüğü: phone_click, whatsapp_click, directions_click, appointment_start, appointment_submit_success, product_explore ... */
export function track(name: string, params: Record<string, string | number | boolean> = {}): void {
  const s = getConsent();
  if (!s || !cfg) return;
  const allowedEvents = ['phone_click', 'whatsapp_click', 'directions_click', 'appointment_start', 'appointment_submit_whatsapp', 'appointment_submit_success', 'product_explore', 'reviews_click'];
  if (!allowedEvents.includes(name)) return;
  const safe: Record<string, string> = {};
  if (['3d', 'view', 'whatsapp', 'api'].includes(String(params.mode))) safe.mode = String(params.mode);
  if (gaLoaded && s.analytics && cfg.ga4) window.gtag?.('event', name, { ...safe, send_to: cfg.ga4 });
  if (name === 'appointment_submit_success' && adsConfigured && s.marketing && cfg.gads && cfg.gadsLabel) {
    window.gtag?.('event', 'conversion', { send_to: `${cfg.gads}/${cfg.gadsLabel}` });
  }
  if (metaLoaded && s.marketing) {
    // Sağlık bağlamı: yalnızca standart, kişisel veri içermeyen olaylar
    if (name === 'appointment_submit_success') window.fbq?.('track', 'Lead');
    else if (name === 'phone_click' || name === 'whatsapp_click') window.fbq?.('track', 'Contact');
  }
  if (openaiLoaded && s.marketing) {
    if (name === 'appointment_submit_success') window.oaiq?.('measure', 'lead_created', { type: 'appointment' });
  }
}
