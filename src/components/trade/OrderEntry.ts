import {
  connectWallet,
  getWalletStatus,
  executeTrade,
  sendMarketOrder,
  getQuote,
  getAutoSlippage,
  type WalletStatus,
  type AutoSellConfig,
} from '@/services/ave/trading';
import { startOrderWebSocket, onOrderUpdate, stopOrderWebSocket } from '@/services/ave/websocket';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const TOKENS = [
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'AERO', address: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', decimals: 18 },
  { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18 },
  { symbol: 'cbETH', address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', decimals: 18 },
  { symbol: 'WEWE', address: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', decimals: 18 },
];

export class OrderEntry {
  private el: HTMLElement;
  private selectedToken = 'WETH';
  private orderType: 'buy' | 'sell' = 'buy';
  private amount = '';
  private slippageMode: 'auto' | 'custom' = 'auto';
  private customSlippage = '5';
  private walletMode: 'metamask' | 'proxy' = 'proxy';
  private wallet: WalletStatus | null = null;
  private stopLossPct = '-50';
  private takeProfitPct = '50';
  private trailingPct = '10';
  private enableAutoSell = true;
  private estimating = false;
  private estimateOut = '';
  private submitting = false;
  private lastResult: { success: boolean; msg: string } | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'order-entry';
    parent.appendChild(this.el);
    this.checkWallet();
  }

  setToken(symbol: string): void {
    if (TOKENS.find(t => t.symbol === symbol)) {
      this.selectedToken = symbol;
      this.render();
      this.doEstimate();
    }
  }

  private async checkWallet(): Promise<void> {
    this.wallet = await getWalletStatus();
    this.render();
    this.doEstimate();
  }

  private render(): void {
    const tokenOptions = TOKENS.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');

    const estimateDisplay = this.estimating
      ? '<span class="estimating">Estimating...</span>'
      : this.estimateOut
        ? `<span class="estimate-value">~${this.estimateOut}</span>`
        : '<span class="estimate-dim">Enter amount</span>';

    const resultHtml = this.lastResult
      ? `<div class="order-result ${this.lastResult.success ? 'success' : 'error'}">${this.lastResult.msg}</div>`
      : '';

    const color = this.orderType === 'buy' ? '#22c55e' : '#ef4444';
    const label = this.orderType === 'buy' ? 'BUY' : 'SELL';

    this.el.innerHTML = `
      <div class="oe-section">
        <div class="oe-title">Order Entry</div>
        <div class="oe-row">
          <select class="oe-select" data-field="token">${tokenOptions}</select>
          <div class="oe-toggle">
            <button class="oe-type-btn ${this.orderType === 'buy' ? 'active' : ''}" data-type="buy">Buy</button>
            <button class="oe-type-btn ${this.orderType === 'sell' ? 'active' : ''}" data-type="sell">Sell</button>
          </div>
        </div>
        <div class="oe-row">
          <input type="number" class="oe-input" placeholder="Amount (ETH)" value="${this.amount}" data-field="amount" step="any" min="0">
        </div>
        <div class="oe-row oe-estimate">
          <span class="oe-label">Est. Output</span>
          ${estimateDisplay}
        </div>
        <div class="oe-row">
          <span class="oe-label">Slippage</span>
          <div class="oe-toggle oe-sm">
            <button class="oe-type-btn ${this.slippageMode === 'auto' ? 'active' : ''}" data-slip="auto">Auto</button>
            <button class="oe-type-btn ${this.slippageMode === 'custom' ? 'active' : ''}" data-slip="custom">Custom</button>
          </div>
          ${this.slippageMode === 'custom' ? `<input type="number" class="oe-input oe-sm" value="${this.customSlippage}" data-field="slippage" step="0.1" min="0.1" max="50">` : ''}
        </div>
        <div class="oe-row">
          <span class="oe-label">Wallet</span>
          <div class="oe-toggle oe-sm">
            <button class="oe-type-btn ${this.walletMode === 'proxy' ? 'active' : ''}" data-wallet="proxy">Proxy</button>
            <button class="oe-type-btn ${this.walletMode === 'metamask' ? 'active' : ''}" data-wallet="metamask">MetaMask</button>
          </div>
        </div>
      </div>

      <div class="oe-section">
        <div class="oe-title oe-collapsible" data-toggle="autosell">
          Auto-Sell Config ${this.enableAutoSell ? '✓' : '—'}
        </div>
        <div class="oe-autosell" ${this.enableAutoSell ? '' : 'style="display:none"'}>
          <div class="oe-row">
            <span class="oe-label">Stop Loss</span>
            <input type="number" class="oe-input oe-sm" value="${this.stopLossPct}" data-field="stopLoss" step="1"> <span class="oe-unit">%</span>
          </div>
          <div class="oe-row">
            <span class="oe-label">Take Profit</span>
            <input type="number" class="oe-input oe-sm" value="${this.takeProfitPct}" data-field="takeProfit" step="1"> <span class="oe-unit">%</span>
          </div>
          <div class="oe-row">
            <span class="oe-label">Trailing</span>
            <input type="number" class="oe-input oe-sm" value="${this.trailingPct}" data-field="trailing" step="1"> <span class="oe-unit">%</span>
          </div>
        </div>
      </div>

      <button class="oe-execute" data-action="execute" style="background:${color}" ${this.submitting ? 'disabled' : ''}>
        ${this.submitting ? 'Executing...' : `${label} ${this.selectedToken}`}
      </button>
      ${resultHtml}

      <style>
        .order-entry{padding:12px;display:flex;flex-direction:column;gap:12px;font-family:system-ui,monospace;font-size:13px;color:#e5e5e5}
        .oe-section{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px}
        .oe-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
        .oe-row{display:flex;align-items:center;gap:8px}
        .oe-label{font-size:12px;color:#888;min-width:75px}
        .oe-select,.oe-input{background:#1a1a1a;border:1px solid #333;padding:8px 10px;border-radius:6px;color:#fff;font-size:13px;flex:1;min-width:0}
        .oe-select:focus,.oe-input:focus{outline:none;border-color:#3b82f6}
        .oe-input.oe-sm{flex:0 0 70px;text-align:right}
        .oe-unit{font-size:12px;color:#666}
        .oe-toggle{display:flex;gap:0;border-radius:6px;overflow:hidden;border:1px solid #333}
        .oe-toggle.oe-sm{flex:0 0 auto}
        .oe-type-btn{background:#1a1a1a;border:none;color:#888;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;transition:all .15s}
        .oe-type-btn.active{background:#333;color:#fff}
        .oe-type-btn:hover{color:#fff}
        .oe-estimate{padding:4px 0;border-bottom:1px solid #1a1a1a}
        .estimate-value{color:#3b82f6;font-weight:600}
        .estimate-dim{color:#555}
        .estimating{color:#888}
        .oe-execute{width:100%;padding:14px;border:none;border-radius:8px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .15s;letter-spacing:.02em}
        .oe-execute:hover:not(:disabled){opacity:.9}
        .oe-execute:disabled{opacity:.4;cursor:not-allowed}
        .oe-autosell{display:flex;flex-direction:column;gap:6px;padding-top:4px}
        .oe-collapsible{cursor:pointer}
        .oe-collapsible:hover{color:#bbb}
        .order-result{padding:8px 12px;border-radius:6px;font-size:12px;margin-top:4px}
        .order-result.success{background:#0a2a15;color:#22c55e;border:1px solid #166534}
        .order-result.error{background:#2a0a0a;color:#ef4444;border:1px solid #7f1d1d}
      </style>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const on = (sel: string, evt: string, fn: (e: Event) => void) => {
      this.el.querySelector(sel)?.addEventListener(evt, fn);
    };

    on('[data-field="token"]', 'change', (e) => {
      this.selectedToken = (e.target as HTMLSelectElement).value;
      this.render();
      this.doEstimate();
    });

    this.el.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.orderType = (btn as HTMLElement).dataset.type as 'buy' | 'sell';
        this.render();
        this.doEstimate();
      });
    });

    on('[data-field="amount"]', 'input', (e) => {
      this.amount = (e.target as HTMLInputElement).value;
      this.doEstimate();
    });

    this.el.querySelectorAll('[data-slip]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.slippageMode = (btn as HTMLElement).dataset.slip as 'auto' | 'custom';
        this.render();
      });
    });

    on('[data-field="slippage"]', 'input', (e) => {
      this.customSlippage = (e.target as HTMLInputElement).value;
    });

    this.el.querySelectorAll('[data-wallet]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.walletMode = (btn as HTMLElement).dataset.wallet as 'metamask' | 'proxy';
        this.render();
      });
    });

    on('[data-toggle="autosell"]', 'click', () => {
      this.enableAutoSell = !this.enableAutoSell;
      this.render();
    });

    on('[data-field="stopLoss"]', 'input', (e) => { this.stopLossPct = (e.target as HTMLInputElement).value; });
    on('[data-field="takeProfit"]', 'input', (e) => { this.takeProfitPct = (e.target as HTMLInputElement).value; });
    on('[data-field="trailing"]', 'input', (e) => { this.trailingPct = (e.target as HTMLInputElement).value; });

    on('[data-action="execute"]', 'click', () => this.execute());
  }

  private async doEstimate(): Promise<void> {
    const amt = parseFloat(this.amount);
    if (!amt || amt <= 0) { this.estimateOut = ''; return; }

    this.estimating = true;
    this.el.querySelector('.oe-estimate')!.innerHTML = '<span class="oe-label">Est. Output</span><span class="estimating">Estimating...</span>';

    try {
      const tokenInfo = TOKENS.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) return;
      const amountWei = BigInt(Math.floor(amt * 1e18)).toString();
      const quote = await getQuote(tokenInfo.address, amountWei, this.orderType);
      const outVal = parseFloat(quote.estimateOut) / Math.pow(10, quote.decimals);
      this.estimateOut = this.orderType === 'buy' ? `${outVal.toFixed(6)} ${this.selectedToken}` : `${outVal.toFixed(6)} ETH`;
    } catch {
      this.estimateOut = '—';
    } finally {
      this.estimating = false;
      const el = this.el.querySelector('.oe-estimate');
      if (el) el.innerHTML = `<span class="oe-label">Est. Output</span>${this.estimateOut ? `<span class="estimate-value">~${this.estimateOut}</span>` : '<span class="estimate-dim">Enter amount</span>'}`;
    }
  }

  private async execute(): Promise<void> {
    const amt = parseFloat(this.amount);
    if (!amt || amt <= 0) { this.lastResult = { success: false, msg: 'Enter a valid amount' }; this.render(); return; }

    this.submitting = true;
    this.lastResult = null;
    this.render();

    try {
      const tokenInfo = TOKENS.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) throw new Error('Invalid token');

      if (this.walletMode === 'proxy') {
        const inToken = this.orderType === 'buy' ? NATIVE : tokenInfo.address;
        const outToken = this.orderType === 'buy' ? tokenInfo.address : NATIVE;
        const inAmount = BigInt(Math.floor(amt * 1e18)).toString();

        const autoSellConfig: AutoSellConfig[] = [];
        if (this.enableAutoSell && this.orderType === 'buy') {
          if (this.stopLossPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.stopLossPct) * 100)), sellRatio: '10000', type: 'default' });
          if (this.takeProfitPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.takeProfitPct) * 100)), sellRatio: '5000', type: 'default' });
          if (this.trailingPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.trailingPct) * 100)), sellRatio: '10000', type: 'trailing' });
        }

        const slippage = this.slippageMode === 'auto' ? '500' : String(Math.round(parseFloat(this.customSlippage || '5') * 100));

        const order = await sendMarketOrder({
          chain: 'base',
          assetsId: PROXY_ASSETS_ID,
          inTokenAddress: inToken,
          outTokenAddress: outToken,
          inAmount,
          swapType: this.orderType,
          slippage,
          useMev: false,
          autoSlippage: this.slippageMode === 'auto',
          autoGas: 'average',
          ...(autoSellConfig.length > 0 ? { autoSellConfig } : {}),
        });

        this.lastResult = { success: true, msg: `Order placed! ID: ${order.id}` };
      } else {
        const result = await executeTrade({
          token: this.selectedToken,
          amount: amt,
          type: this.orderType,
          chain: 'base',
          slippage: parseFloat(this.customSlippage || '5'),
        });

        if (result.success) {
          this.lastResult = { success: true, msg: `TX: ${result.txHash?.slice(0, 10)}...` };
        } else {
          this.lastResult = { success: false, msg: result.error || 'Trade failed' };
        }
      }
    } catch (e: any) {
      this.lastResult = { success: false, msg: e.message || 'Execution failed' };
    } finally {
      this.submitting = false;
      this.render();
    }
  }
}
