import { SITE_VARIANT } from '@/config/variant';

export function setupKeyboardShortcuts(ctx: {
  panels: Record<string, { refresh?: () => Promise<void>; element?: HTMLElement }>;
  getActivePanelKey?: () => string;
}): () => void {
  if (SITE_VARIANT !== 'crypto') return () => {};

  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const chart = ctx.panels['trade-chart'];
    if (!chart) return;

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      chart.refresh?.();
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      const mapSection = document.getElementById('mapSection');
      if (mapSection) {
        mapSection.classList.toggle('live-news-fullscreen');
        document.body.classList.toggle('live-news-fullscreen-active', mapSection.classList.contains('live-news-fullscreen'));
      }
    }

    if (e.key === 'Escape') {
      const mapSection = document.getElementById('mapSection');
      if (mapSection?.classList.contains('live-news-fullscreen')) {
        mapSection.classList.remove('live-news-fullscreen');
        document.body.classList.remove('live-news-fullscreen-active');
      }
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
