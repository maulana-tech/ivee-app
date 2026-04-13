import { Panel } from './Panel';
import { toApiUrl } from '@/services/runtime';

interface HeatmapCell {
  symbol: string;
  name: string;
  change: number;
  marketCap: number;
  volume: number;
}

function getHeatColor(change: number): string {
  if (change > 5) return '#16a34a';
  if (change > 2) return '#22c55e';
  if (change > 0.5) return '#4ade80';
  if (change > -0.5) return 'rgba(255,255,255,0.08)';
  if (change > -2) return '#f87171';
  if (change > -5) return '#ef4444';
  return '#dc2626';
}

function getTextColor(change: number): string {
  if (Math.abs(change) < 0.5) return 'var(--text)';
  return '#fff';
}

export class HeatmapPanel extends Panel {
  private cells: HeatmapCell[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'heatmap', title: 'Crypto Heatmap' });
  }

  protected renderContent(): void {
    if (this.loaded) {
      this.renderPanel();
      return;
    }
    this.showLoading('Loading heatmap...');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const resp = await fetch(toApiUrl('/api/market/v1/list-crypto-quotes'));
      if (!resp.ok) throw new Error('fetch failed');
      const data = await resp.json();
      const quotes: any[] = data.quotes || [];
      if (quotes.length === 0) throw new Error('empty');

      this.cells = quotes.map((q: any) => ({
        symbol: q.symbol || '',
        name: q.name || '',
        change: q.change || 0,
        marketCap: q.marketCap || 0,
        volume: q.volume || 0,
      }));
    } catch {
      this.cells = [
        { symbol: 'BTC', name: 'Bitcoin', change: 1.5, marketCap: 1.4e12, volume: 36e9 },
        { symbol: 'ETH', name: 'Ethereum', change: -0.8, marketCap: 268e9, volume: 15e9 },
        { symbol: 'SOL', name: 'Solana', change: 3.2, marketCap: 48e9, volume: 3e9 },
        { symbol: 'BNB', name: 'BNB', change: 0.5, marketCap: 83e9, volume: 1e9 },
        { symbol: 'XRP', name: 'XRP', change: -1.2, marketCap: 82e9, volume: 2e9 },
        { symbol: 'ADA', name: 'Cardano', change: 2.1, marketCap: 9e9, volume: 400e6 },
        { symbol: 'DOGE', name: 'Dogecoin', change: 4.5, marketCap: 14e9, volume: 1e9 },
        { symbol: 'DOT', name: 'Polkadot', change: -3.1, marketCap: 2e9, volume: 260e6 },
        { symbol: 'LINK', name: 'Chainlink', change: 1.8, marketCap: 6.4e9, volume: 250e6 },
        { symbol: 'AVAX', name: 'Avalanche', change: -0.3, marketCap: 4e9, volume: 240e6 },
      ];
    }
    this.loaded = true;
    this.renderPanel();
  }

  private renderPanel(): void {
    if (this.cells.length === 0) {
      this.showRetrying('No heatmap data available');
      return;
    }

    const totalMcap = this.cells.reduce((s, c) => s + c.marketCap, 0) || 1;

    const rows: HeatmapCell[][] = [];
    let currentRow: HeatmapCell[] = [];
    let rowWeight = 0;

    for (const cell of this.cells) {
      const weight = cell.marketCap / totalMcap;
      currentRow.push(cell);
      rowWeight += weight;
      if (rowWeight >= 0.2 || currentRow.length >= 4) {
        rows.push(currentRow);
        currentRow = [];
        rowWeight = 0;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    const html = `
      <div style="padding:6px;display:flex;flex-direction:column;gap:3px;height:100%;overflow:hidden">
        ${rows.map(row => {
          const rowMcap = row.reduce((s, c) => s + c.marketCap, 0) || 1;
          return `<div style="display:flex;gap:3px;flex:1;min-height:0">
            ${row.map(cell => {
              const pct = Math.max((cell.marketCap / rowMcap) * 100, 15);
              const color = getHeatColor(cell.change);
              const textColor = getTextColor(cell.change);
              const sign = cell.change >= 0 ? '+' : '';
              return `<div style="
                flex:${pct};
                background:${color};
                border-radius:3px;
                padding:4px 6px;
                display:flex;
                flex-direction:column;
                justify-content:center;
                align-items:center;
                min-width:0;
                overflow:hidden;
                cursor:default;
                color:${textColor};
                font-size:10px;
                transition:opacity 0.15s;
              " title="${cell.name}: ${sign}${cell.change.toFixed(2)}%">
                <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cell.symbol}</div>
                <div style="font-weight:600;font-variant-numeric:tabular-nums">${sign}${cell.change.toFixed(1)}%</div>
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    `;

    this.setContent(html);
  }
}
