import { Panel } from './Panel';
import type { NewsItem } from '@/types';

export class MonitorPanel extends Panel {
  private monitors: any[];

  constructor(monitors: any[] = []) {
    super({ id: 'monitors', title: 'Monitors', showCount: true });
    this.monitors = monitors;
  }

  renderResults(news: NewsItem[]): void {
    if (!this.monitors.length) {
      this.setContent('<div class="panel-empty">No monitors configured</div>');
      return;
    }
    let html = '';
    for (const monitor of this.monitors) {
      const matches = (news || []).filter((n: any) => {
        const keywords = monitor.keywords || [];
        if (!keywords.length) return false;
        const text = `${n.title || ''} ${n.summary || ''}`.toLowerCase();
        return keywords.some((k: string) => text.includes(k.toLowerCase()));
      });
      html += `<div class="monitor-result">
        <div class="monitor-name">${monitor.name || 'Monitor'}</div>
        <div class="monitor-count">${matches.length} matches</div>
      </div>`;
    }
    this.setContent(html || '<div class="panel-empty">No matches found</div>');
    this.setCount?.(this.monitors.length);
  }
}
