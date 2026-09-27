/**
 * Çerez panelinin (ConsentBanner) derleme yapılandırmasına bağlı görünümü.
 * Gizlilik sayfasıyla aynı bağlamı kullanır (facts.ts > LegalBuildContext): panel YALNIZCA bu derlemede
 * kimliği tanımlı hizmetleri adlandırır ve yalnızca onlar için izin ister.
 *  - Analitik kategorisi: yalnızca PUBLIC_GA4_ID doluysa (Google Analytics).
 *  - Pazarlama kategorisi: PUBLIC_GADS_ID / PUBLIC_META_PIXEL_ID / PUBLIC_OPENAI_PIXEL_ID'den en az biri doluysa;
 *    metinde yalnızca tanımlı olanlar adlandırılır.
 *  - Hiçbiri yoksa: izin istenecek bir şey yoktur → yalnızca bilgilendirme (harita notu + politika bağlantısı), tek "Anladım" düğmesi.
 * Bu modül astro:env içe aktarmaz (vitest ile doğrudan test edilir).
 */
import type { Consent } from '../types';
import { joinList, type LegalBuildContext } from './facts';

/** Panelde görünen hizmet adları (marka adları; TR ve EN'de aynı). */
export const CONSENT_SERVICE_NAMES = {
  ga4: 'Google Analytics',
  gads: 'Google Ads',
  meta: 'Meta Pixel',
  openai: 'OpenAI',
} as const;

export type ConsentServices = Pick<LegalBuildContext, 'ga4' | 'gads' | 'meta' | 'openai'>;

export interface ConsentCategoryView {
  key: 'necessary' | 'analytics' | 'marketing';
  label: string;
  text: string;
  locked: boolean;
}

export interface ConsentView {
  /** 'choice': en az bir isteğe bağlı hizmet var, izin istenir · 'notice': yok, yalnızca bilgilendirme */
  mode: 'choice' | 'notice';
  title: string;
  text: string;
  categories: ConsentCategoryView[];
  /** Panelde adı geçen isteğe bağlı hizmetler (test/denetim için) */
  services: string[];
}

const list = joinList;

export function consentView(c: Consent, s: ConsentServices): ConsentView {
  const analytics: string[] = s.ga4 ? [CONSENT_SERVICE_NAMES.ga4] : [];
  const marketing: string[] = [];
  if (s.gads) marketing.push(CONSENT_SERVICE_NAMES.gads);
  if (s.meta) marketing.push(CONSENT_SERVICE_NAMES.meta);
  if (s.openai) marketing.push(CONSENT_SERVICE_NAMES.openai);
  const services = [...analytics, ...marketing];

  if (services.length === 0) {
    return { mode: 'notice', title: c.noticeTitle, text: c.textNoticeOnly, categories: [], services };
  }

  const categories: ConsentCategoryView[] = [{ key: 'necessary', label: c.categories.necessary.label, text: c.categories.necessary.text, locked: true }];
  if (analytics.length) categories.push({ key: 'analytics', label: c.categories.analytics.label, text: c.categories.analytics.text.replace('{services}', list(analytics, c.and)), locked: false });
  if (marketing.length) categories.push({ key: 'marketing', label: c.categories.marketing.label, text: c.categories.marketing.text.replace('{services}', list(marketing, c.and)), locked: false });

  return { mode: 'choice', title: c.title, text: c.textWithOptional.replace('{services}', list(services, c.and)), categories, services };
}
