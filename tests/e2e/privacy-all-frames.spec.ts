/**
 * İzin yokken izleme olmadığının TÜM sayfa için kanıtı.
 * helpers.watchRequests yalnızca ana çerçeveyi sayar (sitenin kendi betikleri); bu test ise yeni (izinsiz, çerez
 * paneline dokunulmamış) bir bağlamda TÜM çerçevelerin — iletişimdeki Google Haritalar iframe'i dahil — her isteğini
 * kaydeder ve hiçbirinin ölçüm/reklam/piksel alan adlarına gitmediğini doğrular.
 * Çıktı: qa/round5/privacy-third-party.json (temas edilen üçüncü taraf alan adları + bağlamdaki çerezler; çerez
 * DEĞERLERİ yazılmaz). Masaüstü ve mobil projeler aynı dosyada kendi anahtarlarına yazar.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { test, expect, type Page, type Request } from '@playwright/test';

/** Ölçüm / reklam / piksel uçları (alan adı soneki veya URL parçası) */
const TRACKING: { label: string; test: (u: URL) => boolean }[] = [
  ...['google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com',
    'connect.facebook.net', 'bat.bing.com', 'clarity.ms', 'openai.com', 'oaiusercontent.com', 'analytics.tiktok.com', 'snap.licdn.com', 'px.ads.linkedin.com',
    'hotjar.com', 'mc.yandex.ru', 'static.ads-twitter.com', 'ads-api.twitter.com']
    .map((d) => ({ label: d, test: (u: URL) => u.hostname === d || u.hostname.endsWith(`.${d}`) })),
  { label: 'facebook.com/tr', test: (u) => /(^|\.)facebook\.com$/.test(u.hostname) && u.pathname.startsWith('/tr') },
  { label: 'google.com/pagead|ads|ccm', test: (u) => /(^|\.)google\.[a-z.]+$/.test(u.hostname) && /^\/(pagead|ads|ccm)\//.test(u.pathname) },
];

/**
 * İzinli üçüncü taraf alan adları: yalnızca Google Haritalar gömmesinin kullandığı Google alanları (sonek eşleşmesi;
 * Google karo/görsel alt alan adlarını değiştirebilir). Listede olmayan YENİ bir alan (yeni iframe, yeni izleyici)
 * testi düşürür → bilinçli olarak eklenmeli ve INTEGRATIONS.md §4'e yazılmalı.
 * Not: bu test gerçek Google Haritalar iframe'ini yükler (internet gerekir); çevrimdışı ortamda atlanır.
 */
const MAP_HOST_SUFFIXES = ['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com'];
const isMapHost = (h: string) => MAP_HOST_SUFFIXES.some((d) => h === d || h.endsWith(`.${d}`));
/** Kanıt dosyası yalnızca PRIVACY_REPORT=1 ile yazılır (her test koşusunda izlenen dosya değişmesin). */
const WRITE_REPORT = process.env.PRIVACY_REPORT === '1';

const OUT_DIR = new URL('../../qa/round5/', import.meta.url).pathname;
const OUT = `${OUT_DIR}privacy-third-party.json`;

interface Seen { url: string; frame: string; type: string }

function frameLabel(page: Page, r: Request): string {
  try {
    const f = r.frame();
    if (f === page.mainFrame()) return 'main';
    return `iframe:${new URL(f.url()).origin}`;
  } catch {
    return 'other';
  }
}

async function waitForMap(page: Page) {
  await page.locator('#iletisim').scrollIntoViewIfNeeded();
  const iframe = page.locator('[data-map] iframe');
  await expect(iframe).toBeVisible();
  await expect.poll(() => page.frames().some((f) => f.url().includes('google.com/maps')), { timeout: 20_000 }).toBe(true);
  const frame = page.frames().find((f) => f.url().includes('google.com/maps'))!;
  await frame.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(4000); // harita karoları / işletme kartı istekleri
}

function writeReport(project: string, entry: unknown) {
  const lock = `${OUT}.lock`;
  mkdirSync(OUT_DIR, { recursive: true });
  const until = Date.now() + 10_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > until) rmSync(lock, { recursive: true, force: true });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); // meşgul döngü yerine 50 ms bekle
    }
  }
  try {
    let report: { generatedAt?: string; note?: string; projects?: Record<string, unknown> } = {};
    if (existsSync(OUT)) {
      try { report = JSON.parse(readFileSync(OUT, 'utf8')); } catch { report = {}; }
    }
    report.generatedAt = new Date().toISOString();
    report.note =
      'İzinsiz (çerez paneline dokunulmamış) yeni tarayıcı bağlamı; tüm çerçevelerin istekleri. Çerez değerleri yazılmaz. ' +
      'Üretici: tests/e2e/privacy-all-frames.spec.ts';
    report.projects = { ...(report.projects ?? {}), [project]: entry };
    writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

test('izin yokken hiçbir çerçeveden ölçüm/reklam isteği yok (Google Haritalar iframe dahil); rapor yazılır', async ({ page, context, baseURL }, info) => {
  test.setTimeout(90_000);
  const online = await fetch('https://www.google.com/generate_204', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok || r.status === 204).catch(() => false);
  test.skip(!online, 'internet yok: Google Haritalar iframe yüklenemez');
  const seen: Seen[] = [];
  context.on('request', (r) => seen.push({ url: r.url(), frame: frameLabel(page, r), type: r.resourceType() }));
  // Set-Cookie başlıkları (tarayıcı engellese bile sunucunun çerez koyma girişimi görünsün) — yalnızca ad, değer yok
  const setCookie: { host: string; name: string }[] = [];
  const pending: Promise<unknown>[] = [];
  context.on('response', (res) => {
    pending.push(res.headersArray().then((hs) => {
      for (const h of hs) if (h.name.toLowerCase() === 'set-cookie') setCookie.push({ host: new URL(res.url()).hostname, name: h.value.split('=')[0]!.trim() });
    }).catch(() => {}));
  });

  for (const path of ['/', '/en/']) {
    await page.goto(path);
    await expect(page.locator('[data-consent]')).toBeVisible(); // izin verilmedi, panel açık
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    await waitForMap(page);
  }

  await Promise.allSettled(pending); // Set-Cookie başlıkları okunmadan rapor yazılmasın
  const site = new URL(baseURL ?? 'http://127.0.0.1:4322');
  const parsed = seen.flatMap((s) => {
    try {
      return [{ ...s, u: new URL(s.url) }];
    } catch {
      return [];
    }
  });
  const third = parsed.filter((s) => /^https?:$/.test(s.u.protocol) && s.u.host !== site.host);
  const hosts = new Map<string, { host: string; count: number; frames: Set<string>; types: Set<string>; paths: Set<string> }>();
  for (const s of third) {
    const h = hosts.get(s.u.hostname) ?? { host: s.u.hostname, count: 0, frames: new Set(), types: new Set(), paths: new Set() };
    h.count++;
    h.frames.add(s.frame);
    h.types.add(s.type);
    if (h.paths.size < 6) h.paths.add(s.u.pathname.split('/').slice(0, 3).join('/'));
    hosts.set(s.u.hostname, h);
  }
  const tracking = third.filter((s) => TRACKING.some((t) => t.test(s.u))).map((s) => ({ url: s.url.slice(0, 200), frame: s.frame, rule: TRACKING.find((t) => t.test(s.u))!.label }));
  const cookies = (await context.cookies()).map((c) => ({
    name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
    expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'session',
  }));
  const storage = await page.evaluate(() => Object.keys(localStorage));

  if (WRITE_REPORT) writeReport(info.project.name, {
    baseURL: site.origin,
    viewport: page.viewportSize(),
    pages: ['/', '/en/'],
    consentGiven: false,
    requestCount: seen.length,
    thirdPartyRequestCount: third.length,
    thirdPartyHosts: [...hosts.values()].sort((a, b) => b.count - a.count).map((h) => ({ ...h, frames: [...h.frames], types: [...h.types], paths: [...h.paths] })),
    trackingRequests: tracking,
    cookies,
    setCookieHeaders: [...new Map(setCookie.map((c) => [`${c.host}|${c.name}`, c])).values()],
    firstPartyLocalStorageKeys: storage,
    browser: page.context().browser()?.version() ?? '',
  });

  // Sitenin kendi (ana) çerçevesi hiçbir üçüncü tarafa gitmez; üçüncü taraf istekleri yalnızca harita iframe'inden
  expect(third.filter((s) => s.frame === 'main').map((s) => s.url), 'ana çerçeveden üçüncü taraf').toEqual([]);
  expect(tracking, 'izinsiz ölçüm/reklam isteği (tüm çerçeveler)').toEqual([]);
  // Tüm üçüncü taraf alan adları harita izin listesinde; hepsi harita çerçevesinden (ya da iframe'in kendi belge isteğinden) gelir
  expect([...hosts.keys()].filter((h) => !isMapHost(h)), 'izin listesinde olmayan üçüncü taraf alan adı').toEqual([]);
  expect(
    third.filter((s) => s.frame !== 'main' && !s.frame.startsWith('iframe:https://www.google.com') && !(s.type === 'document' && s.u.hostname === 'www.google.com')).map((s) => `${s.frame} ${s.url.slice(0, 120)}`),
    'harita dışı bir çerçeveden üçüncü taraf isteği',
  ).toEqual([]);
  // Birinci taraf ölçüm/izin çerezi yazılmadı (izin kaydı yalnızca kullanıcı seçince localStorage'a yazılır)
  expect(cookies.filter((c) => c.domain.replace(/^\./, '') === site.hostname), 'site çerezi').toEqual([]);
  expect(storage).not.toContain('ayaz.consent.v1');
});
