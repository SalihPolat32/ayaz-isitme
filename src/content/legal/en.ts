/**
 * English version of the privacy / data-protection / cookie text. Same structure and conditions as tr.ts
 * (the Turkish text is authoritative); generated from the build configuration and business.legal.
 */
import { business, type LegalFacts } from '../../config/business';
import { PROVIDERS, escapeHtml, ext, formatVersionDate, joinList, legalValues, type LegalBuildContext, type MissingFact } from './facts';
import { CONSENT_SERVICE_NAMES } from './consent-view';
import { emailOnGmail, type LegalDoc } from './tr';

const b = business;

/** approvalObject: bkz. tr.ts > legalTr (yalnızca textApproval eksikken kopyalanacak onay nesnesi). */
export function legalEn(ctx: LegalBuildContext, missing: MissingFact[], facts: LegalFacts = b.legal, approvalObject: string | null = null): LegalDoc {
  const v = legalValues(facts, 'en');
  const api = ctx.formMode === 'api';
  const gmail = emailOnGmail();
  const ch = v.channels;
  const emailChannel = !!ch && ch.some((c) => c === 'resend' || c === 'brevo');
  const optional = ctx.ga4 || ctx.gads || ctx.meta || ctx.openai;
  const channelNames = ch ? joinList(ch.map((c) => PROVIDERS[c].name), 'and') : v.channelsTodo;
  const marketing: string[] = [...(ctx.gads ? [CONSENT_SERVICE_NAMES.gads] : []), ...(ctx.meta ? [CONSENT_SERVICE_NAMES.meta] : []), ...(ctx.openai ? [CONSENT_SERVICE_NAMES.openai] : [])];

  const formP = api
    ? `<p><strong>Appointment form:</strong> when you submit the form, your full name, phone number, preferred call-back time and (if, in this tab, you clicked the appointment button on a device card or in the ear-mould section) the topic are sent to our application running on Cloudflare's infrastructure (Cloudflare Workers). The application does not write this information to a database; it forwards your request to us as a notification via ${channelNames}. The notification also contains the time the request was received, the address of the page the form was sent from, the page language and the country code Cloudflare derives from your IP address.${emailChannel && gmail ? ` Notification emails arrive at our address ${b.email}, i.e. Google's Gmail service.` : ''}</p>
<p><strong>Abuse prevention:</strong> your IP address is used to limit the number of requests that can be sent within 60-second intervals${ctx.turnstile ? ' and is passed to Cloudflare Turnstile for bot verification' : ''}. The logs written by the application contain your phone number only in masked form, together with the country code and the delivery result; your name is not written to these logs.</p>${ctx.turnstile ? `
<p><strong>Bot protection:</strong> when you start filling in the form, Cloudflare Turnstile is loaded. Turnstile processes technical information from your browser and your IP address to check that the form is sent by a human.</p>` : ''}`
    : `<p><strong>Appointment form:</strong> the form on this site does not send what you enter to any of our servers. When you submit it, your full name, phone number, preferred call-back time and (if, in this tab, you clicked the appointment button on a device card or in the ear-mould section) the topic are turned into a ready-made WhatsApp message in your browser, and WhatsApp is opened via a <code>wa.me</code> link. When the link opens, the message text is passed to WhatsApp (Meta); when you send the message, your request reaches us and is processed by us in WhatsApp. If you do not send the message, your request does not reach us.</p>`;

  const recipients = [
    `<li><strong>${PROVIDERS.github.name}</strong>: hosting of the website. ${ext(PROVIDERS.github.privacy, 'Privacy statement')}</li>`,
    `<li><strong>${PROVIDERS.google.name}</strong>: the map in the contact section (Google Maps)${gmail ? ', our email service (Gmail)' : ''}${ctx.ga4 ? ', Google Analytics with your consent' : ''}${ctx.gads ? ', Google Ads conversion measurement with your consent' : ''}. ${ext(PROVIDERS.google.privacy, 'Privacy policy')}</li>`,
    `<li><strong>${PROVIDERS.whatsapp.name}</strong>: communication via WhatsApp${api ? '' : ' and the message created by the appointment form'}. ${ext(PROVIDERS.whatsapp.privacy, 'Privacy policy')}</li>`,
    api
      ? `<li><strong>${PROVIDERS.cloudflare.name}</strong>: the appointment form application${ctx.turnstile ? ', bot protection (Turnstile)' : ''}${ctx.liveReviews ? ', retrieving current reviews' : ''}. ${ext(PROVIDERS.cloudflare.privacy, 'Privacy policy')}</li>`
      : '',
    ...(api
      ? ch
        ? ch.map((c) => `<li><strong>${PROVIDERS[c].name}</strong>: delivering the appointment notification to us ${c === 'telegram' ? 'as a Telegram message' : 'by email'}. ${ext(PROVIDERS[c].privacy, 'Privacy policy')}</li>`)
        : [`<li><strong>Appointment notification provider</strong>: ${v.channelsTodo}</li>`]
      : []),
    ctx.meta ? `<li><strong>${PROVIDERS.meta.name}</strong>: Meta Pixel advertising measurement with your consent. ${ext(PROVIDERS.meta.privacy, 'Privacy policy')}</li>` : '',
    ctx.openai ? `<li><strong>${PROVIDERS.openai.name}</strong>: advertising conversion measurement with your consent. ${ext(PROVIDERS.openai.privacy, 'Privacy policy')}</li>` : '',
  ].filter(Boolean);

  const optionalItems = [
    ctx.ga4 ? `<li><strong>Analytics — Google Analytics 4:</strong> usage events such as page views and button clicks. Google signals and ad personalisation are off; the page address is sent without query parameters. ${ext(PROVIDERS.google.cookies, 'Google cookie information')}</li>` : '',
    ctx.gads ? `<li><strong>Marketing — Google Ads conversion measurement:</strong> measuring whether ads lead to appointment requests; the ad personalisation signal is off. ${ext(PROVIDERS.google.cookies, 'Google cookie information')}</li>` : '',
    ctx.meta ? `<li><strong>Marketing — Meta Pixel:</strong> standard events only (page view, contact, appointment request); Limited Data Use (LDU) on, automatic configuration off. ${ext(PROVIDERS.meta.cookies, 'Meta cookie policy')}</li>` : '',
    ctx.openai ? `<li><strong>Marketing — OpenAI measurement pixel:</strong> the appointment-request conversion event only. ${ext(PROVIDERS.openai.privacy, 'OpenAI privacy policy')}</li>` : '',
  ].filter(Boolean);

  const draftNotice = !missing.length
    ? null
    : approvalObject
      ? `<strong>Preview version — awaiting approval.</strong> All business information has been provided; the text below is the final text to be published. Once this page, the Turkish version, the cookie banner, the map note in the contact section and the consent text of the appointment form have been read and approved, the following object is copied as is into <code>business.legal.textApproval</code> (only <code>by</code> and <code>date</code> are filled in):<p><code data-legal-approval>textApproval: ${escapeHtml(approvalObject)}</code></p>The digest (<code>hash</code>) belongs to this final text and to this build's configuration (<code>context</code>); if any business information, the wording or the configuration changes, a new approval is required. If the production build's configuration differs, the object printed in its error message applies.`
      : `<strong>Preview version.</strong> This page cannot be published until the business provides the following information and approves the texts:<ul>${missing.map((m) => `<li>${m.label.en} — <code>business.legal.${m.key}</code></li>`).join('')}</ul>The texts are approved last: once the other information is filled in, this notice shows the digest of the final text to be approved.`;

  return {
    title: 'Privacy, Data Protection (KVKK) and Cookies',
    description: 'Privacy notice, cookie policy and data-protection information for the Ayaz Hearing Center website.',
    draftNotice,
    updated: formatVersionDate('en'),
    sections: [
      {
        id: 'aydinlatma',
        title: 'Privacy Notice (Turkish Data Protection Law No. 6698, Art. 10)',
        html: `
<p><strong>Data controller:</strong> ${b.legalNameEn} (${b.legalName}) — ${b.address.line}. Email: <a href="mailto:${b.email}">${b.email}</a>, phone: ${b.phone.display}. The Turkish version of this page is authoritative.</p>
<h3>What data we process and how</h3>
${formP}
<p><strong>Phone, WhatsApp and email:</strong> when you call us, write to us via our WhatsApp links or send an email, the information you share (name, phone number, message content) is processed to answer your request. WhatsApp conversations take place on WhatsApp's (Meta's) infrastructure.${gmail ? " Our email address is hosted on Google's Gmail service." : ''}</p>
<p><strong>Visiting the site:</strong> the site is hosted on GitHub Pages. To deliver the pages, GitHub receives your IP address and the technical information your browser sends; according to GitHub, visitor IP addresses are logged and stored for security purposes (${ext(PROVIDERS.github.pages, 'GitHub Pages data collection')}). For the Google Maps map in the contact section and for cookies, see the <a href="#cerez">Cookies</a> section.</p>${ctx.liveReviews ? `
<p><strong>Current reviews:</strong> the reviews section retrieves current Google reviews from our application on Cloudflare; your IP address is used for rate limiting in this request. Review authors' profile photos may be loaded from Google's servers.</p>` : ''}
<p><strong>We do not ask for health data.</strong> The form does not ask for medical reports, audiograms or information about your hearing. Please do not send health information via the form, WhatsApp or email.</p>
<h3>Purposes and legal bases</h3>
<p><strong>Purposes:</strong> receiving your appointment/call-back request and contacting you; keeping a record of the request; providing the site and protecting it against abuse; showing our location on a map${optional ? '; if you consent, measuring how the site is used and how effective our ads are' : ''}.</p>
<p><strong>Legal bases (Law No. 6698):</strong> for appointment and contact requests, Art. 5/2(c) (directly related to establishing or performing a contract) and Art. 5/2(f) (legitimate interest of the data controller); for hosting logs, site security and showing the map, Art. 5/2(f)${optional ? '; for optional analytics and marketing cookies, explicit consent under Art. 5/1 (your choice in the cookie panel)' : ''}.</p>
<h3>Transfers</h3>
<p>For the processing described above, your personal data is processed by the following service providers:</p>
<ul>${recipients.join('')}</ul>
<p>Your form content (name, phone, topic) is not sent to analytics or advertising tags.</p>
<p><strong>Cross-border transfer:</strong> all of these providers are established outside Türkiye, so the processing above results in a transfer of your personal data abroad. ${v.crossBorder}</p>
<h3>Retention periods</h3>
<p>Appointment and contact requests are kept for at most ${v.appointmentMonths} months from the date the request is received and then deleted. WhatsApp conversations are kept for at most ${v.whatsappMonths} months and then deleted.${api ? ` Technical logs of the appointment application are deleted after ${v.logsDays} days.` : ''} The durations of the records in your browser are listed in the <a href="#cerez">Cookies</a> section; the providers' own records are governed by the respective provider's policy.</p>
<h3>Your rights and how to apply</h3>
<p><strong>Your rights (Art. 11):</strong> under Article 11 of Law No. 6698, everyone has the right, by applying to the data controller, with regard to themselves:</p>
<ul class="legal-lettered">
<li>a) to learn whether their personal data is processed;</li>
<li>b) to request information about it if their personal data has been processed;</li>
<li>c) to learn the purpose of the processing of their personal data and whether it is used in accordance with that purpose;</li>
<li>ç) to know the third parties, in Türkiye or abroad, to whom their personal data is transferred;</li>
<li>d) to request correction of their personal data if it has been processed incompletely or inaccurately;</li>
<li>e) to request deletion or destruction of their personal data under the conditions set out in Article 7 of the Law;</li>
<li>f) to request that the actions taken under (d) and (e) be notified to the third parties to whom their personal data has been transferred;</li>
<li>g) to object to a result to their detriment arising from the analysis of the processed data exclusively through automated systems;</li>
<li>ğ) to claim compensation for damage suffered because their personal data has been processed unlawfully.</li>
</ul>
<p>This is an informal translation; the Turkish wording of the Law and of this page is authoritative.</p>
<p><strong>How to apply:</strong> in writing to the address above or by email to <a href="mailto:${b.email}">${b.email}</a>, in line with the Communiqué on the Procedures and Principles of Application to the Data Controller. Your application is concluded within 30 days at the latest (Art. 13). If your application is rejected, you find the answer insufficient or it is not answered in time, you may file a complaint with the Personal Data Protection Board (Art. 14).</p>`,
      },
      {
        id: 'cerez',
        title: 'Cookies and Similar Technologies',
        html: `
