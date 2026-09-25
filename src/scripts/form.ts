/**
 * Randevu formu.
 *  - PUBLIC_API_BASE varsa: Worker'a JSON POST; yalnızca delivered:true ise "alındı" gösterir.
 *  - Yoksa: doğrulanmış alanları hazır WhatsApp mesajına çevirir (sahte başarı yok).
 *  - Honeypot, zaman tuzağı, isteğe bağlı Turnstile. PII analitiğe gönderilmez.
 */
import type { RuntimeConfig } from './config';
import { track } from './analytics';
import { normalizeTrPhone, isValidName } from './phone';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      getResponse: (id?: string) => string | undefined;
      reset: (id?: string) => void;
    };
  }
}

const MSG = {
  tr: { waOpened: 'Mesajınız hazır. WhatsApp üzerinden gönderdiğinizde talebiniz bize ulaşır.', waIntro: 'Merhaba, randevu talep ediyorum.', name: 'Ad Soyad', phone: 'Telefon', time: 'Uygun zaman', topic: 'Konu', notDelivered: 'Talebiniz şu anda iletilemedi. Lütfen WhatsApp veya telefonla ulaşın.' },
  en: { waOpened: 'Your message is ready. Send it in WhatsApp to deliver your request.', waIntro: 'Hello, I would like to request an appointment.', name: 'Name', phone: 'Phone', time: 'Preferred time', topic: 'Topic', notDelivered: 'Your request could not be delivered right now. Please reach us via WhatsApp or phone.' },
};

export function initForm(cfg: RuntimeConfig): void {
  const form = document.querySelector<HTMLFormElement>('[data-appointment-form]');
  if (!form) return;
  const m = MSG[cfg.locale];
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const submitLabel = submit.querySelector('span')!;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const tsInput = form.querySelector<HTMLInputElement>('[data-form-ts]')!;
  const tplOk = form.querySelector<HTMLTemplateElement>('[data-tpl-success]')!;
  const tplErr = form.querySelector<HTMLTemplateElement>('[data-tpl-error]')!;
  const fallbackNotice = form.querySelector<HTMLElement>('[data-fallback-notice]');
  const turnstileEl = form.querySelector<HTMLElement>('[data-turnstile]');
  const waMode = !cfg.apiBase;
  let turnstileId: string | null = null;
  let started = false;
  let inFlight = false;
  let turnstileRequested = false;

  if (waMode) {
    submit.classList.add('is-wa');
    submitLabel.textContent = submit.dataset.labelWa || submitLabel.textContent;
    if (fallbackNotice) fallbackNotice.hidden = false;
  }

  const onStart = () => {
    if (started) return;
    started = true;
    tsInput.value = String(Date.now());
    track('appointment_start', { mode: waMode ? 'whatsapp' : 'api' });
    if (!waMode && cfg.turnstile && turnstileEl) loadTurnstile();
  };
  form.addEventListener('focusin', onStart);
  form.addEventListener('input', onStart);

  function loadTurnstile() {
    if (!turnstileEl || turnstileRequested) return;
    turnstileRequested = true;
    turnstileEl.hidden = false;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => {
      turnstileId = window.turnstile?.render(turnstileEl, { sitekey: cfg.turnstile, theme: 'light', language: cfg.locale, size: 'flexible' }) ?? null;
    };
    document.head.appendChild(s);
  }

  const setError = (field: string, msg: string) => {
    const el = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    const input = form.elements.namedItem(field) as HTMLInputElement | null;
    if (el) el.textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const validation = (() => {
    // Mesajlar bileşen tarafından content'ten gelir; burada dil bazlı sabitler yedek olarak tutulur.
    return cfg.locale === 'tr'
      ? { name: 'Lütfen adınızı ve soyadınızı yazın.', phone: 'Lütfen geçerli bir telefon numarası yazın (ör. 05xx xxx xx xx).', consent: 'Devam etmek için aydınlatma metnini onaylayın.' }
      : { name: 'Please enter your full name.', phone: 'Please enter a valid phone number (e.g. 05xx xxx xx xx).', consent: 'Please confirm the privacy notice to continue.' };
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (inFlight) return;
    onStart();
    status.innerHTML = '';
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const phoneRaw = String(fd.get('phone') || '');
    const time = String(fd.get('time') || '');
    const topic = String(fd.get('topic') || '');
    const consent = fd.get('consent') === 'on';
    const honey = String(fd.get('website') || '');
    const phone = normalizeTrPhone(phoneRaw);
    let ok = true;
    setError('name', isValidName(name) ? '' : validation.name); ok &&= isValidName(name);
    setError('phone', phone ? '' : validation.phone); ok &&= !!phone;
    setError('consent', consent ? '' : validation.consent); ok &&= consent;
    if (!ok) {
      form.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid')?.focus();
      return;
    }
    if (honey) return; // bot

    if (waMode) {
      const lines = [m.waIntro, `${m.name}: ${name}`, `${m.phone}: ${phone}`, time ? `${m.time}: ${time}` : '', topic ? `${m.topic}: ${topic}` : ''].filter(Boolean);
      const url = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
      track('appointment_submit_whatsapp');
      // Kullanıcı hareketi içinde anchor tıklaması: popup engelleyicilere takılmaz, mevcut sayfa yerinde kalır.
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      status.innerHTML = `<div class="notice notice--ok">${m.waOpened} <a href="${url}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>`;
      return;
    }

    inFlight = true;
    submit.disabled = true;
    submitLabel.textContent = submit.dataset.labelSending || '…';
    try {
      const res = await fetch(`${cfg.apiBase.replace(/\/$/, '')}/api/appointment`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          time,
          consent: true,
          website: honey,
          t: Number(tsInput.value) || Date.now(),
          turnstileToken: turnstileId ? window.turnstile?.getResponse(turnstileId) : undefined,
          locale: cfg.locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; delivered?: boolean; fields?: Record<string, string> };
      if (res.ok && data.ok && data.delivered) {
        status.replaceChildren(tplOk.content.cloneNode(true));
        form.reset();
        started = false;
        tsInput.value = '';
        track('appointment_submit_success');
      } else if (res.ok && data.ok && !data.delivered) {
        status.innerHTML = `<div class="notice notice--warn">${m.notDelivered}</div>`;
      } else {
        if (data.fields) Object.keys(data.fields).forEach((k) => {
          if (k === 'name' || k === 'phone' || k === 'consent') setError(k, validation[k]);
        });
        status.replaceChildren(tplErr.content.cloneNode(true));
      }
    } catch {
      status.replaceChildren(tplErr.content.cloneNode(true));
    } finally {
      inFlight = false;
      submit.disabled = false;
      submitLabel.textContent = submit.dataset.labelDefault || '';
      if (turnstileId) window.turnstile?.reset(turnstileId);
    }
  });
}
