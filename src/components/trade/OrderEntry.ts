import {
  connectWallet,
  getWalletStatus,
  executeTrade,
  sendMarketOrder,
  sendLimitOrder,
  getQuote,
  type WalletStatus,
  type AutoSellConfig,
} from '@/services/ave/trading';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

interface TokenDef {
  symbol: string;
  address: string;
  decimals: number;
}

const BASE_TOKENS: TokenDef[] = [
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'AERO', address: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', decimals: 18 },
  { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18 },
  { symbol: 'cbETH', address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', decimals: 18 },
  { symbol: 'WEWE', address: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', decimals: 18 },
];

export class OrderEntry {
  private el: HTMLElement;
  private tokens: TokenDef[] = [...BASE_TOKENS];
  private selectedToken = 'WETH';
  private selectedChain: string;
  private orderMode: 'market' | 'limit' = 'market';
  private orderType: 'buy' | 'sell' = 'buy';
  private amount = '';
  private limitPrice = '';
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
  private resultTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement, chain = 'base') {
    this.selectedChain = chain;
    this.el = document.createElement('div');
    this.el.className = 'order-entry';
    parent.appendChild(this.el);
    this.checkWallet();
  }

  setToken(symbol: string, address?: string): void {
    if (this.tokens.find(t => t.symbol === symbol)) {
      this.selectedToken = symbol;
    } else if (address) {
      this.tokens.unshift({ symbol, address, decimals: 18 });
      this.selectedToken = symbol;
    }
    this.render();
    this.doEstimate();
  }

  private async checkWallet(): Promise<void> {
    this.wallet = await getWalletStatus();
    this.render();
    this.doEstimate();
  }

  private render(): void {
    const tokenOptions = this.tokens.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');

    const estimateDisplay = this.estimating
      ? '<span class="oe-estimating">Calculating...</span>'
      : this.estimateOut
        ? `<span class="oe-est-value">${this.estimateOut}</span>`
        : '<span class="oe-est-dim">Enter amount to see estimate</span>';

    const resultHtml = this.lastResult
      ? `<div class="oe-result ${this.lastResult.success ? 'ok' : 'err'}">${this.lastResult.msg}</div>`
      : '';

    const isBuy = this.orderType === 'buy';
    const accentColor = isBuy ? '#22c55e' : '#ef4444';
    const isLimit = this.orderMode === 'limit';

    this.el.innerHTML = `
      <div class="oe-header">
        <span>Order Entry</span>
        <div class="oe-mode-toggle">
          <button class="oe-mode-btn ${!isLimit ? 'sel' : ''}" data-mode="market">Market</button>
          <button class="oe-mode-btn ${isLimit ? 'sel' : ''}" data-mode="limit">Limit</button>
        </div>
      </div>

      <div class="oe-card">
        <div class="oe-pair-row">
          <select class="oe-token" data-field="token">${tokenOptions}</select>
          <div class="oe-side-toggle">
            <button class="oe-side ${isBuy ? 'active' : ''}" data-type="buy" style="${isBuy ? `background:${accentColor};color:#000` : ''}">BUY</button>
            <button class="oe-side ${!isBuy ? 'active' : ''}" data-type="sell" style="${!isBuy ? `background:${accentColor};color:#000` : ''}">SELL</button>
          </div>
        </div>
      </div>

      <div class="oe-card">
        <label class="oe-label">Amount</label>
        <div class="oe-input-wrap">
          <input type="number" class="oe-amount" placeholder="0.0" value="${this.amount}" data-field="amount" step="any" min="0">
          <span class="oe-denom">ETH</span>
        </div>
        <div class="oe-quick-btns">
          <button class="oe-quick" data-pct="25">25%</button>
          <button class="oe-quick" data-pct="50">50%</button>
          <button class="oe-quick" data-pct="75">75%</button>
          <button class="oe-quick" data-pct="100">MAX</button>
        </div>
        ${isLimit ? `
        <label class="oe-label" style="margin-top:6px">Limit Price (USD)</label>
        <div class="oe-input-wrap">
          <input type="number" class="oe-limit-price" placeholder="0.00" value="${this.limitPrice}" data-field="limitPrice" step="any" min="0">
          <span class="oe-denom">USD</span>
        </div>
        ` : ''}
        <div class="oe-est-row">
          <span class="oe-est-label">Estimated</span>
          ${estimateDisplay}
        </div>
      </div>

      <div class="oe-card">
        <div class="oe-row-space">
          <label class="oe-label">Slippage</label>
          <div class="oe-pill-group">
            <button class="oe-pill ${this.slippageMode === 'auto' ? 'sel' : ''}" data-slip="auto">Auto</button>
            <button class="oe-pill ${this.slippageMode === 'custom' ? 'sel' : ''}" data-slip="custom">Custom</button>
          </div>
        </div>
        ${this.slippageMode === 'custom' ? `<input type="number" class="oe-sm-input" value="${this.customSlippage}" data-field="slippage" step="0.1" min="0.1" max="50" placeholder="%">` : ''}
      </div>

      <div class="oe-card">
        <div class="oe-row-space">
          <label class="oe-label">Wallet</label>
          <div class="oe-pill-group">
            <button class="oe-pill ${this.walletMode === 'proxy' ? 'sel' : ''}" data-wallet="proxy">AVE Bot</button>
            <button class="oe-pill ${this.walletMode === 'metamask' ? 'sel' : ''}" data-wallet="metamask">MetaMask</button>
          </div>
        </div>
        ${this.walletMode === 'proxy' ? `<div class="oe-wallet-info">Proxy Wallet <span class="oe-wallet-id">${PROXY_ASSETS_ID.slice(0, 8)}...</span></div>` : ''}
      </div>

      ${isBuy ? `
      <div class="oe-card oe-auto-toggle" data-action="toggle-autosell">
        <div class="oe-row-space">
          <label class="oe-label">Auto-Sell Protection ${this.enableAutoSell ? '<span class="oe-on">ON</span>' : '<span class="oe-off">OFF</span>'}</label>
          <span class="oe-chevron">${this.enableAutoSell ? '▾' : '▸'}</span>
        </div>
      </div>
      <div class="oe-auto-rows" ${this.enableAutoSell ? '' : 'style="display:none"'}>
        <div class="oe-card oe-auto-inner">
          <div class="oe-sl-row">
            <span class="oe-sl-icon sl">SL</span>
            <input type="number" class="oe-sl-input" value="${this.stopLossPct}" data-field="stopLoss" step="1">
            <span class="oe-sl-unit">%</span>
          </div>
          <div class="oe-sl-row">
            <span class="oe-sl-icon tp">TP</span>
            <input type="number" class="oe-sl-input" value="${this.takeProfitPct}" data-field="takeProfit" step="1">
            <span class="oe-sl-unit">%</span>
          </div>
          <div class="oe-sl-row">
            <span class="oe-sl-icon tr">TR</span>
            <input type="number" class="oe-sl-input" value="${this.trailingPct}" data-field="trailing" step="1">
            <span class="oe-sl-unit">%</span>
          </div>
        </div>
      </div>` : ''}

      <button class="oe-exec" data-action="execute" style="background:${accentColor};color:#000" ${this.submitting ? 'disabled' : ''}>
        ${this.submitting ? '<span class="oe-spinner"></span> Executing...' : `${isLimit ? 'LIMIT ' : ''}${isBuy ? 'BUY' : 'SELL'} ${this.selectedToken}`}
      </button>
      ${resultHtml}

      <style>
        .order-entry {
          padding: 12px; display: flex; flex-direction: column; gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          font-size: 13px; color: #ccc;
        }
        .oe-header {
          font-size: 14px; font-weight: 700; color: #fff;
          padding: 4px 0 8px; border-bottom: 1px solid #1a1a1a; margin-bottom: 4px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .oe-mode-toggle { display: flex; gap: 2px; border-radius: 6px; overflow: hidden; background: #0a0a0a; }
        .oe-mode-btn {
          padding: 4px 12px; border: none; cursor: pointer;
          font-size: 10px; font-weight: 700; color: #555;
          background: transparent; transition: all .15s; text-transform: uppercase;
          letter-spacing: .04em;
        }
        .oe-mode-btn.sel { background: #222; color: #fff; }
        .oe-mode-btn:hover { color: #aaa; }

        .oe-card {
          background: #111; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
        }
        .oe-label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .oe-on { color: #22c55e; font-size: 10px; font-weight: 700; }
        .oe-off { color: #555; font-size: 10px; font-weight: 700; }
        .oe-chevron { color: #555; font-size: 11px; }

        .oe-pair-row { display: flex; gap: 8px; align-items: center; }
        .oe-token {
          flex: 1; background: #0d0d0d; border: 1px solid #2a2a2a; color: #fff;
          padding: 10px 12px; border-radius: 8px; font-size: 15px; font-weight: 700;
        }
        .oe-token:focus { outline: none; border-color: #3b82f6; }
        .oe-side-toggle { display: flex; gap: 2px; border-radius: 8px; overflow: hidden; }
        .oe-side {
          padding: 10px 18px; border: none; cursor: pointer; font-weight: 700;
          font-size: 12px; letter-spacing: .04em; transition: all .15s;
          background: #1a1a1a; color: #555;
        }
        .oe-side:not(.active):hover { color: #aaa; }

        .oe-input-wrap {
          display: flex; align-items: center; background: #0d0d0d;
          border: 1px solid #2a2a2a; border-radius: 8px; padding: 0 12px;
          transition: border-color .15s;
        }
        .oe-input-wrap:focus-within { border-color: #3b82f6; }
        .oe-amount, .oe-limit-price {
          flex: 1; background: none; border: none; color: #fff;
          font-size: 20px; font-weight: 600; padding: 12px 0;
          min-width: 0;
        }
        .oe-amount::placeholder, .oe-limit-price::placeholder { color: #333; }
        .oe-amount:focus, .oe-limit-price:focus { outline: none; }
        .oe-denom { color: #555; font-size: 13px; font-weight: 600; padding-left: 8px; }

        .oe-quick-btns { display: flex; gap: 4px; margin-top: 4px; }
        .oe-quick {
          flex: 1; background: #0d0d0d; border: 1px solid #222; color: #666;
          padding: 5px 0; border-radius: 4px; cursor: pointer;
          font-size: 10px; font-weight: 700; transition: all .15s;
        }
        .oe-quick:hover { color: #fff; border-color: #3b82f6; background: #111; }

        .oe-est-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
        .oe-est-label { font-size: 11px; color: #555; }
        .oe-est-value { color: #3b82f6; font-weight: 600; font-size: 13px; }
        .oe-est-dim { color: #333; font-size: 12px; }
        .oe-estimating { color: #666; font-size: 12px; }

        .oe-row-space { display: flex; justify-content: space-between; align-items: center; }
        .oe-pill-group { display: flex; gap: 2px; border-radius: 6px; overflow: hidden; background: #0a0a0a; }
        .oe-pill {
          padding: 5px 14px; border: none; cursor: pointer;
          font-size: 11px; font-weight: 600; color: #555;
          background: transparent; transition: all .15s;
        }
        .oe-pill.sel { background: #222; color: #fff; }
        .oe-pill:hover { color: #aaa; }
        .oe-sm-input {
          background: #0d0d0d; border: 1px solid #2a2a2a; color: #fff;
          padding: 6px 10px; border-radius: 6px; font-size: 13px; width: 100%;
        }
        .oe-sm-input:focus { outline: none; border-color: #3b82f6; }

        .oe-wallet-info { font-size: 10px; color: #555; padding-top: 4px; }
        .oe-wallet-id { color: #3b82f6; font-family: monospace; }

        .oe-auto-toggle { cursor: pointer; transition: border-color .15s; }
        .oe-auto-toggle:hover { border-color: #333; }
        .oe-auto-inner { border-top: none; border-radius: 0 0 8px 8px; margin-top: -1px; }
        .oe-sl-row { display: flex; align-items: center; gap: 8px; }
        .oe-sl-icon {
          width: 26px; height: 26px; border-radius: 4px; display: flex;
          align-items: center; justify-content: center; font-size: 9px; font-weight: 800;
        }
        .oe-sl-icon.sl { background: rgba(239,68,68,.15); color: #ef4444; }
        .oe-sl-icon.tp { background: rgba(34,197,94,.15); color: #22c55e; }
        .oe-sl-icon.tr { background: rgba(59,130,246,.15); color: #3b82f6; }
        .oe-sl-input {
          flex: 1; background: #0d0d0d; border: 1px solid #2a2a2a; color: #fff;
          padding: 6px 10px; border-radius: 6px; font-size: 13px; text-align: right;
        }
        .oe-sl-input:focus { outline: none; border-color: #3b82f6; }
        .oe-sl-unit { color: #555; font-size: 12px; min-width: 16px; }

        .oe-exec {
          width: 100%; padding: 16px; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 800; cursor: pointer;
          transition: all .15s; letter-spacing: .04em; margin-top: 4px;
        }
        .oe-exec:hover:not(:disabled) { filter: brightness(1.1); }
        .oe-exec:disabled { opacity: .4; cursor: not-allowed; }
        .oe-exec:active:not(:disabled) { transform: scale(.98); }

        .oe-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(0,0,0,.2); border-top-color: currentColor;
          border-radius: 50%; animation: oe-spin .6s linear infinite;
        }
        @keyframes oe-spin { to { transform: rotate(360deg); } }

        .oe-result {
          padding: 10px 14px; border-radius: 8px; font-size: 12px;
          margin-top: 4px; font-weight: 500;
          animation: oe-fadein .3s ease;
        }
        @keyframes oe-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .oe-result.ok { background: rgba(34,197,94,.08); color: #4ade80; border: 1px solid rgba(34,197,94,.2); }
        .oe-result.err { background: rgba(239,68,68,.08); color: #f87171; border: 1px solid rgba(239,68,68,.2); }
      </style>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const on = (sel: string, evt: string, fn: (e: Event) => void) => {
      this.el.querySelector(sel)?.addEventListener(evt, fn);
    };

    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.orderMode = (btn as HTMLElement).dataset.mode as 'market' | 'limit';
        this.render();
        this.doEstimate();
      });
    });

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

    on('[data-field="limitPrice"]', 'input', (e) => {
      this.limitPrice = (e.target as HTMLInputElement).value;
    });

    this.el.querySelectorAll('[data-pct]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseInt((btn as HTMLElement).dataset.pct || '50');
        const balance = this.walletMode === 'metamask' ? (this.wallet?.balance || 0) : 0.1;
        const val = (balance * pct / 100);
        this.amount = val.toFixed(6);
        const input = this.el.querySelector('[data-field="amount"]') as HTMLInputElement;
        if (input) input.value = this.amount;
        this.doEstimate();
      });
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

    on('[data-action="toggle-autosell"]', 'click', () => {
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
    const estEl = this.el.querySelector('.oe-est-row');
    if (estEl) estEl.innerHTML = '<span class="oe-est-label">Estimated</span><span class="oe-estimating">Calculating...</span>';

    try {
      const tokenInfo = this.tokens.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) return;
      const amountWei = BigInt(Math.floor(amt * 1e18)).toString();
      const quote = await getQuote(tokenInfo.address, amountWei, this.orderType, this.selectedChain);
      const outVal = parseFloat(quote.estimateOut) / Math.pow(10, quote.decimals);
      this.estimateOut = this.orderType === 'buy' ? `${outVal.toFixed(6)} ${this.selectedToken}` : `${outVal.toFixed(6)} ETH`;
    } catch {
      this.estimateOut = '';
    } finally {
      this.estimating = false;
      if (estEl) estEl.innerHTML = `<span class="oe-est-label">Estimated</span>${this.estimateOut ? `<span class="oe-est-value">${this.estimateOut}</span>` : '<span class="oe-est-dim">Enter amount to see estimate</span>'}`;
    }
  }

  private async execute(): Promise<void> {
    const amt = parseFloat(this.amount);
    if (!amt || amt <= 0) { this.lastResult = { success: false, msg: 'Enter a valid amount' }; this.render(); return; }

    if (this.orderMode === 'limit' && (!this.limitPrice || parseFloat(this.limitPrice) <= 0)) {
      this.lastResult = { success: false, msg: 'Enter a limit price' }; this.render(); return;
    }

    this.submitting = true;
    this.lastResult = null;
    this.render();

    try {
      const tokenInfo = this.tokens.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) throw new Error('Invalid token');

      if (this.walletMode === 'proxy') {
        const inToken = this.orderType === 'buy' ? NATIVE : tokenInfo.address;
        const outToken = this.orderType === 'buy' ? tokenInfo.address : NATIVE;
        const inAmount = BigInt(Math.floor(amt * 1e18)).toString();
        const slippage = this.slippageMode === 'auto' ? '500' : String(Math.round(parseFloat(this.customSlippage || '5') * 100));

        if (this.orderMode === 'limit') {
          const order = await sendLimitOrder({
            chain: this.selectedChain,
            assetsId: PROXY_ASSETS_ID,
            inTokenAddress: inToken,
            outTokenAddress: outToken,
            inAmount,
            swapType: this.orderType,
            slippage,
            useMev: false,
            limitPrice: this.limitPrice,
            autoSlippage: this.slippageMode === 'auto',
            autoGas: 'average',
          });
          this.lastResult = { success: true, msg: `Limit order placed! ID: ${order.id}` };
        } else {
          const autoSellConfig: AutoSellConfig[] = [];
          if (this.enableAutoSell && this.orderType === 'buy') {
            if (this.stopLossPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.stopLossPct) * 100)), sellRatio: '10000', type: 'default' });
            if (this.takeProfitPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.takeProfitPct) * 100)), sellRatio: '5000', type: 'default' });
            if (this.trailingPct) autoSellConfig.push({ priceChange: String(Math.round(parseFloat(this.trailingPct) * 100)), sellRatio: '10000', type: 'trailing' });
          }

          const order = await sendMarketOrder({
            chain: this.selectedChain,
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
        }
      } else {
        const result = await executeTrade({
          token: this.selectedToken,
          amount: amt,
          type: this.orderType,
          chain: this.selectedChain,
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
      if (this.resultTimer) clearTimeout(this.resultTimer);
      this.resultTimer = setTimeout(() => { this.lastResult = null; this.render(); }, 8000);
    }
  }
}
