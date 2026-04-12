import { Panel } from '../Panel';
import { generateTradeSignals, type TradeSignal, type StrategyType } from '@/services/ave/trading-skill';
import { connectWallet, getWalletStatus, executeTrade, switchToBaseNetwork, type WalletStatus } from '@/services/ave/trading';

const STRATEGIES = [
  { value: 'all', label: 'All Strategies' },
  { value: 'momentum', label: 'Momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'breakout', label: 'Breakout' },
] as const;

const CHAINS = [
  { value: 'base', label: 'Base' },
  { value: 'ethereum', label: 'Ethereum' },
] as const;

function formatPrice(price: number): string {
  if (!price || price === 0) return '$0.00';
  if (price < 0.0001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(2)}`;
}

function shortenAddress(address: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

export class TradingPanel extends Panel {
  private signals: TradeSignal[] = [];
  private walletStatus: WalletStatus = { connected: false };
  private selectedStrategy: StrategyType | 'all' = 'all';
  private selectedChain = 'base';
  private executingIds = new Set<string>();

  constructor() {
    super({ id: 'trading', title: 'Trade Execution' });
    this.element.classList.add('trading-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (this.signals.length === 0) {
      this.loadSignals();
    } else {
      this.renderPanel();
    }
  }

  private renderPanel(): void {
    const walletBar = this.walletStatus.connected
      ? `<div class="wallet-bar connected"><span class="dot"></span><span>${shortenAddress(this.walletStatus.address || '')}</span></div>`
      : `<div class="wallet-bar"><button data-action="connect">Connect Wallet</button></div>`;

    const signalList = this.signals.length > 0
      ? this.signals.map(s => this.renderSignal(s)).join('')
      : '<div class="empty">No signals - click refresh</div>';

    this.setContent(`<div class="trading-inner">${walletBar}<div class="signals">${signalList}</div><button data-action="refresh">Refresh</button></div>`);
    this.attachListeners();
  }

  private renderSignal(signal: TradeSignal): string {
    const isBuy = signal.action === 'BUY';
    return `<div class="signal"><span>${signal.symbol}</span><span>${isBuy ? 'BUY' : 'SELL'}</span><span>${signal.confidence}%</span></div>`;
  }

  private attachListeners(): void {
    this.content.querySelector('[data-action="connect"]')?.addEventListener('click', () => this.handleConnect());
    this.content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.loadSignals());
  }

  private async handleConnect(): Promise<void> {
    this.walletStatus = await connectWallet();
    this.renderPanel();
  }

  private async loadSignals(): Promise<void> {
    this.showLoading('Loading...');
    try {
      this.signals = await generateTradeSignals(this.selectedChain);
      this.renderPanel();
    } catch {
      this.showError('Load failed');
    }
  }
}