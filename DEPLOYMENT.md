# Dağıtım — keciorenisitme.com

## Mevcut durum
- Canlı site: Astro v2, commit `e851804` (25 Eyl 2026), repo `SalihPolat32/ayaz-isitme`, dal `master`; GitHub Pages kaynağı **GitHub Actions** (`.github/workflows/deploy.yml`), `CNAME = keciorenisitme.com`.
- Eski statik site yedekte: dal `master-backup` ve etiket `v1-static-2026-09-25` (`4a927e0`); ayrıca yerel git yedeği `ayaz-isitme-master-yedek-2026-09-25.bundle` (depo dışında).
- Yerel yeni sürüm (Tur 3–8): commit/push yapılmadı. **Üretim derlemesi, gizlilik metni için işletme bilgileri doldurulana kadar bilinçli olarak durur** (aşağıda "Yayın öncesi").
- Node ≥ 22.12; `.nvmrc` = 24. Çıktı `dist/` — tamamen statik.

## Yerel çalıştırma
```bash
nvm use            # 24
npm install
cp .env.example .env
npm run dev        # http://localhost:4321/
npm run build      # astro check + build → dist/
npm run preview
npm test           # vitest
```

## Preview (noindex)
`PUBLIC_SITE_ENV` `production` değilse tüm sayfalar `noindex, nofollow` üretir. Preview'ı ayrı bir GitHub Pages projesinde veya Cloudflare Pages'te yayınlayıp indeksleme kapalı test edebilirsiniz.

## Production (GitHub Pages)
1. Pages kaynağı zaten **GitHub Actions**. `deploy.yml` her `master` push'unda `npm run build` (astro check + build, `PUBLIC_SITE_ENV=production`) çalıştırıp yayınlar; derleme durursa yayın yapılmaz, canlı sürüm kalır.
2. Repo > Settings > Secrets and variables > Actions > **Variables** (hepsi isteğe bağlı, şu an tanımlı değil): `PUBLIC_API_BASE`, `PUBLIC_GA4_ID`, `PUBLIC_GADS_ID`, `PUBLIC_GADS_APPOINTMENT_LABEL`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_OPENAI_PIXEL_ID`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_REVIEWS_DISPLAY` (`carousel` | `link`). Bir değişken eklemek gizlilik metnini ve onay özetini değiştirir → yeni onay gerekir.
3. `ALLOW_INCOMPLETE_LEGAL` yalnızca yerel QA derlemesi içindir (yer tutucular + noindex); `deploy.yml`'de **asla** tanımlanmaz.
4. `public/CNAME` özel alan adını korur; DNS değişmez.
5. Yayından sonra: `https://keciorenisitme.com/`, `/en/`, `/gizlilik/`, `/en/privacy/`, `/sitemap-index.xml`, `/robots.txt`, `/og.jpg` kontrol; `/dev/viewer/` artık 404 olmalı.

## URL koruma
| Eski URL | Yeni | Not |
|---|---|---|
| `/` | `/` | aynı |
| `/en/` | `/en/` | aynı |
| `/#home`, `/#about`, `/#services`, `/#products`, `/#gallery`, `/#blog`, `/#faq`, `/#contact` | `/#ana`, `/#merkezimiz`, `/#hizmetler`, `/#cihazlar`, `/#merkezimiz`, `/#sss`, `/#sss`, `/#iletisim` | Hash'ler indekslenmez. Eski hash'ler `src/scripts/nav.ts` (`legacyAnchors`) ile yeni bölüme kaydırılır; reklam/sosyal medya bağlantılarında yine de yeni adresleri kullanın. |
| `/sitemap.xml` | `/sitemap-index.xml` | robots.txt güncel. Search Console'da yeni sitemap'i gönderin. |
| `/assets/img/...` | yok | Eski görsel yolları kaldırıldı; dış bağlantı yoksa sorun değil. |

## Worker
`worker/README.md` — `wrangler deploy` veya `.github/workflows` içine `cloudflare/wrangler-action` eklenerek otomatik.

## Geri dönüş planı
- v2'nin önceki sürümüne: `master`'ı `e851804`'e geri almak (revert) → Actions yeniden yayınlar.
- Eski statik siteye: Pages kaynağını "Deploy from a branch: `master-backup` / root" yapmak. DNS'e dokunulmaz.
- Yerel tam yedek: `ayaz-isitme-master-yedek-2026-09-25.bundle` (`git clone <bundle>`).

## Yayın öncesi kısa liste
- [ ] İşletme bilgileri (`CONTENT-VERIFICATION.md` §7 / `AYAZ-ISLETME-SORULARI.md`): 1–5 doldurulur → derleme nihai metni ve onay nesnesini basar → metin okunur → `textApproval` kopyalanır. Tahmin yazılmaz.
- [ ] `CONTENT-VERIFICATION.md` açık teyitleri (SGK, ücretsiz test, unvan, ikinci telefon, fotoğraftaki kişinin izni) — teyitsizler yayına girmez.
- [ ] Yorum gösterim modu kararı (`carousel` | `link`); hukuki değerlendirme `CONTENT-VERIFICATION.md` §9.
- [ ] Canlı yorum API'si açılacaksa: önce Places yorum kimliği = Takeout kimliği doğrulaması (`INTEGRATIONS.md` §5, risk 12).
- [ ] GA4/Ads/Meta kimlik kararı (eklenirse metin onayı yenilenir).
- [ ] Gerçek cihazda mobil test (Android Chrome, iOS Safari); Search Console sitemap.
