import { Panel } from './Panel';

interface Insight {
  title: string;
  category: string;
  impact: string;
}

export class InsightsPanel extends Panel {
  private insights: Insight[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'insights', title: 'AI Market Insights' });
    this.element.classList.add('insights-panel');
    this.loadInsights();
  }

  updateInsights(_clusters: unknown[]): void {
    this.render();
  }

  protected renderContent(): void {
    if (this.loaded) {
      this.render();
      return;
    }
    this.showLoading('Analyzing market data...');
    this.loadInsights();
  }

  private loadInsights(): void {
    this.insights = [
      { title: 'BTC ETF inflows exceed $1B for 5 consecutive days', category: 'Institutional', impact: 'Bullish' },
      { title: 'Solana network activity at all-time high', category: 'Network', impact: 'Bullish' },
      { title: ' whale wallets accumulating large cap alts', category: 'Whale', impact: 'Neutral' },
      { title: 'Fear & Greed at Greed 65, potential pullback', category: 'Sentiment', impact: 'Caution' },
    ];
    this.loaded = true;
    this.render();
  }

  private render(): void {
    const colors: Record<string, string> = {
      Bullish: '#2ecc71',
      Bearish: '#e74c3c',
      Neutral: '#f39c12',
      Caution: '#e67e22',
    };
    const html = `
      <div class="insights-list">
        ${this.insights.map(item => `
          <div class="insight-item">
            <div class="insight-category">${item.category}</div>
            <div class="insight-title">${item.title}</div>
            <div class="insight-impact" style="color: ${colors[item.impact] || '#fff'}">${item.impact}</div>
          </div>
        `).join('')}
      </div>
    `;
    this.setContent(html);
  }
}