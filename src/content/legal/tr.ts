/**
 * HUKUKİ METİN TASLAKLARI — yayına almadan önce KVKK uzmanı/avukat incelemesi gerekir.
 * Köşeli parantez içindeki alanlar işletme tarafından doldurulacaktır.
 */
import { business } from '../../config/business';
const b = business;

export interface LegalSection { id: string; title: string; html: string }

export const legalTr = {
  title: 'Gizlilik, KVKK ve Çerez Politikası',
  description: 'Ayaz İşitme Merkezi web sitesi için kişisel verilerin korunması aydınlatma metni, çerez politikası ve gizlilik politikası.',
  draftNotice: 'Bu metinler taslaktır; yayına alınmadan önce işletmeye özgü hukuki inceleme gerektirir.',
  updated: '25 Eylül 2026',
  sections: [
    {
      id: 'aydinlatma',
      title: 'Randevu Formu Aydınlatma Metni (KVKK m.10)',
      html: `
<p><strong>Veri sorumlusu:</strong> ${b.legalName} — ${b.address.line}. E-posta: <a href="mailto:${b.email}">${b.email}</a>, Telefon: ${b.phone.display}.</p>
<p><strong>İşlenen kişisel veriler:</strong> Randevu talep formunda paylaştığınız ad-soyad, telefon numarası, tercih ettiğiniz arama zamanı ve isteğe bağlı ilgi konusu (ör. cihaz türü). Güvenlik ve kötüye kullanımı önleme amacıyla talebin gönderildiği tarih-saat ve IP adresi kısa süreli olarak teknik kayıtlarda tutulabilir.</p>
<p><strong>Sağlık verisi talep etmiyoruz.</strong> Formda sağlık raporu, odyogram veya işitme durumunuza ilişkin bilgi istenmez; bu tür özel nitelikli kişisel veriler yalnızca merkezimizde, ayrı ve açık rızanızla ele alınır.</p>
<p><strong>İşleme amaçları:</strong> Randevu/geri arama talebinizin alınması ve sizinle iletişime geçilmesi; talebin kaydının tutulması; sistem güvenliğinin sağlanması.</p>
<p><strong>Hukuki sebepler:</strong> 6698 sayılı Kanun m.5/2-(c) "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması" ve m.5/2-(f) "veri sorumlusunun meşru menfaati". <em>[Hukuki inceleme: hizmet ilişkisinin niteliğine göre dayanak teyit edilecektir.]</em></p>
<p><strong>Aktarım:</strong> Form verileri, talebin bize e-posta/bildirim olarak iletilmesi için kullandığımız altyapı sağlayıcıları (sunucu ve e-posta iletim hizmetleri) aracılığıyla işlenir. Bu sağlayıcıların sunucuları yurt dışında bulunabilir; yurt dışına aktarım Kanun m.9 kapsamındaki yönteme uygun olarak gerçekleştirilir. <em>[Hukuki inceleme: kullanılan sağlayıcılar ve m.9 dayanağı yazılacaktır.]</em> Verileriniz reklam platformlarına aktarılmaz.</p>
<p><strong>Saklama süresi:</strong> Randevu talebi verileri, talebin sonuçlanmasından itibaren <em>[• ay]</em> süreyle saklanır; teknik güvenlik kayıtları <em>[• gün]</em> içinde silinir.</p>
<p><strong>Haklarınız (m.11):</strong> Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.</p>
<p><strong>Başvuru:</strong> Taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak yukarıdaki adrese yazılı olarak veya <a href="mailto:${b.email}">${b.email}</a> adresine iletebilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.</p>`,
    },
    {
      id: 'cerez',
      title: 'Çerez Politikası',
      html: `
<p>Sitemiz, çalışması için gerekli olan zorunlu kayıtlar dışında hiçbir çerezi izniniz olmadan yerleştirmez. İsteğe bağlı çerezler için verdiğiniz kararı dilediğiniz zaman sayfa altındaki <strong>Çerez tercihleri</strong> bağlantısından değiştirebilirsiniz.</p>
<table class="legal-table">
<thead><tr><th>Kategori</th><th>Amaç</th><th>Örnek kayıtlar</th><th>Süre</th></tr></thead>
<tbody>
<tr><td>Zorunlu</td><td>Çerez tercihinizin hatırlanması, form güvenliği (bot koruması)</td><td><code>ayaz.consent.v1</code> (yerel depolama), Cloudflare Turnstile çerezleri</td><td>Tercih 180 gün geçerlidir; kayıt tarayıcıdan silinebilir. Turnstile: oturum</td></tr>
<tr><td>Analitik</td><td>Sitenin nasıl kullanıldığını anlamak (Google Analytics 4). Google sinyalleri ve reklam kişiselleştirmesi kapalıdır; form alanları analitiğe gönderilmez.</td><td><code>_ga</code>, <code>_ga_*</code></td><td>Sağlayıcı belgelerine göre en fazla 2 yıl <em>[doğrulanacak]</em></td></tr>
<tr><td>Pazarlama</td><td>Reklam kampanyalarının etkisini ölçmek (Google Ads dönüşüm, Meta Pixel). Kişiselleştirilmiş reklam kapalıdır.</td><td><code>_gcl_au</code>, <code>_fbp</code></td><td>Sağlayıcı belgelerine göre yaklaşık 90 gün <em>[doğrulanacak]</em></td></tr>
</tbody></table>
<p>Analitik ve pazarlama etiketleri, ilgili kimlikler tanımlanmamışsa hiç yüklenmez. Google Haritalar gömme içeriği yalnızca "Haritayı yükle" düğmesine bastığınızda yüklenir ve o andan itibaren Google'ın kendi çerez politikası geçerli olur.</p>`,
    },
    {
      id: 'gizlilik',
      title: 'Gizlilik Politikası',
      html: `
<p>${b.legalName} olarak kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu ve ilgili mevzuata uygun olarak işleriz. Bu site üzerinden yalnızca sizinle iletişime geçmek için gereken asgari veriyi toplarız; sağlık verilerinizi çevrim içi ortamda istemeyiz.</p>
<p>Telefon, WhatsApp veya e-posta ile bize ulaştığınızda paylaştığınız bilgiler yalnızca talebinizi yanıtlamak için kullanılır. WhatsApp üzerinden iletişim, WhatsApp'ın kendi gizlilik koşullarına tabidir.</p>
<p>Sitemizde reklam kimlikleri veya kişisel bilgileriniz üçüncü taraflara satılmaz, kiralanmaz veya reklam amaçlı profil oluşturmak için kullanılmaz.</p>
<p>Bu politika zaman zaman güncellenebilir. Son güncelleme tarihi sayfanın üstünde belirtilir.</p>`,
    },
  ] as LegalSection[],
};
