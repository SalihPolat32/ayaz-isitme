# İçerik Doğrulama Listesi — Ayaz İşitme Merkezi

Bu liste, yayına çıkmadan önce **işletme sahibinin yazılı teyit vermesi gereken** bilgileri toplar.
Kaynak: `src/config/business.ts` (`verificationStatus` alanları) ve içerik dosyaları (`src/content/tr.ts`, `en.ts`).
Yayın kuralı: `verified`, `from-live-site` ve `storefront` durumları yayınlanır; `unverified` yayınlanmaz.

## 1. İşletme bilgileri

| Bilgi | Sitede | Durum | Kaynak / not | Teyit |
|---|---|---|---|---|
| Kısa marka: Ayaz İşitme Merkezi | Evet | verified | Logo ve kullanıcı talebi | ☐ |
| Resmî ad: Ayaz İşitme Cihazları Satış ve Uygulama Merkezi | Footer, JSON-LD | verified | Canlı site, tabela | ☐ |
| Telefon 0507 155 11 51 / WhatsApp aynı numara | Evet | verified | Canlı site, tabela, Google kaydı | ☐ |
| E-posta ayazisitmecihazlari@gmail.com | Evet | verified | Canlı site | ☐ |
| Adres: Aşağı Eğlence Mah. Ayvalı Cad. No:26/A Keçiören | Evet | verified | Canlı site, Google kaydı | ☐ |
| Posta kodu 06010 | Yalnızca JSON-LD | from-live-site | Canlı sitedeki JSON-LD | ☐ |
| Çalışma saatleri Pzt–Cmt 09:00–19:00, Pazar kapalı | Evet (iletişim, SSS, JSON-LD) | verified | İşletmenin Google Takeout dışa aktarımı (ana profil, 26 Eyl 2026) + kullanıcı onayı ("Google kartı kapanışı 19:00"). Eski sitenin 18:00'i büyük olasılıkla 2026 bayram özel saatlerinden (09–18). Yinelenen iki profil farklı saat bildiriyor (Pazar açık / Cumartesi 17:00) — §11. | ☑ |
| Koordinat (39.978, 32.866) | Hayır | unverified | Canlı sitede yuvarlatılmış; JSON-LD'ye yazılmadı | ☐ |
| Google Place ID `ChIJFz--mydN0xQRGFX1eR6q5s8` | Harita bağlantısı, Worker | verified | İşletmenin kendi Google Takeout dışa aktarımı (üç profilde de aynı Place ID) | ☑ |
| İkinci telefon 0538 778 06 51 | Hayır | unverified | Yalnızca Google ana profilinde kayıtlı; sitede gösterilsin mi? İşletme kararı | ☐ |
| "Daha fazla yorum alın" bağlantısı | Hayır | boş | Google İşletme Profili > Yorumları oku > Daha fazla yorum alın > Kopyala | ☐ |

## 2. Vitrin/tabela fotoğraflarında görülen iddialar

| İddia | Nerede görüldü | Sitede nasıl geçiyor | Teyit |
|---|---|---|---|
| SGK anlaşmalı merkez | Vitrin (ofis-6.jpg: "SGK Anlaşmalı Kurum") | Teyit bekliyor; hero, hizmetler ve SSS iddiası kapalı | ☐ |
| Ücretsiz işitme testi | Vitrin ("Ücretsiz işitme testi"), canlı site başlığı | Teyit bekliyor; ücretsiz ifadesi kapalı | ☐ |
| İşitme cihazı pili / filtre satışı | Vitrin, ofiste Varta pil standı | Hizmetler | ☐ |
| Kulak kalıbı üretimi | Vitrin ("Kulak kalıbı") | Ayrı bölüm | ☐ |

**Tur 10 (27 Eyl 2026) — görsellerdeki iddialar:** Paylaşım kartı (`og.jpg`, JSON-LD görseli) vitrin fotoğrafından üretildiği için SGK logosu, "ücretsiz işitme ve çınlama testi", "Ody." unvanı ve ikinci telefon okunuyordu; kart artık logo + metin + temsili cihaz render'larıdır (`scripts/make-og.mjs`, TR ve EN ayrı). SSS'deki "SGK süreci için kimliğinizi getirin" cümlesi SGK iddiasına bağlandı (doğrulanınca kendiliğinden görünür). **Açık karar ☐:** galerinin ana fotoğrafı (ofis-6, mağaza cephesi) aynı vitrin yazılarını + "12 aya kadar taksit", "ömür boyu bakım" çıkartmalarını gösteriyor (büyütmede okunur). Bırakılsın mı, paneller bulanıklaştırılsın mı, yoksa tabelayı gösteren bir kırpım mı kullanılsın?

