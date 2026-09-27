# QA — nihai durum (27 Eylül 2026, Tur 10)

Ayaz İşitme Merkezi v2 (keciorenisitme.com). Ortam: macOS, Node 24, Astro 7.3.5, Chromium (Playwright), Lighthouse 13.5.
Canlı sürüm hâlâ `e851804`. Canlıya henüz bir şey çıkmadı. Tur 3–10 çalışması `gelistirme/v2-tur10` dalında (taslak PR #1); `master` birleştirmesi yayın kapısının 4 bilgisinden sonra.

## 1. Güncel doğrulama (Tur 10, 27 Eyl 2026)

| Kontrol | Sonuç |
|---|---|
| `npx astro check` (TypeScript strict, 89 dosya) | 0 hata · 0 uyarı · 0 ipucu |
| `npx vitest run` (site, 8 dosya; yeni: `tests/molds.test.ts`) | **140/140** |
| `cd worker && npx vitest run && npm run typecheck` | **112/112**, tip kontrolü temiz |
| Playwright e2e (masaüstü 1280 + Pixel 7) | **102/102** (yeni: `tests/e2e/audit-fixes.spec.ts`). Derleme: `ALLOW_INCOMPLETE_LEGAL=1 PUBLIC_SITE_ENV=production` (QA) |
| axe-core, tüm sayfalar (`/`, `/en/`, iki gizlilik sayfası, 404) | **0 ihlal** (WCAG 2 A/AA, 2.1 AA, 2.2 AA + best-practice; 320, 400, 760, 1280 px; hareket azaltma açık/kapalı; çerez paneli görünürken; sekmeler, `details`, mobil menü açık) |
| Motor kapsamı (27 Eyl 2026, `E2E_ENGINES=1`) | **WebKit** (Safari motoru; masaüstü + iPhone 15 emülasyonu): 101 geçti, 1 atlandı (fare tekerleği testi telefonda anlamsız). Tam paket paralel koşarken canlı API modu testlerinden 2'si bir kez zaman aşımına düştü; tek başına 3 tekrarda 78/78 geçti (yazılımsal 3B motoru yükü). Canlı API modu bu yayında kapalı. **Firefox:** bu bilgisayarda açılamıyor (macOS 27 + Playwright Firefox bilinen profil hatası, sandbox dışı da aynı). Gerçek iPhone/Android testi yok |
| Yatay taşma / başlık taraması | 4 sayfa, 320–1440 px (20 px adım): taşma yok, başlıkta satır kırılması yok, yeniden boyutlamada başlık büyümüyor |
| Üretim derlemesi (`PUBLIC_SITE_ENV=production`, geçersiz kılma yok) | **Bilinçli olarak durur.** 4 işletme bilgisi eksik. Bilgiler eksikken kopyalanacak onay özeti basılmaz (§3). Metin sürümü `2026-09-27.5` (Tur 10: `ayaz.topic` anlatımı düzeltildi) |
| Lighthouse Tur 10 (QA derlemesi, `noindex`) | Performans · erişilebilirlik · en iyi uygulama — TR ve EN: mobil **99·100·100**, masaüstü **100·100·100**; LCP 1,9 s / 0,4 s, TBT 0, **CLS 0**, aktarım **148 / 166 KiB** (Tur 9: 191 / 188). SEO 69 yalnız `is-crawlable` (QA derlemesi bilerek `noindex`) |
| Dağıtım boyutu | `dist` 12 MB → **7,8 MB** (kullanılmayan görsel varyantları üretilmiyor; kalan ≈ 0,6 MB, içe aktarılan katmanların Astro'nun kopyaladığı özgünleri) |
| Paket | İlk JS ≈ 11 KB gz. 3B motoru ayrı parça, yalnızca bölüm görünür olunca yüklenir. Font: Manrope (2 dosya, ≈ 40 KB, önceden yüklenir) |

Çalıştırma:

```bash
npm test
cd worker && npm test
ALLOW_INCOMPLETE_LEGAL=1 PUBLIC_SITE_ENV=production npx astro build && npx playwright test
```

## 2. Güncel kanıt dizini

| Konu | Dosyalar |
|---|---|
| Son TR/EN ana sayfa (masaüstü + mobil, tam sayfa) | `qa/final/home-{tr,en}-{desktop,mobile}.jpg` (küçültülmüş JPEG) |
| Cihaz türleri, 6 tür × TR/EN × masaüstü/mobil; IIC 320 px | `qa/final/devices-*.jpg` |
| Uzman ekibi kartı (TR/EN, masaüstü/mobil) | `qa/final/team-*.jpg` |
| Bölümler (Tur 10, Manrope ile): cihazlar, markalar, hizmetler, kulak kalıbı, süreç, merkez, yorumlar, iletişim (TR/EN, masaüstü/mobil) | `qa/final/section-*.jpg` |
| Paylaşım kartları (TR/EN; vitrin fotoğrafı yok) | `qa/final/og-{tr,en}.jpg` |
| Kulak kalıbı render'ları (8 biçim + malzeme + dome) | `src/assets/device/molds/*.png` |
| Pil çekmecesi (RIC/BTE/CIC, t = 0…1), BTE–RIC ayrımı, kalıp yuvası, kulak çizimleri, 3B bölüm, küçük görseller, posterler | `qa/round5/evidence/*.png` |
| Harita (temiz oturum, masaüstü/mobil) | `qa/round5/map-{desktop,mobile}.png` |
| İzin öncesi tüm çerçevelerin istekleri | `qa/round5/privacy-third-party.json` (`PRIVACY_REPORT=1` ile `tests/e2e/privacy-all-frames.spec.ts` yazar) |
| Gizlilik sayfası TR/EN ve çerez bildirimi | `qa/round6/*.png` (önizleme: eksik bilgiler işaretli) |
| Canlı sürüm (`e851804`) ölçümü | `qa/live/` |

## 3. Özellikler ve güvenceler

**Erişilebilirlik**
- Lighthouse erişilebilirlik puanı 100.
- Klavye: sekmeler (Ok, Home, End), SSS (`details`), lightbox (Ok, Escape, odak dönüşü), mobil menü (`dialog`), 3B tuval ve işaret düğmeleri (ekran okuyucuya açık).
- Mobilde sabit alt çubuk, odaklanan öğeyi örtmez (`scroll-padding-bottom`).
- Hedef alanları ≥ 44 px. `prefers-reduced-motion` ile animasyon ve otomatik döndürme kapanır.
- 3B olmadan tüm bilgi ve eylem düğmeleri HTML'de bulunur.

**3B modeller (temsili)**
- RIC ve BTE: pil kapağı, gövdenin yan duvarları arasındaki yuvadan alttan dışarı dönen bir çekmecedir. Pil beşikte çıkar ve geri girer.
- CIC: ön yüz kapağı açılır.
- 3B motoru yüklenemezse (ağ/sunucu hatası) bu, "WebGL desteklenmiyor"dan ayrı bir mesajla ve "Sayfayı yenile" düğmesiyle gösterilir; poster ve parça açıklamaları her durumda kalır. Geliştirme ve derleme ayrı Vite önbellekleri kullanır (derleme, çalışan dev sunucusunu bozmaz).
- `tests/viewer-door.test.ts`, 25 ara konumu örnekleyen bir regresyon testidir. Güçlü bir kontroldür, her an için matematiksel kanıt değildir.
- BTE; boyutu, şampanya rengi, kancası ve kalıba giren #13 hortumuyla RIC'ten ayrışır.

**Tur 10: bağımsız denetim ve kalıplar**
- Kulak kalıbı bölümü: 8 biçim (tam konka, yarım konka, iskelet, yarım iskelet, kanal, kilitli kanal, CROS, kanal içi/mikro) aynı ölçekte temsili 3B render; malzeme satırı (sert akrilik / yumuşak silikon / RIC dome). Model: `src/scripts/viewer/molds.ts` (SDF'lerin yumuşak birleşimi + MarchingCubes → tek parça yüzey); render: `scripts/render-mold-styles.mjs`. Biçim tanımları ve kısa metinler kaynaklı araştırmaya dayanır (ReSound/Oticon/Microsonic kalıp rehberleri, AudiologyOnline, Hearing Review, Erişçi 2018); adlandırma laboratuvara göre değiştiği sayfada yazılı. `tests/molds.test.ts` biçimleri geometriyle denetler (iskeletin ortası boş, CROS kanalı açık, ses deliği delik…).
- 9 açılı bağımsız denetim (106 ajan): 84 doğrulanmış bulgu, tekilleşince ≈ 45 sorun; hepsi düzeltildi ya da aşağıda (§4) karar olarak listelendi. İkinci doğrulama turu (33 ajan): 88 maddenin 76'sı tam, 12'si kısmen düzeltilmiş bulundu; kısmi olanlar ve 21 yeni bulgu tamamlandı.
- Başlıcaları: paylaşım görseli artık vitrin fotoğrafı değil (doğrulanmamış SGK/ücretsiz test/unvan yazıları görünüyordu) ve dile göre (`og.jpg`, `og-en.jpg`); SSS'deki "SGK süreci" cümlesi `canShow` kapısına bağlandı; bir yorumcunun bitişik yazılmış ad-soyad kullanıcı adı "Samet Ö." yapıldı; fontlar hiç uygulanmıyordu (`tokens.css` Astro değişkenlerini eziyordu) → Manrope; gizlilik/404 sayfalarında menü bağlantıları ve dil değiştirici; 3B sahne üzerinde tekerlek sayfayı kaydırır (yakınlaştırma Ctrl/⌘, kıstırma, klavye); model sekmesi yarışı; çerez panelinin odak/Escape/kaydırma payı; JS kapalıyken form veri göndermez; WhatsApp düğmesi kontrastı; yorum kaydırıcısı canlı bölge ve anlamsal yapı; galeri boş hücre; başlığın her yeniden boyutlamada 1 px büyümesi; RIC/CIC güç aralığı, Auracast, SSS kulak içi görünürlük düzeltmeleri; takılı 3B pilde renk bandı kaldırıldı; `public/models/README.md` yayından çıktı; Worker randevu bildirimine kartın konusu eklendi.

**Görsel bölümler (Tur 9)**
- "Tüm türleri karşılaştır" tablosu tam genişlikte. Önceden genel `details.acc .acc__body { max-width: 70ch }` kuralı, bileşenin kapsamlı kuralını özgüllükte yeniyordu. Başlıkta temsili görseller, görünürlük satırında nokta ölçeği var. Mobilde yatay kayar, satır başlıkları sabit kalır ve sarmalayıcı `tabindex=0 role=region` ile klavyeden kaydırılabilir.
- Sistemler, markalar, hizmetler, kulak kalıbı ve süreç bölümleri: metinler bir-iki cümleye indi, görseller eklendi. Kullanılan görseller: mevcut temsili render'lar, merkezin gerçek fotoğrafları (ofis-1, ofis-5) ve bu projede çizilen SVG'ler (CROS şeması, pil boyutları, kalıp türleri). Yeni görsel dosyası yok.
- Resmî marka logosu yok (izin yok, marka bölümü hukuk incelemesinde). İzinli logo yuvası `src/assets/brands/` (`ASSET-MANIFEST.md`).
- Kapsamlı stil notu: `Icon` kendi `<svg>`'sini üretir, bu yüzden başka bileşenden `.x .icon` kuralı hiç uygulanmaz. Tur 9 bileşenlerinde `:global(.icon)` kullanıldı. Hero, alt çubuk, footer, iletişim, çerez bildirimi ve 3B bölümündeki 10 kural hâlâ etkisiz (§4).

**Kulak çizimleri**
- Bağlantılar render'daki gerçek noktalardan çizilir.
- Görünürlük ölçeği: dolu nokta arttıkça daha görünür. Seviye başına tek etiket vardır ve ekran okuyucu açıklaması bulunur.
- Kulak arkasındaki gövde yarı saydam çizilir ve bu açıklanır.

**Yorumlar**
- Kaynak, işletmenin Google Takeout dışa aktarımıdır: 65 puan, 58 metin. Sitede TR 53, EN 47 yorum var ve adlar kısa yazılır. 5 yorum hukuki risk nedeniyle gizlidir.
- `link` modunda yorum metni, puan ve adet gösterilmez. Canlı API çağrısı da yapılmaz.
- Canlı API modunda tekrar ve koruma eşleşmesi kayıt başına yapılır. Kısa ad ve ay ya da 40 karakterlik açılış tek başına kimseyi elemez. Kurallar ve kalan riskler: `INTEGRATIONS.md` §5.

**Gizlilik / KVKK / çerez**
- Metin, derlemenin gerçek yapılandırmasından üretilir. Şu an WhatsApp modu: form hiçbir sunucumuza veri göndermez.
- Google Haritalar izin beklemeden yüklenir. Bu, sayfada, çerez bildiriminde ve harita notunda çelişkisiz anlatılır.
- Ölçüm etiketi tanımlı değilken çerez bildirimi izin istemez, yalnız bilgi verir.
- İşletmeye özgü bilgiler `business.legal` içindedir. Saklama süreleri işletme sahibince verildi: randevu talepleri 6 ay, WhatsApp 6 ay (27 Eyl 2026). m.9 dayanağı, hukuki sebep teyidi ve metin onayı **boştur, tahminle doldurulmadı.** Üretim derlemesi bunlar gelene kadar durur.
- Onay özeti; nihai metnin (gerçek değerlerle), çerez bildiriminin, harita notunun, form onay metinlerinin, işletme bilgilerinin, yapılandırmanın ve sürümün özetidir. Sıra: doldur → incele → onayla. Ayrıntı: `CONTENT-VERIFICATION.md` §7.

**Bütünlük**
- İzin öncesi hiçbir çerçeveden ölçüm veya reklam isteği gitmez. Üçüncü taraf istekler yalnızca Google Haritalar alanlarındandır.
- Fontlar kendi sunucumuzdan gelir.
- Geliştirme sayfası `/dev/viewer/` yalnızca `astro dev` sırasında vardır. Canlıda (`e851804`) herkese açıktı, yeni derlemede yok.
- Depo herkese açık olduğu için yorumcu adları depoda da kısadır. Sırlar yalnızca Worker'dadır.

## 4. Açık teknik konular (yayın engeli değil)

- **Canlı yorum API'si açılmadan önce:** Places yorum kimliğinin Takeout kimliğiyle aynı olduğu bir kez doğrulanmalıdır (`INTEGRATIONS.md` §5, risk 12).
- API moduna geçilecekse Cloudflare panelindeki kayıt üst verisi kontrol edilmelidir (`worker/README.md` §9).
- Kozmetik: BTE kalıp yuvası birleşim çizgisi yakın zumda hafif tırtıklıdır. CIC menteşe ucunda ince açık bir şerit görünür.
- ~~Etkisiz `.x .icon` kuralları~~ — Tur 10'da düzeltildi: Hero, MobileBar, Footer, Contact, ConsentBanner ve DeviceExplorer'daki 9 kural `:global(.icon)`; önce/sonra görüntüleriyle kontrol edildi (ikonlar artık niyet edilen renk ve boyutta).
- **Depo (27 Eyl 2026):** değişiklikler temiz bir klondan geliştirme dalına aktarıldı: `gelistirme/v2-tur10` (commit `3def419`), taslak PR https://github.com/SalihPolat32/ayaz-isitme/pull/1 (birleştirilmedi; `master` = `e851804`, canlı sürüm değişmedi). Aktarımdan önce gizli anahtar, kişisel veri, yorumcu tam adı ve Takeout taraması temiz; işletme profili iç kimlikleri belgede kısaltıldı.
- Gerçek cihazda (iOS Safari, Android Chrome) test yapılmadı, Playwright emülasyonu kullanıldı. Saha verisi (CrUX) yayından sonra izlenmelidir.
- Yorumcu adları: bitişik yazılmış ad-soyad kullanıcı adı `displayNames` ile "Samet Ö." gösteriliyor — kullanıcı adından okunan kısaltmadır, **işletme sahibi onaylamalı** ☐. Kalan tek kelimelik adlar (berat, Musa, Abdulkadir, melis, Mahwut, OSMAN) yalnızca ilk addır. Canlı API modunda tek kelimelik Google adları olduğu gibi gelir; otomatik kısaltma kuralı ("Abdulkadir" gibi gerçek adları bozacağı için) yoktur.
- **Galeri vitrin fotoğrafı (ofis-6) — sahip kararı ☐:** mağaza vitrinindeki SGK logosu, "ücretsiz işitme testi", "12 aya kadar taksit", "ömür boyu bakım" ve unvan yazıları fotoğrafta okunur (özellikle büyütmede). Metinde bu iddialar doğrulanana kadar gizli; paylaşım kartından çıkarıldı. Seçenekler: olduğu gibi bırakmak (işletmenin kendi gerçek vitrini), panelleri bulanıklaştırmak ya da tabelayı gösteren bir kırpım.
- Kulak kalıbı "yarım iskelet" biçiminin tanımı kaynaklar arasında farklı (halkanın hangi kısmının açık olduğu); render, sahibinin gönderdiği tedarikçi çizelgesindeki biçime göre yapıldı.

## 5. Tur geçmişi (özet)

| Tur | Tarih | Ana değişiklik | Testler (site · worker · e2e) | Lighthouse mob/masa |
|---|---|---|---|---|
| 1–2 | 25 Eyl | v2 yeniden yapım, GPT incelemesi, yayın (`e851804`, yedek dal `master-backup`) | 19 · 110 · 38 | 100 / 100 |
| 3 | 26 Eyl | Pilli 3B modeller, kulak yerleşimi, yorum kaydırıcı, doğrudan harita | 19 · 110 · 38 | 100 / 100 |
| 4 | 26 Eyl | Harita işareti, Takeout yorumları, saatler 09–19, hukuki bulgu → yorum modu anahtarı | 25 · 110 · 42 | 100 / 100 |
| 5 | 26 Eyl | Alttan dönen pil çekmecesi, ayrışan BTE, gizlilik testi, geliştirme sayfası üretimden çıktı | 62 · 110 · 62 | 99 / 100 |
| 6 | 27 Eyl | Yapılandırmadan üretilen gizlilik metni, üretim kapısı, kayıt başına tekrar kontrolü | 123 · 111 · 74 | 99 / 100 |
| 7 | 27 Eyl | Koruma kaydı başına eşleşme, onay özeti nihai metin üzerinden | 131 · 111 · 82 | 99 / 100 |
| 8 | 27 Eyl | Cihaz kartı boşluğu, görünürlük cümlesi kaldırıldı, uzman ekibi metni, dosya temizliği | 132 · 111 · 84 | 99 / 100 |
| 8b | 27 Eyl | GPT: 3B yükleme hatası (ayrı Vite önbellekleri, yükleme/WebGL hatası ayrımı + yenile düğmesi); saklama süreleri 6/6 ay | 132 · 111 · 86 | — |
| 9 | 27 Eyl | Tam genişlikte karşılaştırma tablosu; beş bölüm az yazı + görsel; marka duvarı (resmî logo yok); 4 açılı bağımsız inceleme, 11 bulgu düzeltildi; axe 0 ihlal | 134 · 111 · 88 | 99 / 100 |
| 10 | 27 Eyl | 8 kalıp biçimi için temsili 3B render'lar (kaynaklı metin); 9 açılı bağımsız site denetimi + ikinci doğrulama turu, ≈ 45 sorun düzeltildi; font Manrope (CLS 0, 148 KiB); dağıtım 12 → 7,8 MB | 140 · 112 · 102 | 99 / 100 |
