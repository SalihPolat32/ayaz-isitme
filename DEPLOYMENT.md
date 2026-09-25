# Dağıtım — keciorenisitme.com

## Mevcut durum
- Canlı site: GitHub Pages, repo `SalihPolat32/ayaz-isitme`, dal `master`, `CNAME = keciorenisitme.com`, statik HTML kökten servis ediliyor.
- Yeni site: Astro 7 (Node ≥ 22.12; `.nvmrc` = 24). Çıktı `dist/` — yine tamamen statik.

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
1. Yeni kodu repoya **ayrı dalda** (ör. `v2`) gönderin; `master`'a merge etmeden önce preview'ı onaylayın.
2. Repo > Settings > Pages > **Source: GitHub Actions**.
3. Repo > Settings > Secrets and variables > Actions > **Variables**: `PUBLIC_API_BASE`, `PUBLIC_GA4_ID`, `PUBLIC_GADS_ID`, `PUBLIC_GADS_APPOINTMENT_LABEL`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_TURNSTILE_SITE_KEY` (boş bırakılabilir). `PUBLIC_SITE_ENV=production` iş akışında sabit.
4. `.github/workflows/deploy.yml` her `master` push'unda build edip yayınlar. `public/CNAME` özel alan adını korur; DNS değişmez.
5. İlk yayından sonra: `https://keciorenisitme.com/`, `/en/`, `/gizlilik/`, `/en/privacy/`, `/sitemap-index.xml`, `/robots.txt`, `/og.jpg` kontrol.

## URL koruma
| Eski URL | Yeni | Not |
|---|---|---|
| `/` | `/` | aynı |
| `/en/` | `/en/` | aynı |
| `/#about`, `/#services`, `/#products`, `/#gallery`, `/#blog`, `/#faq`, `/#contact` | `/#merkezimiz`, `/#hizmetler`, `/#cihazlar`, `/#merkezimiz`, `/#cihazlar`, `/#sss`, `/#iletisim` | Hash'ler indekslenmez; reklam/sosyal medya bağlantılarında kullanılmışsa güncelleyin. İsterseniz eski hash'ler için küçük bir JS yönlendirmesi eklenebilir. |
| `/sitemap.xml` | `/sitemap-index.xml` | robots.txt güncel. Search Console'da yeni sitemap'i gönderin. |
| `/assets/img/...` | yok | Eski görsel yolları kaldırıldı; dış bağlantı yoksa sorun değil. |

## Worker
`worker/README.md` — `wrangler deploy` veya `.github/workflows` içine `cloudflare/wrangler-action` eklenerek otomatik.

## Geri dönüş planı
GitHub Pages'te önceki `master` commit'ine (`4a927e0`, 13 Nis 2026) dönmek: Pages kaynağını tekrar "Deploy from a branch: master / root" yapmak ya da `v2` merge'ünü geri almak yeterlidir; DNS'e dokunulmaz.

## Yayın öncesi kısa liste
- [ ] CONTENT-VERIFICATION.md teyitleri (saatler, SGK, ücretsiz test, unvan)
- [ ] Hukuki metinler avukat onayı; `[•]` alanları dolduruldu
- [ ] `PUBLIC_SITE_ENV=production` (noindex kalkar)
- [ ] Place ID + Worker (isteğe bağlı) veya WhatsApp modunda kal
- [ ] GA4 kimliği kararı
- [ ] Gerçek cihazda mobil test (Android Chrome, iOS Safari), Lighthouse mobil raporu
- [ ] Search Console sitemap