SGK ve ücretsiz test inceleme sırasında `unverified` yapıldı; çalışma saatleri 26 Eyl 2026'da Takeout + kullanıcı onayıyla `verified` (09:00–19:00) oldu. Teyit geldikten sonra diğerleri de `verified` yapılabilir. Bir iddiayı kapatmak için ilgili satırı `src/config/business.ts` içinde `status: 'unverified'` yapmak yeterlidir; metinler otomatik düşer.

## 3. Ekip

| Bilgi | Sitede | Durum | Not |
|---|---|---|---|
| Emre Dağlıoğlu, "Ody." | Merkezimiz bölümü (yalnızca "Emre Dağlıoğlu"; unvan teyide kadar gizli) | storefront | Vitrin ve masa isimliğinde görülüyor. **"Ody." = Odyolog mu Odyometrist mi teyit edilmeli**; yönetmelik (RG 24.09.2011/28064, Geçici m.2) her iki unvana da izin veriyor. Özgeçmiş/uzmanlık metni yazılmadı. |
| Diğer personel | Yok | — | Bilgi gelirse eklenir |

## 4. Markalar ve ürünler

| Konu | Sitede | Durum |
|---|---|---|
| Phonak, Oticon, Widex, Bernafon, Signia, ReSound, Starkey, Unitron, Philips, Beltone | "Markalar ve teknolojiler" — **tarafsız bilgilendirme**; yetkili bayilik, stok, fiyat iddiası yok | Kurumsal grup bilgileri resmî sayfalardan doğrulandı (Sonova, Demant, WS Audiology, GN, Starkey) |
| Merkezde uygulanan markalar | Yok | unverified — ofis fotoğraflarında Bernafon/Demant materyalleri; dizinde Bernafon, Oticon, Coselgi fiyat listeleri. Yazılı teyit gelince "Merkezimizde uygulanan markalar" satırı eklenebilir. |
| "Tim Group" ilişkisi | Yok | Araştırma: Tim Toptan'ın sitesinde Demant/Bernafon geçmiyor (Cochlear, Coselgi, Unitron, Signia, Phonak, Widex, Hansaton listeleniyor). Distribütörlük iddiası **kullanılmamalı**. |
| Bernafon ürün görselleri (eski site) | Kullanılmadı | Ticari kullanım hakkı belirsiz (eski README uyarısı) |
| Model bazlı teknik değerler (pil süresi, IP, Bluetooth sürümü) | Yok | Yazılmadı; eklenecekse üretici dokümanı + tarih ile |
| **Hukuki değerlendirme gerektiren: marka bölümü** | "Markalar ve teknolojiler" | Hukuk incelemesi (26 Eyl 2026): Sağlık Hizmetlerinde Tanıtım Yön. (2025) m.5(1)(h) "örtülü veya açık firma, ürün veya marka tanıtımı yapılamaz"; Tıbbi Cihaz Satış, Reklam ve Tanıtım Yön. m.15(1)(a) yalnız merkezlerde satılan cihazların tüketiciye reklamını yasaklıyor (istisna: resmî sitede pazarlama niteliği taşımayan cihaz bilgilendirmesi). Bölüm tarafsız bilgilendirme olarak yazıldı, ama marka adlarının kalıp kalmayacağı avukat/İl Sağlık Müdürlüğü görüşüyle karara bağlanmalı. Tur 9 (27 Eyl 2026): markaya özgü tanıtım cümleleri (ör. "BrainHearing", "doğal ses karakteri") kaldırıldı; bölüm artık yalnız marka adı + bağlı olduğu grup ve markasız teknoloji açıklamalarıdır. Resmî logo kullanılmadı (izin yok; bkz. ASSET-MANIFEST.md). ☐ |

## 5. Cihaz türü içerikleri

