/**
 * Hukuki metin onayının içerik özeti (textApproval.hash).
 *
 * Onay, ziyaretçinin GÖRECEĞİ NİHAİ METNE bağlıdır: bu derleme bağlamında, business.legal'ın GERÇEK değerleriyle
 * basılan metinlerin sha256 özeti (ilk 16 onaltılık hane). Özete girenler:
 *  - gizlilik sayfası TR + EN (legalTr / legalEn), gerçek işletme bilgileriyle ve önizleme uyarısı olmadan
 *    basılmış hali: saklama süreleri, bildirim kanalları, m.9 dayanağı cümlesi dahil;
 *  - onay dışındaki işletme bilgilerinin kendisi (retention, notificationChannels, crossBorderBasis,
 *    legalBasesConfirmation) — sayfada görünmeyen bir değer (ör. WhatsApp modunda teknik kayıt süresi ya da
 *    hukuki sebep teyidinin tarihi) değişse bile onay yenilenir;
 *  - yapılandırma imzası (context) ve sürüm etiketi;
 *  - çerez paneli TR + EN (consentView bu bağlam için + panelde görünen bağlantı/düğme metinleri);
 *  - iletişim bölümündeki harita notu TR + EN (contact.info.mapNote);
 *  - randevu formunun KVKK onay cümlesi, bağlantı metni ve WhatsApp modu açıklaması TR + EN (contact.form.consent/consentLink/fallbackNotice) ve onay kutusunun hata mesajı (contact.form.validation.consent). Arayüz etiketleri ("Son güncelleme", içindekiler başlığı) onay kapsamı dışındadır.
 * Yalnızca textApproval nesnesinin kendisi özete girmez (döngü olurdu).
 *
 * Sonuç: işletme bilgilerinden herhangi biri, metnin herhangi bir ifadesi ya da yapılandırma onaydan sonra
 * değişirse özet değişir ve onay geçersizleşir. Doğru sıra: önce diğer bilgiler doldurulur → nihai metin
 * önizlemede okunur → derlemenin bastığı özet onaylanır. Diğer bilgiler eksikken özet yer tutuculu metne ait
 * olur; kapı bu durumda özeti basmaz ve onayı kabul etmez (facts.ts).
 *
 * Döngüsel içe aktarmayı önlemek için ayrı modüldür: facts.ts özeti parametre olarak alır, kapıyı çalıştıran
 * index.ts bu modülü kullanır. Yalnızca derleme zamanında (Node) çalışır; tarayıcı paketine girmez.
 */
import { createHash } from 'node:crypto';
import type { LegalFacts } from '../../config/business';
import type { SiteContent } from '../types';
import { tr as trContent } from '../tr';
import { en as enContent } from '../en';
import { LEGAL_TEXT_VERSION, legalContextSignature, type LegalBuildContext } from './facts';
import { legalTr } from './tr';
import { legalEn } from './en';
import { consentView } from './consent-view';

/** Özete giren metin kaynakları; testler ifade değişikliğini benzetmek için değiştirilmiş kaynak verebilir. */
export interface LegalTextSources {
  content: { tr: SiteContent; en: SiteContent };
  render: { tr: typeof legalTr; en: typeof legalEn };
}

const DEFAULT_SOURCES: LegalTextSources = {
  content: { tr: trContent, en: enContent },
  render: { tr: legalTr, en: legalEn },
};

/** Çerez panelinde bu bağlamda gerçekten görünen metinler (ConsentBanner.astro ile aynı seçim). */
function bannerTexts(c: SiteContent, ctx: LegalBuildContext) {
  const view = consentView(c.consent, ctx);
  const buttons = view.mode === 'choice' ? [c.consent.acceptAll, c.consent.rejectAll, c.consent.manage, c.consent.save] : [c.consent.acknowledge];
  return { view, policyLink: c.consent.policyLink, buttons };
}

/**
 * Onay dışındaki işletme bilgileri, sabit anahtar sırasıyla (business.ts'teki yazım sırası özeti etkilemez).
 * textApproval bilinçli olarak YOKTUR.
 */
export function approvedFacts(facts: LegalFacts) {
  const cb = facts.crossBorderBasis;
  const lb = facts.legalBasesConfirmation;
  return {
    retention: {
      appointmentRequestsMonths: facts.retention.appointmentRequestsMonths ?? null,
      whatsappMonths: facts.retention.whatsappMonths ?? null,
      technicalLogsDays: facts.retention.technicalLogsDays ?? null,
    },
    notificationChannels: facts.notificationChannels ? [...facts.notificationChannels] : null,
    crossBorderBasis: cb ? { tr: cb.tr ?? null, en: cb.en ?? null } : null,
    legalBasesConfirmation: lb ? { by: lb.by ?? null, date: lb.date ?? null } : null,
  };
}

/** Özetlenen malzeme (kararlı JSON): bu bağlamda, bu işletme bilgileriyle ziyaretçiye gösterilen nihai metin. */
export function legalTextMaterial(ctx: LegalBuildContext, facts: LegalFacts, src: LegalTextSources = DEFAULT_SOURCES): string {
  // Sayfa, önizleme uyarısı olmadan (missing = []) ve GERÇEK değerlerle basılır: tamamlanmış yayın çıktısının aynısı.
  const pageTr = src.render.tr(ctx, [], facts);
  const pageEn = src.render.en(ctx, [], facts);
  return JSON.stringify({
    version: LEGAL_TEXT_VERSION,
    context: legalContextSignature(ctx),
    facts: approvedFacts(facts),
    page: { tr: pageTr, en: pageEn },
    banner: { tr: bannerTexts(src.content.tr, ctx), en: bannerTexts(src.content.en, ctx) },
    mapNote: { tr: src.content.tr.contact.info.mapNote, en: src.content.en.contact.info.mapNote },
    // Randevu formundaki KVKK onay cümlesi ve bağlantısı + WhatsApp modunun açıklaması da ziyaretçiye dönük hukuki metindir
    form: {
      tr: { consent: src.content.tr.contact.form.consent, consentLink: src.content.tr.contact.form.consentLink, fallbackNotice: src.content.tr.contact.form.fallbackNotice, consentError: src.content.tr.contact.form.validation.consent },
      en: { consent: src.content.en.contact.form.consent, consentLink: src.content.en.contact.form.consentLink, fallbackNotice: src.content.en.contact.form.fallbackNotice, consentError: src.content.en.contact.form.validation.consent },
    },
  });
}

/** textApproval.hash olarak beklenen değer: sha256(malzeme) ilk 16 onaltılık hane. */
export function legalTextHash(ctx: LegalBuildContext, facts: LegalFacts, src: LegalTextSources = DEFAULT_SOURCES): string {
  return createHash('sha256').update(legalTextMaterial(ctx, facts, src)).digest('hex').slice(0, 16);
}
