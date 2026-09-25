# Entegrasyonlar — kurulum adımları

Site statiktir (GitHub Pages). Form ve Google yorumları için ayrı bir **Cloudflare Worker** (`worker/`) kullanılır.
Hiçbir entegrasyon zorunlu değildir: kimlikler boşken site güvenli fallback'lerle çalışır.

| Özellik | Kimlik yokken | Kimlik varken |
|---|---|---|
| Randevu formu | Doğrulanmış alanlar hazır **WhatsApp mesajına** dönüşür (sunucuya veri gitmez, sahte "gönderildi" yok) | Worker'a JSON POST → e-posta (+ isteğe bağlı Telegram) → yalnızca `delivered:true` ise "alındı" |
| Google yorumları | Google bağlantı kartı (yorumları gör / yorum yaz) | Worker, Places API (New) ile puan + en fazla 5 yorum |
| GA4 / Google Ads / Meta / OpenAI | Hiç yüklenmez | Yalnızca çerez izniyle yüklenir |
| Turnstile | Yok | Formda görünmez bot koruması |
| Harita | Tıklayınca yüklenen Google gömme | aynı |

## 1. Worker (form + yorumlar)

Ayrıntı: `worker/README.md`. Özet:

```bash
cd worker && npm install
npx wrangler login
# Sırlar
npx wrangler secret put RESEND_API_KEY        # veya BREVO_API_KEY
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put GOOGLE_PLACE_ID
npx wrangler secret put TURNSTILE_SECRET_KEY  # isteğe bağlı
npx wrangler secret put TELEGRAM_BOT_TOKEN    # isteğe bağlı
npx wrangler secret put TELEGRAM_CHAT_ID      # isteğe bağlı
npx wrangler deploy
```

`wrangler.jsonc` içindeki `vars`: `ALLOWED_ORIGINS` (https://keciorenisitme.com), `MAIL_PROVIDER` (`resend` | `brevo` | `mock`), `MAIL_FROM`, `MAIL_TO` (ayazisitmecihazlari@gmail.com), `REVIEWS_CACHE_TTL` (varsayılan 0).

Sitede: `.env` → `PUBLIC_API_BASE=https://<worker-adresi>` (ör. `https://api.keciorenisitme.com` özel alan adı veya `https://ayaz-isitme-api.<hesap>.workers.dev`). GitHub Actions için repo **Variables** altına aynı adla ekleyin.

### E-posta sağlayıcısı
- **Resend** (önerilen basitlik): ücretsiz kotası vardır; gönderen alan adı doğrulaması ister (`keciorenisitme.com` DNS kayıtları). Gmail'e teslimat için `MAIL_TO` yeterlidir.
- **Brevo**: alternatif; API anahtarı ile aynı şekilde.
- **KVKK notu:** Bu sağlayıcıların sunucuları yurt dışındadır; randevu verisinin (ad, telefon) yurt dışına düzenli aktarımı KVKK m.9 kapsamındadır (standart sözleşme + Kurum'a bildirim ya da veriyi Türkiye'de tutan mimari). Karar avukatla verilmeli; karar verilene kadar **API'siz WhatsApp modu** en düşük riskli seçenektir (veri doğrudan ziyaretçinin WhatsApp'ından işletmeye gider, aracı sunucu yoktur).

### Google yorumları (Places API New)
1. Google Cloud'da proje → **Places API (New)** etkinleştir → API anahtarı oluştur → **API kısıtlaması: yalnızca Places API (New)**. Anahtar yalnızca Worker sırrında durur, siteye asla yazılmaz.
2. Place ID: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder → "Ayaz İşitme Cihazları Keçiören" → ID'yi `GOOGLE_PLACE_ID` sırrına ve isterseniz `src/config/business.ts` içine (status: verified) yazın.
3. Maliyet: `reviews` alanı **Place Details Enterprise + Atmosphere** SKU'suna girer — aylık **1.000 çağrı ücretsiz**, sonrası 1.000 çağrı başına ≈25 USD (2026-09 fiyat listesi). Yorum bölümü yalnızca ekrana yaklaşınca çağrı yapar.
4. Politika: Google Maps Platform şartları yorum içeriğinin önbelleklenmesine/saklanmasına açıkça izin vermez (yalnızca Place ID saklanabilir). Worker varsayılan olarak canlı çeker; `REVIEWS_CACHE_TTL` ile önbellek açmak işletmenin uyumluluk kararıdır. Sitede zorunlu atıflar uygulanır: yazar adı/avatarı/profil bağlantısı, "Google Maps" metni, yoruma ve işletmeye Google bağlantısı, göreli tarih.
5. "Yorum yaz" bağlantısı: Google İşletme Profili > Yorumları oku > **Daha fazla yorum alın** > bağlantıyı kopyala → `business.google.writeReviewUrl`.

