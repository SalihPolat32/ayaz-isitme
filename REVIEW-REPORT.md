# Ayaz v2 — kod, içerik ve 3B inceleme

25 Eylül 2026. Çalışma yalnızca `ayaz-isitme-v2/` içinde yapıldı. Mevcut `ayaz_isitme/` reposuna değişiklik, commit, push veya canlı dağıtım yapılmadı. İlk v2 kaynak yedeği: `/private/tmp/ayaz-v2-before-review.tar.gz`.

## Sonuç

3B model yeniden biçimlendirildi; Türkçe/İngilizce metinler ve gerçek işlevsel hatalar düzeltildi. Yerel inceleme sürümü hazır. Canlı API anahtarları, işletme teyitleri ve hukuki taslaklar tamamlanmadan bunu tamamen yayına hazır bir kurulum olarak değerlendirmeyin.

## Düzeltilenler

- **Model:** yatay ve geniş gövde yerine yaklaşık 28 mm uzunluğunda ince, dik RIC gövdesi; üstten çıkan kavisli alıcı kablosu; küçük alıcı/silikon uç; mikrofon açıklıkları, uzun kontrol düğmesi, kabuk birleşim çizgisi ve şarj kontakları. Mat yüzey ve daha hafif gölge. Marka/logosuz temsili geometri; lisanslı üretici CAD modeli değildir. Hero posteri aynı modelin ana görünümünden yeniden render edildi.
- **3B etkileşim:** E/R klavye komutları, ayırma kaydırıcısı ve otomatik dönüş düğmesi senkron. Görünmeyen hotspot'lar odak sırasından çıkarıldı; dokunma hedeflerinin birbirini kaplamaması için aralık eklendi. Mobilde dikey sayfa kaydırması korunuyor. WebGL2 yokken statik görsel/açıklama fallback'i devam ediyor.
- **TR/EN:** koşulsuz görünmezlik, ağrısızlık, sürekli stok ve aynı uzmanla çalışma vaatleri yumuşatıldı. Bluetooth ses aktarım yönü düzeltildi. RIC alıcısı ile yıkanabilen elektronik içermeyen BTE kalıbı ayrımı yapıldı. Üretici/model farkları açıklandı. Teknik dosya adları ve API terimleri ziyaretçiye gösterilen metinden çıkarıldı.
- **İşletme doğrulaması:** SGK anlaşması, ücretsiz test ve saatler teyit beklerken gösterilmiyor. Mesleki unvan teyit edilene kadar yalnızca isim kullanılıyor. `value:false` olan doğrulanmış bir iddianın yine de yayınlanması hatası giderildi. Marka adları bilgilendirme bölümünde görünür; stok/bayilik iddiası eklenmedi.
- **Form:** ilk başarılı talepten sonraki gönderimin zaman tuzağına takılması düzeltildi. Yinelenen eşzamanlı gönderime koruma ve 15 saniye zaman aşımı eklendi. Telefon/ad doğrulaması API ile uyumlu. Sunucu alan hataları seçilen dilde gösteriliyor. Checkbox dahil hata alanları erişilebilir etiketlerle bağlandı. WhatsApp'ın gerçekten açıldığı iddia edilmiyor; gönderilecek mesajın hazır olduğu belirtiliyor.
- **İzin ve ölçüm:** reklam izni tek başına GA4 yapılandırmıyor. Analitik izni sonradan verilince ayrı etkinleşiyor. Hatalı/eski kayıtlar kabul edilmiyor; depolama engelliyken sayfa içi tercih korunuyor. İzin geri çekilince yüklenmiş adaptörleri durdurmak için kaydedilmiş tercihle sayfa yenileniyor. Olay adları/parametreleri izin listesiyle sınırlı; GA4 sayfa meta verilerinden sorgu ve fragment çıkarılıyor. Üçüncü taraf script yükleme hataları yakalanıyor. Kimlikler boşken hiçbir ölçüm adaptörü etkin değil.
- **Yorumlar:** TR/EN dil tercihi Google isteğine ve önbellek/birleştirme anahtarına taşınıyor. Çevrilmiş yorum etiketi, ekran okuyucu için yıldız puanı ve HTTPS bağlantı kontrolü eklendi. En fazla beş yorum gösteriliyor; API yokken Google profil bağlantısı kalıyor.
- **Worker:** JSON gövde sınırı, Content-Length'e güvenmeden akıştan gerçek UTF-8 bayt sayısıyla uygulanıyor; limit aşılınca okuma iptal ediliyor.
- **Yapı:** eski site bölüm bağlantılarına karşılıklar eklendi. Astro 7'nin arka plan sunucusunun Playwright test sürecini erken kapatması düzeltildi. TR/EN uzun düğme etiketlerinin 320 pikselde yarattığı yatay taşma giderildi.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Astro check | 66 dosya; 0 hata, 0 uyarı, 0 ipucu |
| Astro build | 6 statik sayfa başarıyla üretildi |
| Site Vitest | 19/19 |
| Worker Vitest | 110/110 |
| Worker TypeScript | `tsc --noEmit` başarılı |
| Playwright masaüstü + Pixel 7 | 38/38 |
| Son dar ekran CSS değişikliği sonrası hedefli test | 4/4; iki dilde 320, 360, 390, 768, 1024, 1280, 1440 px |
| Tarayıcı görsel kontrol | TR/EN hero, mobil model, monte/ayrılmış model; konsol hatası yok |

