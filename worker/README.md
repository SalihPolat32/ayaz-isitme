# ayaz-isitme-api — keciorenisitme.com için Cloudflare Worker

Astro ile üretilen statik site GitHub Pages'te yayınlanır; sunucu tarafı gereken iki iş bu
Worker'da toplanır:

| Uç nokta | Ne yapar |
|---|---|
| `POST /api/appointment` | Randevu formunu doğrular, botları eler, işletmeye e-posta (+ isteğe bağlı Telegram) gönderir |
| `GET /api/reviews` | Google Places API (New) üzerinden işletmenin puanını ve en fazla 5 yorumunu anahtarı gizleyerek döndürür (varsayılan: canlı çekim, önbellek isteğe bağlı) |
| `GET /api/health` | Sürüm ve hangi özelliklerin etkin olduğu (`mail`, `telegram`, `turnstile`, `reviews`, `rateLimit`, `reviewsCacheTtl`) |

Harici çalışma zamanı bağımlılığı yoktur; TypeScript + Workers standart API'leri.

---

## 1. Hızlı başlangıç (yerel)

```bash
cd worker
nvm use 24                      # veya Node >= 22
npm install
cp .dev.vars.example .dev.vars  # boş bırakılabilir: mock e-posta, Turnstile kapalı, yorumlar 503
npm run dev                     # http://localhost:8787
npm test                        # vitest (Node ortamı, Miniflare gerekmez)
npm run typecheck               # wrangler types + tsc --noEmit
```

Yerelde deneme:

```bash
curl -s localhost:8787/api/health
curl -s -X POST localhost:8787/api/appointment \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:4321' \
  -d '{"name":"Ayşe Yılmaz","phone":"0507 155 11 51","consent":true,"t":1,"website":""}'
# → {"ok":true,"delivered":false,"provider":"mock","telegram":false}
```

`delivered:false` yanıtı **başarı değildir**; ön yüz bu durumda WhatsApp/telefon seçeneğini gösterir.
Gerçek teslim ancak bir e-posta sağlayıcısı (veya Telegram) yapılandırıldığında `delivered:true` olur.

---

## 2. Yapılandırma

### 2.1 Düz metin değişkenler — `wrangler.jsonc` → `vars`

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://keciorenisitme.com,http://localhost:4321` | CORS izin listesi (virgülle). `*` kullanılmaz; form uç noktası yalnızca bu kaynaklardan çalışır |
| `MAIL_PROVIDER` | `mock` | `resend` \| `brevo` \| `mock`. İlgili anahtar yoksa `mock`a düşer ve uyarı loglar |
| `MAIL_FROM` | `Ayaz Isitme Randevu <randevu@keciorenisitme.com>` | Sağlayıcıda **doğrulanmış alan adı** olmalı; `gmail.com` gönderici olamaz |
| `MAIL_TO` | `ayazisitmecihazlari@gmail.com` | Talebin gideceği işletme adresi |
| `REVIEWS_CACHE_TTL` | `0` | Yorum önbelleği (saniye). **`0` = önbellek yok**, her istek Google'a canlı gider. Açmak (ör. `21600` = 6 sa) işletme sahibinin uyum kararıdır — bkz. §5.3 |
| `REVIEWS_CACHE_STALE_TTL` | `0` | Yalnızca önbellek açıkken: Google hata verirse eski kopyanın en fazla ne kadar daha sunulacağı (saniye) |

### 2.2 Gizli değerler (secrets)

Bu değerler **asla** `wrangler.jsonc`'a veya git'e yazılmaz.

| Secret | Gerekli mi | Açıklama |
|---|---|---|
| `RESEND_API_KEY` | `MAIL_PROVIDER=resend` ise | Resend → API Keys |
| `BREVO_API_KEY` | `MAIL_PROVIDER=brevo` ise | Brevo → SMTP & API → API Keys |
| `TURNSTILE_SECRET_KEY` | önerilir | Boşsa Turnstile doğrulaması atlanır (honeypot + zaman tuzağı + hız sınırı yine çalışır) |
| `GOOGLE_PLACES_API_KEY` | yorumlar için | Yalnızca *Places API (New)* ile sınırlanmış sunucu anahtarı |
| `GOOGLE_PLACE_ID` | yorumlar için | İşletmenin Place ID'si (`ChIJ...`). Boşsa `/api/reviews` → `503 not_configured` |
| `TELEGRAM_BOT_TOKEN` | isteğe bağlı | @BotFather'dan alınan token |
| `TELEGRAM_CHAT_ID` | isteğe bağlı | Bota mesaj atıp `https://api.telegram.org/bot<TOKEN>/getUpdates` → `result[].message.chat.id` |

