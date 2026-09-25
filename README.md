> Son kod, TR/EN içerik ve 3B model incelemesi: [REVIEW-REPORT.md](REVIEW-REPORT.md).

# Ayaz İşitme Merkezi — keciorenisitme.com (v2)

Ankara Keçiören'deki Ayaz İşitme Cihazları Satış ve Uygulama Merkezi için tek sayfa kurumsal site.
Astro 7 + TypeScript, Three.js (3B cihaz inceleme), Cloudflare Worker (form + Google yorumları), GitHub Pages.

```bash
nvm use && npm install && cp .env.example .env
npm run dev      # http://localhost:4321/  (EN: /en/)
npm run build    # astro check + astro build → dist/
npm test
```

## Yapı
```
src/config/business.ts      tek işletme yapılandırması (+ doğrulama durumları)
src/content/{tr,en}.ts      tüm metinler; types.ts tip modeli; legal/ hukuki taslaklar
src/layouts/Base.astro      head/SEO/JSON-LD/Consent Mode/fontlar
src/components/*.astro      bölümler (Hero, DeviceExplorer, DeviceTypes, Brands, Services, EarMold, Process, Center, Reviews, Faq, Contact …)
src/scripts/*.ts            istemci: consent, analytics, form, reviews, explorer, nav, tabs, lightbox
src/scripts/viewer/         Three.js temsili RIC modeli ve görüntüleyici
src/assets/                 optimize edilmiş görseller (Astro build'de AVIF/WebP + srcset)
public/                     robots.txt, CNAME, og.jpg, favicon'lar, models/ (GLB için)
worker/                     Cloudflare Worker (ayrı paket)
scripts/                    prepare-images.mjs, make-og.mjs
tests/                      vitest
```

## Belgeler
- `CONTENT-VERIFICATION.md` — işletmenin teyit etmesi gereken bilgiler
- `ASSET-MANIFEST.md` — görsel kaynak/lisans listesi
- `INTEGRATIONS.md` — form, yorumlar, ölçüm, hosting kurulumu
- `DEPLOYMENT.md` — preview/production, URL koruma, geri dönüş
- `QA-REPORT.md` — yapılan kontroller ve sonuçlar

## Tasarım kararları (kısa)
- Tek H1, tür/marka/hizmet içeriği ilk HTML'de; JS olmadan tüm bilgi ve CTA'lar erişilebilir.
- 3B motor yalnızca bölüm görünür olunca ayrı chunk olarak yüklenir; WebGL yoksa poster + açıklamalar kalır.
- Fontlar build'de indirilip self-host edilir; Google'a çalışma zamanında istek gitmez.
- Çerez onayı olmadan hiçbir analitik/reklam scripti yüklenmez (Consent Mode v2 temel mod).
- Doğrulanmamış ticari iddialar (`unverified`) otomatik olarak yayına girmez.
