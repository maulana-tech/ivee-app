import { Panel } from './Panel';
import { toApiUrl } from '@/services/runtime';

interface Insight {
  title: string;
  category: string;
  impact: string;
  detail?: string;
}

export class InsightsPanel extends Panel {
  private insights: Insight[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'insights', title: 'AI Market Insights' });
    this.element.classList.add('insights-panel');
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

  private async loadInsights(): Promise<void> {
    try {
      const [cryptoResp, fearResp, newsResp] = await Promise.all([
        fetch(toApiUrl('/api/market/v1/list-crypto-quotes')).then(r => r.json()).catch(() => null),
        fetch(toApiUrl('/api/market/v1/get-fear-greed-index')).then(r => r.json()).catch(() => null),
        fetch(toApiUrl('/api/news/v1/list-news')).then(r => r.json()).catch(() => null),
      ]);

      const quotes: any[] = cryptoResp?.quotes || [];
      const fearValue = fearResp?.value ?? 50;
      const fearLabel = fearResp?.valueClassification ?? 'Neutral';
      const newsItems: any[] = newsResp?.items || [];

      this.insights = [];

      if (quotes.length > 0) {
        const btc = quotes.find((q: any) => q.symbol === 'BTC');
        const eth = quotes.find((q: any) => q.symbol === 'ETH');

        if (btc) {
          const dir = btc.change > 0 ? 'up' : btc.change < 0 ? 'down' : 'flat';
          this.insights.push({
            title: `Bitcoin ${dir === 'up' ? 'rallying' : dir === 'down' ? 'declining' : 'consolidating'} at $${Math.round(btc.price).toLocaleString()}`,
            category: 'Price',
            impact: btc.change > 2 ? 'Bullish' : btc.change < -2 ? 'Bearish' : 'Neutral',
            detail: `${btc.change > 0 ? '+' : ''}${btc.change?.toFixed(2)}% (24h)`,
          });
        }

        if (eth) {
          this.insights.push({
            title: `Ethereum ${eth.change > 0 ? 'gaining' : 'under pressure'} at $${Math.round(eth.price).toLocaleString()}`,
            category: 'Price',
            impact: eth.change > 2 ? 'Bullish' : eth.change < -2 ? 'Bearish' : 'Neutral',
            detail: `${eth.change > 0 ? '+' : ''}${eth.change?.toFixed(2)}% (24h)`,
          });
        }

        const gainers = quotes.filter((q: any) => q.change > 5);
        const losers = quotes.filter((q: any) => q.change < -5);
        if (gainers.length > 0) {
          this.insights.push({
            title: `${gainers.length} coins up >5% — top gainer: ${gainers[0].symbol} (+${gainers[0].change?.toFixed(1)}%)`,
            category: 'Momentum',
            impact: 'Bullish',
          });
        }
        if (losers.length > 0) {
          this.insights.push({
            title: `${losers.length} coins down >5% — top loser: ${losers[0].symbol} (${losers[0].change?.toFixed(1)}%)`,
            category: 'Momentum',
            impact: 'Bearish',
          });
        }

        const totalMcap = quotes.reduce((s: number, q: any) => s + (q.marketCap || 0), 0);
        if (totalMcap > 0) {
          this.insights.push({
            title: `Total crypto market cap: $${(totalMcap / 1e12).toFixed(2)}T`,
            category: 'Market',
            impact: 'Neutral',
          });
        }
      }

      this.insights.push({
        title: `Fear & Greed Index: ${fearValue} (${fearLabel})`,
        category: 'Sentiment',
        impact: fearValue >= 60 ? 'Caution' : fearValue <= 40 ? 'Opportunity' : 'Neutral',
        detail: fearValue >= 75 ? 'Extreme Greed — expect volatility' : fearValue <= 25 ? 'Extreme Fear — potential bottom' : undefined,
      });

      if (newsItems.length > 0) {
        const bullish = newsItems.filter((n: any) => n.sentiment === 'bullish').length;
        const bearish = newsItems.filter((n: any) => n.sentiment === 'bearish').length;
        if (bullish + bearish > 0) {
          this.insights.push({
            title: `News sentiment: ${bullish} bullish vs ${bearish} bearish headlines`,
            category: 'News',
            impact: bullish > bearish * 1.5 ? 'Bullish' : bearish > bullish * 1.5 ? 'Bearish' : 'Neutral',
          });
        }
      }
    } catch {
      this.insights = [
        { title: 'Market data analysis unavailable', category: 'System', impact: 'Neutral' },
      ];
    }

    this.loaded = true;
    this.render();
  }

  private render(): void {
    const colors: Record<string, string> = {
      Bullish: '#2ecc71',
      Bearish: '#e74c3c',
      Neutral: '#f39c12',
      Caution: '#e67e22',
      Opportunity: '#2ecc71',
    };
    const html = `
      <div class="insights-list">
        ${this.insights.map(item => `
          <div class="insight-item" style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em">${item.category}</div>
              <div style="font-size:10px;font-weight:600;color:${colors[item.impact] || '#fff'}">${item.impact}</div>
            </div>
            <div style="font-size:12px;line-height:1.4">${item.title}</div>
            ${item.detail ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${item.detail}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    this.setContent(html);
  }
}
