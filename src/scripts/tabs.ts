import { prefersReducedMotion } from './config';

/** WAI-ARIA APG Tabs: tıklama + ok tuşları + Home/End, roving tabindex. */
export function initTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    if (!tabs.length) return;
    const select = (i: number, focus = true) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j]!.hidden = !on;
      });
      if (focus) tabs[i]?.focus();
      tabs[i]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, false));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        let idx: number | null = null;
        if (e.key === 'ArrowRight') idx = (i + 1) % n;
        else if (e.key === 'ArrowLeft') idx = (i - 1 + n) % n;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = n - 1;
        if (idx !== null) {
          e.preventDefault();
          select(idx);
        }
      });
    });
  });
}
