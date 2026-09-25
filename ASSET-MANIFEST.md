# Varlık Manifestosu — Ayaz İşitme Merkezi

| Dosya | Kaynak | Tür | Lisans / izin | Kullanım |
|---|---|---|---|---|
| `src/assets/brand/ayaz-logo-full.png` | `ayaz_isitme/assets/img/ayaz-logo-full.png` (1038×680, RGBA) | Gerçek — işletme logosu | İşletmeye ait | Header, OG, JSON-LD logo, apple-touch-icon |
| `src/assets/brand/ayaz-logo-full-white.png` | aynı klasör | Gerçek | İşletmeye ait | Footer |
| `src/assets/ofis/ofis-1..8.jpg` | `ayaz_isitme/assets/img/ofis/ofis-*.png` orijinallerinden (5712×4284'e kadar, toplam ≈77 MB) `scripts/prepare-images.mjs` ile üretilen ≤2000 px JPEG masterlar (≈3 MB toplam) | Gerçek — merkez fotoğrafları | İşletmeye ait kabul edildi; fotoğraftaki kişi için yayın izni teyit edilmeli | Merkezimiz galerisi, ekip kartı (ofis-1), OG görseli (ofis-6) |
| `public/og.jpg` | `scripts/make-og.mjs` — ofis-6 + metin | Türetilmiş | — | Open Graph / Twitter kartı (1200×630) |
| `public/apple-touch-icon.png` | `scripts/make-og.mjs` — logodan | Türetilmiş | — | iOS ana ekran ikonu |
| `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png` | GitHub deposu (`assets/img/`) | Gerçek | İşletmeye ait | Favicon |
| `public/logo-ayaz.png` | Logo kopyası | Gerçek | İşletmeye ait | JSON-LD `logo` |
| `src/assets/device/ric-poster.svg` | Elle çizilmiş şematik | **Temsili** | Bu projede üretildi | Hero ve 3B bölümü posteri (3B yüklenene kadar / WebGL yoksa). Gerçek render ile değiştirilebilir (bkz. `src/scripts/viewer/README.md`). |
| `src/scripts/viewer/model.ts` (parametrik 3B model) | Bu projede üretildi | **Temsili** — markasız RIC | — | 3B inceleme bölümü; "Temsili cihaz" uyarısı görünür |
| `src/components/TypeGlyph.astro` | Bu projede çizildi | Şematik | — | Cihaz türü sekmeleri |
| İkonlar (`src/components/Icon.astro`) | Lucide tarzı elle yazılmış yollar; WhatsApp glifi Simple Icons (CC0) | — | MIT/CC0 | Arayüz |
| Fontlar Manrope, Inter | Google Fonts (OFL), build sırasında indirilip `_astro/fonts` altında self-host edilir | — | SIL OFL 1.1 | Tipografi |

**Kullanılmayanlar (bilerek):**
- `ayaz_isitme/assets/img/bernafon/*` — Bernafon CDN'den alınmış ürün/insan görselleri; ticari kullanım hakkı belirsiz.
- `ayaz_isitme/assets/img/hero.jpg` — Bernafon stok görseli.
- `ayaz_isitme/assets/img/yorumlar/*.png` — Google yorum ekran görüntüleri; yorumlar API/bağlantı ile sunuluyor, ekran görüntüsü kopyalanmadı.
- `Med-SEM Güncel/`, `medsem-isitme/` — başka işletme; hiçbir varlık alınmadı.
- Fiyat listeleri (PDF) ve kişisel belgeler — projeye dahil edilmedi.
