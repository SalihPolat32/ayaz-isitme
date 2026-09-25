import type { Locale, SiteContent } from '../content/types';
import { tr } from '../content/tr';
import { en } from '../content/en';

export const contents: Record<Locale, SiteContent> = { tr, en };
export const getContent = (locale: Locale): SiteContent => contents[locale];

/** Yerel yollar (trailingSlash: always) */
export const localePaths: Record<Locale, string> = { tr: '/', en: '/en/' };
export const legalPaths: Record<Locale, string> = { tr: '/gizlilik/', en: '/en/privacy/' };
export const ogLocales: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' };
