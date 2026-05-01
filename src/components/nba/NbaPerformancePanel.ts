import { Panel } from '../Panel';
import { getMockPositions, calculatePortfolioSummary } from '@/services/nba/predictions';

export class NbaPerformancePanel extends Panel {
  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-performance-panel');
  }

  protected renderContent(): void {
    const positions = getMockPositions();
    const summary = calculatePortfolioSummary(positions);
    this.renderPerformance(summary, positions);
  }

  private renderPerformance(summary: ReturnType<typeof calculatePortfolioSummary>, positions: any[]): void {
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

  private renderStrategyBreakdown(positions: any[]): string {
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
    this.renderContent();
  }
}
