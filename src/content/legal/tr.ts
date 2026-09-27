/**
 * Gizlilik / KVKK / çerez metni (Türkçe, esas metin).
 * Metin DERLEME YAPILANDIRMASINDAN üretilir: yalnızca bu derlemede gerçekten çalışan işleme anlatılır
 * (form modu, Turnstile, canlı yorumlar, ölçüm kimlikleri — bkz. facts.ts > LegalBuildContext).
 * İşletmeye özgü bilgiler (saklama süreleri, bildirim sağlayıcısı, m.9 dayanağı, onaylar) business.legal'dan
 * gelir; eksikse önizlemede işaretli yer tutucu basılır, üretim derlemesi durur. İngilizce sürüm (en.ts) aynı yapıdadır.
 */
import { business, type LegalFacts } from '../../config/business';
import { PROVIDERS, escapeHtml, ext, formatVersionDate, joinList, legalValues, type LegalBuildContext, type MissingFact } from './facts';
import { CONSENT_SERVICE_NAMES } from './consent-view';

const b = business;

export interface LegalSection { id: string; title: string; html: string }

export interface LegalDoc {
  title: string;
  description: string;
  /** Eksik işletme bilgisi varsa önizleme uyarısı (HTML); tamamsa null */
  draftNotice: string | null;
  updated: string;
  sections: LegalSection[];
}

/** E-posta adresimiz Gmail'de mi (business.email) */
export const emailOnGmail = () => /@gmail\.com$/i.test(b.email);

/**
 * approvalObject: onay dışındaki bilgiler tamam ve yalnızca textApproval eksikse, bu nihai metnin onayı için
 * kopyalanacak nesne (facts.ts > textApprovalTemplate); önizleme uyarısında gösterilir. Uyarı metin özetine girmez.
 */
