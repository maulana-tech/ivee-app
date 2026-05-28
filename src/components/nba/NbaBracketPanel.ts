import { Panel } from '../Panel';
import { getPlayoffGames, type NbaGame, type NbaTeam } from '@/services/nba/client';

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
  private isLiveData = false;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-bracket-panel');
  }

  protected renderContent(): void {
    this.setContent('<div class="nba-loading">Loading bracket...</div>');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const games = await getPlayoffGames(2025);
      if (games.length) {
        this.series = this.buildSeriesFromGames(games);
        this.isLiveData = true;
      } else {
        this.series = this.getMockBracket();
        this.isLiveData = false;
      }
    } catch {
      this.series = this.getMockBracket();
      this.isLiveData = false;
    }
    this.renderBracket();
  }

  private buildSeriesFromGames(games: NbaGame[]): BracketSeries[] {
    const seriesMap = new Map<string, {
      teamA: NbaTeam; teamB: NbaTeam;
      winsA: number; winsB: number;
    }>();

    for (const game of games) {
      if (game.status !== 'Final') continue;

      const abbrs = [game.home_team.abbreviation, game.visitor_team.abbreviation].sort();
      const key = abbrs.join('-');

      if (!seriesMap.has(key)) {
        const [first, second] = abbrs[0] === game.home_team.abbreviation
          ? [game.home_team, game.visitor_team]
          : [game.visitor_team, game.home_team];
        seriesMap.set(key, { teamA: first, teamB: second, winsA: 0, winsB: 0 });
      }

      const s = seriesMap.get(key)!;
      const homeWon = game.home_team_score > game.visitor_team_score;
      const winnerAbbr = homeWon ? game.home_team.abbreviation : game.visitor_team.abbreviation;

      if (winnerAbbr === s.teamA.abbreviation) s.winsA++;
      else s.winsB++;
    }

    return Array.from(seriesMap.values()).map((s, i) => ({
      round: 0,
      seed_high: 0,
      seed_low: 0,
      high_team: s.teamA.full_name,
      low_team: s.teamB.full_name,
      high_abbr: s.teamA.abbreviation,
      low_abbr: s.teamB.abbreviation,
      high_wins: s.winsA,
      low_wins: s.winsB,
      format: 'Bo7',
    }));
  }

  private renderBracket(): void {
    if (this.isLiveData) {
      this.renderLiveSeries();
    } else {
      this.renderRoundBracket();
    }
  }

  private renderLiveSeries(): void {
    const html = `
      <div class="nba-bracket-header">
        <h3>2025 NBA Playoffs</h3>
        <span class="nba-live-badge">LIVE</span>
      </div>
      <div class="nba-bracket-series-list">
        ${this.series.map(s => this.renderSeries(s)).join('') || '<p class="nba-empty">No completed playoff games yet</p>'}
      </div>
    `;
    this.setContent(html);
  }

  private renderRoundBracket(): void {
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
          ${series.seed_high ? `<span class="nba-series-seed">${series.seed_high}</span>` : ''}
          <span class="nba-series-abbr">${series.high_abbr}</span>
          <span class="nba-series-wins">${series.high_wins}</span>
        </div>
        <div class="nba-series-team ${!highLeading ? 'leading' : ''}">
          ${series.seed_low ? `<span class="nba-series-seed">${series.seed_low}</span>` : ''}
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
    this.loadData();
  }
}