Tür açıklamaları ve karşılaştırma tablosu üretici rehberlerine dayanır (Phonak, Widex, ReSound, Starkey, Oticon, Signia; kaynak listesi: ilk araştırma turunun `devices-brands.md` §10 dosyası artık diskte yok; üretici rehber bağlantıları depo dışındaki `AYAZ-ARASTIRMA-VE-YOL-HARITASI.md` içinde, ör. Phonak cihaz rehberi). Sitede "genel rehber" uyarısı var. Odyoloji uzmanı gözden geçirmesi önerilir: ☐

## 6. SGK ve mevzuat ifadeleri

- SSS'de SGK cevabı yalnızca süreç özetidir (rapor + reçete, SUT ile güncellenen tutar/koşullar). Tutar, katkı payı yüzdesi ve yenileme süresi **yayınlanmadı**.
- Reklam mevzuatı: Tıbbi Cihaz Satış, Reklam ve Tanıtım Yönetmeliği m.15 — işitme cihazı **ürün reklamı** tüketiciye yapılamaz; merkezin **kendi sitesindeki cihaz bilgilendirmesi** istisna (m.15/2). Reklam kampanyaları merkez ve hizmetleri odaklı kurulmalı. Avukat teyidi: ☐

## 7. Hukuki metinler (27 Eylül 2026 — yapılandırmaya bağlı metin + yayın kapısı)

Metin: `src/content/legal/tr.ts` (esas) ve `en.ts`, sayfa: `/gizlilik/`, `/en/privacy/`. Metin **derleme yapılandırmasından üretilir** ve yalnızca o derlemede gerçekten çalışan işlemeyi anlatır (`src/content/legal/facts.ts` > `LegalBuildContext`):

