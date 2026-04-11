import { Panel } from '../Panel';
import { isEnabled, searchTokens } from '@/services/ave/client';
import { getPriceAlerts, addPriceAlert, removePriceAlert, type PriceAlert } from '@/services/ave/monitoring';

export class PriceAlertPanel extends Panel {
  private alerts: PriceAlert[] = [];
  private showForm = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private searchResults: { id: string; symbol: string; chain: string }[] = [];

  constructor() {
    super({ id: 'price-alerts', title: 'Price Alerts' });
    this.element.classList.add('price-alert-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (!isEnabled()) {
      this.showSetupRequired();
      return;
    }
    this.alerts = getPriceAlerts();
    this.renderAlerts();
    this.startAutoRefresh();
  }

  private showSetupRequired(): void {
    this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">🔔</div>
        <h3>Price Alerts Setup Required</h3>
        <p>Configure AVE Cloud API to enable price alerts:</p>
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

  private startAutoRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      this.alerts = getPriceAlerts();
      this.renderAlerts();
    }, 60_000);
  }

  private renderAlerts(): void {
    const triggeredCount = this.alerts.filter(a => a.triggered).length;
    const pendingCount = this.alerts.filter(a => !a.triggered).length;

    const html = `
      <div class="price-alert-controls">
        <span class="alert-summary">${triggeredCount} triggered · ${pendingCount} pending</span>
        <button class="add-alert-btn">${this.showForm ? 'Cancel' : '+ Add Alert'}</button>
      </div>
      ${this.showForm ? this.renderForm() : ''}
      <div class="price-alert-list">
        ${this.alerts.length === 0
          ? '<div class="empty-state">No price alerts configured. Click "+ Add Alert" to create one.</div>'
          : this.alerts.map(alert => this.renderAlert(alert)).join('')
        }
      </div>
    `;

    this.setContent(html);
    this.attachEventListeners();
  }

  private renderForm(): string {
    return `
      <div class="price-alert-form">
        <input type="text" class="alert-token-search" placeholder="Search token symbol or address...">
        <div class="alert-search-results"></div>
        <select class="alert-chain-select">
          <option value="base">Base</option>
          <option value="ethereum">Ethereum</option>
          <option value="solana">Solana</option>
          <option value="bsc">BSC</option>
        </select>
        <select class="alert-type-select">
          <option value="above">Above</option>
          <option value="below">Below</option>
          <option value="stop_loss">Stop Loss</option>
          <option value="take_profit">Take Profit</option>
        </select>
        <input type="number" class="alert-target-price" placeholder="Target price (USD)" step="any">
        <button class="submit-alert-btn">Create Alert</button>
      </div>
    `;
  }

  private renderAlert(alert: PriceAlert): string {
    const statusClass = alert.triggered ? 'triggered' : 'pending';
    const statusColor = alert.triggered ? '#00ff00' : '#ffaa00';
    const typeLabel = alert.type.replace('_', ' ').toUpperCase();
    const priceDiff = alert.currentPrice > 0
      ? (((alert.targetPrice - alert.currentPrice) / alert.currentPrice) * 100).toFixed(2)
      : '—';

    return `
      <div class="price-alert-item ${statusClass}" data-id="${alert.id}">
        <div class="alert-info">
          <span class="alert-symbol">${alert.symbol}</span>
          <span class="alert-chain">${alert.chain}</span>
        </div>
        <div class="alert-type">${typeLabel}</div>
        <div class="alert-prices">
          <div class="alert-target">Target: $${alert.targetPrice.toFixed(6)}</div>
          <div class="alert-current">Current: $${alert.currentPrice.toFixed(6)}</div>
          <div class="alert-diff">${priceDiff !== '—' ? `${priceDiff}%` : '—'}</div>
        </div>
        <div class="alert-status" style="color: ${statusColor}">
          ${alert.triggered ? 'TRIGGERED' : 'PENDING'}
        </div>
        <button class="remove-alert-btn" data-id="${alert.id}" title="Remove">✕</button>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const addBtn = this.element.querySelector('.add-alert-btn');
    addBtn?.addEventListener('click', () => {
      this.showForm = !this.showForm;
      this.renderAlerts();
    });

    const submitBtn = this.element.querySelector('.submit-alert-btn');
    submitBtn?.addEventListener('click', () => this.handleAddAlert());

    this.element.querySelectorAll('.remove-alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) {
          removePriceAlert(id);
          this.alerts = getPriceAlerts();
          this.renderAlerts();
        }
      });
    });

    const searchInput = this.element.querySelector('.alert-token-search') as HTMLInputElement;
    if (searchInput) {
      let searchTimeout: ReturnType<typeof setTimeout>;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => this.handleTokenSearch(searchInput.value), 300);
      });
    }
  }

  private async handleTokenSearch(query: string): Promise<void> {
    if (query.length < 2) {
      this.searchResults = [];
      const resultsDiv = this.element.querySelector('.alert-search-results');
      if (resultsDiv) resultsDiv.innerHTML = '';
      return;
    }

    const chain = (this.element.querySelector('.alert-chain-select') as HTMLSelectElement)?.value || 'base';
    try {
      const results = await searchTokens(query, chain);
      this.searchResults = results.map(r => ({ id: r.id, symbol: r.symbol, chain: r.chain }));
      const resultsDiv = this.element.querySelector('.alert-search-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = this.searchResults.map((r, i) =>
          `<div class="search-result-item" data-index="${i}">${r.symbol} (${r.chain})</div>`
        ).join('');
        resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0');
            const selected = this.searchResults[idx];
            if (selected) {
              const input = this.element.querySelector('.alert-token-search') as HTMLInputElement;
              if (input) {
                input.value = selected.symbol;
                input.dataset.tokenId = selected.id;
                input.dataset.chain = selected.chain;
              }
              resultsDiv.innerHTML = '';
            }
          });
        });
      }
    } catch {}
  }

  private handleAddAlert(): void {
    const searchInput = this.element.querySelector('.alert-token-search') as HTMLInputElement;
    const chainSelect = this.element.querySelector('.alert-chain-select') as HTMLSelectElement;
    const typeSelect = this.element.querySelector('.alert-type-select') as HTMLSelectElement;
    const priceInput = this.element.querySelector('.alert-target-price') as HTMLInputElement;

    const tokenId = searchInput?.dataset.tokenId;
    const symbol = searchInput?.value?.trim();
    const chain = chainSelect?.value || 'base';
    const type = (typeSelect?.value || 'above') as PriceAlert['type'];
    const targetPrice = parseFloat(priceInput?.value || '0');

    if (!tokenId || !symbol || !targetPrice || targetPrice <= 0) return;

    addPriceAlert({
      tokenId,
      symbol,
      chain,
      type,
      targetPrice,
      currentPrice: 0,
    });

    this.showForm = false;
    this.alerts = getPriceAlerts();
    this.renderAlerts();
  }

  public async refresh(): Promise<void> {
    this.alerts = getPriceAlerts();
    this.renderAlerts();
  }

  public destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    super.destroy();
  }
}
