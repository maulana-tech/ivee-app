import { Panel } from '../Panel';

interface BracketSeries {
  round: number;
  seed_high: number;
  seed_low: number;
  high_team: string;
  low_team: string;
  high_abbr: string;
  low_abbr: string;
  high_wins: number;
  low_wins: number;
  format: string;
}

export class NbaBracketPanel extends Panel {
  private series: BracketSeries[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-bracket-panel');
    this.series = this.getMockBracket();
  }

  protected renderContent(): void {
    this.renderBracket();
  }

  private renderBracket(): void {
    const round1 = this.series.filter(s => s.round === 1);
    const round2 = this.series.filter(s => s.round === 2);
    const round3 = this.series.filter(s => s.round === 3);
    const finals = this.series.filter(s => s.round === 4);

    const html = `
      <div class="nba-bracket-header">
        <h3>2025 NBA Playoffs</h3>
      </div>
      <div class="nba-bracket-grid">
        <div class="nba-bracket-round">
          <h4>First Round</h4>
          ${round1.map(s => this.renderSeries(s)).join('')}
        </div>
        <div class="nba-bracket-round">
          <h4>Conf. Semis</h4>
          ${round2.map(s => this.renderSeries(s)).join('')}
        </div>
        <div class="nba-bracket-round">
          <h4>Conf. Finals</h4>
          ${round3.map(s => this.renderSeries(s)).join('')}
        </div>
        <div class="nba-bracket-round">
          <h4>NBA Finals</h4>
          ${finals.map(s => this.renderSeries(s)).join('')}
        </div>
      </div>
    `;
    this.setContent(html);
  }

  private renderSeries(series: BracketSeries): string {
    const highLeading = series.high_wins > series.low_wins;
    const isOver = series.high_wins === 4 || series.low_wins === 4;

    return `
      <div class="nba-bracket-series ${isOver ? 'completed' : ''}">
        <div class="nba-series-team ${highLeading ? 'leading' : ''}">
          <span class="nba-series-seed">${series.seed_high}</span>
          <span class="nba-series-abbr">${series.high_abbr}</span>
          <span class="nba-series-wins">${series.high_wins}</span>
        </div>
        <div class="nba-series-team ${!highLeading ? 'leading' : ''}">
          <span class="nba-series-seed">${series.seed_low}</span>
          <span class="nba-series-abbr">${series.low_abbr}</span>
          <span class="nba-series-wins">${series.low_wins}</span>
        </div>
      </div>
    `;
  }

  private getMockBracket(): BracketSeries[] {
    return [
      { round: 1, seed_high: 1, seed_low: 8, high_team: 'Boston Celtics', low_team: 'Miami Heat', high_abbr: 'BOS', low_abbr: 'MIA', high_wins: 4, low_wins: 1, format: 'Bo7' },
      { round: 1, seed_high: 4, seed_low: 5, high_team: 'Cleveland Cavaliers', low_team: 'New York Knicks', high_abbr: 'CLE', low_abbr: 'NYK', high_wins: 3, low_wins: 2, format: 'Bo7' },
      { round: 1, seed_high: 1, seed_low: 8, high_team: 'Oklahoma City Thunder', low_team: 'Houston Rockets', high_abbr: 'OKC', low_abbr: 'HOU', high_wins: 3, low_wins: 2, format: 'Bo7' },
      { round: 1, seed_high: 4, seed_low: 5, high_team: 'Denver Nuggets', low_team: 'Los Angeles Lakers', high_abbr: 'DEN', low_abbr: 'LAL', high_wins: 2, low_wins: 3, format: 'Bo7' },
      { round: 2, seed_high: 1, seed_low: 4, high_team: 'Boston Celtics', low_team: 'Cleveland Cavaliers', high_abbr: 'BOS', low_abbr: 'CLE', high_wins: 1, low_wins: 0, format: 'Bo7' },
      { round: 2, seed_high: 1, seed_low: 5, high_team: 'Oklahoma City Thunder', low_team: 'Los Angeles Lakers', high_abbr: 'OKC', low_abbr: 'LAL', high_wins: 0, low_wins: 0, format: 'Bo7' },
      { round: 3, seed_high: 0, seed_low: 0, high_team: 'TBD', low_team: 'TBD', high_abbr: '---', low_abbr: '---', high_wins: 0, low_wins: 0, format: 'Bo7' },
      { round: 4, seed_high: 0, seed_low: 0, high_team: 'TBD', low_team: 'TBD', high_abbr: '---', low_abbr: '---', high_wins: 0, low_wins: 0, format: 'Bo7' },
    ];
  }

  public async refresh(): Promise<void> {
    this.renderBracket();
  }
}