<p><strong>Our own site code does not write cookies.</strong> Without your consent, it writes only the following two strictly necessary records to your browser's storage. They do not identify you, and our site does not send them to any server on their own. The topic carried by <code>ayaz.topic</code> (e.g. "BTE") is included in your request only if you submit the form${api ? ' and is then sent to the appointment application' : '; it appears in the WhatsApp message text once the WhatsApp link opens'}. Fonts are served with our site; the site does not contact Google for fonts.</p>
<table class="legal-table">
<thead><tr><th>Record</th><th>Where</th><th>Purpose</th><th>Duration</th></tr></thead>
<tbody>
<tr><td data-label="Record"><code>ayaz.consent.v1</code></td><td data-label="Where">Browser local storage (localStorage)</td><td data-label="Purpose">${optional
  ? 'Remembering the choice you made in the cookie panel (yes/no for analytics and marketing, and when you chose). Written only when you make a choice.'
  : 'Remembering that you closed the cookie notice (and when), so that it is not shown again on every page. As no optional service runs on this site, the analytics and marketing values in the record are always "no". Written only when you close the notice.'}</td><td data-label="Duration">${optional ? 'The choice is valid for 180 days; after that you are asked again.' : 'The record is valid for 180 days; after that the notice is shown again.'} You can delete it in your browser settings.</td></tr>
