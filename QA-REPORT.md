> **Güncel inceleme:** 25 Eylül 2026 GPT düzeltmeleri ve yeni test sonuçları [REVIEW-REPORT.md](REVIEW-REPORT.md) içinde. Aşağıdaki Lighthouse sonuçları önceki sürümün ölçümüdür.

# QA Raporu — Ayaz İşitme Merkezi v2

Tarih: 25 Eylül 2026 · Ortam: macOS, Node 24.21, Astro 7.3.5, Chromium (Playwright 1.63), Lighthouse 13.5.
Tüm kontroller **yerel build** (`astro build`, `PUBLIC_SITE_ENV=production`) ve `astro preview` üzerinde yapıldı. Canlı site değiştirilmedi; gerçek dış servislere (Google, Resend, Meta…) istek atılmadı.

## 1. Derleme ve tip kontrolü
| Kontrol | Sonuç |
|---|---|
| `astro check` (TypeScript strict, 58 dosya) | 0 hata, 0 uyarı |
| `astro build` | 6 sayfa: `/`, `/en/`, `/gizlilik/`, `/en/privacy/`, `/404`, `/dev/viewer/` (noindex, sitemap dışı) |
| `worker/` `tsc --noEmit` + `wrangler deploy --dry-run` | geçti (28,7 KiB bundle) |

## 2. Otomatik testler
| Paket | Kapsam | Sonuç |
|---|---|---|
| `vitest` (site) | telefon normalizasyonu, ad doğrulama, TR/EN içerik yapı eşitliği, nav/hotspot/tür kimlikleri, SEO uzunlukları, Med-SEM sızıntı koruması | **13/13** |
| `vitest` (worker) | validasyon, honeypot, zaman tuzağı, Places yanıtı kırpma, coalescing, sağlayıcılar, Turnstile, rate limit | **106/106** |
| Playwright e2e (desktop 1280 + Pixel 7) | ana sayfa yükleme/başlıklar/JSON-LD; 360–1440 px yatay taşma; sekmeler (tıklama+klavye); SSS akordeon; lightbox (klavye, odak dönüşü); harita tıkla-yükle; robots/sitemap/og/404; form doğrulama + WhatsApp mesajı + bot tuzağı; çerez ret/kabul/yeniden açma + Consent Mode; 3B yükleme/ayrışma/sıfırlama/hotspot; reduced-motion; WebGL yokken fallback; EN sayfa ve dil geçişi; gizlilik sayfaları; mobil menü | **34/34** (bir koşuda mobil menü testi zamanlama nedeniyle 1 kez başarısız oldu; test bekleme koşulu sağlamlaştırıldı, 3 tekrarda geçti) |

Çalıştırma: `npm test` · `cd worker && npm test` · `npm run build && npm run test:e2e`

## 3. Performans (Lighthouse 13.5, laboratuvar — sıralama garantisi değildir)
Koşullar: `astro preview` üzerinden 127.0.0.1, simüle edilmiş kısıtlama (mobil: Moto G Power / yavaş 4G; masaüstü preset). Raporlar: `qa/lighthouse-mobile.html`, `qa/lighthouse-desktop.html`.

| | Performans | Erişilebilirlik | Best Practices | SEO | LCP | FCP | TBT | CLS | Speed Index | Aktarım |
|---|---|---|---|---|---|---|---|---|---|---|
| Mobil | **100** | **100** | **100** | **100** | 1,7 s | 1,2 s | 0 ms | 0 | 1,2 s | 102 KiB |
| Masaüstü | **100** | **100** | **100** | **100** | 0,4 s | 0,3 s | 0 ms | 0 | 0,3 s | 92 KiB |

İlk yükleme bütçesi: HTML 24 KB gz + CSS ≈11 KB gz + JS 6,6 KB gz + Manrope (2 subset, 39 KB) + logo/poster. Three.js parçası (≈149 KB gz) yalnızca 3B sahne %25 görünür olup tarayıcı boşa düştüğünde yüklenir; Lighthouse izinde hiç istenmedi.
Not: Preview ortamı `noindex` ürettiği için ölçüm `PUBLIC_SITE_ENV=production` ile alındı. Gerçek kullanıcı (CrUX) verisi yayından sonra ölçülmelidir.

Düzeltilen performans sorunları: (1) WebGL yeteneği ilk yüklemede sorgulanıyordu → 1,9 s uzun görev (TBT 1,8 s); sorgu motor yüklenirken yapılacak şekilde taşındı → TBT 0. (2) Hero için IntersectionObserver "reveal" animasyonu LCP'yi geciktiriyordu → hero JS'siz, yalnızca CSS giriş animasyonu. (3) Inter fontu preload'dan çıkarıldı (≈133 KB kritik yol).

