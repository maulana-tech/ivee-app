import { Panel } from '../Panel';
import { getInjuries, type InjuryReport } from '@/services/nba/client';

export class NbaInjuryPanel extends Panel {
  private injuries: InjuryReport[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-injury-panel');
  }

  protected renderContent(): void {
    if (this.injuries.length === 0) {
      this.loadInjuries();
    } else {
      this.renderInjuries();
    }
  }

  private renderInjuries(): void {
    const grouped = this.groupByTeam();

    const html = `
      <div class="nba-injury-header">
        <span class="nba-injury-count">${this.injuries.length} Players</span>
        <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
      </div>
      <div class="nba-injury-list">
        ${Object.entries(grouped).map(([team, players]) => this.renderTeamInjuries(team, players)).join('')}
      </div>
    `;
    this.setContent(html);
    this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadInjuries());
  }

  private renderTeamInjuries(team: string, players: InjuryReport[]): string {
    return `
      <div class="nba-injury-team">
        <h4 class="nba-injury-team-name">${team}</h4>
        ${players.map(p => this.renderInjuryRow(p)).join('')}
      </div>
    `;
  }

  private renderInjuryRow(injury: InjuryReport): string {
    const statusClass = injury.status?.toLowerCase().includes('out') ? 'nba-status-out'
      : injury.status?.toLowerCase().includes('questionable') ? 'nba-status-q'
      : injury.status?.toLowerCase().includes('probable') ? 'nba-status-prob'
      : 'nba-status-day';

    return `
      <div class="nba-injury-row">
        <span class="nba-injury-player">${injury.player.first_name} ${injury.player.last_name}</span>
        <span class="nba-injury-status ${statusClass}">${injury.status || 'Day-to-Day'}</span>
        <span class="nba-injury-comment">${injury.comment || ''}</span>
      </div>
    `;
  }

  private groupByTeam(): Record<string, InjuryReport[]> {
    const map: Record<string, InjuryReport[]> = {};
    for (const injury of this.injuries) {
      const team = injury.team?.full_name || 'Unknown';
      if (!map[team]) map[team] = [];
      map[team].push(injury);
    }
    return map;
  }

  private async loadInjuries(): Promise<void> {
    this.showLoading('Loading injury reports...');
    try {
      this.injuries = await getInjuries();
      this.renderInjuries();
    } catch {
      this.setContent(`
        <div class="nba-injury-header">
          <span>Injury Report</span>
          <button class="nba-refresh-btn" title="Refresh">&#8635;</button>
        </div>
        <div class="nba-injury-empty">
          <p>Injury data will be available during the playoff season.</p>
          <p class="nba-hint">Configure VITE_NBA_API_KEY in .env.local for live data.</p>
        </div>
      `);
      this.element.querySelector('.nba-refresh-btn')?.addEventListener('click', () => this.loadInjuries());
    }
  }

  public async refresh(): Promise<void> {
    await this.loadInjuries();
  }
}
