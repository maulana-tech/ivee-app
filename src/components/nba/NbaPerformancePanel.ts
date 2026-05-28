import { Panel } from '../Panel';
import { calculatePortfolioSummary, getMockPositions, type StrategyPosition } from '@/services/nba/predictions';
import { degasRankService, type DegaPosition } from '@/services/nba/dega-rank';

export class NbaPerformancePanel extends Panel {
  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-performance-panel');
  }

  protected renderContent(): void {
    this.setContent('<div class="nba-loading">Loading performance data...</div>');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    let positions: StrategyPosition[];
    try {
      const degas = await degasRankService.fetchPositions();
      const source = degas.length ? degas : degasRankService.getMockPositions();
      positions = this.mapToStrategyPositions(source);
    } catch {
      positions = getMockPositions();
    }
    const summary = calculatePortfolioSummary(positions);
    this.renderPerformance(summary, positions);
  }

  private mapToStrategyPositions(degas: DegaPosition[]): StrategyPosition[] {
    return degas.map(pos => ({
      id: pos.id,
      market: pos.marketId,
      question: pos.question,
      side: pos.side,
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      size: pos.size,
      pnl: pos.pnl,
      pnlPercent: pos.pnlPercent,
      status: pos.status === 'settled' ? (pos.pnl > 0 ? 'won' : 'lost') : pos.status as 'open' | 'closed',
      strategy: 'IVEE Trading',
      openedAt: pos.openedAt,
    }));
  }

  private renderPerformance(summary: ReturnType<typeof calculatePortfolioSummary>, positions: StrategyPosition[]): void {
    const unrealizedColor = summary.unrealizedPnl >= 0 ? '#00ff88' : '#ff4444';
    const realizedColor = summary.realizedPnl >= 0 ? '#00ff88' : '#ff4444';

    const html = `
      <div class="nba-perf-header">
        <h3>P&L Tracker</h3>
      </div>
      <div class="nba-perf-grid">
        <div class="nba-perf-card">
          <span class="nba-perf-label">Total P&L</span>
          <span class="nba-perf-value" style="color: ${unrealizedColor}">$${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(0)}</span>
        </div>
        <div class="nba-perf-card">
          <span class="nba-perf-label">Unrealized</span>
          <span class="nba-perf-value" style="color: ${unrealizedColor}">$${summary.unrealizedPnl >= 0 ? '+' : ''}${summary.unrealizedPnl.toFixed(0)}</span>
        </div>
        <div class="nba-perf-card">
          <span class="nba-perf-label">Realized</span>
          <span class="nba-perf-value" style="color: ${realizedColor}">$${summary.realizedPnl >= 0 ? '+' : ''}${summary.realizedPnl.toFixed(0)}</span>
        </div>
        <div class="nba-perf-card">
          <span class="nba-perf-label">Win Rate</span>
          <span class="nba-perf-value">${summary.winRate}%</span>
        </div>
        <div class="nba-perf-card">
          <span class="nba-perf-label">Positions</span>
          <span class="nba-perf-value">${summary.openPositions} open / ${summary.closedPositions} closed</span>
        </div>
        <div class="nba-perf-card">
          <span class="nba-perf-label">Invested</span>
          <span class="nba-perf-value">$${summary.totalInvested}</span>
        </div>
      </div>
      <div class="nba-perf-strategies">
        <h4>Strategy Breakdown</h4>
        ${this.renderStrategyBreakdown(positions)}
      </div>
    `;
    this.setContent(html);
  }

  private renderStrategyBreakdown(positions: StrategyPosition[]): string {
    const byStrategy: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const p of positions) {
      const strat = p.strategy || 'Unknown';
      if (!byStrategy[strat]) byStrategy[strat] = { pnl: 0, count: 0, wins: 0 };
      byStrategy[strat].pnl += p.pnl;
      byStrategy[strat].count++;
      if (p.pnl > 0) byStrategy[strat].wins++;
    }

    return Object.entries(byStrategy).map(([name, data]) => {
      const color = data.pnl >= 0 ? '#00ff88' : '#ff4444';
      return `
        <div class="nba-strategy-row">
          <span class="nba-strat-name">${name}</span>
          <span class="nba-strat-count">${data.count} trades (${data.wins}W)</span>
          <span class="nba-strat-pnl" style="color: ${color}">$${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}</span>
        </div>
      `;
    }).join('');
  }

  public async refresh(): Promise<void> {
    this.loadData();
  }
}
