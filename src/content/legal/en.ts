/** English summary of the Turkish legal drafts. The Turkish texts are authoritative; both require legal review before publishing. */
import { business } from '../../config/business';
import type { LegalSection } from './tr';
const b = business;

export const legalEn = {
  title: 'Privacy, Data Protection (KVKK) and Cookies',
  description: 'Privacy notice, cookie policy and data-protection information for the Ayaz Hearing Center website.',
  draftNotice: 'These texts are drafts and require business-specific legal review before publication. The Turkish version is authoritative.',
  updated: '25 September 2026',
  sections: [
    {
      id: 'aydinlatma',
      title: 'Appointment Form Privacy Notice (Turkish Data Protection Law No. 6698, Art. 10)',
      html: `
<p><strong>Data controller:</strong> ${b.legalNameEn} (${b.legalName}) — ${b.address.line}. Email: <a href="mailto:${b.email}">${b.email}</a>, phone: ${b.phone.display}.</p>
<p><strong>Data we process:</strong> the full name, phone number, preferred call-back time and optional topic you enter in the appointment form. For security and abuse prevention, the submission time and IP address may be kept briefly in technical logs.</p>
<p><strong>We do not ask for health data.</strong> The form never requests medical reports, audiograms or details about your hearing; such special-category data is handled only in person at our center with your separate explicit consent.</p>
<p><strong>Purposes:</strong> receiving your request and contacting you; keeping a record of the request; securing our systems.</p>
<p><strong>Legal bases:</strong> Art. 5/2(c) (necessary for establishing or performing a contract) and Art. 5/2(f) (legitimate interest) of Law No. 6698. <em>[Legal review pending.]</em></p>
<p><strong>Transfers:</strong> form data is processed by the hosting and email-delivery providers we use to receive your request; their servers may be located outside Türkiye, and any cross-border transfer is carried out in line with Art. 9. <em>[Providers and Art. 9 basis to be specified.]</em> Your data is never shared with advertising platforms.</p>
<p><strong>Retention:</strong> appointment request data is kept for <em>[• months]</em> after the request is closed; technical logs are deleted within <em>[• days]</em>.</p>
<p><strong>Your rights (Art. 11):</strong> to learn whether your data is processed, request information, learn the purpose and whether it is used accordingly, know the third parties it is transferred to, request correction, deletion or destruction, request notification of these actions to third parties, object to results produced by automated analysis, and claim compensation for damages.</p>
<p><strong>How to apply:</strong> in writing to the address above or by email to <a href="mailto:${b.email}">${b.email}</a>. Requests are answered within 30 days at the latest.</p>`,
    },
    {
      id: 'cerez',
      title: 'Cookie Policy',
      html: `
<p>Apart from strictly necessary storage, this site sets no cookies without your consent. You can change your decision at any time via the <strong>Cookie preferences</strong> link in the footer.</p>
<table class="legal-table">
<thead><tr><th>Category</th><th>Purpose</th><th>Examples</th><th>Duration</th></tr></thead>
<tbody>
<tr><td>Necessary</td><td>Remembering your cookie choice, form bot protection</td><td><code>ayaz.consent.v1</code> (local storage), Cloudflare Turnstile</td><td>Choice valid for 180 days; storage can be cleared in the browser. Turnstile: session</td></tr>
<tr><td>Analytics</td><td>Understanding how the site is used (Google Analytics 4; Google signals and ad personalisation off; form fields excluded)</td><td><code>_ga</code>, <code>_ga_*</code></td><td>Up to 2 years per provider documentation <em>[to verify]</em></td></tr>
<tr><td>Marketing</td><td>Measuring advertising campaigns (Google Ads conversions, Meta Pixel). Personalised advertising is disabled.</td><td><code>_gcl_au</code>, <code>_fbp</code></td><td>About 90 days per provider documentation <em>[to verify]</em></td></tr>
</tbody></table>
<p>Analytics and marketing tags are not loaded at all unless the corresponding IDs are configured. The Google Maps embed loads only after you press "Load map", after which Google's own cookie policy applies.</p>`,
    },
    {
      id: 'gizlilik',
      title: 'Privacy Policy',
      html: `
<p>${b.legalNameEn} processes personal data in accordance with Turkish Law No. 6698 and related regulations. Through this website we collect only the minimum data needed to contact you and never request health data online.</p>
<p>Information you share by phone, WhatsApp or email is used solely to answer your request. Communication over WhatsApp is subject to WhatsApp's own privacy terms.</p>
<p>We do not sell or rent your data, and we do not build advertising profiles from it.</p>
<p>This policy may be updated from time to time; the date of the last update is shown at the top of the page.</p>`,
    },
  ] as LegalSection[],
};
