import { readConfig } from './config';
import { initConsent } from './consent';
import { initAnalytics } from './analytics';
import { initTracking } from './track';
import { initNav } from './nav';
import { initReveal } from './reveal';
import { initTabs } from './tabs';
import { initLightbox } from './lightbox';
import { initForm } from './form';
import { initReviews } from './reviews';
import { initMap } from './map';
import { initExplorer } from './explorer';

const cfg = readConfig();
const safe = (name: string, fn: () => void) => {
  try {
    fn();
  } catch (err) {
    if (import.meta.env.DEV) console.error(`[init:${name}]`, err);
  }
};

safe('consent', () => initConsent());
safe('analytics', () => initAnalytics(cfg));
safe('tracking', () => initTracking());
safe('nav', () => initNav());
safe('reveal', () => initReveal());
safe('tabs', () => initTabs());
safe('lightbox', () => initLightbox());
safe('form', () => initForm(cfg));
safe('reviews', () => initReviews(cfg));
safe('map', () => initMap());
safe('explorer', () => initExplorer());
