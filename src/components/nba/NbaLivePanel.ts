import { Panel } from '../Panel';
import { getTodayGames, type NbaGame } from '@/services/nba/client';

export class NbaLivePanel extends Panel {
  private games: NbaGame[] = [];
  private autoRefresh: ReturnType<typeof setInterval> | null = null;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-live-panel');
  }

  protected renderContent(): void {
    if (this.games.length === 0) {
      this.loadGames();
    } else {
      this.renderGames();
    }
  }

  private renderGames(): void {
    const html = `
      <div class="nba-live-header">
        <span class="nba-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        <span class="nba-game-count">${this.games.length} Games</span>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      <div class="nba-games-list">
        ${this.games.map(g => this.renderGame(g)).join('')}
      </div>
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private renderGame(game: NbaGame): string {
    const isLive = game.status === 'In Progress' || game.status === '2nd Qtr' || game.status === '3rd Qtr' || game.status === '4th Qtr' || game.status === '1st Qtr' || game.status === 'Halftime';
    const isFinal = game.status === 'Final';
    const statusClass = isLive ? 'nba-live' : isFinal ? 'nba-final' : 'nba-scheduled';
    const statusLabel = isLive ? `<span class="nba-pulse">&#9679;</span> ${game.status}` : game.status;
    const homeWinning = game.home_team_score > game.visitor_team_score;

    return `
      <div class="nba-game-card ${statusClass}" data-game-id="${game.id}">
        <div class="nba-game-status ${statusClass}">${statusLabel}</div>
        <div class="nba-game-matchup">
          <div class="nba-team-row ${homeWinning && (isLive || isFinal) ? 'nba-winning' : ''}">
            <span class="nba-team-abbr">${game.visitor_team.abbreviation}</span>
            <span class="nba-team-name">${game.visitor_team.city} ${game.visitor_team.name}</span>
            <span class="nba-team-score">${(isLive || isFinal) ? game.visitor_team_score : ''}</span>
          </div>
          <div class="nba-team-row ${!homeWinning && (isLive || isFinal) ? 'nba-winning' : ''}">
            <span class="nba-team-abbr">${game.home_team.abbreviation}</span>
            <span class="nba-team-name">${game.home_team.city} ${game.home_team.name}</span>
            <span class="nba-team-score">${(isLive || isFinal) ? game.home_team_score : ''}</span>
          </div>
        </div>
        ${isLive ? `<div class="nba-game-period">Q${game.period} ${game.time}</div>` : ''}
        ${game.postseason ? '<div class="nba-playoff-badge">PLAYOFFS</div>' : ''}
      </div>
    `;
  }

  private attachEvents(): void {
    const refreshBtn = this.element.querySelector('.nba-refresh-btn');
    refreshBtn?.addEventListener('click', () => this.loadGames());

    this.element.querySelectorAll('.nba-game-card').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = (card as HTMLElement).dataset.gameId;
        if (gameId) {
          this.element.querySelectorAll('.nba-game-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });
  }

  private async loadGames(): Promise<void> {
    this.showLoading('Loading today\'s games...');
    try {
      this.games = await getTodayGames();
      this.renderGames();
    } catch {
      this.showError('Failed to load NBA games');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadGames();
  }

  public startAutoRefresh(intervalMs: number = 30000): void {
    this.stopAutoRefresh();
    this.autoRefresh = setInterval(() => this.loadGames(), intervalMs);
  }

  public stopAutoRefresh(): void {
    if (this.autoRefresh) {
      clearInterval(this.autoRefresh);
      this.autoRefresh = null;
    }
  }

  public dispose(): void {
    this.stopAutoRefresh();
  }
}
