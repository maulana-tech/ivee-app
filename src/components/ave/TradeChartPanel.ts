import { Panel } from '../Panel';
import { getTrendingTokens, type AveToken } from '@/services/ave/client';

const POPULAR_TOKENS = [
  { symbol: 'BTC', name: 'Bitcoin', id: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', id: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', id: 'solana' },
  { symbol: 'BNB', name: 'BNB', id: 'binancecoin' },
  { symbol: 'XRP', name: 'XRP', id: 'ripple' },
  { symbol: 'DOGE', name: 'Dogecoin', id: 'dogecoin' },
  { symbol: 'ADA', name: 'Cardano', id: 'cardano' },
  { symbol: 'AVAX', name: 'Avalanche', id: 'avalanche-2' },
  { symbol: 'LINK', name: 'Chainlink', id: 'chainlink' },
  { symbol: 'DOT', name: 'Polkadot', id: 'polkadot' },
];

interface PricePoint {
  time: number;
  price: number;
  volume: number;
}

export class TradeChartPanel extends Panel {
  private selectedToken = POPULAR_TOKENS[0];
  private timeInterval = '24h';
  private priceData: PricePoint[] = [];
  private currentPrice = 0;
  private change24h = 0;
  private high24h = 0;
  private low24h = 0;
  private volume24h = 0;

  constructor() {
    super({ id: 'trade-chart', title: 'Trade Chart' });
    this.element.classList.add('trade-chart-panel', 'panel-wide');
  }

  protected renderContent(): void {
    this.renderChart();
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.showLoading('Loading chart data...');
    try {
      const resp = await fetch(`/api/market/v1/list-crypto-quotes`);
      const data = await resp.json();
      const token = (data.quotes || []).find((q: any) => q.symbol === this.selectedToken.symbol);
      if (token) {
        this.currentPrice = token.price || 0;
        this.change24h = token.change || 0;
        this.volume24h = token.volume || 0;
        this.priceData = (token.sparkline || []).map((p: number, i: number) => ({
          time: Date.now() - (24 - i) * 3600000,
          price: p,
          volume: Math.random() * (this.volume24h / 24),
        }));
        this.high24h = Math.max(...this.priceData.map(p => p.price));
        this.low24h = Math.min(...this.priceData.map(p => p.price));
      }
      this.renderChart();
    } catch (e) {
      this.showError('Failed to load chart data');
    }
  }

  private renderChart(): void {
    const priceColor = this.change24h >= 0 ? '#00ff88' : '#ff4455';
    const changeSign = this.change24h >= 0 ? '+' : '';
    const formatPrice = (p: number) => {
      if (p >= 1000) return p.toFixed(2);
      if (p >= 1) return p.toFixed(4);
      return p.toFixed(6);
    };
    const formatVol = (v: number) => {
      if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
      return v.toFixed(2);
    };

    const chartSvg = this.generateSvgChart(priceColor);

    const html = `
      <div class="trade-chart-header">
        <div class="trade-chart-token-select">
          <select class="token-selector">
            ${POPULAR_TOKENS.map(t => 
              `<option value="${t.symbol}" ${t.symbol === this.selectedToken.symbol ? 'selected' : ''}>${t.symbol} - ${t.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="trade-chart-price-info">
          <span class="chart-price" style="color: ${priceColor}">${formatPrice(this.currentPrice)}</span>
          <span class="chart-change" style="color: ${priceColor}">${changeSign}${this.change24h.toFixed(2)}%</span>
        </div>
        <div class="trade-chart-stats">
          <div class="stat"><span class="stat-label">24h High</span><span class="stat-value">${formatPrice(this.high24h)}</span></div>
          <div class="stat"><span class="stat-label">24h Low</span><span class="stat-value">${formatPrice(this.low24h)}</span></div>
          <div class="stat"><span class="stat-label">Volume</span><span class="stat-value">${formatVol(this.volume24h)}</span></div>
        </div>
        <div class="trade-chart-intervals">
          <button class="interval-btn ${this.timeInterval === '1h' ? 'active' : ''}" data-interval="1h">1H</button>
          <button class="interval-btn ${this.timeInterval === '24h' ? 'active' : ''}" data-interval="24h">24H</button>
          <button class="interval-btn ${this.timeInterval === '7d' ? 'active' : ''}" data-interval="7d">7D</button>
          <button class="interval-btn ${this.timeInterval === '30d' ? 'active' : ''}" data-interval="30d">30D</button>
        </div>
      </div>
      <div class="trade-chart-body">
        ${chartSvg}
      </div>
      <div class="trade-chart-footer">
        <span class="chart-token-label">${this.selectedToken.symbol}/USD</span>
        <span class="chart-update-time">Updated: ${new Date().toLocaleTimeString()}</span>
      </div>
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private generateSvgChart(color: string): string {
    if (this.priceData.length < 2) {
      return '<div class="chart-empty">Loading chart...</div>';
    }

    const width = 800;
    const height = 300;
    const padding = { top: 10, right: 10, bottom: 30, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const prices = this.priceData.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const points = this.priceData.map((p, i) => {
      const x = padding.left + (i / (this.priceData.length - 1)) * chartW;
      const y = padding.top + chartH - ((p.price - minPrice) / priceRange) * chartH;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

    const gridLines = [];
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (i / gridSteps) * chartH;
      const price = maxPrice - (i / gridSteps) * priceRange;
      const formatP = (p: number) => p >= 1 ? p.toFixed(2) : p.toFixed(6);
      gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1a2a2a" stroke-width="1"/>`);
      gridLines.push(`<text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" fill="#4a6a6a" font-size="10">${formatP(price)}</text>`);
    }

    const timeLabels = [];
    const labelCount = 6;
    for (let i = 0; i <= labelCount; i++) {
      const idx = Math.floor((i / labelCount) * (this.priceData.length - 1));
      const x = padding.left + (idx / (this.priceData.length - 1)) * chartW;
      const time = new Date(this.priceData[idx].time);
      timeLabels.push(`<text x="${x}" y="${height - 5}" text-anchor="middle" fill="#4a6a6a" font-size="10">${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}</text>`);
    }

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${gridLines.join('')}
        <path d="${areaPath}" fill="url(#chartGrad)"/>
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${points[points.length - 1].x}" cy="${points[points.length - 1].y}" r="4" fill="${color}"/>
        ${timeLabels.join('')}
      </svg>
    `;
  }

  private attachEvents(): void {
    const selector = this.element.querySelector('.token-selector') as HTMLSelectElement;
    selector?.addEventListener('change', (e) => {
      const sym = (e.target as HTMLSelectElement).value;
      this.selectedToken = POPULAR_TOKENS.find(t => t.symbol === sym) || POPULAR_TOKENS[0];
      this.loadData();
    });

    this.element.querySelectorAll('.interval-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.timeInterval = (btn as HTMLElement).dataset.interval || '24h';
        this.loadData();
      });
    });
  }

  public async refresh(): Promise<void> {
    await this.loadData();
  }
}
