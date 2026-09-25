export interface RuntimeConfig {
  locale: 'tr' | 'en';
  apiBase: string;
  ga4: string;
  gads: string;
  gadsLabel: string;
  meta: string;
  openai: string;
  turnstile: string;
  env: 'production' | 'preview';
  placeId: string;
  whatsapp: string;
}

const FALLBACK: RuntimeConfig = {
  locale: 'tr', apiBase: '', ga4: '', gads: '', gadsLabel: '', meta: '', openai: '', turnstile: '', env: 'preview', placeId: '', whatsapp: '',
};

export function readConfig(): RuntimeConfig {
  const el = document.getElementById('ayaz-config');
  if (!el?.textContent) return FALLBACK;
  try {
    return { ...FALLBACK, ...(JSON.parse(el.textContent) as Partial<RuntimeConfig>) };
  } catch {
    return FALLBACK;
  }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isDev = import.meta.env.DEV;
