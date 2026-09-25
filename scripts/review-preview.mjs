import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'qa/review';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4322';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
 await page.addInitScript(() => localStorage.setItem('ayaz.consent.v1', JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false, ts: Date.now() })));
 await page.goto(base + '/', { waitUntil: 'networkidle' });
 await page.screenshot({ path: `${out}/hero-desktop.png` });
 await page.locator('[data-stage]').scrollIntoViewIfNeeded();
 await page.waitForTimeout(6000);
 console.log(JSON.stringify({ state: await page.locator('[data-explorer]').getAttribute('data-state'), errors }));
 await page.addStyleTag({ content: '[data-header], .mbar, astro-dev-toolbar { visibility: hidden !important; }' });
 await page.locator('[data-explorer]').screenshot({ path: `${out}/model-desktop.png` });
 await page.locator('[data-explode-toggle]').click();
 await page.locator('[data-explorer]').screenshot({ path: `${out}/model-exploded.png` });
 await page.locator('[data-reset]').click();
 if (process.argv.includes('--full')) {
  await page.goto(base + '/en/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/hero-en.png` });
  const mobile = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  const m = await mobile.newPage();
  await m.addInitScript(() => localStorage.setItem('ayaz.consent.v1', JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false, ts: Date.now() })));
  await m.goto(base + '/');
  await m.screenshot({ path: `${out}/hero-mobile.png`, scale: 'css' });
  await m.locator('[data-stage]').scrollIntoViewIfNeeded();
  await m.waitForTimeout(5000);
  await m.addStyleTag({ content: '[data-header], .mbar, astro-dev-toolbar { visibility: hidden !important; }' });
  await m.locator('[data-explorer]').screenshot({ path: `${out}/model-mobile.png` });
  await mobile.close();
  const overflows = [];
  for (const path of ['/', '/en/']) {
    await page.goto(base + path);
    for (const width of [320, 393, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const offending = overflow ? await page.evaluate(() => [...document.querySelectorAll('body *')].map(el => ({ tag: el.tagName, cls: el.className, x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right, text: el.textContent?.slice(0, 60) })).filter(el => el.right > innerWidth + 1 && el.x >= 0).slice(-20)) : [];
      overflows.push({ path, width, overflow, ...(overflow ? { offending } : {}) });
    }
  }
  await writeFile(`${out}/responsive-check.json`, JSON.stringify(overflows, null, 2));
  console.log(JSON.stringify({ overflows }));
 }
 await writeFile(`${out}/browser-errors.json`, JSON.stringify(errors, null, 2));
} finally { await browser.close(); }
