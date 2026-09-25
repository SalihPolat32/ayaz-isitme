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
| Çalışma saatleri Pzt–Cmt 09:00–18:00, Pazar kapalı | Hayır, teyide kadar gizli | unverified | Canlı sitedeki JSON-LD; **yazılı teyit şart** | ☐ |
| Koordinat (39.978, 32.866) | Hayır | unverified | Canlı sitede yuvarlatılmış; JSON-LD'ye yazılmadı | ☐ |
| Google Place ID | Hayır | unverified | Place ID Finder ile alınmalı: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder | ☐ |
| "Daha fazla yorum alın" bağlantısı | Hayır | boş | Google İşletme Profili > Yorumları oku > Daha fazla yorum alın > Kopyala | ☐ |

## 2. Vitrin/tabela fotoğraflarında görülen iddialar

| İddia | Nerede görüldü | Sitede nasıl geçiyor | Teyit |
|---|---|---|---|
| SGK anlaşmalı merkez | Vitrin (ofis-6.jpg: "SGK Anlaşmalı Kurum") | Teyit bekliyor; hero, hizmetler ve SSS iddiası kapalı | ☐ |
| Ücretsiz işitme testi | Vitrin ("Ücretsiz işitme testi"), canlı site başlığı | Teyit bekliyor; ücretsiz ifadesi kapalı | ☐ |
| İşitme cihazı pili / filtre satışı | Vitrin, ofiste Varta pil standı | Hizmetler | ☐ |
| Kulak kalıbı üretimi | Vitrin ("Kulak kalıbı") | Ayrı bölüm | ☐ |

SGK, ücretsiz test ve çalışma saatleri inceleme sırasında `unverified` yapıldı. Teyit geldikten sonra `verified` olarak güncellenebilir. Diğer iddiaları kapatmak için ilgili satırı `src/config/business.ts` içinde `status: 'unverified'` yapmak yeterlidir; metinler otomatik düşer.

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

## 5. Cihaz türü içerikleri

Tür açıklamaları ve karşılaştırma tablosu üretici rehberlerine dayanır (Phonak, Widex, ReSound, Starkey, Oticon, Signia; kaynak listesi: araştırma dosyası `devices-brands.md` §10). Sitede "genel rehber" uyarısı var. Odyoloji uzmanı gözden geçirmesi önerilir: ☐

## 6. SGK ve mevzuat ifadeleri

- SSS'de SGK cevabı yalnızca süreç özetidir (rapor + reçete, SUT ile güncellenen tutar/koşullar). Tutar, katkı payı yüzdesi ve yenileme süresi **yayınlanmadı**.
- Reklam mevzuatı: Tıbbi Cihaz Satış, Reklam ve Tanıtım Yönetmeliği m.15 — işitme cihazı **ürün reklamı** tüketiciye yapılamaz; merkezin **kendi sitesindeki cihaz bilgilendirmesi** istisna (m.15/2). Reklam kampanyaları merkez ve hizmetleri odaklı kurulmalı. Avukat teyidi: ☐

## 7. Hukuki metinler

`src/content/legal/tr.ts` ve `en.ts` **taslaktır**. Doldurulacak alanlar: saklama süresi, yurt dışı aktarım dayanağı (KVKK m.9; standart sözleşme veya veriyi Türkiye'de tutan mimari), VERBİS durumu. Avukat incelemesi: ☐

## 8. Görsel kullanım hakları

Bkz. `ASSET-MANIFEST.md`. Ofis fotoğrafları ve logo işletmeye ait kabul edildi; fotoğraftaki kişinin yayın izni: ☐
