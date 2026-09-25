# 3B cihaz görüntüleyici (`src/scripts/viewer`)

Etkileşimli, parçalanabilir (explode) **temsili RIC işitme cihazı** görüntüleyicisi.
Çerçeve bağımsız TypeScript + `three@0.186`; Astro bileşeni yalnızca canvas'ı sağlar ve
`mountDeviceViewer()` çağırır.

## Önemli: temsili model uyarısı

Model **markasız ve şematiktir**; gerçek bir ürünün birebir kopyası değildir. Herhangi bir
üreticinin tasarımını, ticari görünümünü (trade dress) veya patentli bir formunu temsil etmez.
Sayfada bu durum kullanıcıya açıkça belirtilmelidir (ör. "Temsili gösterim — gerçek cihaz
modele göre farklılık gösterir"). Marka/model adı, logo veya ürün fotoğrafı bu modelle yan yana
"aynı ürün" izlenimi verecek biçimde kullanılmamalıdır.

## Dosyalar

| Dosya | Görev |
| --- | --- |
| `types.ts` | `PartId`, `ViewerOptions`, `ViewerController`, `DevicePart`, `DeviceModel` (yalnızca tip). |
| `model.ts` | `buildDeviceModel()` — tamamen parametrik model (Three.js geometrisi, dış varlık yok). |
| `scene.ts` | Renderer, kamera, OrbitControls, RoomEnvironment→PMREM ortamı, VSM yumuşak gölge, render döngüsü, gözlemciler, bağlam kaybı, `dispose()`. |
| `explode.ts` | 0..1 parçalanma tween'i (600 ms, easeInOutCubic; hareket azaltmada anında). |
| `camera.ts` | Klavye yörünge adımı ve kamera küresel tween'i (`focusPart`, `reset`). |
| `hotspots.ts` | Çapaları her karede CSS pikseline yansıtır; görünürlük = normal·kamera > eşik ∧ canvas içi. |
| `index.ts` | `mountDeviceViewer(root, opts)` ve `isWebGLAvailable()`; DEV'de `window.__ayazViewer`. |
| `gltf.ts` | **Taslak** — lisanslı GLB ile değiştirme yolu (`loadGltfModel`). Kullanımda değil. |

## Ölçek ve eksenler

- **1 sahne birimi = 10 mm** (`UNIT_MM`). Gövde ≈ 28 mm × 8 mm × 6 mm; alıcı Ø 1.9 mm; dome Ø ≈ 5.2 mm.
- +X kulak kanalına doğru, +Y yukarı (kablo üst uçtan çıkar), +Z dışa bakan yüz.
- Model kökü orijindedir; tüm parça grupları dinlenme konumunda (0,0,0)'dadır. Açılma:
  `position = restPosition + explodeDirection * explodeDistance * t`.

Parça kimlikleri (**tam olarak** bunlar): `mics`, `body`, `button`, `wire`, `receiver`, `dome`, `power`.

## Üçgen bütçesi

Model üçgen sayısı `buildDeviceModel().triangleCount` üzerinden hesaplanır; bütçe 60k. Gövde loft 64×40, dome lathe, kablo ve kabuk birleşim çizgileri parametriktir. GLB ile değiştirirken
toplamı 60k altında tutun (mobil GPU + gölge geçişi + transmission geçişi = model 3 kez çizilir).

## Kullanım

```ts
const { mountDeviceViewer, isWebGLAvailable } = await import('../scripts/viewer/index.ts');
if (!isWebGLAvailable()) { /* statik poster göster */ }
const viewer = await mountDeviceViewer(rootEl, {
  canvas,
  onHotspot: (id, x, y, visible) => { /* nokta elemanını translate(x,y) ile konumla */ },
  onInteract: () => { /* ilk etkileşimde ipucunu gizle */ },
  onReady: () => { /* posteri kaldır */ },
});
viewer.explode(); viewer.focusPart('dome'); viewer.reset(); viewer.destroy();
```

- `onHotspot` koordinatları **canvas'ın sol-üst köşesine göre CSS pikseldir**; nokta katmanını
  canvas'ın üzerine `position:absolute; inset:0` ile yerleştirin.
- Canvas'a `tabindex="0"` verin: ok tuşları döndürür, `+`/`-` yaklaştırır, `r` sıfırlar, `e` parçalar.
- Canvas üzerinde `touch-action: pan-y` ayarlanır: tek parmakla yatay döndürme, dikey sayfa kaydırma, iki parmakla yaklaştırma.
  Fare tekerleği canvas üzerinde sayfayı kaydırmaz (yaklaştırır); bu yüzden canvas'ı sayfa
  genişliğinin tamamı yapmayın, yanında kaydırma alanı bırakın.
- Varsayılan bakış (`HOME_DIR`, `scene.ts`): dış sırt (-X) + dış yüz (+Z), hafif üstten; kablo/alıcı/dome
  gövdenin önünde, ekranın sağında kalır. Ayna görünüm için `HOME_DIR.x` işaretini çevirin.
- Çerçeveleme gerçek silüete göre yapılır (`fitView`): paketlenmiş model kadrajın %74'ünü
  doldurur. Parçalanırken pivot yeniden ortalanır ve %18'e kadar küçülür (kamera geri çekilmiş
  gibi) — açılmış hal de çerçeveye sığar.
