> Son durum: [QA-REPORT.md](QA-REPORT.md) (doğrulama, kanıt dizini, açık konular). Yayın öncesi işletmeden beklenen bilgiler: `CONTENT-VERIFICATION.md` §7 (aynı sorular depo dışında `AYAZ-ISLETME-SORULARI.md` olarak da verildi).

# Ayaz İşitme Merkezi — keciorenisitme.com (v2)

Ankara Keçiören'deki Ayaz İşitme Cihazları Satış ve Uygulama Merkezi için tek sayfa kurumsal site.
Astro 7 + TypeScript, Three.js (3B cihaz inceleme), Cloudflare Worker (form + Google yorumları), GitHub Pages.

```bash
nvm use && npm install && cp .env.example .env
npm run dev      # http://localhost:4321/  (EN: /en/)
npm run build    # astro check + astro build → dist/  (PUBLIC_SITE_ENV=production iken işletme bilgileri eksikse bilinçli olarak durur)
npm test
```

## Yapı
```
src/config/business.ts      tek işletme yapılandırması (+ doğrulama durumları, business.legal — işletme dolduracak)
src/content/{tr,en}.ts      tüm metinler; types.ts tip modeli
src/content/legal/          gizlilik/KVKK/çerez metinleri (derleme yapılandırmasından üretilir), üretim kapısı, onay özeti
src/content/reviews*.{ts,json}  Google Takeout'tan içe aktarılan yorumlar + seçki (reviews-curation.json)
src/layouts/Base.astro      head/SEO/JSON-LD/Consent Mode/fontlar
src/components/*.astro      bölümler (Hero, DeviceExplorer, DeviceTypes, EarView, Brands, Services, EarMold, Process, Center, Reviews, Faq, Contact, LegalPage …)
src/scripts/*.ts            istemci: consent, analytics, form, reviews, explorer, ear-lazy, nav, tabs, lightbox
src/scripts/viewer/         Three.js temsili RIC/BTE/CIC modelleri (pil çekmecesi: slot-door.ts), render API
src/dev/viewer.astro        yalnızca `astro dev` sırasında /dev/viewer/ (üretime girmez)
src/assets/                 optimize edilmiş görseller (AVIF/WebP + srcset); device/views: render'lar + anchors.json
public/                     robots.txt, CNAME, og.jpg, favicon'lar, models/
worker/                     Cloudflare Worker (form + canlı yorumlar; ayrı paket)
scripts/                    prepare-images, make-og, import-google-reviews (+ lib/), render-device-views, capture-poster, qa-screenshots (yerel yardımcı; çıktısı qa/screenshots/ depoya girmez)
tests/                      vitest (içerik, gizlilik kapısı, yorum eşleştirme, 3B kapak) + tests/e2e (Playwright)
```

## Belgeler
- `CONTENT-VERIFICATION.md` — işletmenin teyit etmesi gereken bilgiler
- `ASSET-MANIFEST.md` — görsel kaynak/lisans listesi
- `INTEGRATIONS.md` — form, yorumlar, ölçüm, hosting kurulumu
- `DEPLOYMENT.md` — preview/production, URL koruma, geri dönüş
- `QA-REPORT.md` — nihai doğrulama, kanıt dizini, açık teknik konular, tur geçmişi
- `worker/README.md` — Worker kurulumu, kayıtlar (§9)
- `src/scripts/viewer/README.md` — 3B modeller ve render API

## Tasarım kararları (kısa)
- Tek H1, tür/marka/hizmet içeriği ilk HTML'de; JS olmadan tüm bilgi ve CTA'lar erişilebilir.
- 3B motor yalnızca bölüm görünür olunca ayrı chunk olarak yüklenir; WebGL yoksa poster + açıklamalar kalır.
- Fontlar build'de indirilip self-host edilir; Google'a çalışma zamanında istek gitmez.
- Çerez onayı olmadan hiçbir analitik/reklam scripti yüklenmez (Consent Mode v2 temel mod).
- Doğrulanmamış ticari iddialar (`unverified`) otomatik olarak yayına girmez.
