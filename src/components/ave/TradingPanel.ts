import { Panel } from '../Panel';
import { isEnabled } from '@/services/ave/client';
import { generateTradeSignals, type TradeSignal, type StrategyType } from '@/services/ave/trading-skill';
import { connectWallet, getWalletStatus, executeTrade, switchToBaseNetwork, type WalletStatus } from '@/services/ave/trading';

const STRATEGIES: Array<{ value: StrategyType | 'all'; label: string }> = [
  { value: 'all', label: 'All Strategies' },
  { value: 'momentum', label: 'Momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'breakout', label: 'Breakout' },
  { value: 'volume_profile', label: 'Volume Profile' },
  { value: 'whale_following', label: 'Whale Following' },
];

const CHAINS = [
  { value: 'base', label: 'Base' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'solana', label: 'Solana' },
  { value: 'bsc', label: 'BSC' },
];

function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.0001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(2)}`;
}

function formatUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export class TradingPanel extends Panel {
  private signals: TradeSignal[] = [];
  private walletStatus: WalletStatus = { connected: false };
  private selectedStrategy: StrategyType | 'all' = 'all';
  private selectedChain: string = 'base';
  private executingIds = new Set<string>();

  constructor() {
    super({ id: 'trading', title: 'Trade Execution' });
    this.element.classList.add('trading-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (!isEnabled()) {
      this.showSetupRequired();
      return;
    }
    this.renderPanel();
  }

  private showSetupRequired(): void {
    this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">📊</div>
        <h3>Trading Skill Setup Required</h3>
        <p>Configure AVE Cloud API to enable trade execution:</p>
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

  private renderPanel(): void {
    const walletBar = this.walletStatus.connected
      ? `<div class="wallet-bar connected">
           <span class="wallet-status-dot"></span>
           <span class="wallet-addr">${shortenAddress(this.walletStatus.address!)}</span>
         </div>`
      : `<div class="wallet-bar disconnected">
           <button class="connect-wallet-btn" data-action="connect">Connect Wallet</button>
         </div>`;

    const strategyOptions = STRATEGIES.map(s =>
      `<option value="${s.value}" ${this.selectedStrategy === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    const chainOptions = CHAINS.map(c =>
      `<option value="${c.value}" ${this.selectedChain === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const signalList = this.signals.length > 0
      ? this.signals.map(s => this.renderSignal(s)).join('')
      : '<div class="no-signals">No signals found. Try adjusting filters.</div>';

    this.setContent(`
      <div class="trading-panel-inner">
        ${walletBar}
        <div class="trading-controls">
          <select class="strategy-select" data-action="strategy">${strategyOptions}</select>
          <select class="chain-select" data-action="chain">${chainOptions}</select>
          <button class="refresh-btn" data-action="refresh" title="Refresh signals">↻</button>
        </div>
        <div class="signal-list">
          ${signalList}
        </div>
      </div>
    `);

    this.attachListeners();
  }

  private renderSignal(signal: TradeSignal): string {
    const isBuy = signal.action === 'BUY';
    const actionClass = isBuy ? 'action-buy' : 'action-sell';
    const actionLabel = isBuy ? 'BUY' : 'SELL';
    const confidenceColor = signal.confidence >= 70 ? '#22c55e' : signal.confidence >= 40 ? '#eab308' : '#ef4444';
    const isExecuting = this.executingIds.has(signal.id);
    const disabled = !this.walletStatus.connected || isExecuting;

    return `
      <div class="signal-card" data-signal-id="${signal.id}">
        <div class="signal-header">
          <span class="signal-symbol">${signal.symbol}</span>
          <span class="signal-chain">${signal.chain}</span>
          <span class="signal-action ${actionClass}">${actionLabel}</span>
        </div>
        <div class="signal-confidence">
          <div class="confidence-bar-track">
            <div class="confidence-bar-fill" style="width:${signal.confidence}%;background:${confidenceColor}"></div>
          </div>
          <span class="confidence-value">${signal.confidence}%</span>
        </div>
        <div class="signal-prices">
          <div class="price-item"><span class="price-label">Entry</span><span class="price-value">${formatPrice(signal.entryPrice)}</span></div>
          <div class="price-item"><span class="price-label">Target</span><span class="price-value">${formatPrice(signal.targetPrice)}</span></div>
          <div class="price-item"><span class="price-label">Stop</span><span class="price-value">${formatPrice(signal.stopLoss)}</span></div>
        </div>
        <div class="signal-reason">${signal.reason}</div>
        <div class="signal-footer">
          <span class="signal-strategy">${signal.strategy.replace('_', ' ')}</span>
          <button class="execute-btn ${actionClass}" data-action="execute" data-signal-id="${signal.id}" ${disabled ? 'disabled' : ''}>
            ${isExecuting ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>
    `;
  }

  private attachListeners(): void {
    const content = this.content;

    content.querySelector('[data-action="connect"]')?.addEventListener('click', () => this.handleConnectWallet());
    content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.loadSignals());

    const strategySelect = content.querySelector('[data-action="strategy"]') as HTMLSelectElement | null;
    strategySelect?.addEventListener('change', () => {
      this.selectedStrategy = strategySelect.value as StrategyType | 'all';
      this.loadSignals();
    });

    const chainSelect = content.querySelector('[data-action="chain"]') as HTMLSelectElement | null;
    chainSelect?.addEventListener('change', () => {
      this.selectedChain = chainSelect.value;
      this.loadSignals();
    });

    content.querySelectorAll('[data-action="execute"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const signalId = (btn as HTMLElement).dataset.signalId;
        const signal = this.signals.find(s => s.id === signalId);
        if (signal) this.handleExecute(signal);
      });
    });
  }

  private async handleConnectWallet(): Promise<void> {
    try {
      this.walletStatus = await connectWallet();
      if (!this.walletStatus.connected) {
        await switchToBaseNetwork();
        this.walletStatus = await getWalletStatus();
      }
      this.renderPanel();
    } catch {
      this.showError('Failed to connect wallet');
    }
  }

  private async handleExecute(signal: TradeSignal): Promise<void> {
    if (!this.walletStatus.connected || this.executingIds.has(signal.id)) return;

    this.executingIds.add(signal.id);
    this.renderPanel();

    try {
      const result = await executeTrade({
        token: signal.tokenId,
        amount: 100,
        type: signal.action === 'BUY' ? 'buy' : 'sell',
        chain: signal.chain,
        slippage: 0.5,
      });

      if (result.success) {
        this.executingIds.delete(signal.id);
        this.renderPanel();
      } else {
        this.executingIds.delete(signal.id);
        this.showError(result.error || 'Trade failed');
      }
    } catch {
      this.executingIds.delete(signal.id);
      this.showError('Trade execution failed');
    }
  }

  private async loadSignals(): Promise<void> {
    this.showLoading('Generating trade signals...');
    try {
      const strategy = this.selectedStrategy === 'all' ? undefined : this.selectedStrategy;
      const chain = this.selectedChain === 'all' ? undefined : this.selectedChain;
      this.signals = await generateTradeSignals(chain, strategy);
      this.renderPanel();
    } catch {
      this.showError('Failed to generate trade signals');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadSignals();
  }

  public load(): void {
    if (!isEnabled()) {
      this.showSetupRequired();
      return;
    }
    this.loadSignals();
  }
}