- Otomatik dönüş ilk etkileşimde durur; `reset()` kullanıcının son otomatik dönüş tercihini geri yükler. Hareket azaltma tercihinde
  otomatik dönüş kapalı, tween'ler anında.
- Sekme gizliyken veya canvas görünüm dışındayken döngü durur; hiçbir şey değişmiyorsa kare
  çizilmez (talep üzerine render).

## Poster yakalama (statik yedek görsel)

Görüntüleyici `preserveDrawingBuffer` kullanmaz (performans). `captureImage()` bir kare çizer ve
**aynı tick içinde** `canvas.toDataURL('image/png')` okur; bu yüzden güvenilirdir.

Geliştirme sunucusunda `/dev/viewer/` sayfasını açın; konsolda:

```js
const url = window.__ayazViewer.captureImage(1600, 1200); // DPR=1, tam piksel
// url'yi indirin ve `scripts/prepare-images.mjs` ile AVIF/WebP'e çevirin
```

Şeffaf arka planlıdır (`alpha:true`); poster olarak sayfa zemini üzerine doğrudan konabilir.
Not: transmission (dome) geçişi, arka planda alfa < 1 olduğunda beyaz-yarı saydam temizleme
kullanır; açık zeminde fark edilmez.

## Parametrik modeli lisanslı GLB ile değiştirme

`gltf.ts` içindeki `loadGltfModel(url, options)` aynı `DeviceModel` sözleşmesini üretir.
`index.ts` içinde `buildDeviceModel()` yerine `await loadGltfModel('/models/cihaz.glb')`
kullanın (fonksiyon zaten async). Dosyayı `public/models/` altına koyun ve **Draco/Meshopt
sıkıştırma kullanmayın** (yükleyici ek decoder istemesin) ya da decoder yolunu ayarlayın.

GLB gereksinimleri:

1. Kök sahnenin **doğrudan çocukları** olarak 7 düğüm; adları `PartId` ile **birebir** aynı
   (`mics`, `body`, `button`, `wire`, `receiver`, `dome`, `power`). Alt parçalar bu düğümlerin
   altında olabilir (ör. `mics` grubu iki port içerir).
2. Ölçek 1 birim = 10 mm. Blender metre çıkışı için `{ scale: 100 }` verin.
3. Eksenler: +X ön uç, +Y yukarı, +Z dışa bakan yüz (Blender'da −Y ileri → glTF +Z dönüşümü
   otomatik; kontrol edin).
4. Malzemeler PBR (`MeshStandardMaterial`/`MeshPhysicalMaterial`); vurgu için parça başına
   klonlanır. Dome için glTF `KHR_materials_transmission` desteklenir.
5. Açılma yönleri ve çapa normalleri `options.hints` ile parça başına verilebilir; verilmezse
   parametrik modelle aynı varsayılanlar kullanılır. Çapa, parçanın sınır kutusunun normal
   yönündeki yüzeyine konur.
6. Toplam ≤ 60k üçgen; tek doku seti (≤ 2048²) veya dokusuz düz PBR renkler tercih edilir.
7. Lisans: GLB'nin ticari web kullanımına izin verdiğini belgeleyin ve dosyanın yanına
   `LICENSE.txt` koyun. Ürün fotoğrafından fotogrametri ile üretilmiş modeller marka haklarını
   ihlal edebilir.

`gltf.ts` derlenir ancak gerçek bir GLB ile **test edilmemiştir**; etkinleştirirken
`/dev/viewer/` ile doğrulayın.

## Bilinen sınırlar

- Dome'da "havalandırma çentikleri" (scallop) yoktur; yalnızca üstte açık ses deliği vardır.
- Alıcı kablosu opak açık gri (yarı saydam değil) — sıralama artefaktlarından kaçınmak için.
- Parçalanma sırasında dome zeminin (görünmez gölge düzlemi) altına inebilir; düzlem görünmez
  olduğu için görsel etkisi yalnızca gölgenin kesilmesidir.
- Gölge VSM'dir (256 px harita + geniş bulanıklık = yumuşak temas gölgesi, opaklık 0.2); çok eski
  mobil GPU'larda float render hedefi desteklenmezse Three.js otomatik geri düşer.

## 25 Eylül 2026 inceleme notları

Dış kontrol `onExplodeChange` ve `onAutoRotateChange` olaylarını kullanır; klavye ve düğmeler aynı durumu gösterir. Görünmeyen noktalar klavye sırasından çıkarılır. Görünür noktalar arasında en az 48 CSS piksel merkez aralığı hedeflenir. Poster, ana bakışa sıfırlanarak `scripts/capture-poster.mjs` ile yeniden üretilebilir.