| Derleme değeri | Metne etkisi (kaynak kod) |
|---|---|
| `PUBLIC_API_BASE` boş | **WhatsApp modu**: form veriyi hiçbir sunucuya göndermez; tarayıcıda hazır WhatsApp mesajı + `wa.me` (`src/scripts/form.ts`). Alıcılar: GitHub Pages, Google (harita, Gmail), WhatsApp/Meta. |
| `PUBLIC_API_BASE` dolu | **API modu**: ad, telefon, zaman → Cloudflare Worker → bildirim kanalı (`worker/src/appointment.ts`); bildirimde alınma zamanı, sayfa adresi, dil, ülke kodu; IP yalnızca 60 sn hız sınırı (+ Turnstile); Worker logunda maskeli telefon/ülke/sonuç, ad ve IP yok. Cloudflare'in otomatik çağrı (invocation) logları ve izleme (traces) kapalı (`worker/wrangler.jsonc` > `observability`); açılırsa metin önce güncellenir. Bildirim kanalları "A, B ve C" biçiminde listelenir. Karusel modunda canlı yorumlar da Worker'dan (`src/scripts/reviews.ts`). |
| `PUBLIC_TURNSTILE_SITE_KEY` (+ API modu) | Turnstile paragrafı ve alıcısı. |
| `PUBLIC_GA4_ID`, `PUBLIC_GADS_ID`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_OPENAI_PIXEL_ID` | Yalnızca tanımlı olanlar "izninize bağlı" bölümünde ve alıcı listesinde; m.5/1 açık rıza cümlesi yalnızca en az biri varsa. Hiçbiri yoksa "hiçbir analitik veya pazarlama hizmeti etkin değildir". **Çerez paneli de aynı bağlamdan üretilir** (`src/content/legal/consent-view.ts`, `ConsentBanner.astro`): Analitik kategorisi yalnızca `PUBLIC_GA4_ID` ile (Google Analytics); Pazarlama kategorisi yalnızca Ads/Meta/OpenAI kimliklerinden biri varsa ve yalnızca tanımlı olanları adlandırır; hiçbiri yoksa panel izin istemez — yalnızca harita notu + politika bağlantısı ve tek "Anladım" düğmesi (kayıt `analytics:false, marketing:false`). |

Sabit gerçekler (koddan): sitenin kendi kodu çerez yazmaz; izinsiz yazılan tek kayıtlar `ayaz.consent.v1` (localStorage, seçim 180 gün geçerli — `src/scripts/consent.ts`) ve `ayaz.topic` (sessionStorage, kart düğmesiyle seçilen konu — `src/scripts/track.ts`); yazı tipleri build'de self-host (`astro.config.mjs` fonts; derlenmiş HTML/CSS'te `fonts.googleapis`/`fonts.gstatic` yok); barındırma GitHub Pages (`deploy.yml`, `public/CNAME`; GitHub'ın belgesine göre ziyaretçi IP'si güvenlik için kaydedilir); harita izin beklemeden yüklenir, IP + tarayıcı bilgisi + sayfa adresi Google'a gider, Google çerez yerleştirebilir/okuyabilir (§10). Çerez adları/süreleri sağlayıcılara aittir: metinde tahmini süre **yazılmaz**, sağlayıcının çerez sayfasına bağlantı verilir.

**İşletme/avukat girdileri** — `src/config/business.ts` > `legalFacts` (`business.legal`). Tahminle doldurulmaz; bilinmeyen `null` kalır:

| Anahtar | Soru | Ne zaman gerekli | Durum |
|---|---|---|---|
| `retention.appointmentRequestsMonths` | Randevu ve iletişim talepleri, talebin alındığı tarihten itibaren en fazla kaç ay saklanıyor ve sonra siliniyor? (tam sayı, ay) | her zaman | ☑ **6 ay** — işletme sahibi yanıtı, 27 Eyl 2026 (`business.ts`'e yazıldı) |
| `retention.whatsappMonths` | WhatsApp yazışmaları en fazla kaç ay tutuluyor ve sonra siliniyor? (ay) | her zaman | ☑ **6 ay** — işletme sahibi yanıtı, 27 Eyl 2026 (`business.ts`'e yazıldı) |
| `retention.technicalLogsDays` | Cloudflare Worker çalışma kayıtları (Workers Logs) kaç gün tutuluyor? (gün) | API modu | ☐ |
| `notificationChannels` | Worker'da gerçekten etkin bildirim kanalları: `'resend'`, `'brevo'`, `'telegram'` | API modu | ☐ |
| `crossBorderBasis.tr` / `.en` | KVKK m.9 yurt dışı aktarım dayanağı (avukat metni, tek cümle, TR + EN). Alıcıların hepsi yurt dışında: GitHub, Google, WhatsApp/Meta; API modunda Cloudflare ve bildirim sağlayıcısı; izinle ölçüm hizmetleri | her zaman | ☐ |
| `legalBasesConfirmation` | Metindeki hukuki sebeplerin teyidi: form/iletişim m.5/2-(c)+(f); barındırma, güvenlik, harita m.5/2-(f); isteğe bağlı çerezler m.5/1 açık rıza. `{ by, date: 'YYYY-AA-GG' }` | her zaman | ☐ |
| `textApproval` | Metinlerin tamamının onayı `{ by, date, version, context, hash }` — `version` = `LEGAL_TEXT_VERSION` (`facts.ts`, insan okuyabilir etiket, şu an `2026-09-27.4`); `context` = derleme yapılandırmasının imzası (`legalContextSignature`: form modu, Turnstile, canlı yorumlar, ölçüm kimlikleri — metin bunlara göre farklı basılır); `hash` = onaylanan **nihai metnin** içerik özeti (`src/content/legal/text-hash.ts` > `legalTextHash(ctx, facts)`: bu bağlamda, yukarıdaki alanların **gerçek değerleriyle** ve önizleme uyarısı olmadan basılan gizlilik sayfası TR/EN + çerez paneli TR/EN + harita notu TR/EN + randevu formunun KVKK onay cümlesi/bağlantısı ve WhatsApp açıklaması TR/EN + yukarıdaki alanların kendisi (sayfada görünmeyenler dahil: WhatsApp modunda `technicalLogsDays`, `legalBasesConfirmation`'ın `by`/`date`'i) + `context` + `version`; kararlı JSON, sha256 ilk 16 hane; yalnızca `textApproval` nesnesinin kendisi özete girmez). **Sıra zorunlu:** (1) yukarıdaki alanların hepsi doldurulur → (2) önizleme (veya QA) derlemesinde nihai `/gizlilik/` ve `/en/privacy/` metinleri, çerez paneli, harita notu ve form onay metni okunur → (3) derlemenin bastığı nesne onaylanıp kopyalanır. Yukarıdaki alanlardan biri eksikken onay **kabul edilmez** (özeti tutsa bile) ve hata mesajı **kopyalanacak özet basmaz** (yer tutuculu metnin özeti olurdu); bunun yerine "önce yukarıdaki N bilgiyi doldurun, derlemeyi yeniden çalıştırın" der. Alanlar tamamken üretim derlemesinin hata mesajı nesneyi tam haliyle basar (`textApproval: { by: '<rol/kısa ad>', date: '<YYYY-AA-GG>', version: '…', context: '…', hash: '…' }`); aynı nesne önizleme sayfasının üstündeki "onay bekliyor" uyarısında ve derleme günlüğünde de görünür (`data-legal-approval`; uyarı özete girmez). `by`/`date` doldurulup olduğu gibi kopyalanır. Onaydan sonra yukarıdaki alanlardan biri (saklama süresi, bildirim kanalı, m.9 cümlesi, teyit), metnin herhangi bir ifadesi (hash) ya da yapılandırma (context/hash; ör. GitHub Variables'a `PUBLIC_GA4_ID` eklenmesi) değişirse onay geçersizleşir ve **yeni onay** gerekir. Önizleme derlemesinin yapılandırması üretiminkinden farklıysa (ör. ölçüm kimlikleri yalnızca GitHub Variables'ta), geçerli nesne üretim derlemesinin hata mesajındakidir | her zaman | ☐ |

`by` alanına rol veya kısa ad yazın ("İşletme sahibi", "Av. A. B."): repo herkese açıktır.

**Yayın kapısı:** `PUBLIC_SITE_ENV=production` derlemesi, gerekli bir anahtar eksik/geçersizse `[hukuki-metin-kapısı] Üretim derlemesi durduruldu …` hatasıyla her eksik anahtarı ve sorusunu listeleyerek **durur** (`enforceLegalGate(facts, ctx, legalTextHash(ctx, facts))`, `src/content/legal/index.ts`, sayfa ön-derlemesinde); `textApproval` eksik/geçersizse ve diğer tüm alanlar doluysa bu derleme için girilecek tam nesneyi (`version`, `context`, nihai metnin `hash`'i dahil) basar; diğer alanlardan biri eksikse özet basmaz, önce onları doldurmayı ister. Bu, GitHub Actions dağıtımını da durdurur: bilgiler doldurulana kadar yeni sürüm yayına çıkmaz (canlıdaki son sürüm yerinde kalır). Önizleme derlemelerinde (ve dev sunucusunda) eksikler `<mark class="legal-todo">İşletme dolduracak: …</mark>` olarak işaretlenir ve sayfanın üstünde eksik listesiyle önizleme uyarısı görünür; yalnızca `textApproval` eksikse sayfa nihai metinle basılır ve uyarı onaylanacak nesneyi gösterir (sayfa yine `noindex`). Hepsi doluysa çıktıda hiçbir yer tutucu/uyarı yoktur (`tests/legal.test.ts`: `[`, `•`, "doğrulanacak", "yazılacak", "Hukuki inceleme", "taslak", "to be confirmed", "pending" yok).

**QA geçersiz kılma:** `ALLOW_INCOMPLETE_LEGAL=1` (yalnızca komut satırı ortamı; `.env.example`'da açıklandı). Üretim derlemesini yer tutucularla tamamlar; böyle bir derlemede **tüm sayfalar `noindex, nofollow`** olur (`Base.astro` > `qaOverride`; taslak içeren gizlilik sayfaları her durumda noindex), barındırılan bir QA derlemesi dizine eklenemez. Yer tutucu stili (`mark.legal-todo`) yalnızca yer tutucu basılan sayfaya satır içi eklenir; tamamlanmış çıktıda CSS'te de yoktur; **deploy.yml'de asla tanımlanmaz** (`tests/legal.test.ts` deploy.yml'i denetler; GitHub Variables derlemeye yalnızca deploy.yml'in `vars.X` ile aktardıkları üzerinden geçtiği için orada tanımlanması etkisizdir).

Açık konular: VERBİS kayıt yükümlülüğü/durumu (metne yazılmadı) ☐ · Avukat incelemesi ☐ · İşletme içi uygulamanın (silme, WhatsApp yedeği) gerçekten beyan edilen sürelere uyması ☐

## 8. Görsel kullanım hakları

Bkz. `ASSET-MANIFEST.md`. Ofis fotoğrafları ve logo işletmeye ait kabul edildi; fotoğraftaki kişinin yayın izni: ☐

## 9. Google yorumları (26 Eylül 2026 — Takeout içe aktarıldı, hukuki karar bekliyor)

Veri: `src/content/reviews-data.json` (üretici: `node scripts/import-google-reviews.mjs <Takeout>`), sıra/çıkarma: `src/content/reviews-curation.json`.

| Konu | Durum / karar |
|---|---|
| Kaynak | İşletmenin kendi **Google Takeout → İşletme Profili** dışa aktarımı (ana profil `location-…8883`): **65 puan (hepsi 5★), 58 metinli yorum**, Ocak 2024 – 20 Temmuz 2026. Google Haritalar kazınmadı. |
| Sitede (karusel modu) | TR **53**, EN **47** yorum (Tur 5, 26 Eyl 2026; önce TR 36 / EN 29). 65 = toplam puan sayısı; bunların 7'si metinsizdir ve kart olarak gösterilemez, özet kartında sayılır; döngülü, en iyiler önde. Sıra: üç bağımsız okuma (güven, risk, çeşitlilik) + Borda sayımı → 12 sabit (pin); editoryal olarak geri alınanlar sonda. EN'de yalnızca Google çevirisi özgünü çarpıtan 6 yorum yalnız TR'de (Tur 5 doğrulamasında 'Eşim → my wife' da eklendi) (`enExclude`, `translation-error`); EN sabitleri `enPin`. |
| Görünen ad düzeltmesi (Tur 10) | Bir yorumcunun Google kullanıcı adı ad ve soyadın bitişik yazımıydı (ad-soyad bitişik yazılmış tek kelime → tam ad sayılır, depo herkese açık; yorum kimliği `reviews-curation.json > displayNames` içinde). `reviews-curation.json > displayNames` ile "Samet Ö." gösteriliyor; `reviews-data.json` da güncellendi (parmak izleri Google adından hesaplandığı için değişmedi). Kısaltma kullanıcı adından okunmuştur — **işletme sahibi onaylamalı ya da başka biçim vermeli** ☐. |
| Çıkarılan 5 yorum (`legal-risk`) | İşletme sahibinin "hepsini alalım" talebiyle 22 çıkarma yeniden sınıflandırıldı; yalnız hukuki risk taşıyanlar gizli: Salih P. (profil yöneticisiyle aynı ad → **olası** çıkar çatışması, TEYİT EDİLMEDİ — işletme sahibi teyit etmeli ☐), gizem (sağlık sonucu "sorunu kalmadı" + diğer merkezlerle olumsuz kıyas), Emir Ö. ve Sadullah K. (rakip kıyası), Arda G. (fiyat + "tek adresi"). 17 `editorial` kayıt (kısa/zayıf, argo, "kulaklık", "yeni açıldı", marka/model içermeyen genel cihaz memnuniyeti) geri alındı. Gerekçeler `reviews-curation.json`. ☐ |
| **Ürün/cihaz övgüsü içeren yorumlar (karar ☐)** | Önceki turda Tıbbi Cihaz Satış, Reklam ve Tanıtım Yön. m.15(1)(a) (yalnız merkezde satılan cihazların tüketiciye reklamı) gerekçesiyle gizlenen genel cihaz övgüleri (ör. "Kaliteli ürün", "cihazlar çok kaliteli", "cihazdan memnunuz", "cihaz sorunsuz çalışıyor"; marka/model adı içermeyenler) Tur 5'te işletme sahibinin "yorumların hepsi gösterilsin" isteğiyle `editorial` sayılıp geri alındı ve listenin sonuna kondu. Bu bir hukuki değerlendirme DEĞİLDİR; karusel modu seçilecekse bu grup için de avukat/İl Sağlık Müdürlüğü görüşü alınmalı. Gizlemek için ilgili kayıtların `category` alanı `legal-risk` yapılıp içe aktarıcı çalıştırılır. |
| **HUKUKİ BULGU** | Ticari Reklam ve Haksız Ticari Uygulamalar Yön. **m.28/B(1) ve (6)** (RG 1/7/2026-33297, yürürlük **1/8/2026**) satın alımı doğrulanamayan mecralardan (Google) alınan yorumların yayınını ve reklamda kullanımını yasaklıyor; **m.4/1-t** yıldız/puanı da "tüketici değerlendirmesi" sayıyor. Reklam Kurulu 14/2/2025 (354. toplantı) kararı Google yorum+puanlarını satıcı sitesinde yayınlamayı "uyarı olsun olmasın" haksız ticari uygulama saydı. Ayrıca Sağlık Hizmetlerinde Tanıtım ve Bilgilendirme Yön. (RG 12/11/2025) **m.5(1)(e)** hasta/yakın teşekkür-memnuniyet ifadeleriyle reklamı yasaklıyor. Yaptırım: durdurma, içerik kaldırma ve 6502 s. Kanun m.63/m.77 uyarınca idari para cezası — **güncel ceza tutarı teyit edilmedi** (GPT incelemesi, 26 Eyl 2026; Tur 4 raporundaki TL aralığı kesin rakam olarak aktarılmamalı). Ticaret Bakanlığının 2026 duyurusu (1/8/2026 yürürlük) ve 2025 Reklam Kurulu duyurusu GPT tarafından da doğrulandı. İki bağımsız ajan birincil metinlerden doğruladı (güven: yüksek). ☐ **İşletme/avukat kararı** |
| Gösterim modu | `business.reviewsDisplay` = `'carousel'` (kullanıcı talebi, şu an) \| `'link'` (yorum metni/puan/adet yok, yalnızca Google profil bağlantısı — **önerilen**). GitHub > Settings > Variables > `PUBLIC_REVIEWS_DISPLAY=link` ile kod değişmeden de geçilir. ☐ |
| Canlı site (e851804) | Yorum metni veya puan **yok**; yalnızca "Yorumlarımız Google'da" bağlantısı (26 Eyl 2026 kontrol edildi). |
| Yazar adları | Kısa ad ("Akın E."). KVKK m.6: yorum, yazarın işitme cihazı kullandığını gösterebilir (özel nitelikli veri) → yayın için açık rıza en güvenli yol. ☐ |
| Şema | `Review`/`AggregateRating` JSON-LD **yok** (Google: başka siteden toplanan yorumlar işaretlenmez). |
| Canlı veri (Worker) | `'link'` modunda Places API yorum çağrısı da yapılmaz (otomatik test: `tests/e2e/reviews-link-mode.spec.ts`). Karusel + API modunda canlı yorumlar statik kartlarla ve seçkide çıkarılan yorumların koruma kayıtlarıyla (yorum başına bir kayıt; yalnızca özetler) AYNI kayıt başına kurallarla eşleştirilir: kısa ad + ay ya da 40 karakterlik ortak açılış tek başına kimseyi elemez. Çıkarılan bir yorum birebir, gürültülü ya da benzer biçimde ya da aynı kimlikle gelirse engellenir; EN sayfasında Google'ın çevirisi Takeout çevirisinden belirgin farklıysa ve kimlik eşleşmiyorsa geri görünebilir (INTEGRATIONS.md §5, risk 12) — canlı API açılmadan önce Places yorum kimliğinin Takeout kimliğiyle aynı olduğu doğrulanmalı. Takeout sonrası yazılan yeni yorumlar ise incelemesiz görünebilir. ☐ |
| Eski görüntü | Takeout, Google'da sonradan silinen/düzenlenen yorumları bilemez; "itibarıyla" tarihi gösterilir, 90 günden eskiyse derleme uyarır. Düzenli yeniden içe aktarma: ☐ |

## 10. Harita gömmesi (26 Eylül 2026 değişti)

İletişim bölümündeki Google Haritalar artık **doğrudan** yüklenir (önceden tıkla-yükle idi) ve işletme adı + adres sorgusuyla **Ayaz İşitme işaretli** açılır (işletme kartı, puan ve "Yol tarifi" düğmesi Google'dan gelir). İşletme sahibinin kararı: harita otomatik yüklenmeye devam eder (tıkla-yükle yok).

Metin (27 Eyl 2026): çerez bölümü bunu **çelişkisiz** anlatır — "sitemizin kendi kodu çerez yazmaz" + haritanın izin beklemeden yüklendiği, IP adresi, tarayıcı bilgisi ve sayfa adresinin Google'a iletildiği, Google'ın kendi çerezlerini yerleştirebileceği/okuyabileceği; Google gizlilik ve çerez sayfalarına bağlantı; haritayı kullanmak istemeyenler için adres ve telefonun aynı bölümde metin olarak bulunduğu. Eski "zorunlu kayıtlar dışında hiçbir çerezi izniniz olmadan yerleştirmez" cümlesi kaldırıldı. Çerez paneli metni ve haritanın altındaki not da aynı bilgiyi verir (`src/content/tr.ts`/`en.ts` > `consent.textWithOptional`/`consent.textNoticeOnly`, `contact.info.mapNote`); ikisi de onay özetine (`textApproval.hash`, §7) dahildir, değişirlerse onay yenilenir. Hukuki sebep m.5/2-(f) olarak yazıldı ve `legalBasesConfirmation` ile teyit edilecek; yurt dışı aktarım dayanağı `crossBorderBasis` (§7). ☐

Ölçüm (26 Eyl 2026, `tests/e2e/privacy-all-frames.spec.ts` → `qa/round5/privacy-third-party.json`): izin verilmemiş yeni tarayıcıda tüm çerçevelerde ölçüm/reklam isteği yok; üçüncü taraf istekler yalnızca harita iframe'inden (`www.google.com`, `maps.googleapis.com`, `maps.gstatic.com`, `fonts.googleapis.com`/`fonts.gstatic.com`, `places.googleapis.com`). Test ortamında Google çerez koymadı, ancak bu gerçek ziyaretçiler için garanti değil ve IP/sayfa adresi izinden önce Google'a gidiyor — ayrıntı INTEGRATIONS.md §4. Karar: ☐

Not (26 Eyl 2026): Google Haritalar gömmesindeki işletme kartı Google'ın kendi puanını ("5.0 ★ (65)") gösterir. `'link'` modu seçilirse tutarlılık için yalnızca koordinatlı (kartsız) gömme düşünülebilir: ☐

## 11. Google İşletme Profili düzeltmeleri (Takeout incelemesi, 26 Eylül 2026)

| Konu | Öneri | Teyit |
|---|---|---|
| Yinelenen profiller | Takeout'ta aynı hesapta aynı Place ID'ye bağlı 3 profil görünüyor (mağaza kodları …1086 — 65 yorumlu; …1523; …9111; tam kodlar yalnız işletme hesabında, herkese açık depoda tutulmaz). **Hemen silinmemeli** (GPT incelemesi): aynı Place ID ve farklı mağaza kodu, hangi kaydın güvenle kaldırılacağını tek başına kanıtlamaz; Google, profil içeriği ve yöneticilerini kaldırmanın işletmenin eklediği fotoğraf, gönderi ve yorum yanıtlarını kalıcı silebileceğini belirtiyor. Önce: (1) Takeout zip'i yedek olarak saklanır; (2) business.google.com/locations'ta her kaydın doğrulama durumu, yorum sayısı ve sahipliği kontrol edilir; (3) gerçek mükerrerlik doğrulanırsa Google İşletme Profili desteğinden yazılı yönlendirme alınır. Diğer iki kayıttaki farklı saatler (Pazar açık, Cumartesi 17:00) Google'da görünen tutarsız saatlerin **olası** nedenidir, kanıtlanmış değildir. | ☐ |
| Açıklama | 24 satırlık anahtar kelime listesi (fiyat, "en iyi", marka listesi) → 712 karakterlik olgusal taslak raporda. | ☐ |
| Kategori | Birincil "Hearing aid store" (`gcid:hearing_aid_store`), ek "Hearing aid repair service"; odyolog çalışıyorsa "Audiologist". Yinelenen kayıt konusu netleştikten sonra. | ☐ |
| Yorum yanıtları | 65 yorumdan yalnız 1'i yanıtlı → günde 5–10, kısa ve kişisel yanıt; sağlık/cihaz ayrıntısı eklenmeden. | ☐ |
| Adres yazımı | "Aşaği" → "Aşağı" (düşük öncelik; yeniden doğrulama tetikleyebilir). | ☐ |
| Web sitesi bağlantısı | `http://` → `https://keciorenisitme.com/` (isteğe bağlı UTM). | ☐ |
