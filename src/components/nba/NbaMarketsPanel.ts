import { Panel } from '../Panel';
import { getNbaMarkets, type PredictionMarket } from '@/services/nba/prediction-market';

export class NbaMarketsPanel extends Panel {
  private markets: PredictionMarket[] = [];
  private filter: string = 'all';

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-markets-panel');
  }

  protected renderContent(): void {
    if (this.markets.length === 0) {
      this.loadMarkets();
    } else {
      this.renderMarkets();
    }
  }

  private renderMarkets(): void {
    const totalVolume = this.markets.reduce((s, m) => s + parseFloat(m.volume || '0'), 0);
    const html = `
      <div class="nba-markets-header">
        <span class="nba-markets-count">${this.markets.length} Markets</span>
        <span class="nba-markets-volume">Vol: $${this.formatNumber(totalVolume)}</span>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      <div class="nba-markets-filter">
        <button class="nba-filter-btn ${this.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="nba-filter-btn ${this.filter === 'series' ? 'active' : ''}" data-filter="series">Series</button>
        <button class="nba-filter-btn ${this.filter === 'player' ? 'active' : ''}" data-filter="player">Player Props</button>
        <button class="nba-filter-btn ${this.filter === 'futures' ? 'active' : ''}" data-filter="futures">Futures</button>
      </div>
      <div class="nba-markets-list">
        ${this.markets.map(m => this.renderMarket(m)).join('')}
      </div>
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private renderMarket(market: PredictionMarket): string {
    const yesPrice = parseFloat(market.outcomePrices?.[0] || '0');
    const noPrice = parseFloat(market.outcomePrices?.[1] || '0');
    const volume = parseFloat(market.volume || '0');
    const isYesLeading = yesPrice > noPrice;

    return `
      <div class="nba-market-card" data-market-id="${market.id}">
        <div class="nba-market-question">${market.question}</div>
        <div class="nba-market-prices">
          <div class="nba-price-bar">
            <div class="nba-price-yes ${isYesLeading ? 'leading' : ''}" style="width: ${yesPrice * 100}%">
              <span>Yes ${Math.round(yesPrice * 100)}&#162;</span>
            </div>
            <div class="nba-price-no ${!isYesLeading ? 'leading' : ''}" style="width: ${noPrice * 100}%">
              <span>No ${Math.round(noPrice * 100)}&#162;</span>
            </div>
          </div>
        </div>
        <div class="nba-market-meta">
          <span class="nba-market-vol">Vol: $${this.formatNumber(volume)}</span>
          <span class="nba-market-liq">Liq: $${this.formatNumber(parseFloat(market.liquidity || '0'))}</span>
        </div>
      </div>
    `;
  }

  private formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
  }

  private attachEvents(): void {
    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadMarkets());

    this.element.querySelectorAll('.nba-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter = (btn as HTMLElement).dataset.filter || 'all';
        this.element.querySelectorAll('.nba-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderMarkets();
      });
    });

    this.element.querySelectorAll('.nba-market-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.marketId;
        if (id) {
          this.element.querySelectorAll('.nba-market-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });
  }

  private async loadMarkets(): Promise<void> {
    this.showLoading('Loading prediction markets...');
    try {
      this.markets = await getNbaMarkets();
      this.renderMarkets();
    } catch {
      this.showError('Failed to load prediction markets');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadMarkets();
  }
}
