import { Panel } from '../Panel';
import { getStandings, type TeamStanding, type NbaGame } from '@/services/nba/client';
import { generatePrediction, type GamePrediction } from '@/services/nba/predictions';

export class NbaTeamsPanel extends Panel {
  private standings: TeamStanding[] = [];
  private predictions: GamePrediction[] = [];
  private view: 'standings' | 'predictions' = 'standings';

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-teams-panel');
  }

  protected renderContent(): void {
    this.renderView();
  }

  private renderView(): void {
    const html = `
      <div class="nba-teams-header">
        <div class="nba-teams-tabs">
          <button class="nba-tab ${this.view === 'standings' ? 'active' : ''}" data-view="standings">Standings</button>
          <button class="nba-tab ${this.view === 'predictions' ? 'active' : ''}" data-view="predictions">AI Picks</button>
        </div>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      ${this.view === 'standings' ? this.renderStandings() : this.renderPredictions()}
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private renderStandings(): string {
    if (this.standings.length === 0) {
      this.loadStandings();
      return '<div class="nba-loading">Loading standings...</div>';
    }

    const east = this.standings.filter(t => t.conference === 'East').sort((a, b) => b.percentage - a.percentage);
    const west = this.standings.filter(t => t.conference === 'West').sort((a, b) => b.percentage - a.percentage);

    return `
      <div class="nba-standings-grid">
        <div class="nba-conference">
          <h4 class="nba-conf-title">Eastern Conference</h4>
          ${east.slice(0, 8).map((t, i) => this.renderStandingRow(t, i + 1)).join('')}
        </div>
        <div class="nba-conference">
          <h4 class="nba-conf-title">Western Conference</h4>
          ${west.slice(0, 8).map((t, i) => this.renderStandingRow(t, i + 1)).join('')}
        </div>
      </div>
    `;
  }

  private renderStandingRow(team: TeamStanding, seed: number): string {
    const streakText = team.streak > 0 ? `W${team.streak}` : team.streak < 0 ? `L${Math.abs(team.streak)}` : '-';
    const streakClass = team.streak > 0 ? 'nba-streak-w' : team.streak < 0 ? 'nba-streak-l' : '';
    const playoffLine = seed <= 6 ? 'nba-playoff-safe' : seed <= 8 ? 'nba-playoff-playin' : '';

    return `
      <div class="nba-standing-row ${playoffLine}">
        <span class="nba-seed">${seed}</span>
        <span class="nba-team-abbr">${team.abbreviation}</span>
        <span class="nba-record">${team.wins}-${team.losses}</span>
        <span class="nba-pct">${team.percentage.toFixed(3)}</span>
        <span class="nba-streak ${streakClass}">${streakText}</span>
      </div>
    `;
  }

  private renderPredictions(): string {
    if (this.predictions.length === 0) {
      return '<div class="nba-loading">Predictions available on game days</div>';
    }

    return `
      <div class="nba-predictions-list">
        ${this.predictions.map(p => this.renderPredictionRow(p)).join('')}
      </div>
    `;
  }

  private renderPredictionRow(pred: GamePrediction): string {
    const confColor = pred.confidence >= 70 ? '#00ff88' : pred.confidence >= 50 ? '#ffaa00' : '#ff4444';

    return `
      <div class="nba-prediction-card">
        <div class="nba-pred-matchup">
          <span class="nba-pred-away">${pred.awayTeam}</span>
          <span class="nba-pred-at">@</span>
          <span class="nba-pred-home">${pred.homeTeam}</span>
        </div>
        <div class="nba-pred-pick">
          <span class="nba-pred-winner">${pred.predictedWinner}</span>
          <span class="nba-pred-confidence" style="color: ${confColor}">${pred.confidence}%</span>
        </div>
        <div class="nba-pred-detail">
          <span>Spread: ${pred.predictedMargin > 0 ? '+' : ''}${pred.predictedMargin}</span>
          <span>O/U: ${pred.predictedTotal}</span>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    this.element.querySelectorAll('.nba-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.view = (tab as HTMLElement).dataset.view as 'standings' | 'predictions';
        this.renderView();
      });
    });

    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => {
      if (this.view === 'standings') this.loadStandings();
    });
  }

  private async loadStandings(): Promise<void> {
    try {
      this.standings = await getStandings();
      this.renderView();
    } catch {
      this.standings = [];
      this.renderView();
    }
  }

  public updatePredictions(games: NbaGame[]): void {
    this.predictions = games.map(g => generatePrediction(g, this.standings));
    if (this.view === 'predictions') this.renderView();
  }

  public async refresh(): Promise<void> {
    await this.loadStandings();
  }
}
