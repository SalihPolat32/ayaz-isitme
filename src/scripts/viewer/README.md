# 3B cihaz görüntüleyici (`src/scripts/viewer`)

Etkileşimli, parçalanabilir (explode), **pil kapağı açılabilen** üç temsili işitme cihazı:
**RIC (312 pil)**, **BTE (13 pil)**, **CIC (10 pil)**. Çalışma zamanında `setDeviceType()` ile
değiştirilir. Çerçeve bağımsız TypeScript + `three@0.186`; Astro bileşeni yalnızca canvas'ı
sağlar ve `mountDeviceViewer()` çağırır. Hiçbir dış varlık (GLB/texture) yoktur; her şey
parametrik Three.js geometrisidir.

## Önemli: temsili model uyarısı

Modeller **markasız ve şematiktir**; gerçek bir ürünün birebir kopyası değildir. Herhangi bir
üreticinin tasarımını, ticari görünümünü (trade dress) veya patentli bir formunu temsil etmez.
Sayfada bu durum kullanıcıya açıkça belirtilmelidir (ör. "Temsili gösterim — gerçek cihaz
modele göre farklılık gösterir"). Marka/model adı, logo veya ürün fotoğrafı bu modellerle yan
yana "aynı ürün" izlenimi verecek biçimde kullanılmamalıdır. Pillerin üzerinde marka yazısı yoktur;
yalnızca boyut standardının etiket rengi (312 kahverengi, 13 turuncu, 10 sarı) önerilir.

## Dosyalar

| Dosya | Görev |
| --- | --- |
| `types.ts` | `DeviceType`, `PartId`, **`PART_IDS`** (runtime sabit), `ViewerOptions`, `ViewerController`, `DevicePart`, `DeviceModel`. |
| `model.ts` | `buildDeviceModel(type)`, `buildRenderModel(kind)`, `buildShellVariant(kind)`, `BATTERY_SIZE`, `RENDER_KINDS`. |
| `model-curved.ts` | RIC ve BTE: omurga boyunca loft gövde (altta simetrik yuvarlatılmış dikdörtgen kesit), **alttan açılan çekmece** pil kapağı (`slot-door.ts`), mikrofon portları, düğmeler, kablo/alıcı/dome (RIC), üst tabla + kalın akrilik kanca + meme / #13 hortum / akrilik kulak kalıbı (BTE). `BTE_TUBE_MM`, `BTE_HOOK_MM`. |
| `slot-door.ts` | RIC/BTE pil yuvası geometrisi: yanaklı gövde derisi (şerit hücreleri dikişin altında çıkarılmış) + yanak iç yüzleri + dikiş yüzü (su geçirmez), U biçimli kapak (dış/iç deri + kenar yüzleri, ön-üst köşe pahı), pim uçları. |
| `model-shell.ts` | Ortak kabuk üreticisi `buildShellDevice(spec)`: CIC (etkileşimli) ve yalnızca render için ITE / ITC / IIC (`SHELL_VARIANTS`). Faceplate hattından kanal kesitine dışbükey geçişli organik loft, yüzey pimli ince pil kapağı + görünen koyu cep + görünmez bölme hacmi (`compartment`), mikrofon, vent, çıkarma ipi, ses tekerleği (ITE), kulak kiri koruyucusu. |
| `loft.ts` | Omurga boyunca kesit süpürme (yuvarlak/düz/açık uçlar, özel `section` kesit eğrisi). |
| `parts.ts` | Parça taslakları, çinko-hava pil (`addBattery`), menteşe/kayma mekaniği, bağlantı noktaları (`connectors` → `root.userData.connectors`), `finalizeModel()` (poz, sınırlar, çapalar, dispose). |
| `materials.ts` | Malzemeler (grafit, çelik pil, yarı saydam akrilik kalıp `mold`, kabuk akriliği `shellAcrylic`, faceplate, şeffaf PVC, silikon dome, naylon ip…) — `makeMaterial(kind, color?)` — ve `HIGHLIGHT_COLOR`. |
| `scene.ts` | Renderer, kamera, OrbitControls, `createStudio()` (RoomEnvironment→PMREM, VSM yumuşak gölge, zemin), `setModel()` ile yeniden çerçeveleme, render döngüsü, gözlemciler, bağlam kaybı, `dispose()`. |
| `render.ts` | Çevrimdışı ön ayar render'ı (`renderDeviceView`) — sabit ölçekli şeffaf PNG'ler, katman maskeleri, parça/mesh süzgeci (`parts`, `hideMeshes`), otomatik çerçeveleme (`fit`, `dir: 'home'`), kesirli kapak (`door: 0..1`; `doorOpen` de çalışır), yakın çekim hedefi (`target`), bağlantı noktalarının piksel koordinatı (`connectors`) ve model ölçüleri (`dims`). |
| `explode.ts` | Genel skaler tween (`Tween`, `ExplodeController`): parçalanma 600 ms, kapak 450 ms; hareket azaltmada anında. |
| `camera.ts` | Klavye yörünge adımı ve kamera küresel tween'i (`focusPart`, `reset`). |
| `hotspots.ts` | Çapaları her karede CSS pikseline yansıtır; görünürlük = `anchorEnabled` ∧ normal·kamera > eşik ∧ canvas içi; model değişince eski kimliklere `visible=false`. |
| `index.ts` | `mountDeviceViewer(root, opts)` ve `isWebGLAvailable()`; DEV'de `window.__ayazViewer`. |
| `gltf.ts` | **Taslak** — lisanslı GLB ile değiştirme yolu (`loadGltfModel`). Kullanımda değil. |

## Üç model (+ üç render türevi)

| | RIC | BTE | CIC |
| --- | --- | --- | --- |
| Pil | **312** — Ø7.9 × 3.6 mm, kahverengi etiket | **13** — Ø7.9 × 5.4 mm, turuncu etiket | **10** — Ø5.8 × 3.6 mm, sarı etiket |
| Boyut | Omurga ≈ 28.8 mm; altta 9.4 × 6.8 mm, üste doğru incelir; grafit | Omurga ≈ 40 mm (RIC'in 1.39 katı), tabla + saplama ile ≈ 42 mm; altta 12 × 9.2 mm, dolgun sırt, üstte Ø4 mm düz tabla; **açık şampanya metalik** | Faceplate 9 × 7.5 mm (yuvarlak üçgen/oval), faceplate→uç ≈ 11.4 mm, ~20° kıvrık fasulye biçimi |
| Parçalar | mics, body, button, wire, receiver, dome, battery-door, battery | mics, body, button (program + ses rocker'ı), hook, tube, earmold, battery-door, battery | shell, faceplate, mic, battery-door, battery, vent, pull-string, receiver-outlet |
| Kapak | Alt uçta çekmece (dikiş alttan ≈ 9.3 mm); pim dikişin ön ucunda, ekseni Z; alt uç öne **90°** döner | Aynı; dikiş alttan ≈ 9.3 mm, **90°** | Faceplate'te 7.2 × 4.1 mm ince kapak; pim üst kısa kenarda yüzeyde, serbest alt kenar **88°** dışarı |
| Üçgen | ≈ 14.2k | ≈ 31.4k | ≈ 13.7k (ITE 14.0k, ITC 11.9k, IIC 12.9k) |

Bütçe tip başına 40k üçgendir (mobil GPU + gölge geçişi + transmission geçişi = model 3 kez çizilir).

**Render türevleri** (`buildShellVariant`, etkileşimli değil, aynı parça kimlikleri):

| | ITE (tam kabuk) | ITC (yarım kabuk) | IIC (dip kanal) |
| --- | --- | --- | --- |
| Faceplate / uzunluk | ≈ 15 × 17.7 mm, konkayı dolduran kulak biçimli hat + arka-üstte heliks kilidi çıkıntısı; ≈ 16 mm | ≈ 11 × 12.6 mm; ≈ 14 mm | ≈ 5.8 × 7.2 mm; ≈ 10.5 mm |
| Faceplate düzeni | Yatay dikdörtgen kapak (13 pil), tırtıllı ses tekerleği (sağ üst), 2 vida başı mikrofon portu (sol üst), vent (alt) | Dikey dikdörtgen kapak (312), 1 mikrofon, vent | Koyu gri kabuk, siyah faceplate, dikey kapak (10), mikrofon, vent, çıkarma ipi |
| Kabuk profili | Kubbe biçimli konka kısmı kanala dolguyla bağlanır (`fillet`) | Mermi/fasulye (dışbükey) | Mermi/fasulye |

### Parça kimlikleri (`PART_IDS`, `types.ts`)

```ts
ric: ['mics','body','button','wire','receiver','dome','battery-door','battery']
bte: ['mics','body','button','hook','tube','earmold','battery-door','battery']
cic: ['shell','faceplate','mic','battery-door','battery','vent','pull-string','receiver-outlet']
```

`battery` grubu **`battery-door` grubunun çocuğudur**: kapakla birlikte döner. Kapak grubunun
orijini menteşe noktasıdır (`localizeTo`).

### Pil kapağı (mekanizma ve animasyon)

**RIC / BTE — alttan açılan çekmece** (referans: parmaklar arasında tutulan 312 RIC fotoğrafı; ayrıntı `slot-door.ts`):

- Gövdenin iki yan duvarı (**yanaklar**, |z| > w; w = pil kalınlığının yarısı + 0.25 mm) alt uca kadar **tam** kalır.
  Aralarındaki dilim, dikiş istasyonunun (alt uçtan ≈ 9.3 mm, pilin üstünden 0.24 mm yukarıda) altında boştur.
- Kapak bu yuvaya oturan **U biçimli çekmecedir**: ön şerit + alt uç + arka şerit (dış yüzeyi gövdeyle aynı yüzey),
  0.55 mm (RIC) / 0.6 mm (BTE) duvarlı iç yüz, koyu yan ve üst kenarlar, pili kenarından saran koyu **beşik** (halka
  dilimi), arka şeritte dikişin altında **tırnak çentiği**. Kapalıyken yalnızca ön/alt/arka kenarlardaki şerit ve ince
  dikişler görünür (dikiş 0.24 mm, yanak aralığı 0.1 mm); pil tamamen gizlidir.
- **Menteşe pimi dikiş hattının ÖN ucunda** (ön yüzeyden 0.35 / 0.4 mm içeride), ekseni yan yüzlere dik (+Z): pim
  yanaklardan geçer, uçları yan yüzlerde küçük metal noktalar olarak görünür. Kapağın ön-üst köşesi 45° pahlıdır.
- Açılış (`t` 0 → 1): kapak pim çevresinde profil düzleminde **90°** döner, alt ucu öne çıkar; pil beşikte birlikte döner
  ve yanakların arasından **tamamen** dışarı çıkar → yan görünüşte etiketli (+Z) yüzü görünür, açık çekmecenin ön şeridi
  pilin üstünde yatay durur (fotoğraftaki gibi). Kapanış aynı yayla geri; **kayma yoktur** (pil beşikte sabit).
- **Çakışmasızlık**: kapak bölgesi dilimin dikiş altındaki tamamı olduğundan her noktası pim çevresinde döndüğünde
  gövde dış hattının dışına çıkar; dikişin üstündeki gövdeye yalnızca pimin önündeki noktalar girebilir → pah. Pah
  sınırı, gövde dikiş yüzünün pimin önündeki GERÇEK en alçak noktasından hesaplanır (omurga eğri olduğundan ön kenar
  `gapBody`'den ≈ 0.03 mm alçaktadır; aksi halde 90°'de kapak köşesi dikiş yüzü kenarına ≈ 0.05 mm girer). Kapalı
  yuvada koyu yanak iç yüzleri ve dikiş yüzü görünür (see-through yok). `tests/viewer-door.test.ts` her `t`
  (25 adım, parçalanma 0 ve 1) için pil ve kapak köşelerinin gövde katısının içinde olmadığını VE gövde köşelerinin
  kapak paneli / pil katısının içinde olmadığını (köşeler arasından geçen yüzler) ışın paritesiyle denetler; kapalıyken
  kapak dış derisinin normali yönünde görünür gövde yüzeyi olmamalı; tam açıkta pilin ≥ %70'i yan silüetin dışında
  olmalı (şu an %100), kapalıyken %0.
- Parçalanma: kapak öne-aşağı; pil kapağın açık yan tarafından (+Z) dışarı → gövde — kapak — pil.

**Kulak içi kabuklar (CIC / ITE / ITC / IIC)**: yuvarlak köşeli dikdörtgen, 0.3 mm kalın kapak faceplate'te; menteşe
pimi bir kısa kenarda plaka yüzeyinin 0.12 mm altında (ince metal çubuk görünür), serbest kenarda tırnak çentiği. Pil
kapağın hemen altında **dik** durur (yuvarlak yüzü dönme düzleminde, etiket ana bakış tarafında). Plaka düzlemini kesen
her pil noktası pime ≤ delik boyu uzaklıkta olmalıdır (yoksa delik kenarından geçer); bu yüzden CIC'te kapak 7.2 mm ve
pil menteşeden 2.14 mm uzakta (`batteryF`; izin verilen en büyük değeri aşarsa model hata verir), kapak **88°** açılır →
açıkta pilin tamamı faceplate'in dışında. Kapağın altında koyu kuyu (görünen cep) ve pilin açılış yayını kapsayan görünmez
**bölme hacmi** (`compartment`, `userData.proxy`) vardır; bölme deliğin menteşe ucunun gerisinde pilin süpürdüğü
disklerin üst zarfını izler (kabuğun daralan üst duvarına taşmaz). İkisi de kabuğun içinde kalır (test). ITE/ITC/IIC
yalnızca kapalı render edilir; pilleri kapağın ortasında (`batteryF: 'center'`), bölme hacmi yok — açılış çakışması bu
türevlerde denetlenmez.
- **Faceplate deliği bandı**: ExtrudeGeometry pahı (`PLATE_BEVEL_SIZE` 0.2 mm) üst yüzde dış hattı içeri, deliği dışarı
  kaydırır; ikisinin arasındaki en dar bant 2 × pahtan dar olursa üst yüz üçgenleri ters döner ve deliğin bir kısmını
  kapatır (kapak plaka bandının altına gömülür). `plateClearance(spec)` bu bandı (ve delik ile mikrofon / vent / ip tabanı /
  tekerlek arasını) ölçer; test tüm türevlerde bant ≥ 2 × pah + 0.1 mm ister. Şu an: CIC 0.56 mm, ITC 1.65, ITE 1.45,
  IIC 0.64 mm. Delik = kapak + 0.12 mm (`HOLE_GAP`) her kenarda; pim boyu deliğin menteşe hizasındaki genişliğine
  sığdırılır. Kapak ve plaka kapak düzlemindeki normalleri tam ±Z (pah kapağa teğet) → düz yüzde çapraz gölge kaması yok.

Ortak:

- `setBatteryDoor(open, animate?)`, `toggleBatteryDoor()`, `isBatteryDoorOpen()`; klavye **`b`**.
- ~450 ms easeInOutCubic (`ExplodeController`, `DOOR_DURATION`); hareket azaltma tercihinde anında.
- `focusPart('battery')` / `focusPart('battery-door')` kapağı otomatik açar ve çapayı kapağın **hedef**
  pozunda hesaplar.
- Hotspot: `battery-door` çapası RIC/BTE'de arka şeridin ortasında (normal: şerit normali + dış yan yüz), kabuklarda
  kapağın dış yüzünde (normal: pilin etiket tarafı + dışarı → açıkken odak kamerası pili karşıdan, kapağı yandan görür);
  `battery` çapası pilin etiket yüzünün merkezinde ve kapak kapalıyken `anchorEnabled=false` → `onHotspot(..., visible=false)`.
- `reset()` ve `setDeviceType()` kapağı kapatır (`onDoorChange(false)`).
- `boundsExploded` hem kapak kapalı hem açık (parçalanmış) pozların birleşimidir (kadraj ve gölge kamerası).
- Çarpışma işaretleri (yalnızca test/denetim): `mesh.userData.collision` = `'solid'` (gövde katısı; aynı
  `collisionGroup` tek kapalı yüzey), `'cavity'` (katıdan oyulmuş boşluk; `userData.carves` = oyduğu katı grubunun adı —
  CIC kuyusu ve bölmesi yalnızca `'shell'` iç hacmini oyar, faceplate malzemesini asla), `'door'` (kapak paneli katısı;
  CIC'te ince kapak). Adlar: kapak dış yüzü `door-outer`, pil gövdesi `battery-cell`, faceplate plakası `faceplate-plate`.

### BTE kulak kalıbı, kanca ve hortum

- **Kalıp** (akrilik tam kabuk): konka çanağı ≈ 13 × 16 mm, ≈ 5.2 mm kalın, yanal yüzü yassı, kenarları
  yumuşak; dış hat 2B örtük alandan (böbrek elips + parmak biçimli **heliks kilidi** kolu, yumuşak dolgulu
  birleşim) çıkarılır. Kanal kökünde medial yüz şişkinleşir; **kanal gövdesi** kökte hafif genişler,
  Ø6.5 → 5.3 mm incelir, ≈ 9 mm, ~28° öne-yukarı kıvrık. Uçta **ses borusu** (Ø1.9 mm) ve yanında **vent**
  (Ø0.8 mm); yanal yüzde vent ağzı.
- **Hortum yuvası**: çanağın üst kenarından yükselen akrilik bilezik (Ø4.4–5 mm), ağzında koyu delik ve beyaz **hortum
  kilidi** halkası; hortum yuvaya ≈ 2.5 mm girer (yarı saydam kalıbın içinden seçilir).
- **Kanca**: gövde tepesindeki Ø4 mm düz **tablaya** (dişli çelik saplama) koyu somunla vidalanan kalın şeffaf akrilik
  kanca, **Ø3.8 mm** (`BTE_HOOK_MM`), iç kanal Ø1.5 mm; kulağın üstünden kıvrılır, ucunda tırtıllı (dikenli) meme.
- **Hortum**: standart **#13** şeffaf PVC, **Ø3.3 / Ø1.9 mm** (`BTE_TUBE_MM`); memenin üzerine ≈ 4 mm geçer. İç kanal
  (`lumen`, arka yüz çizilen gri iç duvar) şeffaf cidarın içinden koyu bir çekirdek gibi okunur → hortum boş bir
  borudur. Uçlarda cidar kalınlığını gösteren kesik halkalar.
- `root.userData.dims = { tubeOuterMm: 3.3, tubeInnerMm: 1.9, hookOuterMm: 3.8 }` → `render.ts` sonucu `dims`.
- Malzeme `mold`: sıcak pembe-ten akrilik (#e9a996), transmission 0.22 + kırmızımsı zayıflatma rengi,
  clearcoat 0.85, hafif sheen.

### RIC alıcısı

Kablo kulağın üstünden öne geçer, sonra kanala doğru (içe-öne-aşağı) döner; alıcı + dome kanal yönünde durur
(yan görünüşte sağa-aşağı ve sayfanın içine). Alıcı arkasında kablo girişinde gerilim kılıfı vardır.

### Model değiştirme

`await viewer.setDeviceType('bte')`: eski geometri/malzemeler `dispose()`, yeni model kurulur,
`scene.setModel()` ana bakışı yeniden hesaplar (`fitView`, modelin `homeDir`'i), parçalanma 0 ve
kapak kapalı, kamera anında ana bakışa; otomatik dönüş durumu korunur; shader'lar
`compileAsync` ile derlenir; `onDeviceChange(type)` çağrılır ve yeni kimlikler için hotspot bildirimi
başlar (eski kimliklere bir kez `visible=false` gönderilir). `getPartIds()` geçerli listeyi verir.

## Ölçek ve eksenler

- **1 sahne birimi = 10 mm** (`UNIT_MM`).
- RIC/BTE: +X yüze/kulak kanalına doğru (ön), +Y yukarı (kablo/kanca çıkışı), +Z dışa bakan yüz.
  Omurga XY düzlemindedir; +n = arka sırt (düğmeler, mikrofonlar), −n = ön (kafaya bakan).
- Kabuklar (CIC/ITE/ITC/IIC): +Z lateral (faceplate, dışarı bakan), −Z medial (kanal ucu), +Y yukarı, +X öne.
  Omurganın ilk parçası tam −Z olmalıdır (faceplate kenarı kabukla aralıksız birleşsin; üretici bunu denetler).
- Model kökü orijindedir. Açılma: `position = restPosition + explodeDirection * explodeDistance * t`
  (üst nesne uzayında; pil için kapak uzayı). Kapak: `quaternion = axisAngle(axis, angle * doorT)`.

## Kullanım

```ts
const { mountDeviceViewer, isWebGLAvailable } = await import('../scripts/viewer/index.ts');
if (!isWebGLAvailable()) { /* statik poster göster */ }
const viewer = await mountDeviceViewer(rootEl, {
  canvas,
  deviceType: 'ric',
  onHotspot: (id, x, y, visible) => { /* nokta elemanını translate(x,y) ile konumla */ },
  onDoorChange: (open) => { /* kapak düğmesi durumu */ },
  onDeviceChange: (type) => { /* hotspot DOM'unu PART_IDS[type] ile yeniden kur */ },
});
await viewer.setDeviceType('cic');
viewer.explode(); viewer.focusPart('battery'); viewer.toggleBatteryDoor(); viewer.reset(); viewer.destroy();
```

- `onHotspot` koordinatları **canvas'ın sol-üst köşesine göre CSS pikseldir**; nokta katmanını
  canvas'ın üzerine `position:absolute; inset:0` ile yerleştirin. Görünür noktalar arasında en az
  48 px merkez aralığı korunur.
- Canvas'a `tabindex="0"` verin: ok tuşları döndürür, `+`/`-` yaklaştırır, `r` sıfırlar, `e` parçalar, `b` kapağı açar/kapar.
- Canvas üzerinde `touch-action: pan-y`: tek parmakla yatay döndürme, dikey sayfa kaydırma, iki parmakla yaklaştırma.
- Ana bakış tip başına `DeviceModel.homeDir` ile gelir (RIC/BTE: arka sırt + dış yüz, hafif üstten;
  kabuklar: ön-üst-dış 3/4 — faceplate ve kanala incelen kabuk birlikte). Çerçeveleme gerçek silüete göre (`fitView`, kadrajın %74'ü). Parçalanırken
  pivot yeniden ortalanır ve açılmış halin boyut oranı kadar küçülür.
- Otomatik dönüş ilk etkileşimde durur; `reset()` son tercihi geri yükler. Sekme gizliyken veya
  canvas görünüm dışındayken döngü durur; hiçbir şey değişmiyorsa kare çizilmez.

## Malzemeler

Nötr stüdyo: RoomEnvironment→PMREM (0.9), tepeden ana ışık + VSM yumuşak temas gölgesi, ACES.
RIC gövde ve kapak grafit (#2e333a, roughness .5, clearcoat .25; kapak içi ve kenarları daha koyu mat); BTE açık şampanya
/ gümüş-bej metalik (`champagne` #cdbd9f, metalness .55, clearcoat .6); pil yuvası iç yüzleri `cavity` (koyu mat); pil fırçalanmış
çelik + etiket diski (yarıçapın %70'i); BTE kalıbı yarı saydam pembe-ten akrilik (`mold`); kabuklar
`shellAcrylic` (transmission .1, renk parametreli: CIC #b27d5b kahve-ten, ITC #c59772, ITE #dba386 pembe-ten),
faceplate ve kapak bir ton koyu opak akrilik; IIC koyu gri kabuk + siyah faceplate (opak). Hortum/kanca şeffaf
(transmission .8, ior 1.45); dome yarı saydam silikon; çıkarma ipi şeffaf naylon + topuz; mikrofon portları
vida başı görünümlü metal halka. Tüm malzemeler parça başına ayrı örnektir (vurgu emissive'i).

## Render betiği (kulak illüstrasyonu ve ürün küçük resimleri)

```bash
ASTRO_DEV_BACKGROUND=0 npx astro dev --port 4323 --host 127.0.0.1   # veya çalışan dev sunucusu (ör. 4321)
node scripts/render-device-views.mjs http://127.0.0.1:4323/dev/viewer/ [--height=1400] [--pad=6] [--thumb=900]
```

`/dev/viewer/` sayfası `window.__ayazRender(kind, opts)` (→ `render.ts`) açar. Paralel düzenlemeler Vite'ın
sayfayı yenilemesine yol açarsa betik bekleyip yeniden dener. Çıktılar `src/assets/device/views/`:

- `ric.png`, `bte.png` — takılı yönelim, yan görünüş (+Z, hafif arkadan-üstten): gövde solda
  (kulak arkası), kablo/kanca sağa (öne) kıvrılır. **Sol kulak** yan görünüş illüstrasyonu (yüz sağda) için.
- `ric-body.png` + `ric-front.png`, `bte-body.png` + `bte-front.png` — aynı kameradan iki katman
  (`DevicePart.layer`: `body` = kulak arkasında kalanlar, `front` = kulağın üzerinden geçenler), üç
  dosya **ortak kırpma kutusuyla** kesilir → (0,0) hizalı bindirilir. Betik kutuyu yazdırır.
- `cic.png`, `ite.png`, `itc.png`, `iic.png` — faceplate dıştan (hafif eğik), kapak kapalı.
- **Ayrı parçalar** (hortum/kablo site bileşeninde SVG yolu olarak çizilir; aynı yanal kamera, sabit ölçek,
  temas gölgesi kapalı, her biri kendi kutusuna kırpılmış):
  `ear-bte-body.png` (gövde + kanca, hortum/kalıp yok), `ear-bte-mold.png` (yalnız kalıp, yanal yüz),
  `ear-ric-body.png` (gövde + kısa kablo konektörü), `ear-ric-receiver.png` (alıcı + dome).
- **`anchors.json`** — her ayrı parça için `width`, `height`, `mmPerPx` ve bağlantı noktaları **o PNG'nin kendi
  piksel uzayında** (sol-üst orijin, y aşağı): `hookTip` + `hookTipDir` (BTE gövde), `tubeInlet` +
  `tubeInletDir` + `center` (kalıp), `wireExit` + `wireExitDir` (RIC gövde), `wireInlet` + `wireInletDir` +
  `center` (alıcı). `*Dir` görüntü düzleminde birim yöndür (hortum/kablo o yönde çıkar). `canvasBox`: aynı
  türün kırpılmamış ortak kanvasındaki kutu (parçaları 3B modeldeki göreli konumlarıyla yerleştirmek için).
  Noktalar modelde `md.connectors` ile tanımlanır, `render.ts` kamerayla yansıtır.
- **Ürün küçük resimleri** `thumb-{ric,bte,ite,itc,cic,iic}.png` — modelin ana bakışı (poster yönü, 3/4),
  kapak kapalı, aynı stüdyo ışığı, temas gölgesi kapalı, 2400 px'te render → kırpılıp **900 px yüksekliğe**
  küçültülür (ölçek türe göre değişir, betik yazdırır).
- Ölçek (views + ear-*) sabittir: fov 18°, **0.045 mm/px (22.2 px/mm)** model merkez düzleminde; betik
  `viewHeightMm = height × 0.045` verir, varsayılan canvas 1400 px = 63 mm (`--height` yalnızca kapsanan alanı değiştirir;
  silüet kenara değerse `UYARI` yazar). BTE ≈ 52 mm yükseklik (kanca + kalıp dahil), RIC ≈ 34 mm, CIC ≈ 13.4 mm ip dahil.
- `anchors.json` BTE girişlerinde (`ear-bte-body`, `ear-bte-mold`) ayrıca **`tubeOuterMm` / `tubeInnerMm`** (3.3 / 1.9):
  SVG hortumu gerçek çapta çizmek için (px = mm / mmPerPx → 73.3 / 42.2 px).
- Temas gölgesi kapalı, alfa korunur. Dosyalar tarayıcı kapandıktan sonra yazılır (Vite yeniden yükleme).

## Poster yakalama (statik yedek görsel)

```bash
node scripts/capture-poster.mjs http://127.0.0.1:4323/dev/viewer/ [ric|bte|cic|all]
```

`__ayazViewer.setDeviceType(kind)` → `reset()` → kapak kapalı → `captureImage(1600,1600)`; kırpılıp
%18 paylı kare tuvale ortalanır → `src/assets/device/{ric,bte,cic}-poster.png` (1643 px, şeffaf).
`captureImage()` bir kare çizer ve aynı tick içinde `toDataURL` okur (preserveDrawingBuffer gerekmez).

## Parametrik modeli lisanslı GLB ile değiştirme

`gltf.ts` içindeki `loadGltfModel(url, { type, scale, hints, door })` aynı `DeviceModel`
sözleşmesini üretir. `index.ts` içinde `buildDeviceModel(type)` yerine
`await loadGltfModel('/models/{type}.glb', { type })` kullanın (hem `mountDeviceViewer` hem
`setDeviceType` async). Dosyaları `public/models/` altına koyun; Draco/Meshopt kullanmayın ya da
decoder yolunu ayarlayın.

GLB gereksinimleri:

1. Kök sahnenin **doğrudan çocukları** olarak `PART_IDS[type]` adlı düğümler; **`battery` düğümü
   `battery-door` altında** olmalı (kapakla döner). Alt parçalar bu düğümlerin altında olabilir.
2. Ölçek 1 birim = 10 mm (Blender metre çıkışı için `{ scale: 100 }`).
3. Eksenler: RIC/BTE +X ön uç, +Y yukarı, +Z dışa bakan yüz; CIC +Z faceplate.
4. Kapak menteşesi `door: { hinge, axis, angle?, slideDir?, slideDistance? }` ile model uzayında
   verilir; verilmezse kapak dönmez.
5. Malzemeler PBR; vurgu için parça başına klonlanır. `KHR_materials_transmission` desteklenir.
6. Açılma yönleri / çapa normalleri `hints` ile parça başına; verilmezse parametrik varsayılanlar.
7. Toplam ≤ 40k üçgen/tip; tek doku seti (≤ 2048²) veya dokusuz düz PBR renkler.
8. Lisans: GLB'nin ticari web kullanımına izin verdiğini belgeleyin, yanına `LICENSE.txt` koyun.
   Ürün fotoğrafından fotogrametri ile üretilmiş modeller marka haklarını ihlal edebilir.

`gltf.ts` derlenir ancak gerçek bir GLB ile **test edilmemiştir**; etkinleştirirken `/dev/viewer/` ile doğrulayın.

## Bilinen sınırlar

- Dome'da havalandırma çentikleri yoktur; RIC alıcı kablosu opak açık gridir (sıralama artefaktı yok).
- Kulak kalıbının kanalı ile çanağı iki ayrı yüzeydir (kesişim medial tarafta, yan/ana bakışta görünmez);
  ses borusu kanal boyunca modellenmemiştir (yalnız uçta ve hortum girişinde görünür).
- RIC/BTE pim ekseni ön yüzeye çok yakındır (0.35–0.4 mm): yanaklarda pime ayrılan malzeme ince (≈ 0.2 mm) ama vardır;
  kapağın ön-üst köşesi bu yüzden pahlıdır. Pim kapağa ayrı bir mafsal halkasıyla bağlanmaz (temsili).
- CIC bölme hacmi (`compartment`) görünmezdir (yalnızca çarpışma denetimi); görünen koyu cep kuyunun tabanı, açılırken
  pilin alt kısmını örter (pil koyu cepten çıkıyormuş gibi görünür).
- ITE / ITC / IIC türevlerinde kapak hiç açılmaz; pil kapağın ortasındadır ve açılış çakışması denetlenmez.
- Transmission (dome, hortum, kalıp, kabuklar) geçişi şeffaf zeminde beyaz-yarı saydam temizleme kullanır;
  kalıbın PNG'lerde alfa değeri ≈ 0.9'dur (akrilik gibi hafif geçirgen), açık zeminde fark edilmez.
- Gölge VSM'dir (256 px + geniş bulanıklık); çok eski mobil GPU'larda float render hedefi yoksa
  Three.js otomatik geri düşer.
- Headless (SwiftShader) sayfada `requestAnimationFrame` çalışır; render/poster betikleri yine de
  animasyonsuz çağrılar (`setBatteryDoor(open,false)`, `setExplode(t,false)`) kullanır.
