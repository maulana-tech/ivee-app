import { Panel } from '../Panel';
import { isEnabled } from '@/services/ave/client';
import { getWhaleAlerts, WhaleAlert } from '@/services/ave/monitor';

export class WhaleAlertPanel extends Panel {
  private alerts: WhaleAlert[] = [];
  private selectedPair: string = 'WETH-USDC';
  private chain: string = 'base';
  private loaded: boolean = false;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('whale-alert-panel');
    this.element.classList.add('panel-wide');
  }

  protected renderContent(): void {
    if (this.loaded) {
      this.renderAlerts();
      return;
    }
    this.showLoading('Connecting to AVE...');
    setTimeout(() => this.checkAndLoad(), 100);
  }

  private async checkAndLoad(): Promise<void> {
    const enabled = isEnabled();
    if (!enabled) {
      this.showAveSetup();
      this.loaded = true;
      return;
    }
    this.loaded = true;
    this.renderAlerts();
  }

  private showAveSetup(): void {
    this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">🐋</div>
        <h3>Whale Alert Setup Required</h3>
        <p>Configure AVE Cloud API to enable whale tracking:</p>
        <ol>
          <li>Register at <a href="https://cloud.ave.ai/register" target="_blank">cloud.ave.ai</a></li>
          <li>Get your free API key</li>
          <li>Add to .env.local:
            <code>VITE_AVE_API_KEY=your_key<br>VITE_AVE_ENABLED=true</code>
          </li>
          <li>Restart dev server</li>
        </ol>
      </div>
    `);
  }

  private renderAlerts(): void {
    if (this.alerts.length === 0) {
      this.showLoading('Loading whale activity...');
      this.loadAlerts();
      return;
    }

    const html = `
      <div class="whale-controls">
        <select class="pair-select">
          <option value="WETH-USDC" ${this.selectedPair === 'WETH-USDC' ? 'selected' : ''}>WETH/USDC</option>
          <option value="WETH-WBTC" ${this.selectedPair === 'WETH-WBTC' ? 'selected' : ''}>WETH/WBTC</option>
          <option value="USDC-WBTC" ${this.selectedPair === 'USDC-WBTC' ? 'selected' : ''}>USDC/WBTC</option>
        </select>
        <button class="refresh-btn" title="Refresh">↻</button>
      </div>
      <div class="whale-list">
        ${this.alerts.map(alert => this.renderAlert(alert)).join('')}
      </div>
    `;

    this.setContent(html);
    this.attachEventListeners();
  }

  private renderAlert(alert: WhaleAlert): string {
    const typeEmoji = alert.type === 'buy' ? '🟢' : '🔴';
    const typeClass = alert.type === 'buy' ? 'buy' : 'sell';
    
    return `
      <div class="whale-alert-item ${typeClass}" data-id="${alert.id}">
        <div class="whale-emoji">${typeEmoji}</div>
        <div class="whale-details">
          <div class="whale-token">${alert.tokenSymbol}</div>
          <div class="whale-trader" title="${alert.trader}">${alert.traderShort}</div>
        </div>
        <div class="whale-amount">
          <div class="whale-usd">${this.formatUSD(alert.amountUSD)}</div>
          <div class="whale-time">${alert.timeAgo}</div>
        </div>
      </div>
    `;
  }

  private formatUSD(amount: number): string {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
  }

  private attachEventListeners(): void {
    const pairSelect = this.element.querySelector('.pair-select') as HTMLSelectElement;
    const refreshBtn = this.element.querySelector('.refresh-btn') as HTMLButtonElement;

    pairSelect?.addEventListener('change', (e) => {
      this.selectedPair = (e.target as HTMLSelectElement).value;
      this.loadAlerts();
    });

    refreshBtn?.addEventListener('click', () => {
      this.loadAlerts();
    });
  }

  private async loadAlerts(): Promise<void> {
    this.showLoading('Loading whale activity...');
    try {
      this.alerts = await getWhaleAlerts(this.selectedPair, this.chain, 5000, 20);
      this.renderAlerts();
    } catch (error) {
      this.showError('Failed to load whale alerts');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadAlerts();
  }
}
