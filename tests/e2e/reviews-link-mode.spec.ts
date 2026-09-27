/**
 * 'link' modu kanıtı: PUBLIC_REVIEWS_DISPLAY=link ile GERÇEK bir derleme (geçici outDir) alınır ve
 *  1) üretilen HTML'de yorum kancası ([data-reviews]), şablon, koruma listesi, yorum metni, yıldız/puan/adet yoktur;
 *  2) sayfa tarayıcıda açıldığında — PUBLIC_API_BASE tanımlı olduğu hâlde — Worker'ın /api/reviews ucuna (dolayısıyla
 *     bizim anahtarımızla Places API çağrısına) HİÇ istek gitmez; sitenin kendi çerçevesi de Places'e istek atmaz.
 *     Not: Google Haritalar gömmesi (iletişim) kendi içinde places.googleapis.com …/GetPlace çağırır; bu Google'ın
 *     widget'ıdır, bizim anahtarımızı kullanmaz ve yorum moduna bağlı değildir (bkz. INTEGRATIONS.md §4).
 * Derleme ~2 sn sürer (görsel önbelleği node_modules/.astro'da); aynı koşudaki projeler tek derlemeyi paylaşır.
 * dist/ klasörüne dokunulmaz.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { test, expect } from '@playwright/test';

const ROOT = new URL('../../', import.meta.url).pathname;
const API = 'https://api.ayaz.test';
const TMP = process.env.E2E_LINK_TMP || tmpdir();
// Aynı Playwright koşusundaki işçiler (masaüstü + mobil) aynı ana süreci paylaşır → tek derleme.
const OUT = join(TMP, `ayaz-e2e-link-${process.ppid}`);
const DONE = join(OUT, '.e2e-built');
const LOCK = `${OUT}.lock`;

const data = JSON.parse(readFileSync(join(ROOT, 'src/content/reviews-data.json'), 'utf8')) as { reviews: { text: string; textEn?: string }[]; summary: { count: number } };

function buildOnce() {
  // Eski koşulardan kalan geçici derlemeleri temizle (1 saatten eski)
  for (const name of readdirSync(TMP)) {
    if (!name.startsWith('ayaz-e2e-link-') || join(TMP, name).startsWith(OUT)) continue;
    try {
      if (Date.now() - statSync(join(TMP, name)).mtimeMs > 3_600_000) rmSync(join(TMP, name), { recursive: true, force: true });
    } catch { /* başka süreç siliyor olabilir */ }
  }
  if (existsSync(DONE)) return;
  let owner = false;
  try {
    mkdirSync(LOCK);
    owner = true;
  } catch { /* başka işçi derliyor */ }
  if (owner) {
    try {
      execFileSync('npx', ['astro', 'build', '--outDir', OUT], {
        cwd: ROOT,
        env: { ...process.env, PUBLIC_REVIEWS_DISPLAY: 'link', PUBLIC_API_BASE: API, PUBLIC_SITE_ENV: 'preview' },
        stdio: 'pipe',
        timeout: 170_000,
      });
      writeFileSync(DONE, new Date().toISOString());
    } finally {
      rmSync(LOCK, { recursive: true, force: true });
    }
    return;
  }
  const until = Date.now() + 170_000;
  while (!existsSync(DONE)) {
    if (Date.now() > until) throw new Error('link derlemesi zaman aşımı');
    if (!existsSync(LOCK)) throw new Error('link derlemesi başarısız (diğer işçi)');
    execFileSync('sleep', ['0.5']);
  }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(180_000);
  buildOnce();
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url || '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
    let file = join(OUT, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(OUT) || !existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
});

const snippet = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 28);

for (const path of ['/', '/en/']) {
  test(`link modu ${path}: HTML'de yorum/puan yok, /api/reviews ve Places çağrısı yok`, async ({ page }) => {
    // 1) Derlenmiş HTML
    const html = readFileSync(join(OUT, path, 'index.html'), 'utf8');
    expect(html).toContain('data-reviews-mode="link"');
    expect(html).toContain(`"apiBase":"${API}"`); // API tanımlı → çağrı olmaması moddan kaynaklanıyor
    expect(html).not.toMatch(/data-reviews(?![-\w])/); // kaydırıcı kancası
    expect(html).not.toContain('data-review-tpl');
    expect(html).not.toContain('data-reviews-guard');
    expect(html).not.toContain('data-fp=');
    expect(html).not.toMatch(/class="rvc[\s"]/);
    expect(html).not.toMatch(/data-rating|data-stars|rv__score/);
    // Puan özeti ve yapılandırılmış veri: yıldız/puan/adet hiçbir biçimde yok
    expect(html).not.toMatch(/aggregateRating|ratingValue|reviewCount|"@type":\s*"Review"/);
    expect(html).not.toContain(`${data.summary.count} yorum`);
    expect(html).not.toContain(`${data.summary.count} reviews`);
    // Gösterilen TÜM yorumların metni (TR özgün + EN çeviri) sayfada yok
    for (const r of data.reviews) {
      expect(html).not.toContain(snippet(r.text));
      if (r.textEn) expect(html).not.toContain(snippet(r.textEn));
    }

    // 2) Tarayıcı: tüm çerçevelerdeki istekler
    const requests: { url: string; main: boolean }[] = [];
    page.context().on('request', (r) => {
      let main = true;
      try { main = r.frame() === page.mainFrame(); } catch { /* service worker vb. */ }
      requests.push({ url: r.url(), main });
    });
    await page.route(`${API}/**`, (r) => r.fulfill({ status: 503, json: { ok: false } }));
    await page.goto(base + path);
    await page.locator('[data-consent-reject]').click({ timeout: 5000 }).catch(() => {});
    const section = page.locator('#yorumlar');
    await expect(section).toHaveAttribute('data-reviews-mode', 'link');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('[data-track="reviews_click"]')).toBeVisible();
    await expect(page.locator('[data-reviews]')).toHaveCount(0);
    await expect(section.locator('.stars, .rvc, [data-rating]')).toHaveCount(0);
    // Tüm sayfayı gez (tembel yüklenen her şey tetiklensin), sonra bekle
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(2500);
    expect(requests.length).toBeGreaterThan(5);
    const urls = (list: typeof requests) => list.map((r) => r.url);
    expect(urls(requests.filter((r) => r.url.includes('/api/reviews'))), 'yorum API çağrısı (tüm çerçeveler)').toEqual([]);
    expect(urls(requests.filter((r) => r.url.startsWith(API))), 'Worker çağrısı (tüm çerçeveler)').toEqual([]);
    expect(urls(requests.filter((r) => r.main && r.url.includes('places.googleapis.com'))), 'siteden Places API çağrısı').toEqual([]);
  });
}
