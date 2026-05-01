import { Panel } from '../Panel';
import { calculateMarketSentiment, getNbaMarkets, type PredictionMarket } from '@/services/nba/prediction-market';

export class NbaMomentumPanel extends Panel {
  private markets: PredictionMarket[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-momentum-panel');
  }

  protected renderContent(): void {
    if (this.markets.length === 0) {
      this.loadMomentum();
    } else {
      this.renderMomentum();
    }
  }

  private renderMomentum(): void {
    const sentiment = calculateMarketSentiment(this.markets);
    const gaugeColor = sentiment.score > 65 ? '#00ff88' : sentiment.score < 35 ? '#ff4444' : '#ffaa00';

    const html = `
      <div class="nba-momentum-header">
        <h3>Market Momentum</h3>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      <div class="nba-momentum-gauge">
        <div class="nba-gauge-bar">
          <div class="nba-gauge-fill" style="width: ${sentiment.score}%; background: ${gaugeColor}"></div>
        </div>
        <div class="nba-gauge-labels">
          <span>Bearish</span>
          <span class="nba-gauge-score" style="color: ${gaugeColor}">${sentiment.label} (${sentiment.score})</span>
          <span>Bullish</span>
        </div>
      </div>
      <div class="nba-momentum-stats">
        <div class="nba-stat">
          <span class="nba-stat-label">Bullish Markets</span>
          <span class="nba-stat-value" style="color: #00ff88">${sentiment.bullish}</span>
        </div>
        <div class="nba-stat">
          <span class="nba-stat-label">Bearish Markets</span>
          <span class="nba-stat-value" style="color: #ff4444">${sentiment.bearish}</span>
        </div>
        <div class="nba-stat">
          <span class="nba-stat-label">Total Markets</span>
          <span class="nba-stat-value">${this.markets.length}</span>
        </div>
      </div>
      <div class="nba-momentum-top">
        <h4>Highest Volume</h4>
        ${this.getTopVolume(5).map(m => `
          <div class="nba-momentum-item">
            <span class="nba-momentum-q">${m.question}</span>
            <span class="nba-momentum-vol">$${this.fmt(parseFloat(m.volume || '0'))}</span>
          </div>
        `).join('')}
      </div>
    `;
    this.setContent(html);
    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadMomentum());
  }

  private getTopVolume(n: number): PredictionMarket[] {
    return [...this.markets]
      .sort((a, b) => parseFloat(b.volume || '0') - parseFloat(a.volume || '0'))
      .slice(0, n);
  }

  private fmt(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
  }

  private async loadMomentum(): Promise<void> {
    this.showLoading('Loading momentum data...');
    try {
      this.markets = await getNbaMarkets();
      this.renderMomentum();
    } catch {
      this.showError('Failed to load momentum data');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadMomentum();
  }
}