export function legalTr(ctx: LegalBuildContext, missing: MissingFact[], facts: LegalFacts = b.legal, approvalObject: string | null = null): LegalDoc {
  const v = legalValues(facts, 'tr');
  const api = ctx.formMode === 'api';
  const gmail = emailOnGmail();
  const ch = v.channels;
  const emailChannel = !!ch && ch.some((c) => c === 'resend' || c === 'brevo');
  const optional = ctx.ga4 || ctx.gads || ctx.meta || ctx.openai;
  const channelNames = ch ? joinList(ch.map((c) => PROVIDERS[c].name), 've') : v.channelsTodo;
  const marketing: string[] = [...(ctx.gads ? [CONSENT_SERVICE_NAMES.gads] : []), ...(ctx.meta ? [CONSENT_SERVICE_NAMES.meta] : []), ...(ctx.openai ? [CONSENT_SERVICE_NAMES.openai] : [])];

  const formP = api
    ? `<p><strong>Randevu formu:</strong> Formu gönderdiğinizde ad-soyad, telefon numarası, tercih ettiğiniz arama zamanı ve (bu sekmede bir cihaz kartındaki ya da kulak kalıbı bölümündeki randevu düğmesine tıkladıysanız) ilgi konusu, Cloudflare altyapısında çalışan uygulamamıza (Cloudflare Workers) iletilir. Uygulama bu bilgileri bir veritabanına yazmaz; talebinizi ${channelNames} aracılığıyla bize bildirim olarak iletir. Bildirimde ayrıca talebin alındığı zaman, formun gönderildiği sayfa adresi, sayfa dili ve Cloudflare'in IP adresinizden belirlediği ülke kodu yer alır.${emailChannel && gmail ? ` Bildirim e-postaları ${b.email} adresimize, yani Google'ın Gmail hizmetine ulaşır.` : ''}</p>
<p><strong>Kötüye kullanımın önlenmesi:</strong> IP adresiniz, 60 saniyelik aralıklarla gönderilebilecek talep sayısını sınırlamak için kullanılır${ctx.turnstile ? ' ve bot doğrulaması için Cloudflare Turnstile hizmetine iletilir' : ''}. Uygulamanın yazdığı çalışma kayıtlarında telefon numaranız yalnızca maskelenmiş olarak, ülke kodu ve iletim sonucuyla birlikte yer alır; adınız bu kayıtlara yazılmaz.</p>${ctx.turnstile ? `
<p><strong>Bot koruması:</strong> Formu doldurmaya başladığınızda Cloudflare Turnstile yüklenir. Turnstile, formu bir insanın gönderdiğini doğrulamak için tarayıcınızdan teknik bilgiler ve IP adresinizi işler.</p>` : ''}`
    : `<p><strong>Randevu formu:</strong> Bu sitedeki form, girdiğiniz bilgileri hiçbir sunucumuza göndermez. Formu gönderdiğinizde ad-soyad, telefon numarası, tercih ettiğiniz arama zamanı ve (bu sekmede bir cihaz kartındaki ya da kulak kalıbı bölümündeki randevu düğmesine tıkladıysanız) ilgi konusu, tarayıcınızda hazır bir WhatsApp mesajına dönüştürülür ve <code>wa.me</code> bağlantısıyla WhatsApp açılır. Bağlantı açıldığında mesaj metni WhatsApp'a (Meta) iletilir; mesajı siz gönderdiğinizde talebiniz bize ulaşır ve WhatsApp üzerinde tarafımızca işlenir. Mesajı göndermezseniz talebiniz bize ulaşmaz.</p>`;

  const recipients = [
    `<li><strong>${PROVIDERS.github.name}</strong>: sitenin barındırılması. ${ext(PROVIDERS.github.privacy, 'Gizlilik bildirimi')}</li>`,
    `<li><strong>${PROVIDERS.google.name}</strong>: iletişim bölümündeki harita (Google Haritalar)${gmail ? ', e-posta hizmetimiz (Gmail)' : ''}${ctx.ga4 ? ', izninizle Google Analytics' : ''}${ctx.gads ? ', izninizle Google Ads dönüşüm ölçümü' : ''}. ${ext(PROVIDERS.google.privacy, 'Gizlilik politikası')}</li>`,
    `<li><strong>${PROVIDERS.whatsapp.name}</strong>: WhatsApp üzerinden iletişim${api ? '' : ' ve randevu formunun oluşturduğu mesaj'}. ${ext(PROVIDERS.whatsapp.privacy, 'Gizlilik politikası')}</li>`,
    api
      ? `<li><strong>${PROVIDERS.cloudflare.name}</strong>: randevu formu uygulaması${ctx.turnstile ? ', bot koruması (Turnstile)' : ''}${ctx.liveReviews ? ', güncel yorumların alınması' : ''}. ${ext(PROVIDERS.cloudflare.privacy, 'Gizlilik politikası')}</li>`
      : '',
    ...(api
      ? ch
        ? ch.map((c) => `<li><strong>${PROVIDERS[c].name}</strong>: randevu bildiriminin ${c === 'telegram' ? 'Telegram mesajı olarak' : 'e-posta olarak'} bize iletilmesi. ${ext(PROVIDERS[c].privacy, 'Gizlilik politikası')}</li>`)
        : [`<li><strong>Randevu bildirim sağlayıcısı</strong>: ${v.channelsTodo}</li>`]
      : []),
    ctx.meta ? `<li><strong>${PROVIDERS.meta.name}</strong>: izninizle Meta Pixel reklam ölçümü. ${ext(PROVIDERS.meta.privacy, 'Gizlilik politikası')}</li>` : '',
    ctx.openai ? `<li><strong>${PROVIDERS.openai.name}</strong>: izninizle reklam dönüşüm ölçümü. ${ext(PROVIDERS.openai.privacy, 'Gizlilik politikası')}</li>` : '',
  ].filter(Boolean);

  const optionalItems = [
    ctx.ga4 ? `<li><strong>Analitik — Google Analytics 4:</strong> sayfa görüntüleme ve düğme tıklaması gibi kullanım olayları. Google sinyalleri ve reklam kişiselleştirme kapalıdır; sayfa adresi sorgu parametreleri olmadan gönderilir. ${ext(PROVIDERS.google.cookies, 'Google çerez açıklaması')}</li>` : '',
    ctx.gads ? `<li><strong>Pazarlama — Google Ads dönüşüm ölçümü:</strong> reklamların randevu talebine dönüşüp dönüşmediğinin ölçülmesi; reklam kişiselleştirme sinyali kapalıdır. ${ext(PROVIDERS.google.cookies, 'Google çerez açıklaması')}</li>` : '',
    ctx.meta ? `<li><strong>Pazarlama — Meta Pixel:</strong> yalnızca standart olaylar (sayfa görüntüleme, iletişim, randevu talebi); Sınırlı Veri Kullanımı (LDU) açık, otomatik yapılandırma kapalıdır. ${ext(PROVIDERS.meta.cookies, 'Meta çerez politikası')}</li>` : '',
    ctx.openai ? `<li><strong>Pazarlama — OpenAI ölçüm pikseli:</strong> yalnızca randevu talebi dönüşüm olayı. ${ext(PROVIDERS.openai.privacy, 'OpenAI gizlilik politikası')}</li>` : '',
  ].filter(Boolean);

  const draftNotice = !missing.length
    ? null
    : approvalObject
      ? `<strong>Önizleme sürümü — onay bekliyor.</strong> İşletme bilgilerinin tamamı dolduruldu; aşağıdaki metin yayınlanacak nihai metindir. Bu sayfa, İngilizce sürümü, çerez paneli, iletişim bölümündeki harita notu ve randevu formunun onay metni okunup onaylanınca şu nesne <code>business.legal.textApproval</code> alanına olduğu gibi kopyalanır (yalnızca <code>by</code> ve <code>date</code> doldurulur):<p><code data-legal-approval>textApproval: ${escapeHtml(approvalObject)}</code></p>Özet (<code>hash</code>) bu nihai metne ve bu derlemenin yapılandırmasına (<code>context</code>) aittir; bir işletme bilgisi, metnin ifadesi ya da yapılandırma değişirse yeni onay gerekir. Üretim derlemesinin yapılandırması farklıysa onun hata mesajında basılan nesne geçerlidir.`
      : `<strong>Önizleme sürümü.</strong> Aşağıdaki bilgiler işletme tarafından verilip metinler onaylanmadan bu sayfa yayına alınamaz:<ul>${missing.map((m) => `<li>${m.label.tr} — <code>business.legal.${m.key}</code></li>`).join('')}</ul>Metin onayı en son verilir: diğer bilgiler doldurulunca bu uyarı, nihai metnin onaylanacak özetini gösterir.`;

  return {
    title: 'Gizlilik, KVKK ve Çerez Politikası',
    description: 'Ayaz İşitme Merkezi web sitesi için kişisel verilerin korunması aydınlatma metni, çerez politikası ve gizlilik politikası.',
    draftNotice,
    updated: formatVersionDate('tr'),
    sections: [
      {
        id: 'aydinlatma',
        title: 'Aydınlatma Metni (KVKK m.10)',
        html: `
<p><strong>Veri sorumlusu:</strong> ${b.legalName} — ${b.address.line}. E-posta: <a href="mailto:${b.email}">${b.email}</a>, Telefon: ${b.phone.display}.</p>
<h3>Hangi verileri, hangi yolla işliyoruz?</h3>
${formP}
<p><strong>Telefon, WhatsApp ve e-posta:</strong> Bizi aradığınızda, WhatsApp bağlantılarımızla yazdığınızda veya e-posta gönderdiğinizde paylaştığınız bilgiler (ad, telefon numarası, mesaj içeriği) talebinizi yanıtlamak için işlenir. WhatsApp yazışmaları WhatsApp (Meta) altyapısında gerçekleşir.${gmail ? " E-posta adresimiz Google'ın Gmail hizmetindedir." : ''}</p>
<p><strong>Sitenin ziyaret edilmesi:</strong> Site GitHub Pages üzerinde barındırılır. Sayfaları iletebilmek için GitHub, IP adresinizi ve tarayıcınızın gönderdiği teknik bilgileri alır; GitHub'ın açıklamasına göre ziyaretçi IP adresleri güvenlik amacıyla kaydedilir ve saklanır (${ext(PROVIDERS.github.pages, 'GitHub Pages veri toplama')}). İletişim bölümündeki Google Haritalar haritası ve çerezler için <a href="#cerez">Çerezler</a> bölümüne bakın.</p>${ctx.liveReviews ? `
<p><strong>Güncel yorumlar:</strong> Yorumlar bölümü güncel Google yorumlarını Cloudflare üzerindeki uygulamamızdan alır; bu istekte IP adresiniz istek sınırı için kullanılır. Yorum yazarlarının profil fotoğrafları Google sunucularından yüklenebilir.</p>` : ''}
<p><strong>Sağlık verisi istemiyoruz.</strong> Form sağlık raporu, odyogram veya işitme durumunuza ilişkin bilgi istemez. Lütfen form, WhatsApp veya e-posta yoluyla sağlık bilgisi göndermeyin.</p>
<h3>Amaçlar ve hukuki sebepler</h3>
<p><strong>İşleme amaçları:</strong> randevu/geri arama talebinizi almak ve sizinle iletişime geçmek; talebin kaydını tutmak; siteyi sunmak ve kötüye kullanıma karşı korumak; konumumuzu harita üzerinde göstermek${optional ? '; izin vermeniz hâlinde sitenin kullanımını ve reklamlarımızın etkisini ölçmek' : ''}.</p>
<p><strong>Hukuki sebepler (6698 sayılı Kanun):</strong> randevu ve iletişim talepleri için m.5/2-(c) "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması" ve m.5/2-(f) "veri sorumlusunun meşru menfaati"; barındırma kayıtları, sitenin güvenliği ve harita gösterimi için m.5/2-(f)${optional ? '; isteğe bağlı analitik ve pazarlama çerezleri için m.5/1 açık rıza (çerez panelindeki seçiminiz)' : ''}.</p>
<h3>Aktarım</h3>
<p>Kişisel verileriniz, yukarıdaki işlemler için aşağıdaki hizmet sağlayıcılar tarafından işlenir:</p>
<ul>${recipients.join('')}</ul>
<p>Form içeriğiniz (ad, telefon, konu) analitik veya reklam etiketlerine gönderilmez.</p>
<p><strong>Yurt dışına aktarım:</strong> Bu sağlayıcıların tamamı yurt dışında yerleşiktir; bu nedenle yukarıdaki işlemler kişisel verilerinizin yurt dışına aktarılması sonucunu doğurur. ${v.crossBorder}</p>
<h3>Saklama süreleri</h3>
<p>Randevu ve iletişim talepleri, talebin alındığı tarihten itibaren en fazla ${v.appointmentMonths} ay saklanır ve ardından silinir. WhatsApp yazışmaları en fazla ${v.whatsappMonths} ay saklanır ve ardından silinir.${api ? ` Randevu uygulamasının teknik çalışma kayıtları ${v.logsDays} gün sonra silinir.` : ''} Tarayıcınızdaki kayıtların süreleri <a href="#cerez">Çerezler</a> bölümündedir; sağlayıcıların kendi kayıtları için ilgili sağlayıcının politikası geçerlidir.</p>
<h3>Haklarınız ve başvuru</h3>
<p><strong>Haklarınız (KVKK m.11):</strong> 6698 sayılı Kanun'un 11. maddesi uyarınca herkes, veri sorumlusuna başvurarak kendisiyle ilgili;</p>
<ul class="legal-lettered">
<li>a) Kişisel veri işlenip işlenmediğini öğrenme,</li>
<li>b) Kişisel verileri işlenmişse buna ilişkin bilgi talep etme,</li>
<li>c) Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
<li>ç) Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,</li>
<li>d) Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,</li>
<li>e) Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme,</li>
<li>f) (d) ve (e) bentleri uyarınca yapılan işlemlerin, kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
<li>g) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme,</li>
<li>ğ) Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme</li>
</ul>
<p>haklarına sahiptir.</p>
<p><strong>Başvuru:</strong> Taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak yukarıdaki adrese yazılı olarak veya <a href="mailto:${b.email}">${b.email}</a> adresine iletebilirsiniz. Başvurunuz, Kanun m.13 uyarınca en geç 30 gün içinde sonuçlandırılır. Başvurunuzun reddedilmesi, cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (m.14).</p>`,
      },
      {
        id: 'cerez',
        title: 'Çerezler ve Benzeri Teknolojiler',
        html: `
<p><strong>Sitemizin kendi kodu çerez yazmaz.</strong> İzniniz olmadan tarayıcınızın depolama alanına yalnızca aşağıdaki iki zorunlu kaydı yazar. Bu kayıtlar sizi tanımlamaz ve sitemiz tarafından ayrıca bir sunucuya gönderilmez. <code>ayaz.topic</code> ile taşınan konu (ör. "BTE"), yalnızca formu gönderirseniz talebin içinde yer alır${api ? ' ve randevu uygulamasına iletilir' : '; WhatsApp bağlantısı açıldığında mesaj metninde yer alır'}. Yazı tipleri sitemizle birlikte sunulur; sitemiz yazı tipi için Google'a istek göndermez.</p>
<table class="legal-table">
<thead><tr><th>Kayıt</th><th>Nerede</th><th>Amaç</th><th>Süre</th></tr></thead>
<tbody>
<tr><td data-label="Kayıt"><code>ayaz.consent.v1</code></td><td data-label="Nerede">Tarayıcının yerel depolaması (localStorage)</td><td data-label="Amaç">${optional
  ? 'Çerez panelinde yaptığınız seçimi (analitik ve pazarlama için evet/hayır ve seçim zamanı) hatırlamak. Yalnızca bir seçim yaptığınızda yazılır.'
  : 'Çerez bildirimini kapattığınızı (ve zamanını) hatırlamak; böylece bildirim her sayfada yeniden gösterilmez. Bu sitede isteğe bağlı hizmet olmadığından kayıttaki analitik ve pazarlama değerleri her zaman "hayır"dır. Yalnızca bildirimi kapattığınızda yazılır.'}</td><td data-label="Süre">${optional ? 'Seçim 180 gün geçerlidir; sonra tercihiniz yeniden sorulur.' : 'Kayıt 180 gün geçerlidir; sonra bildirim yeniden gösterilir.'} Kaydı tarayıcı ayarlarından silebilirsiniz.</td></tr>
<tr><td data-label="Kayıt"><code>ayaz.topic</code></td><td data-label="Nerede">Tarayıcının oturum depolaması (sessionStorage)</td><td data-label="Amaç">Bir cihaz kartındaki ya da kulak kalıbı bölümündeki randevu düğmesine tıkladığınızda seçtiğiniz konuyu randevu formuna aktarmak.</td><td data-label="Süre">Sekmeyi kapattığınızda tarayıcı tarafından silinir.</td></tr>
</tbody></table>
<h3>İzin beklemeden yüklenen üçüncü taraf içerik: Google Haritalar</h3>
<p>İletişim bölümündeki harita, Google tarafından sunulan üçüncü taraf içeriktir ve sayfa görüntülendiğinde izninizi beklemeden otomatik olarak yüklenir (tarayıcınız haritayı, sayfada bu bölüme yaklaştığınızda yükleyebilir). Harita yüklenirken IP adresiniz, tarayıcı bilgileriniz ve görüntülediğiniz sayfanın adresi Google'a iletilir; Google kendi çerezlerini yerleştirebilir veya tarayıcınızda bulunan Google çerezlerini okuyabilir. Bu işlemler için Google'ın ${ext(PROVIDERS.google.privacy, 'gizlilik politikası')} ve ${ext(PROVIDERS.google.cookies, 'çerez açıklaması')} geçerlidir.</p>
<p>Haritayı kullanmak istemiyorsanız adresimiz (${b.address.line}) ve telefonumuz (${b.phone.display}) aynı bölümde metin olarak yer alır.</p>${ctx.turnstile ? `
<p><strong>Cloudflare Turnstile:</strong> Randevu formunu doldurmaya başladığınızda bot koruması için yüklenir; işlediği veriler için Cloudflare'in ${ext(PROVIDERS.cloudflare.privacy, 'gizlilik politikası')} geçerlidir.</p>` : ''}${ctx.liveReviews ? `
<p><strong>Güncel yorumlar:</strong> Yorumlar bölümü Cloudflare üzerindeki uygulamamıza istek gönderir; yorum yazarlarının profil fotoğrafları Google sunucularından yüklenebilir.</p>` : ''}
<h3>İzninize bağlı çerezler (analitik ve pazarlama)</h3>
${optional
  ? `<p>Aşağıdaki hizmetler yalnızca çerez panelinde ilgili kategoriye izin verdiğinizde yüklenir; izin vermediğiniz sürece hiç yüklenmez:</p>
<ul>${optionalItems.join('')}</ul>
<p>Bu hizmetler, izin verdiğinizde sitemizin alan adı altında da çerez yerleştirebilir. Çerez adları ve süreleri sağlayıcı tarafından belirlenir; güncel liste sağlayıcının çerez açıklamasındadır. İzninizi geri çektiğinizde sayfa yeniden yüklenir ve etiketler durur; daha önce yerleşmiş üçüncü taraf çerezlerini tarayıcı ayarlarınızdan silebilirsiniz.</p>`
  : `<p>Bu sitede şu anda hiçbir analitik veya pazarlama hizmeti etkin değildir; bu nedenle çerez bildirimi sizden izin istemez ve analitik veya pazarlama seçeneği içermez. Böyle bir hizmet etkinleştirilirse yalnızca izninizle yüklenir; hem çerez panelinde hem bu bölümde adıyla listelenir.</p>`}
<p>${optional ? 'Seçiminizi' : 'Çerez bildirimini'} dilediğiniz zaman sayfa altındaki <strong>Çerez tercihleri</strong> bağlantısından ${optional ? 'değiştirebilirsiniz' : 'yeniden açabilirsiniz'}.</p>`,
      },
      {
        id: 'gizlilik',
        title: 'Gizlilik Politikası',
        html: `
<p>${b.legalName} olarak kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu ve ilgili mevzuata uygun olarak işleriz. Bu site üzerinden yalnızca sizinle iletişime geçmek için gereken asgari veriyi toplarız${optional ? '; bunun dışında, yalnızca açık rızanızla, yukarıdaki çerez politikasında sayılan ölçüm hizmetleri çalışır' : ''} ve çevrim içi ortamda sağlık bilgisi istemeyiz.</p>
<p>${marketing.length
  ? `Kişisel verilerinizi satmayız ve kiralamayız. Kendimiz reklam amaçlı profil oluşturmayız; ancak pazarlama çerezlerine izin verirseniz pazarlama hizmetleri (${joinList(marketing, 've')}) reklamlarımızın etkisini ölçmek için veri toplar ve bu verileri kendi politikalarına göre işler (bkz. <a href="#cerez">Çerezler</a>).`
  : 'Kişisel verilerinizi satmayız, kiralamayız ve reklam amaçlı profil oluşturmak için kullanmayız.'}</p>
<p>WhatsApp, Google Haritalar yol tarifi ve Google yorumları bağlantıları ilgili hizmetin sayfasını açar; orada o hizmetin gizlilik koşulları geçerlidir.</p>
<p>Bu sayfa, sitemizde çalışan hizmetlere göre hazırlanır; bir hizmet eklendiğinde veya kaldırıldığında güncellenir. Son güncelleme tarihi sayfanın üstünde yer alır.</p>`,
      },
    ],
  };
}
