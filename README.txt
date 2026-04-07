# Ayaz İşitme Cihazları - One Page (TR/EN)

Bu paket; Bootstrap 5.3 ile hazırlanmış, TR/EN tek sayfa (one-page) kurumsal sitedir.
İçerik: İletişim formu, Google harita, Bernafon “Modeller” slider (indicators ile yana kaymalı), ürün galerisi, SSS.

## Localde çalıştırma (WebStorm / VS Code)
En sağlıklısı bir local server ile açmaktır (özellikle form ve JS için):

- Python:
  - `python3 -m http.server 5173`
  - TR: http://localhost:5173/
  - EN: http://localhost:5173/en/

WebStorm:
- Proje klasörünü açın
- `index.html` üzerinde sağ tık → **Open in Browser**
- Alternatif: WebStorm “Built-in server” ile link üretir

## Dark Mode
Sağ üstteki tema butonu (ay/ güneş) ile light/dark geçiş yapılır.
Tercih localStorage’da saklanır ve tekrar açılışta uygulanır.

## İletişim Formu
Formlar şu endpoint’e bağlıdır (ücretsiz, ilk kullanımda e-posta doğrulaması isteyebilir):
- `https://formsubmit.co/medsemisitme@gmail.com`

İsterseniz bunu kendi mail sunucunuza/CRM’inize veya başka bir form sağlayıcısına çevirebiliriz.

## Görseller
- Logo: sizin yüklediğiniz logo (assets/img/logo.png).
- Bernafon ürün/insan görselleri: Bernafon’un resmi global sitesindeki görsel CDN kaynaklarından alınmıştır.
  Lütfen ticari kullanım için marka/dağıtıcı sözleşmeniz ve kullanım izinleri kapsamında olduğundan emin olun.
  Görseller: `assets/img/bernafon/`