Üretime girme (her komut değeri gizli olarak ister):

```bash
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put GOOGLE_PLACE_ID
# isteğe bağlı
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret list
```

Yerelde aynı adlar `.dev.vars` dosyasından okunur (`.gitignore`'da).

---

## 3. E-posta sağlayıcısını seçme / değiştirme

1. Sağlayıcıda `keciorenisitme.com` (veya `mail.keciorenisitme.com` alt alanı) için verilen DNS
   kayıtlarını (SPF/DKIM, TXT/CNAME) alan adının DNS'ine ekleyip doğrulayın. Bu, sitenin GitHub
   Pages'te olmasından bağımsızdır; yalnızca DNS kaydı eklenir.
2. `wrangler.jsonc` → `vars.MAIL_PROVIDER` değerini `resend` veya `brevo` yapın, `MAIL_FROM`'u
   doğrulanmış alan adındaki adrese çekin.
3. İlgili secret'ı girin ve `npm run deploy`.
4. `GET /api/health` → `features.mail` alanı seçilen sağlayıcıyı göstermeli (`mock` görüyorsanız anahtar eksik).

| Sağlayıcı | Uç nokta | Ücretsiz katman (araştırma tarihi 2026-09) |
|---|---|---|
| Resend | `POST https://api.resend.com/emails` (Bearer) | 3.000 e-posta/ay, 100/gün, 3 alan adı |
| Brevo | `POST https://api.brevo.com/v3/smtp/email` (`api-key`) | ~300 e-posta/gün (üçüncü taraf kaynaklı; doğrulanmadı) |
| mock | — | Göndermez; `delivered:false` döner |

**Telegram** ikinci kanaldır ve e-postayla paralel gönderilir. Yalnızca Telegram ulaşırsa yanıt
`{ delivered:true, provider:'telegram' }` olur. Gerçek bir e-posta sağlayıcısı denendi ve hiçbir
kanal ulaşamadıysa `502 delivery_failed` döner (ön yüz WhatsApp'a yönlendirir).

Bildirim içeriği: ad soyad, telefon (hem `0507 155 11 51` hem `+905071551151`, `tel:` bağlantılı),
tercih edilen zaman, dil, Europe/Istanbul zaman damgası, formun gönderildiği sayfa (sorgu dizesi
atılır), ülke kodu. Konu: `Yeni randevu talebi — keciorenisitme.com`.

---

## 4. Bot koruması

Katmanlar sırayla uygulanır; herhangi biri istemcinin verisini geri yansıtmaz.

| Katman | Davranış |
|---|---|
| Hız sınırı | IP başına 5 istek / 60 sn (form) ve 30 istek / 60 sn (yorumlar) → `429 rate_limited` + `Retry-After: 60` |
| Honeypot (`website`) | Doluysa `200 { ok:true, delivered:false, provider:'none' }` (bot bir şey öğrenmez) |
| Zaman tuzağı (`t`) | Form açılışından < 3 sn sonra gönderim → `400 too_fast` (gerçek kullanıcı yeniden dener). `t` yoksa karar verilmez |
| Alan doğrulaması | `400 validation` + `fields` (yalnızca kod: `required` / `invalid` / `too_short` / `too_long`) |
| Turnstile | `TURNSTILE_SECRET_KEY` varsa `turnstileToken` siteverify'da doğrulanır; hostname izinli kaynaklarla eşleşmeli → `403 turnstile` (`codes`), erişilemezse `503 turnstile_unavailable` |

### Hız sınırı: binding veya KV

`wrangler.jsonc` içindeki `ratelimits` bloğu **Workers Rate Limiting binding**'dir (GA, ücretsiz,
ek kaynak gerektirmez, wrangler ≥ 4.36). İki sayaç vardır: `APPT_LIMITER` (form, 5/60 sn) ve
`REVIEWS_LIMITER` (yorumlar, 30/60 sn — canlı çekim modunda Google faturasının şişirilmesini önler).
Sayaç Cloudflare veri merkezi başınadır ve "izin verici" tasarlanmıştır; bu yüzden tek başına değil,
yukarıdaki katmanlarla birlikte kullanılır. Yorum sayacı için KV yedeği bilerek yoktur (her istek KV
yazması harcardı); binding yoksa izin verilir ve loga uyarı yazılır.

Bindingi kaldırmanız gerekirse yedek olarak KV kullanılabilir:

```bash
npx wrangler kv namespace create RATE_KV
# çıktıdaki id'yi wrangler.jsonc "kv_namespaces" bloğuna yapıştırın (yorumları açın)
```

Free planda KV günde **1.000 yazma** ile sınırlıdır ve her form isteği 1 yazma harcar; bu nedenle
KV yalnızca yedektir. İki binding de yoksa Worker isteğe izin verir ve loga uyarı yazar.

### Turnstile

- Cloudflare Dashboard → Turnstile → Add site → hostname `keciorenisitme.com` (yerel geliştirme için `localhost` da eklenebilir), Widget mode *Managed*.
- **Site key** ön yüze (`PUBLIC_TURNSTILE_SITE_KEY`), **secret key** Worker'a (`TURNSTILE_SECRET_KEY`).
- Test anahtarları: site `1x00000000000000000000AA` (her zaman geçer), secret `1x0000000000000000000000000000000AA` (her zaman geçer), `2x…AA` (her zaman reddeder).
- Token 300 sn geçerlidir ve **tek kullanımlıktır**; Worker alan doğrulamasını Turnstile'dan önce yapar ki form hatasında token boşa gitmesin. Ön yüz `400/403` sonrası `turnstile.reset()` çağırmalıdır.

---

## 5. Google yorumları (`/api/reviews`)

### 5.1 Place ID bulma

1. https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder
   sayfasında "Ayaz İşitme Cihazları Keçiören" aratın, işaretçiye tıklayın, `ChIJ…` ile başlayan kimliği kopyalayın.
2. `npx wrangler secret put GOOGLE_PLACE_ID` ile girin (ön yüzdeki `business.google.placeId` alanı da güncellenebilir; Place ID gizli değildir, süresiz saklanabilir).
3. Doğrulama: deploy sonrası `GET /api/reviews` → `googleMapsUri` doğru işletmeyi açmalı.

### 5.2 API anahtarı ve kısıtlar (Google Cloud Console)

1. Faturalandırması açık bir proje seçin (ücretsiz katman için de zorunlu).
2. *Google Maps Platform → APIs* → **Places API (New)** → Enable. (Eski "Places API" değil.)
3. *Credentials → Create credentials → API key*. Ardından anahtarı düzenleyin:
   - **API restrictions:** yalnızca *Places API (New)*.
   - **Application restrictions:** *None*. Worker'lar paylaşımlı Cloudflare IP'lerinden çıkar; IP kısıtı pratik değildir. Anahtar yalnızca sunucuda (secret) durur, tarayıcıya asla gitmez.
4. *APIs & Services → Quotas* altında Places API (New) için günlük istek kotası belirleyin ve *Billing → Budgets* ile bütçe uyarısı kurun.

### 5.3 Önbellek (isteğe bağlı), uyum ve maliyet

**Şartlar.** Google Maps Platform Hizmet Şartları (3.2.3 "No Caching", Maps Service Specific Terms
§3 ve §14.3) yalnızca **Place ID**'nin süresiz ve enlem/boylamın 30 güne kadar saklanmasına açıkça
izin verir; yorum metni, puan, yazar adı/fotoğrafı izinli listede **değildir**. Bu yüzden Worker
varsayılan olarak **önbellek tutmaz** (`REVIEWS_CACHE_TTL=0`): her sayfa görüntülemesi Google'a canlı
gider, yanıt tarayıcıya `Cache-Control: no-store` ile döner ve aynı anda gelen istekler tek Google
çağrısında birleştirilir (`X-Cache: bypass`).

**Önbelleği açmak** (`REVIEWS_CACHE_TTL`, ör. `21600` = 6 sa) maliyeti ziyaretçi sayısından bağımsız
hale getirir ama Google şartları açısından **işletme sahibinin vermesi gereken bir uyum kararıdır**;
gerekirse Google Maps Platform destek/satış ekibine sorulmalıdır. Açıldığında:

- Cache API (`caches.default`) sentetik anahtarla kullanılır; kopya veri merkezi başınadır ve yalnızca
  **özel alan adında** çalıştığı belgelenmiştir (`workers.dev`'de her istek Google'a gidebilir).
- `REVIEWS_CACHE_STALE_TTL` > 0 ise Google erişilemezken eski kopya bu ek süre boyunca sunulur
  (`X-Cache: stale`); yoksa `502 upstream`.
- Yorum içeriği bunun dışında hiçbir yerde (KV, D1, derleme çıktısı) saklanmaz.

**Maliyet.** İstenen alan maskesi `id,displayName,rating,userRatingCount,googleMapsUri,reviews`.
`reviews` alanı çağrıyı **Place Details Enterprise + Atmosphere** SKU'suna sokar: ayda **1.000 çağrı
ücretsiz**, sonrası 1.000 çağrı başına 25 USD (2026-09 fiyat listesi).

| Mod | Aylık Google çağrısı | Tahmini maliyet |
|---|---|---|
| Canlı (varsayılan) | ≈ yorum bloğunun yüklendiği sayfa görüntülemesi | 1.000 → 0 USD; 3.000 → 50 USD; 10.000 → 225 USD |
| Önbellek 6 sa (özel alan adı) | veri merkezi başına ~4/gün → ~120–500 | 0 USD |

Canlı modda: Google Console'da günlük kota ve bütçe uyarısı kurun (§5.2), yorum bloğunu yalnızca
görünür olduğunda (IntersectionObserver) yükleyin ve Worker'ın 30 istek/dk IP sınırına güvenin.

### 5.4 Ön yüzde gösterim yükümlülükleri (Places politikası)

Yanıt biçimi:

```json
{
  "ok": true, "attribution": "Google", "name": "…", "rating": 4.8, "userRatingCount": 57,
  "googleMapsUri": "https://maps.google.com/?cid=…",
  "reviews": [{ "author": "…", "authorUri": "…", "authorPhoto": "…", "rating": 5, "text": "…",
                "translated": false, "relativeTime": "2 hafta önce", "publishTime": "2026-09-10T08:15:30Z",
                "reviewUri": "https://www.google.com/maps/reviews/…", "flagUri": "…" }],
  "fetchedAt": "2026-09-25T07:00:00.000Z"
}
```

- Yanıttaki `googleMapsUri` (işletme), her yorumun `reviewUri` (`Review.googleMapsUri`) ve `flagUri` (`Review.flagContentUri`) alanları politika için taşınır.
- Bloğa **Google Maps logosu** (veya yer yoksa "Google Maps" metni, değiştirilmemiş) eklenir; blok görsel olarak ayrılır.
- Her yorumda yazar avatarı + adı (`authorUri`'ye bağlantılı), yıldız, metin, `relativeTime`,
  ve **`reviewUri`'ye "Google Maps'te gör" bağlantısı** (zorunlu). `flagUri` ile "Sorun bildir" önerilir.
- Yanıt `ok:false` ise (503/502) yalnızca Google bağlantı kartı gösterilir; **asla sahte/örnek yorum gösterilmez**.
- En fazla 5 yorum gelir, "alaka" sırasına göre; yeniden sıralama parametresi Places API (New)'de yoktur.

---

## 6. Yayınlama

### 6.1 `workers.dev` (varsayılan, DNS değişikliği gerekmez)

```bash
npm run deploy
# → https://ayaz-isitme-api.<hesap-alt-alani>.workers.dev
```

Bu adresi ön yüzün `PUBLIC_API_BASE` değişkenine yazın.

### 6.2 Özel alan adı `api.keciorenisitme.com`

Ön koşul: `keciorenisitme.com` DNS'inin **Cloudflare'da** olması (ücretsiz plan yeter). GitHub
Pages ile çakışmaz: mevcut `A`/`CNAME` kayıtlarını Cloudflare'a aynen taşıyın (Pages kayıtları
"DNS only" bırakılabilir). Ardından `wrangler.jsonc`'ta iki satırın yorumunu açın:

```jsonc
"routes": [{ "pattern": "api.keciorenisitme.com", "custom_domain": true }],
"workers_dev": false,
```

`npm run deploy` DNS kaydını ve sertifikayı otomatik oluşturur (`api` için önceden CNAME
olmamalı). Önbellek açılacaksa özel alan adı gerekir: Cache API'nin belgelenmiş çalışma alanıdır (§5.3).

### 6.3 GitHub Actions ile otomatik deploy

Cloudflare Dashboard → *My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"* şablonu;
hesabı tek hesapla sınırlayın. Repo *Settings → Secrets and variables → Actions*:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ve Worker secret'ları.

```yaml
# .github/workflows/worker-deploy.yml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths: ["worker/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: worker/package-lock.json
      - run: npm ci
        working-directory: worker
      - run: npm test && npm run typecheck
        working-directory: worker
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          # command varsayılanı: deploy
          secrets: |
            RESEND_API_KEY
            TURNSTILE_SECRET_KEY
            GOOGLE_PLACES_API_KEY
            GOOGLE_PLACE_ID
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          TURNSTILE_SECRET_KEY: ${{ secrets.TURNSTILE_SECRET_KEY }}
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}
          GOOGLE_PLACE_ID: ${{ secrets.GOOGLE_PLACE_ID }}
```

`secrets:` listesindeki her ad `env:` altında aynı adla bulunmalıdır. Telegram kullanılacaksa
`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` de eklenir.

---

## 7. Ön yüzün (Astro) ihtiyaç duyduğu değişkenler

`.env` / GitHub Pages build ortamı:

| Değişken | Değer |
|---|---|
| `PUBLIC_API_BASE` | `https://api.keciorenisitme.com` **veya** `https://ayaz-isitme-api.<alt-alan>.workers.dev` (sonda `/` yok). Boşsa form WhatsApp'a yönlendirir, yorum bloğu bağlantı kartı gösterir |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site anahtarı (gizli değil). Boşsa widget çizilmez; Worker'da secret de boş bırakılmalı |

İstek sözleşmesi (`POST {PUBLIC_API_BASE}/api/appointment`, `Content-Type: application/json`):

```ts
{
  name: string,            // 2–80 karakter; harf (Türkçe dâhil), boşluk, tire, kesme
  phone: string,           // "0507 155 11 51" | "5071551151" | "+90 507 155 11 51" → +905071551151
  time?: string,           // ≤ 60 karakter, serbest metin
  consent: true,           // KVKK onayı; tam olarak boolean true
  website?: string,        // honeypot: gizli alan, BOŞ kalmalı
  t?: number,              // formun açıldığı Date.now()
  turnstileToken?: string, // cf-turnstile-response
  locale?: 'tr' | 'en'
}
```

Yanıtlar:

| HTTP | Gövde | Ön yüz davranışı |
|---|---|---|
| 200 | `{ ok:true, delivered:true, provider:'resend'\|'brevo'\|'telegram', telegram:boolean }` | Teşekkür mesajı |
| 200 | `{ ok:true, delivered:false, provider:'mock'\|'none' }` | Başarı **gösterme**; WhatsApp/telefon seçeneği sun |
| 400 | `{ ok:false, error:'validation', fields:{ name?:…, phone?:…, time?:…, consent?:… } }` | Alan hatalarını göster |
| 400 | `{ ok:false, error:'too_fast' }` | "Lütfen tekrar deneyin" |
| 400 | `{ ok:false, error:'bad_request', reason }` | Genel hata |
| 403 | `{ ok:false, error:'turnstile', codes:[…] }` | Widget'ı sıfırla, tekrar dene |
| 403 | `{ ok:false, error:'origin' }` | İzinli kaynak değil (ALLOWED_ORIGINS) |
| 429 | `{ ok:false, error:'rate_limited' }` + `Retry-After` | Biraz sonra tekrar |
| 502 | `{ ok:false, error:'delivery_failed' }` | WhatsApp'a yönlendir |
| 503 | `{ ok:false, error:'turnstile_unavailable' }` | WhatsApp'a yönlendir |

`GET /api/reviews`: `200` (bkz. §5.4; `X-Cache: bypass|hit|miss|stale`), `429 rate_limited`, `503 not_configured`, `502 upstream`. Hepsi CORS başlıklı JSON;
bilinmeyen yol `404 not_found`, yanlış yöntem `405 method_not_allowed`; beklenmeyen hata `500 internal`
(yığın izi yalnızca loga gider).

---

## 8. Maliyet özeti (Free katmanlar, 2026-09)

| Servis | Ücretsiz sınır | Bu kullanım |
|---|---|---|
| Cloudflare Workers | 100.000 istek/gün, 10 ms CPU/istek | Form + yorum istekleri çok altında; `fetch` bekleme süresi CPU'ya sayılmaz |
| Rate Limiting binding | ücret belirtilmemiş | — |
| Workers KV (yalnızca yedek) | 100.000 okuma, 1.000 yazma/gün | Kullanılmıyor |
| Resend | 3.000/ay, 100/gün | Randevu hacmi için yeterli |
| Google Places API (New) | 1.000 Enterprise+Atmosphere çağrı/ay | Canlı modda sayfa görüntülemesi kadar (bkz. §5.3); önbellekle ~120–500/ay |
| Turnstile, Telegram | ücretsiz | — |

---

## 9. Gizlilik / KVKK notları

- Form verisi hiçbir yerde saklanmaz; yalnızca e-posta/Telegram olarak iletilir.
- Loglarda telefon maskelenir (`+90507*****51`), ad ve serbest metin loglanmaz; IP loglanmaz
  (yalnızca ülke kodu). `observability` açıkken Cloudflare istek loglarını kendi saklama süresince tutar.
- Yanıtlar gönderilen kişisel veriyi geri yansıtmaz; hata gövdelerinde yalnızca kodlar bulunur.
- Yorumlar varsayılan olarak saklanmaz; önbellek açılırsa yalnızca uçta, en fazla `REVIEWS_CACHE_TTL + REVIEWS_CACHE_STALE_TTL` süreyle durur.
- Güvenlik başlıkları her yanıtta: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Content-Security-Policy: default-src 'none'`, `Strict-Transport-Security`.

---

## 10. Sorun giderme

| Belirti | Kontrol |
|---|---|
| `provider:'mock'` dönüyor | `/api/health` → `features.mail` (`rateLimit.appointment/reviews` ve `reviewsCacheTtl` de burada görünür). Secret girildi mi (`wrangler secret list`)? `MAIL_PROVIDER` doğru mu? |
| `502 delivery_failed` | Worker logları (`npx wrangler tail`): `error="422 validation_error …"` gibi sağlayıcı özeti görünür; genellikle `MAIL_FROM` alan adı doğrulanmamıştır |
| `403 origin` | İstek `Origin` başlığı `ALLOWED_ORIGINS`'te değil (şema+host, `www` farkı!) |
| `403 turnstile hostname-mismatch` | Turnstile widget'ı `ALLOWED_ORIGINS` dışındaki bir hostname'de çizilmiş |
| `/api/reviews` → 503 | `GOOGLE_PLACE_ID` veya `GOOGLE_PLACES_API_KEY` eksik |
| `/api/reviews` → 502 | Loglarda `places 403 PERMISSION_DENIED` → API etkin değil ya da anahtar kısıtı yanlış; `places 400 INVALID_ARGUMENT` → Place ID hatalı |
| `/api/reviews` → 429 | Aynı IP'den dakikada 30'dan fazla istek; ön yüz bloğu yalnızca bir kez yüklemeli |
| Önbellek açık ama her istek `X-Cache: miss` | Cache API `workers.dev`'de çalışmıyor olabilir → özel alan adı (§6.2). `X-Cache: bypass` ise önbellek kapalıdır (`REVIEWS_CACHE_TTL=0`) |
