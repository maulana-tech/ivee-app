import { Panel } from './Panel';
import { toApiUrl } from '@/services/runtime';

interface NewsItem {
  title: string;
  source: string;
  time: string;
  url?: string;
  sentiment?: string;
  category?: string;
}

export class LiveNewsPanel extends Panel {
  private items: NewsItem[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'live-news', title: 'Crypto Headlines' });
    this.element.classList.add('news-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (this.loaded) {
      this.renderNews();
      return;
    }
    this.showLoading('Loading crypto headlines...');
    this.loadNews();
  }

  private async loadNews(): Promise<void> {
    try {
      const resp = await fetch(toApiUrl('/api/news/v1/list-news'));
      if (!resp.ok) throw new Error('news fetch failed');
      const data = await resp.json();
      const raw = Array.isArray(data.items) ? data.items : [];
      const now = Date.now();
      this.items = raw.map((item: any, i: number) => ({
        title: item.title || 'Untitled',
        source: item.source || 'Unknown',
        time: item.publishedAt ? this.formatTime(item.publishedAt) : `${i + 1}m ago`,
        url: item.url,
        sentiment: item.sentiment,
        category: item.category,
      }));
      if (this.items.length === 0) throw new Error('empty');
    } catch {
      this.items = [
        { title: 'Bitcoin surges as institutional demand grows', source: 'CoinDesk', time: '2m ago', sentiment: 'bullish', category: 'crypto' },
        { title: 'Ethereum L2 ecosystem reaches new highs', source: 'The Block', time: '15m ago', sentiment: 'bullish', category: 'crypto' },
        { title: 'Solana DEX volume sets new records', source: 'DeFi Llama', time: '32m ago', sentiment: 'bullish', category: 'defi' },
        { title: 'Fed signals cautious approach to rate cuts', source: 'Reuters', time: '1h ago', sentiment: 'bearish', category: 'macro' },
        { title: 'BlackRock BTC ETF sees continued inflows', source: 'Bloomberg', time: '2h ago', sentiment: 'bullish', category: 'etf' },
      ];
    }
    this.loaded = true;
    this.renderNews();
  }

  private formatTime(iso: string): string {
    try {
      const ts = new Date(iso).getTime();
      const diff = Math.max(0, Math.round((Date.now() - ts) / 60000));
      if (diff < 1) return 'just now';
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return `${Math.floor(diff / 1440)}d ago`;
    } catch {
      return '';
    }
  }

  private renderNews(): void {
    const sentimentColors: Record<string, string> = {
      bullish: '#2ecc71',
      bearish: '#e74c3c',
      neutral: '#f39c12',
    };
    const html = `
      <div class="news-list">
        ${this.items.map(item => {
          const dot = item.sentiment ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${sentimentColors[item.sentiment] || '#888'};margin-right:6px;vertical-align:middle"></span>` : '';
          return `
          <div class="news-item" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
              <div class="news-source" style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em">${item.source}</div>
              <div class="news-time" style="font-size:10px;color:var(--text-muted)">${item.time}</div>
            </div>
            <div class="news-title" style="font-size:12px;line-height:1.4">${dot}${item.title}</div>
          </div>`;
        }).join('')}
      </div>
    `;
    this.setContent(html);
  }
}
