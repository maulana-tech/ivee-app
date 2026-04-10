import { Panel } from '../Panel';
import { executeTrade, getWalletStatus } from '@/services/ave/trading';
export class TradingPanel extends Panel {
    constructor(options) {
        super(options);
        Object.defineProperty(this, "walletAddress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isConnected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "selectedToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "tradeType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'buy'
        });
        Object.defineProperty(this, "amount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        this.element.classList.add('trading-panel');
    }
    renderContent() {
        this.renderTradingInterface();
    }
    renderTradingInterface() {
        const html = `
      <div class="trading-container">
        <div class="wallet-section">
          ${this.isConnected ? this.renderConnectedWallet() : this.renderConnectWallet()}
        </div>
        
        ${this.isConnected ? `
          <div class="trade-form">
            <div class="trade-type-selector">
              <button class="trade-type-btn ${this.tradeType === 'buy' ? 'active' : ''}" data-type="buy">Buy</button>
              <button class="trade-type-btn ${this.tradeType === 'sell' ? 'active' : ''}" data-type="sell">Sell</button>
            </div>
            
            <div class="form-group">
              <label>Token</label>
              <div class="token-input-wrapper">
                <input type="text" class="token-input" placeholder="0x..." value="${this.selectedToken}">
                <div class="token-suggestions">
                  <button class="token-suggestion" data-token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC</button>
                  <button class="token-suggestion" data-token="0x4200000000000000000000000000000000000006">WETH</button>
                  <button class="token-suggestion" data-token="0x532f7910193E54082937F0446F70f8fF5D8f21c1">CBTC</button>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label>Amount</label>
              <input type="number" class="amount-input" placeholder="0.00" value="${this.amount}">
              <div class="quick-amounts">
                <button class="quick-amount" data-amount="10">10</button>
                <button class="quick-amount" data-amount="50">50</button>
                <button class="quick-amount" data-amount="100">100</button>
                <button class="quick-amount" data-amount="all">ALL</button>
              </div>
            </div>
            
            <div class="trade-summary">
              <div class="summary-row">
                <span>Price</span>
                <span class="price-value">$1.00</span>
              </div>
              <div class="summary-row">
                <span>Fee</span>
                <span class="fee-value">~$0.50</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span class="total-value">$0.00</span>
              </div>
            </div>
            
            <button class="execute-trade-btn ${this.tradeType}">
              ${this.tradeType === 'buy' ? 'Buy' : 'Sell'} Token
            </button>
            
            <div class="trade-status"></div>
          </div>
          
          <div class="recent-trades">
            <h4>Recent Trades</h4>
            <div class="trades-list">
              <p class="no-trades">No trades yet</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
        this.setContent(html);
        this.attachEventListeners();
    }
    renderConnectWallet() {
        return `
      <div class="wallet-connect">
        <div class="wallet-icon">👛</div>
        <h3>Connect Wallet</h3>
        <p>Connect your wallet to start trading on Base chain</p>
        <button class="connect-wallet-btn">Connect Wallet</button>
        <p class="wallet-note">Supported: MetaMask, WalletConnect, Coinbase Wallet</p>
      </div>
    `;
    }
    renderConnectedWallet() {
        return `
      <div class="wallet-info">
        <div class="wallet-status connected">
          <span class="status-dot"></span>
          <span class="status-text">Connected</span>
        </div>
        <div class="wallet-address">
          ${this.walletAddress?.slice(0, 6)}...${this.walletAddress?.slice(-4)}
        </div>
        <button class="disconnect-btn">Disconnect</button>
      </div>
    `;
    }
    attachEventListeners() {
        const connectBtn = this.element.querySelector('.connect-wallet-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }
        const tradeTypeBtns = this.element.querySelectorAll('.trade-type-btn');
        tradeTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.tradeType = btn.dataset.type;
                this.renderTradingInterface();
            });
        });
        const tokenSuggestions = this.element.querySelectorAll('.token-suggestion');
        tokenSuggestions.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedToken = btn.dataset.token || '';
                this.renderTradingInterface();
            });
        });
        const quickAmounts = this.element.querySelectorAll('.quick-amount');
        quickAmounts.forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                const amountInput = this.element.querySelector('.amount-input');
                if (amountInput) {
                    amountInput.value = amount === 'all' ? '1000' : amount || '';
                    this.amount = amountInput.value;
                }
            });
        });
        const amountInput = this.element.querySelector('.amount-input');
        if (amountInput) {
            amountInput.addEventListener('input', (e) => {
                this.amount = e.target.value;
                this.updateTradeSummary();
            });
        }
        const executeBtn = this.element.querySelector('.execute-trade-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeTrade());
        }
        const disconnectBtn = this.element.querySelector('.disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectWallet());
        }
    }
    async connectWallet() {
        try {
            const status = await getWalletStatus();
            if (status.connected) {
                this.isConnected = true;
                this.walletAddress = status.address || null;
                this.renderTradingInterface();
            }
            else {
                this.showStatus('Please install a Web3 wallet extension', 'warning');
            }
        }
        catch {
            this.showStatus('Failed to connect wallet', 'error');
        }
    }
    disconnectWallet() {
        this.isConnected = false;
        this.walletAddress = null;
        this.renderTradingInterface();
    }
    async executeTrade() {
        if (!this.selectedToken || !this.amount) {
            this.showStatus('Please fill in all fields', 'warning');
            return;
        }
        const executeBtn = this.element.querySelector('.execute-trade-btn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.textContent = 'Processing...';
        }
        try {
            const tradeRequest = {
                token: this.selectedToken,
                amount: parseFloat(this.amount),
                type: this.tradeType,
                chain: 'base',
                slippage: 0.5,
            };
            const result = await executeTrade(tradeRequest);
            if (result.success) {
                this.showStatus(`Trade successful! Tx: ${result.txHash?.slice(0, 10)}...`, 'success');
                this.amount = '';
                this.renderTradingInterface();
            }
            else {
                this.showStatus(`Trade failed: ${result.error}`, 'error');
            }
        }
        catch {
            this.showStatus('Trade execution failed', 'error');
        }
        finally {
            if (executeBtn) {
                executeBtn.disabled = false;
                executeBtn.textContent = `${this.tradeType === 'buy' ? 'Buy' : 'Sell'} Token`;
            }
        }
    }
    updateTradeSummary() {
        const priceValue = this.element.querySelector('.price-value');
        const totalValue = this.element.querySelector('.total-value');
        if (priceValue && totalValue) {
            const amount = parseFloat(this.amount) || 0;
            totalValue.textContent = `$${amount.toFixed(2)}`;
        }
    }
    showStatus(message, type) {
        const statusEl = this.element.querySelector('.trade-status');
        if (statusEl) {
            statusEl.className = `trade-status ${type}`;
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            if (type !== 'error') {
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 5000);
            }
        }
    }
}