## 4. Erişilebilirlik
- Lighthouse a11y 100; düzeltilenler: `span[aria-label]` için `role="img"`, `<dl>` içindeki düğme dışarı alındı.
- Klavye: sekmeler (Ok/Home/End), akordeon (native `details`), lightbox (Ok tuşları, Escape, odak geri dönüşü), mobil menü (`<dialog>`, Escape, backdrop), 3B canvas (`tabindex`, ok tuşları, +/−, R, E), görünür odak halkası.
- Hedef alanları ≥ 44 px (düğmeler, hotspot'lar, alt çubuk); `prefers-reduced-motion` ile animasyon/otomatik döndürme kapalı.
- Kontrast: ink/bg 13,7:1, accent-text (#0B6670)/bg 6,2:1, beyaz/accent 4,75:1, beyaz/navy 14,6:1.
- 3B olmadan tüm bilgi ve CTA'lar HTML'de (parça açıklamaları, poster, fallback metni).

## 5. Görsel kontrol (in-app tarayıcı + Playwright ekran görüntüleri: `qa/screenshots/`)
- Masaüstü 1024/1280/1440, tablet 768, mobil 375/390/412: taşma yok, header 1024–1199'da yalnızca logo, 1280+'da telefon görünür.
- Hero, 3B sahne (6 hotspot varsayılan açıda görünür), sekmeler, marka kartları, hizmetler, kulak kalıbı (lacivert blok), süreç, galeri (5 sütun editoryal grid), ekip kartı, yorum bağlantı kartı, SSS, form, harita placeholder, footer.
- Mobil: menü dialog, alt çubuk (Ara/WhatsApp/Yol tarifi), çerez paneli alt çubuğun üstünde.

## 6. Bütünlük ve güvenlik
- İzin verilmeden hiçbir üçüncü taraf isteği yok (e2e ile doğrulandı: googletagmanager, facebook, openai, fonts.googleapis vb. yok). Kimlik boşsa izin verilse bile script yüklenmez.
- Form: sunucu yokken WhatsApp moduna düşer, sahte "gönderildi" göstermez; PII analitiğe gitmez; honeypot + zaman tuzağı; Worker tarafında doğrulama, Turnstile (opsiyonel), rate limit, telefon maskeli log.
- Yorumlar: API yokken bağlantı kartı; sahte puan/yorum yok.
- Secrets yalnızca Worker sırlarında; `.env.example` boş.

## 7. Yapılamayanlar / açık maddeler
- Gerçek cihazda (iOS Safari, Android Chrome) test yapılmadı; Playwright emülasyonu kullanıldı.
- Gerçek Places API, Resend/Brevo, Turnstile, GA4/Ads/Meta çağrıları test edilmedi (kimlik yok); Worker fake-fetch testleriyle doğrulandı.
- 3B model **temsili** (parametrik); lisanslı GLB gelince `src/scripts/viewer/README.md` adımlarıyla değiştirilir.
- Hukuki metinler taslak; saklama süresi ve yurt dışı aktarım dayanağı boş.
- İşletme teyitleri (saat, SGK, ücretsiz test, unvan, uygulanan markalar) bekliyor — `CONTENT-VERIFICATION.md`.
- Lighthouse skoru laboratuvar ölçümüdür; Search Console/CrUX ile saha verisi izlenmeli.

## 8. Çapraz kontrol — GPT incelemesi sonrası (25 Eylül 2026, 17:10)
GPT'nin `REVIEW-REPORT.md` ile teslim ettiği değişiklikler (yeni ince RIC modeli, metin yumuşatmaları, form/izin/yorum düzeltmeleri, Worker akış limiti, yeni testler) Claude tarafından yedek arşivle (`/private/tmp/ayaz-v2-before-review.tar.gz`) karşılaştırılarak incelendi ve tüm doğrulamalar yeniden koşturuldu:

| Kontrol | Sonuç |
|---|---|
| astro check (66 dosya) | 0 hata |
| astro build (production) | 6 sayfa |
| vitest site / worker | 19/19 · 110/110 |
| Playwright e2e (desktop + Pixel 7) |   38 passed (44.4s)  — GPT'nin `integrations.spec.ts` testi mobil projede 5 s bekleme süresiyle sistematik düşüyordu (yazılımsal GPU'da 3B motor yüklemesi yorum listesini geciktiriyor; ürün hatası değil). Bekleme 20 s yapıldı. |
| Lighthouse mobil / masaüstü | 100·100·100·100 / 100·100·100·100 — LCP 1,7 s / 0,4 s, TBT 0, CLS 0; aktarım 154 / 148 KiB (yeni poster PNG ile arttı). Dosyalar: `qa/lighthouse-mobile-2026-09-25-1707.html/.json`, `qa/lighthouse-desktop-2026-09-25-1707.html/.json` (ölçüm 17:08; 15:13 tarihli eski raporlar da duruyor) |

Kod incelemesi: değişiklikler tutarlı ve yerinde (izin kaydı doğrulama + 180 gün, analitik olay allowlist'i ve URL temizliği, form eşzamanlı gönderim/15 s zaman aşımı, telefon doğrulama sıkılaştırma, Worker gövde limiti akıştan bayt sayarak, yorumlarda https kontrolü ve dil parametresi, eski hash bağlantı karşılıkları). Not: `Contact.astro` içindeki bilgi listesindeki telefon ikonuna eklenen `aria-describedby` özniteliği Icon bileşeni tarafından yok sayılır; zararsız.
Politika değişikliği (işletme kararı gerektirir): GPT, vitrinde görülen "SGK anlaşmalı" ve "ücretsiz işitme testi" ifadeleri ile çalışma saatlerini teyit gelene kadar `unverified` yaparak yayından kaldırdı; Claude'un ilk sürümünde bunlar `storefront`/`from-live-site` ile yayındaydı. Tek satırla geri açılabilir (`src/config/business.ts`).

Not: `dist/` varsayılan `preview` moduyla (noindex) yeniden derlendi; önizleme yüklemeleri için bu hali kullanın. Production derlemesi yalnızca GitHub Actions workflow'unda üretilir.
