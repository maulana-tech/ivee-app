import { Panel } from '../Panel';
import { getMockPositions, calculatePortfolioSummary, type StrategyPosition } from '@/services/nba/predictions';

export class NbaStrategyPanel extends Panel {
  private positions: StrategyPosition[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-strategy-panel');
  }

  protected renderContent(): void {
    if (this.positions.length === 0) {
      this.positions = getMockPositions();
    }
    this.renderDashboard();
  }

  private renderDashboard(): void {
    const summary = calculatePortfolioSummary(this.positions);
    const pnlColor = summary.totalPnl >= 0 ? '#00ff88' : '#ff4444';

    const html = `
      <div class="nba-strategy-header">
        <h3>Strategy Dashboard</h3>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      <div class="nba-strategy-summary">
        <div class="nba-stat-card">
          <span class="nba-stat-label">Total P&L</span>
          <span class="nba-stat-value" style="color: ${pnlColor}">$${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(0)}</span>
        </div>
        <div class="nba-stat-card">
          <span class="nba-stat-label">Open</span>
          <span class="nba-stat-value">${summary.openPositions}</span>
        </div>
        <div class="nba-stat-card">
          <span class="nba-stat-label">Win Rate</span>
          <span class="nba-stat-value">${summary.winRate}%</span>
        </div>
        <div class="nba-stat-card">
          <span class="nba-stat-label">Invested</span>
          <span class="nba-stat-value">$${summary.totalInvested}</span>
        </div>
      </div>
      <div class="nba-strategy-positions">
        <h4>Active Positions</h4>
        ${this.positions.filter(p => p.status === 'open').map(p => this.renderPosition(p)).join('')}
      </div>
      <div class="nba-strategy-closed">
        <h4>Recent Results</h4>
        ${this.positions.filter(p => p.status !== 'open').map(p => this.renderPosition(p)).join('')}
      </div>
    `;
    this.setContent(html);
    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.refresh());
  }

  private renderPosition(pos: StrategyPosition): string {
    const pnlColor = pos.pnl >= 0 ? '#00ff88' : '#ff4444';
    const statusBadge = pos.status === 'open'
      ? '<span class="nba-pos-status nba-pos-open">OPEN</span>'
      : pos.status === 'won'
        ? '<span class="nba-pos-status nba-pos-won">WON</span>'
        : '<span class="nba-pos-status nba-pos-lost">LOST</span>';

    return `
      <div class="nba-position-card ${pos.status}">
        <div class="nba-pos-header">
          <span class="nba-pos-question">${pos.question}</span>
          ${statusBadge}
        </div>
        <div class="nba-pos-details">
          <span class="nba-pos-side">${pos.side.toUpperCase()} @ ${pos.entryPrice.toFixed(2)}</span>
          <span class="nba-pos-current">Now: ${pos.currentPrice.toFixed(2)}</span>
          <span class="nba-pos-pnl" style="color: ${pnlColor}">$${pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(0)} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(1)}%)</span>
        </div>
        <div class="nba-pos-meta">
          <span class="nba-pos-strategy">${pos.strategy}</span>
          <span class="nba-pos-size">Size: $${pos.size}</span>
        </div>
      </div>
    `;
  }

  public async refresh(): Promise<void> {
    this.renderDashboard();
  }
}
