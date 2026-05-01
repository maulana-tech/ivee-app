import { Panel } from '../Panel';

interface SpeedOpportunity {
  id: string;
  type: string;
  description: string;
  edge: string;
  timeLeft: string;
  confidence: number;
}

export class NbaSpeedPanel extends Panel {
  private opportunities: SpeedOpportunity[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-speed-panel');
    this.opportunities = this.getMockOpportunities();
  }

  protected renderContent(): void {
    this.renderOpportunities();
  }

  private renderOpportunities(): void {
    const html = `
      <div class="nba-speed-header">
        <h3>Speed Opportunities</h3>
        <span class="nba-speed-count">${this.opportunities.length} Active</span>
      </div>
      <div class="nba-speed-description">
        <p>Stat-based opportunities detected before prediction markets adjust odds.</p>
      </div>
      <div class="nba-speed-list">
        ${this.opportunities.map(opp => this.renderOpportunity(opp)).join('')}
      </div>
    `;
    this.setContent(html);
  }

  private renderOpportunity(opp: SpeedOpportunity): string {
    const confColor = opp.confidence >= 70 ? '#00ff88' : opp.confidence >= 50 ? '#ffaa00' : '#ff4444';

    return `
      <div class="nba-speed-card">
        <div class="nba-speed-type">${opp.type}</div>
        <div class="nba-speed-desc">${opp.description}</div>
        <div class="nba-speed-detail">
          <span class="nba-speed-edge">Edge: ${opp.edge}</span>
          <span class="nba-speed-time">&#9202; ${opp.timeLeft}</span>
          <span class="nba-speed-conf" style="color: ${confColor}">${opp.confidence}%</span>
        </div>
      </div>
    `;
  }

  private getMockOpportunities(): SpeedOpportunity[] {
    return [
      {
        id: '1', type: 'INJURY IMPACT',
        description: 'Jayson Tatum listed as questionable → Celtics market may not reflect full impact',
        edge: '+8% mispricing', timeLeft: '2h until tipoff', confidence: 72,
      },
      {
        id: '2', type: 'BACK-TO-BACK',
        description: 'Lakers playing B2B → historically 42% win rate on road B2B games',
        edge: '+5% edge on Under', timeLeft: '8h', confidence: 65,
      },
      {
        id: '3', type: 'STREAK REVERSION',
        description: 'Nuggets on 6-game win streak → historical regression suggests higher loss probability',
        edge: '+4% on opponent ML', timeLeft: '14h', confidence: 58,
      },
    ];
  }

  public async refresh(): Promise<void> {
    this.renderOpportunities();
  }
}