## 2. Ölçüm (izinle)

Tüm kimlikler `.env` / GitHub Variables ile verilir; boşsa ilgili script hiç yüklenmez.

| Değişken | Ne | Not |
|---|---|---|
| `PUBLIC_GA4_ID` | GA4 ölçüm kimliği (`G-…`) | Mevcut sitede `G-VRC710M0YF` kullanılıyor; aynı mülk kullanılabilir. Consent Mode v2 temel modu: izin yoksa gtag.js yüklenmez. Google sinyalleri ve reklam kişiselleştirme kapalı. |
| `PUBLIC_GADS_ID` | Google Ads (`AW-…`) | Pazarlama izniyle yüklenir. |
| `PUBLIC_GADS_APPOINTMENT_LABEL` | Dönüşüm etiketi | `appointment_submit_success` olayında `AW-…/etiket` dönüşümü gönderilir. Telefon/WhatsApp tıklamaları GA4 olayı olarak gider; Ads'te "tıklama = arama" sayılmaz. |
| `PUBLIC_META_PIXEL_ID` | Meta Pixel | Pazarlama izniyle; yalnızca standart olaylar (`PageView`, `Contact`, `Lead`), LDU açık, gelişmiş eşleştirme yok. Meta bu siteyi "Sağlık ve zindelik" kategorisine alıp **Temel Kurulum** kısıtı uygulayabilir; URL parametrelerine sağlık terimi konmaz. |
| `PUBLIC_OPENAI_PIXEL_ID` | ChatGPT Ads pikseli | Resmî `oaiq` yükleyici hazır; ancak OpenAI reklam politikası ABD dışı sağlık hizmetleri reklamlarını "genellikle yasak" sayıyor (10 Eyl 2026 sürümü). Hesap/kategori onayı gelmeden **boş bırakın**. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile | Worker'a `TURNSTILE_SECRET_KEY` de eklenmeli. |

İç olay sözlüğü (`track()`): `phone_click`, `whatsapp_click`, `directions_click`, `appointment_start`, `appointment_submit_success`, `appointment_submit_whatsapp`, `product_explore`, `reviews_click`, `review_write_click`. Hiçbir olayda ad, telefon veya form içeriği gönderilmez.

Google Ads politikası: sağlık "hassas ilgi kategorisi" — **yeniden pazarlama / müşteri eşleştirme / benzer kitle kullanmayın**; anahtar kelime + konum + hazır kitlelerle çalışın. Türk mevzuatı: işitme cihazı **ürün** reklamı tüketiciye yapılamaz (Tıbbi Cihaz Satış, Reklam ve Tanıtım Yönetmeliği m.15); reklamlar **merkez ve hizmetleri** için kurgulanmalı.

## 3. Organik arama ve yapay zekâ botları

- `public/robots.txt`: tüm botlara açık; `OAI-SearchBot` ve `ChatGPT-User` açıkça izinli (ChatGPT aramasında görünürlük). `GPTBot` (eğitim) ayrıca engellenmedi; istenirse `Disallow` eklenir — arama görünürlüğünü etkilemez.
- Sitemap: `https://keciorenisitme.com/sitemap-index.xml` (build'de üretilir; robots.txt içinde).
- Search Console: yeni yapı yayına alındıktan sonra sitemap gönderin; `/en/` için hreflang otomatik.

## 4. Harita

Google Maps gömme yalnızca "Haritayı yükle" düğmesiyle yüklenir (çerez onayından bağımsız, kullanıcı eylemi). Adres: `business.google.mapsEmbedUrl`.
