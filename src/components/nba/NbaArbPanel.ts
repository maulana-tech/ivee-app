import { Panel } from '../Panel';
import { findArbitrageOpportunities, getNbaMarkets, type MarketArbitrage, type PredictionMarket } from '@/services/nba/prediction-market';

export class NbaArbPanel extends Panel {
  private opportunities: MarketArbitrage[] = [];
  private markets: PredictionMarket[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-arb-panel');
  }

  protected renderContent(): void {
    if (this.opportunities.length === 0 && this.markets.length === 0) {
      this.loadArbitrage();
    } else {
      this.renderOpportunities();
    }
  }

  private renderOpportunities(): void {
    if (this.opportunities.length === 0) {
      this.setContent(`
        <div class="nba-arb-header">
          <h3>Arbitrage Scanner</h3>
          <button class="nba-refresh-btn" title="Scan">&#8635;</button>
        </div>
        <div class="nba-arb-empty">
          <div class="nba-arb-icon">&#9889;</div>
          <p>Scanning ${this.markets.length} markets for arbitrage opportunities...</p>
          <p class="nba-arb-hint">Mispricing occurs when Yes + No prices deviate significantly from $1.00</p>
        </div>
      `);
      this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadArbitrage());
      return;
    }

    const html = `
      <div class="nba-arb-header">
        <h3>Arbitrage Scanner</h3>
        <span class="nba-arb-count">${this.opportunities.length} Found</span>
        <button class="nba-refresh-btn" title="Scan">&#8635;</button>
      </div>
      <div class="nba-arb-list">
        ${this.opportunities.map(opp => this.renderOpportunity(opp)).join('')}
      </div>
    `;
    this.setContent(html);
    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadArbitrage());
  }

  private renderOpportunity(opp: MarketArbitrage): string {
    const severity = opp.mispricing > 0.05 ? 'nba-arb-high' : opp.mispricing > 0.02 ? 'nba-arb-med' : 'nba-arb-low';

    return `
      <div class="nba-arb-card ${severity}">
        <div class="nba-arb-question">${opp.question}</div>
        <div class="nba-arb-prices">
          <div class="nba-arb-price">
            <span class="nba-arb-label">Yes</span>
            <span class="nba-arb-value">$${opp.yesPrice.toFixed(2)}</span>
          </div>
          <div class="nba-arb-price">
            <span class="nba-arb-label">No</span>
            <span class="nba-arb-value">$${opp.noPrice.toFixed(2)}</span>
          </div>
          <div class="nba-arb-edge">
            <span class="nba-arb-label">Edge</span>
            <span class="nba-arb-value nba-arb-edge-value">${(opp.mispricing * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div class="nba-arb-meta">
          <span>${opp.platform}</span>
          <span>Vol: $${this.formatVol(opp.volume)}</span>
        </div>
      </div>
    `;
  }

  private formatVol(v: string): string {
    const n = parseFloat(v || '0');
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
  }

  private async loadArbitrage(): Promise<void> {
    this.showLoading('Scanning for arbitrage...');
    try {
      this.markets = await getNbaMarkets();
      this.opportunities = findArbitrageOpportunities(this.markets);
      this.renderOpportunities();
    } catch {
      this.showError('Failed to scan for arbitrage');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadArbitrage();
  }
}
