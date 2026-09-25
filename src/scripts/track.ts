import { track } from './analytics';

const TOPIC_KEY = 'ayaz.topic';

export function initTracking(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
    if (!el) return;
    const name = el.dataset.track!;
    const topic = el.dataset.topic;
    if (topic) {
      try {
        sessionStorage.setItem(TOPIC_KEY, topic);
      } catch {
        /* yoksay */
      }
      document.querySelectorAll<HTMLInputElement>('[data-form-topic]').forEach((i) => (i.value = topic));
    }
    track(name, topic ? { topic } : {});
  });
  try {
    const t = sessionStorage.getItem(TOPIC_KEY);
    if (t) document.querySelectorAll<HTMLInputElement>('[data-form-topic]').forEach((i) => (i.value = t));
  } catch {
    /* yoksay */
  }
}