Ek testler: ayrı Analytics/Ads izinleri, hatalı izin kaydı, PII parametrelerinin atılması, depolama engeli, yeniden form gönderimi, İngilizce API hataları/yorumlar, çok baytlı/akışlı gövde limiti, klavye–kaydırıcı senkronu.

Görseller `qa/review/` içinde. `scripts/review-preview.mjs --full` derlenmiş önizleme varsayılan `http://127.0.0.1:4322` üzerinde çalışır; `PREVIEW_URL` ile değiştirilebilir. Poster: `scripts/capture-poster.mjs` (geliştirme sunucusu gerektirir).

Bu incelemede Lighthouse yeniden ölçülmedi. Eski QA raporundaki 100/100 sonuçları Claude'un önceki ölçümüdür; bu sürüm için yeni ölçüm gibi sunulmamalıdır. Derlemede Three.js için 500 kB chunk uyarısı var; motor ayrı ve bölüm görünürlüğüne bağlı yükleniyor. Gerçek düşük güçlü telefon ve Safari'de elle dokunmatik kontrol ayrıca yapılabilir.

## Yayına geçmeden kalan gerçek girdiler

1. Çalışma gün/saatleri, SGK anlaşması, ücretsiz test, doğru mesleki unvan ve uygulanan markalar için işletme teyidi. `CONTENT-VERIFICATION.md` güncellendi.
2. Google Place ID + sunucuda Places anahtarı; Worker URL'si ve e-posta/Telegram sağlayıcısı. Testler sahte API yanıtlarını kullandı; gerçek e-posta gönderilmedi ve ücretli Google API çağrısı yapılmadı.
3. Hukuki sayfalardaki açık taslak alanları: saklama/aktarım dayanağı vb. Bunlar teknik kontrolle hukuken onaylanmış sayılmaz.
4. Reklam/ölçüm hesaplarının uygunluğu ve kimlikleri. Kodun varlığı reklam hesabı onayı veya Google sıralaması garantisi değildir.
5. Yayına karar verilirse v2'nin gerçek GitHub Pages reposuna taşınması ve üretim ortamı ayarı. Mevcut yerel derleme bilinçli olarak `noindex` önizlemedir.

## Başvurulan teknik kaynaklar

- RIC/miniRITE biçimi ve model bazlı özellikler: [Oticon Intent miniRITE](https://www.oticon.com/products/663063/oticon-intent-minirite). Eski projedeki Bernafon ürün görseli yalnızca şekil/oran referansı olarak incelendi; siteye ticari ürün görseli olarak eklenmedi.
- Bakımın modele göre ayrılması: [Phonak RIC bakım kaynakları](https://www.phonak.com/en-us/support/how-to-videos/qr-support/cleaning-hi) ve [RIC bakım rehberi](https://www.phonak.com/content/dam/celum/phonak/master-assets/en/documents/resources/support/ph-instruction-leaflet-ric-care-guide-280x380-en.pdf).
- Dil parametresi ve dönen alanlar: [Google Places Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details).
- Dokunmatik kamera kontrolü: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).
