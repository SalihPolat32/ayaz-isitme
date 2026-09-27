/**
 * Derleme ortamından hukuki metin bağlamı (yalnızca .astro sayfalarında kullanılır; testler facts.ts'i doğrudan besler).
 * PUBLIC_* değerleri astro:env'den (Base.astro ile aynı kaynak); ALLOW_INCOMPLETE_LEGAL yalnızca derleme
 * sürecinin ortamından okunur, tarayıcıya gitmez.
 */
import {
  PUBLIC_API_BASE,
  PUBLIC_GA4_ID,
  PUBLIC_GADS_ID,
  PUBLIC_META_PIXEL_ID,
  PUBLIC_OPENAI_PIXEL_ID,
  PUBLIC_TURNSTILE_SITE_KEY,
  PUBLIC_SITE_ENV,
  PUBLIC_REVIEWS_DISPLAY,
} from 'astro:env/client';
import { business } from '../../config/business';
import { resolveReviewsMode } from '../reviews';
import { LEGAL_OVERRIDE_ENV, type LegalEnv } from './facts';

export function legalEnvFromBuild(): { env: LegalEnv; reviewsMode: 'carousel' | 'link' } {
  return {
    env: {
      PUBLIC_SITE_ENV,
      PUBLIC_API_BASE,
      PUBLIC_TURNSTILE_SITE_KEY,
      PUBLIC_GA4_ID,
      PUBLIC_GADS_ID,
      PUBLIC_META_PIXEL_ID,
      PUBLIC_OPENAI_PIXEL_ID,
      ALLOW_INCOMPLETE_LEGAL: process.env[LEGAL_OVERRIDE_ENV],
    },
    reviewsMode: resolveReviewsMode(undefined, PUBLIC_REVIEWS_DISPLAY, business.reviewsDisplay),
  };
}
