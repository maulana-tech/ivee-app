import { Panel } from '../Panel';
import { fetchPortfolio, formatCurrency, formatPercent, addPosition, removePosition, PortfolioPosition } from '@/services/ave/portfolio';

export class PortfolioPanel extends Panel {
  private totalValue: number = 0;
  private change24h: number = 0;
  private holdings: any[] = [];

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('portfolio-panel');
    this.loadPortfolio();
  }

  protected renderContent(): void {
    this.renderPortfolio();
  }

  private renderPortfolio(): void {
    if (this.holdings.length === 0) {
      this.showEmptyPortfolio();
      return;
    }

    const changeColor = this.change24h >= 0 ? '#00ff00' : '#ff4444';
    
    const html = `
      <div class="portfolio-summary">
        <div class="portfolio-total">
          <div class="total-label">Total Value</div>
          <div class="total-value">${formatCurrency(this.totalValue)}</div>
          <div class="total-change" style="color: ${changeColor}">
            ${formatPercent(this.change24h / (this.totalValue - this.change24h) * 100 || 0)} today
          </div>
        </div>
        <button class="add-position-btn">+ Add</button>
      </div>
      <div class="holdings-list">
        ${this.holdings.map((h, i) => `
          <div class="holding-item" data-index="${i}">
            <div class="holding-token">
              <span class="token-symbol">${h.symbol}</span>
              <span class="token-chain">${h.chain}</span>
            </div>
            <div class="holding-balance">
              <span class="balance-amount">${h.balance.toFixed(4)}</span>
              <span class="balance-value">${formatCurrency(h.valueUSD)}</span>
            </div>
            <div class="holding-pnl" style="color: ${h.pnl >= 0 ? '#00ff00' : '#ff4444'}">
              ${formatCurrency(h.pnl)} (${formatPercent(h.pnlPercent)})
            </div>
            <button class="remove-btn" title="Remove">×</button>
          </div>
        `).join('')}
      </div>
    `;

    this.setContent(html);
    this.attachEventListeners();
  }

  private showEmptyPortfolio(): void {
    this.setContent(`
      <div class="portfolio-empty">
        <div class="empty-icon">💼</div>
        <h3>No Positions Yet</h3>
        <p>Add your crypto holdings to track P&L</p>
        <button class="add-position-btn">+ Add First Position</button>
      </div>
      ${this.renderAddPositionForm()}
    `);
    this.attachEventListeners();
  }

  private renderAddPositionForm(): string {
    return `
      <div class="add-position-form" style="display: none;">
        <div class="form-group">
          <label>Token Address</label>
          <input type="text" class="token-address" placeholder="0x...">
        </div>
        <div class="form-group">
          <label>Symbol</label>
          <input type="text" class="token-symbol" placeholder="e.g., PEPE">
        </div>
        <div class="form-group">
          <label>Chain</label>
          <select class="token-chain">
            <option value="base">Base</option>
            <option value="ethereum">Ethereum</option>
            <option value="bsc">BSC</option>
            <option value="solana">Solana</option>
          </select>
        </div>
        <div class="form-group">
          <label>Balance</label>
          <input type="number" class="token-balance" placeholder="0.00" step="any">
        </div>
        <div class="form-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn">Add Position</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const addBtn = this.element.querySelector('.add-position-btn') as HTMLButtonElement;
    const form = this.element.querySelector('.add-position-form') as HTMLElement;
    const cancelBtn = this.element.querySelector('.cancel-btn') as HTMLButtonElement;
    const saveBtn = this.element.querySelector('.save-btn') as HTMLButtonElement;
    const refreshBtn = this.element.querySelector('.refresh-btn') as HTMLButtonElement;

    addBtn?.addEventListener('click', () => {
      if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      }
    });

    cancelBtn?.addEventListener('click', () => {
      if (form) form.style.display = 'none';
    });

    saveBtn?.addEventListener('click', () => this.savePosition());
    
    refreshBtn?.addEventListener('click', () => {
      this.loadPortfolio();
    });

    // Remove buttons
    this.element.querySelectorAll('.remove-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const holding = this.holdings[i];
        if (holding) {
          removePosition(holding.token, holding.chain);
          this.loadPortfolio();
        }
      });
    });
  }

  private async savePosition(): Promise<void> {
    const addressInput = this.element.querySelector('.token-address') as HTMLInputElement;
    const symbolInput = this.element.querySelector('.token-symbol') as HTMLInputElement;
    const chainSelect = this.element.querySelector('.token-chain') as HTMLSelectElement;
    const balanceInput = this.element.querySelector('.token-balance') as HTMLInputElement;

    const position: PortfolioPosition = {
      token: addressInput.value,
      symbol: symbolInput.value.toUpperCase(),
      chain: chainSelect.value,
      balance: parseFloat(balanceInput.value) || 0,
    };

    if (position.token && position.symbol && position.balance > 0) {
      addPosition(position);
      const form = this.element.querySelector('.add-position-form') as HTMLElement;
      if (form) form.style.display = 'none';
      this.loadPortfolio();
    }
  }

  private async loadPortfolio(): Promise<void> {
    this.showLoading('Loading portfolio...');
    try {
      const portfolio = await fetchPortfolio();
      this.totalValue = portfolio.totalValue;
      this.change24h = portfolio.change24h;
      this.holdings = portfolio.holdings;
      this.renderPortfolio();
    } catch (error) {
      this.showError('Failed to load portfolio');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadPortfolio();
  }
}
