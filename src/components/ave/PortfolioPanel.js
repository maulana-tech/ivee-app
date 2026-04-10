import { Panel } from '../Panel';
import { fetchPortfolio, formatCurrency, formatPercent, addPosition, removePosition } from '@/services/ave/portfolio';
export class PortfolioPanel extends Panel {
    constructor(options) {
        super(options);
        Object.defineProperty(this, "totalValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "change24h", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "holdings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.element.classList.add('portfolio-panel');
    }
    renderContent() {
        this.renderPortfolio();
    }
    renderPortfolio() {
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
    showEmptyPortfolio() {
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
    renderAddPositionForm() {
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
    attachEventListeners() {
        const addBtn = this.element.querySelector('.add-position-btn');
        const form = this.element.querySelector('.add-position-form');
        const cancelBtn = this.element.querySelector('.cancel-btn');
        const saveBtn = this.element.querySelector('.save-btn');
        const refreshBtn = this.element.querySelector('.refresh-btn');
        addBtn?.addEventListener('click', () => {
            if (form) {
                form.style.display = form.style.display === 'none' ? 'block' : 'none';
            }
        });
        cancelBtn?.addEventListener('click', () => {
            if (form)
                form.style.display = 'none';
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
    async savePosition() {
        const addressInput = this.element.querySelector('.token-address');
        const symbolInput = this.element.querySelector('.token-symbol');
        const chainSelect = this.element.querySelector('.token-chain');
        const balanceInput = this.element.querySelector('.token-balance');
        const position = {
            token: addressInput.value,
            symbol: symbolInput.value.toUpperCase(),
            chain: chainSelect.value,
            balance: parseFloat(balanceInput.value) || 0,
        };
        if (position.token && position.symbol && position.balance > 0) {
            addPosition(position);
            const form = this.element.querySelector('.add-position-form');
            if (form)
                form.style.display = 'none';
            this.loadPortfolio();
        }
    }
    async loadPortfolio() {
        this.showLoading('Loading portfolio...');
        try {
            const portfolio = await fetchPortfolio();
            this.totalValue = portfolio.totalValue;
            this.change24h = portfolio.change24h;
            this.holdings = portfolio.holdings;
            this.renderPortfolio();
        }
        catch (error) {
            this.showError('Failed to load portfolio');
        }
    }
    async refresh() {
        await this.loadPortfolio();
    }
}
