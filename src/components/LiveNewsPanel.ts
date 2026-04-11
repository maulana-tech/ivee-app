import { Panel } from './Panel';

interface NewsItem {
  title: string;
  source: string;
  time: string;
  url?: string;
}

export class LiveNewsPanel extends Panel {
  private items: NewsItem[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'live-news', title: 'Crypto Headlines' });
    this.element.classList.add('news-panel', 'panel-wide');
    this.loadNews();
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
    this.items = [
      { title: 'Bitcoin surges past $73K as ETF inflows hit $500M', source: 'CoinDesk', time: '2m ago' },
      { title: 'Ethereum upgrade goes live on Mainnet', source: 'CryptoSlate', time: '15m ago' },
      { title: 'Solana DEX volume surpasses Ethereum for first time', source: 'The Block', time: '32m ago' },
      { title: 'Fed signals possible rate cut in June', source: 'Reuters', time: '1h ago' },
      { title: 'BlackRock IBIT sees record $1.2B inflow', source: 'Bloomberg', time: '2h ago' },
    ];
    this.loaded = true;
    this.renderNews();
  }

  private renderNews(): void {
    const html = `
      <div class="news-list">
        ${this.items.map(item => `
          <div class="news-item">
            <div class="news-source">${item.source}</div>
            <div class="news-title">${item.title}</div>
            <div class="news-time">${item.time}</div>
          </div>
        `).join('')}
      </div>
    `;
    this.setContent(html);
  }
}