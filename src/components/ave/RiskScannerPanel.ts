import { Panel } from '../Panel';
import { scanRisk, type RiskWarning } from '@/services/ave/monitoring';

export class RiskScannerPanel extends Panel {
  private riskWarnings: RiskWarning[] = [];
  private chainFilter: string = 'all';
  private loading = false;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('risk-scanner-panel', 'panel-wide');
    this.loadRiskScan();
  }

  protected renderContent(): void {
    this.loadRiskScan();
  }

  private showDemoWarning(): void {
    this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">🔍</div>
        <h3>Risk Scanner Setup Required</h3>
        <p>Configure AVE Cloud API to enable token risk scanning:</p>
        <ol>
          <li>Register at <a href="https://cloud.ave.ai/register" target="_blank">cloud.ave.ai</a></li>
          <li>Get your free API key</li>
          <li>Add to .env.local:
            <code>VITE_AVE_API_KEY=your_key<br>VITE_AVE_ENABLED=true</code>
          </li>
        </ol>
      </div>
    `);
  }

  private async loadRiskScan(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.showLoading('Scanning trending tokens for risk...');

    try {
      const chain = this.chainFilter === 'all' ? undefined : this.chainFilter;
      const topics = ['hot', 'gainer'] as const;
      const tokenIds: string[] = [];
      const seen = new Set<string>();

      for (const topic of topics) {
        try {
          const tokens = await getTokensByRank(topic, 15);
          for (const t of tokens) {
            if (seen.has(t.token)) continue;
            seen.add(t.token);
            if (chain && t.chain !== chain) continue;
            tokenIds.push(t.token);
          }
        } catch {}
      }

      if (tokenIds.length === 0) {
        this.riskWarnings = [];
        this.renderTable();
        return;
      }

      this.riskWarnings = await scanRisk(tokenIds.slice(0, 10));
      this.renderTable();
    } catch {
      this.showError('Failed to scan tokens for risk');
    } finally {
      this.loading = false;
    }
  }

  private renderTable(): void {
    const html = `
      <div class="risk-scanner-controls">
        <select class="chain-filter">
          <option value="all" ${this.chainFilter === 'all' ? 'selected' : ''}>All Chains</option>
          <option value="base" ${this.chainFilter === 'base' ? 'selected' : ''}>Base</option>
          <option value="ethereum" ${this.chainFilter === 'ethereum' ? 'selected' : ''}>Ethereum</option>
          <option value="solana" ${this.chainFilter === 'solana' ? 'selected' : ''}>Solana</option>
          <option value="bsc" ${this.chainFilter === 'bsc' ? 'selected' : ''}>BSC</option>
        </select>
        <button class="scan-btn" title="Rescan">↻ Scan</button>
      </div>
      ${this.riskWarnings.length === 0
        ? '<div class="empty-state">No risk data available. Click "Scan" to analyze trending tokens.</div>'
        : `
      <div class="risk-table">
        <div class="risk-table-header">
          <span class="col-symbol">Token</span>
          <span class="col-chain">Chain</span>
          <span class="col-score">Risk Score</span>
          <span class="col-warnings">Warnings</span>
        </div>
        ${this.riskWarnings.map(w => this.renderRow(w)).join('')}
      </div>`}
    `;

    this.setContent(html);
    this.attachEventListeners();
  }

  private renderRow(w: RiskWarning): string {
    const scoreColor = w.riskScore > 70 ? '#ff4444' : w.riskScore > 40 ? '#ffaa00' : '#00cc66';
    const scoreLabel = w.riskScore > 70 ? 'HIGH' : w.riskScore > 40 ? 'MEDIUM' : 'LOW';

    return `
      <div class="risk-table-row" data-token="${w.tokenId}">
        <span class="col-symbol">${w.symbol || w.tokenId.slice(0, 8) + '…'}</span>
        <span class="col-chain">${w.chain}</span>
        <span class="col-score">
          <span class="risk-score-badge" style="background: ${scoreColor}">${w.riskScore.toFixed(0)}</span>
          <span class="risk-level-label" style="color: ${scoreColor}">${scoreLabel}</span>
        </span>
        <span class="col-warnings">
          <ul class="warning-list">
            ${w.warnings.map(warn => `<li>${warn}</li>`).join('')}
          </ul>
        </span>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const chainFilter = this.element.querySelector('.chain-filter') as HTMLSelectElement;
    chainFilter?.addEventListener('change', (e) => {
      this.chainFilter = (e.target as HTMLSelectElement).value;
      this.loadRiskScan();
    });

    const scanBtn = this.element.querySelector('.scan-btn');
    scanBtn?.addEventListener('click', () => this.loadRiskScan());
  }

  public async refresh(): Promise<void> {
    await this.loadRiskScan();
  }
}
