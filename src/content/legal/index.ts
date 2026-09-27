/**
 * Gizlilik sayfalarının tek giriş noktası: derleme bağlamını kurar, yayın kapısını (nihai metnin özetiyle) uygular,
 * TR/EN metni üretir. Sayfalar (gizlilik.astro, en/privacy.astro) ortam değerlerini buraya verir.
 */
import { business, type LegalFacts } from '../../config/business';
import { awaitingApprovalOnly, enforceLegalGate, legalContextFromEnv, textApprovalTemplate, type LegalEnv } from './facts';
import { legalTr, type LegalDoc } from './tr';
import { legalEn } from './en';
import { legalTextHash } from './text-hash';

let warned = false;

export function buildLegalDoc(locale: 'tr' | 'en', env: LegalEnv, reviewsMode: 'carousel' | 'link', facts: LegalFacts = business.legal): LegalDoc {
  const ctx = legalContextFromEnv(env, reviewsMode);
  // Onay NİHAİ metne bağlı: bu bağlamda gerçek işletme bilgileriyle basılan metnin özeti (text-hash.ts).
  // Üretimde eksik + geçersiz kılma yok → hata, derleme durur (diğer bilgiler eksikken özet basılmaz).
  const textHash = legalTextHash(ctx, facts);
  const { missing } = enforceLegalGate(facts, ctx, textHash);
  // Yalnızca onay eksikse: önizleme uyarısı, onaylanacak nesneyi (nihai metnin özetiyle) gösterir.
  const approvalObject = awaitingApprovalOnly(missing) ? textApprovalTemplate(ctx, textHash) : null;
  if (missing.length && !warned) {
    warned = true;
    console.warn(
      `[hukuki-metin-kapısı] ${ctx.production ? 'ÜRETİM (ALLOW_INCOMPLETE_LEGAL ile geçersiz kılındı)' : 'Önizleme'}: ${missing.length} işletme bilgisi eksik; gizlilik sayfası ${approvalObject ? 'nihai metinle, “onay bekliyor” uyarısıyla' : 'önizleme uyarısıyla (eksik değerler yer tutucuyla)'} basılıyor: ` +
        missing.map((m) => `business.legal.${m.key}`).join(', ') +
        (approvalObject ? `\n  Nihai metin onay bekliyor (sayfayı okuyup onaylayınca kopyalayın): textApproval: ${approvalObject}` : ''),
    );
  }
  return locale === 'tr' ? legalTr(ctx, missing, facts, approvalObject) : legalEn(ctx, missing, facts, approvalObject);
}
