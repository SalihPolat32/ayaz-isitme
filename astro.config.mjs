// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://keciorenisitme.com';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,

  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  integrations: [
    sitemap({
      i18n: { defaultLocale: 'tr', locales: { tr: 'tr-TR', en: 'en' } },
      filter: (page) => !page.includes('/dev/') && !page.includes('/404'),
    }),
  ],

  image: {
    // Responsive <img> çıktısı: srcset + sizes, layout'a göre otomatik.
    layout: 'constrained',
    responsiveStyles: true,
    breakpoints: [480, 640, 768, 1024, 1280, 1600, 2000],
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: { avif: { quality: 55, effort: 6 }, webp: { quality: 78 }, jpeg: { quality: 82, mozjpeg: true } },
    },
  },

  // Fontlar build sırasında indirilip self-host edilir (Google'a runtime isteği gitmez).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Manrope',
      cssVariable: '--font-display',
      weights: ['500 800'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-body',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
  ],

  env: {
    schema: {
      /** Cloudflare Worker adresi (form + Google yorumları). Boşsa güvenli fallback'ler devreye girer. */
      PUBLIC_API_BASE: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** GA4 ölçüm kimliği (G-XXXX). Boşsa GA hiç yüklenmez. */
      PUBLIC_GA4_ID: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** Google Ads dönüşüm kimliği (AW-XXXX). */
      PUBLIC_GADS_ID: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** Google Ads randevu dönüşüm etiketi (send_to: AW-XXXX/label). */
      PUBLIC_GADS_APPOINTMENT_LABEL: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** Meta Pixel kimliği. Boşsa yüklenmez. */
      PUBLIC_META_PIXEL_ID: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** OpenAI (ChatGPT Ads) ölçüm kimliği. Koşullar doğrulanana kadar boş bırakın. */
      PUBLIC_OPENAI_PIXEL_ID: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** Cloudflare Turnstile site anahtarı (form spam koruması). */
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      /** 'production' dışındaki her değer noindex üretir (preview ortamı). */
      PUBLIC_SITE_ENV: envField.string({ context: 'client', access: 'public', optional: true, default: 'preview' }),
    },
  },
});
