import { Panel } from '../Panel';
import { isEnabled } from '@/services/ave/client';
import { backtestStrategy, type BacktestResult, type StrategyType } from '@/services/ave/trading-skill';

const STRATEGIES: Array<{ value: StrategyType; label: string }> = [
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

const PERIODS: Array<{ value: number; label: string }> = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const QUICK_TOKENS = [
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', chain: 'base' },
  { address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', symbol: 'cbETH', chain: 'base' },
  { address: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', symbol: 'AERO', chain: 'base' },
  { address: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', symbol: 'WEWE', chain: 'base' },
  { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', chain: 'base' },
];

export class BacktestPanel extends Panel {
  private result: BacktestResult | null = null;
  private tokenInput: string = '';
  private selectedStrategy: StrategyType = 'momentum';
  private selectedChain: string = 'base';
  private selectedPeriod: number = 7;
  private loading = false;

  constructor() {
    super({ id: 'backtest', title: 'Strategy Backtest' });
    this.element.classList.add('backtest-panel');
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
        <div class="ave-icon">📈</div>
        <h3>Backtest Setup Required</h3>
        <p>Configure AVE Cloud API to enable strategy backtesting:</p>
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
    const strategyOptions = STRATEGIES.map(s =>
      `<option value="${s.value}" ${this.selectedStrategy === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    const chainOptions = CHAINS.map(c =>
      `<option value="${c.value}" ${this.selectedChain === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const periodOptions = PERIODS.map(p =>
      `<option value="${p.value}" ${this.selectedPeriod === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const resultsHtml = this.loading
      ? ''
      : this.result
        ? this.renderResults()
        : '<div class="no-results">Enter a token and run a backtest to see results.</div>';

    this.setContent(`
      <div class="backtest-panel-inner">
        <div class="backtest-controls">
          <input type="text" class="token-input" placeholder="Token address or symbol" value="${this.tokenInput}" data-field="token">
          <div class="quick-tokens">
            ${QUICK_TOKENS.map(t => `<button class="quick-token-btn" data-token="${t.address}" title="${t.symbol}">${t.symbol}</button>`).join('')}
          </div>
          <select data-field="chain">${chainOptions}</select>
          <select data-field="strategy">${strategyOptions}</select>
          <select data-field="period">${periodOptions}</select>
          <button class="run-backtest-btn" data-action="run" ${this.loading ? 'disabled' : ''}>
            ${this.loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>
        ${resultsHtml}
      </div>
    `);

    this.attachListeners();
  }

  private renderResults(): string {
    const r = this.result!;
    const winRateColor = r.winRate >= 55 ? '#22c55e' : r.winRate >= 40 ? '#eab308' : '#ef4444';
    const returnColor = r.totalReturn >= 0 ? '#22c55e' : '#ef4444';
    const drawdownColor = r.maxDrawdown <= 10 ? '#22c55e' : r.maxDrawdown <= 25 ? '#eab308' : '#ef4444';

    const tradeRows = r.signals.length > 0
      ? r.signals.map(s => {
          const isBuy = s.action === 'BUY';
          const pnlHtml = s.pnl !== undefined
            ? `<span class="trade-pnl ${s.pnl >= 0 ? 'positive' : 'negative'}">${s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(6)}</span>`
            : '';
          return `
            <tr class="trade-row">
              <td>${formatDate(s.time * 1000)}</td>
              <td class="${isBuy ? 'action-buy' : 'action-sell'}">${s.action}</td>
              <td>$${s.price.toFixed(6)}</td>
              <td>${pnlHtml}</td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="4" class="no-trades">No simulated trades</td></tr>';

    return `
      <div class="backtest-results">
        <div class="backtest-summary">
          <div class="summary-card">
            <span class="summary-label">Win Rate</span>
            <span class="summary-value" style="color:${winRateColor}">${r.winRate.toFixed(1)}%</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Total Return</span>
            <span class="summary-value" style="color:${returnColor}">${formatPercent(r.totalReturn)}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Max Drawdown</span>
            <span class="summary-value" style="color:${drawdownColor}">-${r.maxDrawdown.toFixed(2)}%</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Sharpe Ratio</span>
            <span class="summary-value">${r.sharpeRatio.toFixed(2)}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Total Trades</span>
            <span class="summary-value">${r.trades}</span>
          </div>
        </div>
        <div class="backtest-meta">
          <span>${r.symbol} · ${r.strategy.replace('_', ' ')} · ${formatDate(r.startDate)} - ${formatDate(r.endDate)}</span>
        </div>
        <div class="trade-log">
          <table class="trade-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Price</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              ${tradeRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private attachListeners(): void {
    const content = this.content;

    content.querySelector('[data-action="run"]')?.addEventListener('click', () => this.runBacktest());

    content.querySelector('[data-field="token"]')?.addEventListener('input', (e) => {
      this.tokenInput = (e.target as HTMLInputElement).value;
    });

    content.querySelectorAll('.quick-token-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const address = (e.target as HTMLElement).getAttribute('data-token') || '';
        this.tokenInput = address;
        const input = content.querySelector('[data-field="token"]') as HTMLInputElement;
        if (input) input.value = address;
      });
    });

    content.querySelector('[data-field="strategy"]')?.addEventListener('change', (e) => {
      this.selectedStrategy = (e.target as HTMLSelectElement).value as StrategyType;
    });

    content.querySelector('[data-field="chain"]')?.addEventListener('change', (e) => {
      this.selectedChain = (e.target as HTMLSelectElement).value;
    });

    content.querySelector('[data-field="period"]')?.addEventListener('change', (e) => {
      this.selectedPeriod = parseInt((e.target as HTMLSelectElement).value, 10);
    });
  }

  private async runBacktest(): Promise<void> {
    if (this.loading) return;

    const token = this.tokenInput.trim();
    if (!token) {
      this.showError('Enter a token address or symbol');
      return;
    }

    this.loading = true;
    this.result = null;
    this.showLoading('Running backtest...');

    try {
      this.result = await backtestStrategy(token, this.selectedStrategy, this.selectedPeriod);
      this.loading = false;
      this.renderPanel();
    } catch {
      this.loading = false;
      this.showError('Backtest failed. Check the token address and try again.');
    }
  }

  public async refresh(): Promise<void> {
    if (this.tokenInput) {
      await this.runBacktest();
    } else {
      this.renderPanel();
    }
  }

  public load(): void {
    if (!isEnabled()) {
      this.showSetupRequired();
      return;
    }
    this.renderPanel();
  }
}