<tr><td data-label="Record"><code>ayaz.topic</code></td><td data-label="Where">Browser session storage (sessionStorage)</td><td data-label="Purpose">Carrying the topic you picked into the appointment form when you click the appointment button on a device card or in the ear-mould section.</td><td data-label="Duration">Deleted by the browser when you close the tab.</td></tr>
</tbody></table>
<h3>Third-party content loaded without waiting for consent: Google Maps</h3>
<p>The map in the contact section is third-party content provided by Google and loads automatically when the page is viewed, without waiting for your consent (your browser may load it as you approach that section of the page). While the map loads, your IP address, browser information and the address of the page you are viewing are sent to Google; Google may set its own cookies or read Google cookies already in your browser. Google's ${ext(PROVIDERS.google.privacy, 'privacy policy')} and ${ext(PROVIDERS.google.cookies, 'cookie information')} apply to this processing.</p>
<p>If you prefer not to use the map, our address (${b.address.line}) and phone number (${b.phone.display}) are shown as text in the same section.</p>${ctx.turnstile ? `
<p><strong>Cloudflare Turnstile:</strong> loaded for bot protection when you start filling in the appointment form; Cloudflare's ${ext(PROVIDERS.cloudflare.privacy, 'privacy policy')} applies to the data it processes.</p>` : ''}${ctx.liveReviews ? `
<p><strong>Current reviews:</strong> the reviews section sends a request to our application on Cloudflare; review authors' profile photos may be loaded from Google's servers.</p>` : ''}
<h3>Cookies that require your consent (analytics and marketing)</h3>
${optional
  ? `<p>The following services load only if you allow the corresponding category in the cookie panel; without your consent they do not load at all:</p>
<ul>${optionalItems.join('')}</ul>
<p>When you allow them, these services may also set cookies under our site's domain. Cookie names and durations are determined by the provider; the current list is in the provider's cookie information. If you withdraw consent, the page reloads and the tags stop; you can delete third-party cookies already set in your browser settings.</p>`
  : `<p>No analytics or marketing service is currently active on this site; the cookie notice therefore does not ask for your consent and offers no analytics or marketing option. If such a service is enabled, it will load only with your consent and will be listed by name both in the cookie panel and in this section.</p>`}
<p>You can ${optional ? 'change your choice' : 'reopen the cookie notice'} at any time via the <strong>Cookie preferences</strong> link in the footer.</p>`,
      },
      {
        id: 'gizlilik',
        title: 'Privacy Policy',
        html: `
<p>${b.legalNameEn} processes personal data in accordance with Turkish Law No. 6698 on the Protection of Personal Data and related regulations. Through this website we collect only the minimum data needed to contact you${optional ? '; apart from that, the measurement services listed in the cookie policy above run only with your explicit consent' : ''} and we never ask for health information online.</p>
<p>${marketing.length
  ? `We do not sell or rent your personal data. We do not build advertising profiles ourselves; however, if you allow marketing cookies, the marketing services (${joinList(marketing, 'and')}) collect data to measure the effect of our ads and process it under their own policies (see <a href="#cerez">Cookies</a>).`
  : 'We do not sell or rent your personal data and we do not use it to build advertising profiles.'}</p>
<p>The WhatsApp, Google Maps directions and Google reviews links open the respective service's page; that service's privacy terms apply there.</p>
<p>This page reflects the services running on our site and is updated when a service is added or removed. The date of the last update is shown at the top of the page.</p>`,
      },
    ],
  };
}
