import { Panel } from '../Panel';
import {
  sendLimitOrder,
  cancelLimitOrder,
  getLimitOrders,
  getProxyWallets,
  type ProxyWallet,
  type LimitOrderRecord,
} from '@/services/ave/trading';

interface LimitOrder {
  id: string;
  chain: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: 'buy' | 'sell';
  limitPrice: string;
  status: string;
  createTime: string;
}

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';
const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const TOKENS = [
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006' },
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
];

export class LimitOrderPanel extends Panel {
  private orders: LimitOrderRecord[] = [];
  private selectedToken: string = 'WETH';
  private orderType: 'buy' | 'sell' = 'buy';
  private amount: string = '';
  private limitPrice: string = '';
  private stopLoss: string = '';
  private takeProfit: string = '';
  private loading = false;
  private submitting = false;

  constructor() {
    super({ id: 'limit-orders', title: 'Limit Orders' });
    this.element.classList.add('limit-order-panel');
  }

  protected renderContent(): void {
    this.renderPanel();
  }

  private renderPanel(): void {
    const tokenOptions = TOKENS.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');

    const orderRows = this.orders.length > 0
      ? this.orders.map(o => this.renderOrderRow(o)).join('')
      : '<tr><td colspan="5" class="no-orders">No open limit orders</td></tr>';

    const html = `
      <div class="limit-order-inner">
        <div class="limit-order-form">
          <div class="form-row">
            <select data-field="token">${tokenOptions}</select>
            <select data-field="type">
              <option value="buy" ${this.orderType === 'buy' ? 'selected' : ''}>Buy</option>
              <option value="sell" ${this.orderType === 'sell' ? 'selected' : ''}>Sell</option>
            </select>
          </div>
          <div class="form-row">
            <input type="number" class="order-input" placeholder="Amount" value="${this.amount}" data-field="amount" step="any" min="0">
          </div>
          <div class="form-row">
            <input type="number" class="order-input" placeholder="Limit Price (USD)" value="${this.limitPrice}" data-field="limitPrice" step="any" min="0">
          </div>
          <div class="form-row">
            <input type="number" class="order-input" placeholder="Stop Loss (USD)" value="${this.stopLoss}" data-field="stopLoss" step="any" min="0">
            <input type="number" class="order-input" placeholder="Take Profit (USD)" value="${this.takeProfit}" data-field="takeProfit" step="any" min="0">
          </div>
          <button class="submit-order-btn" data-action="submit" ${this.submitting ? 'disabled' : ''}>
            ${this.submitting ? 'Submitting...' : `Place ${this.orderType === 'buy' ? 'Buy' : 'Sell'} Limit Order`}
          </button>
        </div>
        <div class="limit-orders-header">
          <span class="section-label">Open Orders</span>
          <button class="refresh-btn" data-action="refresh" title="Refresh">↻</button>
        </div>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Limit Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${orderRows}
          </tbody>
        </table>
      </div>
      <style>
        .limit-order-inner{padding:12px;color:#e5e5e5;font-family:system-ui,monospace;font-size:13px}
        .limit-order-form{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:12px;margin-bottom:16px}
        .form-row{display:flex;gap:8px;margin-bottom:8px}
        .form-row:last-of-type{margin-bottom:12px}
        select,.order-input{background:#1a1a1a;border:1px solid #333;padding:8px 10px;border-radius:6px;color:#fff;font-size:13px;flex:1;min-width:0}
        select:focus,.order-input:focus{outline:none;border-color:#3b82f6}
        .submit-order-btn{width:100%;padding:10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s}
        .submit-order-btn:hover:not(:disabled){background:#2563eb}
        .submit-order-btn:disabled{opacity:0.5;cursor:not-allowed}
        .limit-orders-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .section-label{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:0.05em}
        .refresh-btn{background:#1a1a1a;border:1px solid #333;padding:4px 10px;border-radius:6px;color:#888;cursor:pointer;font-size:14px}
        .orders-table{width:100%;border-collapse:collapse;font-size:12px}
        .orders-table th{text-align:left;color:#666;padding:6px 8px;border-bottom:1px solid #222;font-weight:500;font-size:11px;text-transform:uppercase}
        .orders-table td{padding:6px 8px;border-bottom:1px solid #111}
        .no-orders{color:#555;text-align:center;padding:16px!important}
        .cancel-btn{background:#ef4444;border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px}
        .cancel-btn:hover{background:#dc2626}
        .type-buy{color:#22c55e;font-weight:600}
        .type-sell{color:#ef4444;font-weight:600}
      </style>
    `;

    this.setContent(html);
    this.attachListeners();
  }

  private renderOrderRow(order: LimitOrderRecord): string {
    const typeClass = order.swapType === 'buy' ? 'type-buy' : 'type-sell';
    const isActive = order.status === 'pending' || order.status === 'open';
    return `
      <tr>
        <td>${this.getSymbolFromAddress(order.inTokenAddress)}</td>
        <td class="${typeClass}">${order.swapType.toUpperCase()}</td>
        <td>${parseFloat(order.inAmount).toFixed(6)}</td>
        <td>$${parseFloat(order.limitPrice).toFixed(2)}</td>
        <td>${isActive ? `<button class="cancel-btn" data-action="cancel" data-id="${order.id}">Cancel</button>` : '<span style="color:#555">—</span>'}</td>
      </tr>
    `;
  }

  private getSymbolFromAddress(address: string): string {
    const found = TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
    return found ? found.symbol : address.slice(0, 8) + '...';
  }

  private attachListeners(): void {
    const content = this.content;

    content.querySelector('[data-field="token"]')?.addEventListener('change', (e) => {
      this.selectedToken = (e.target as HTMLSelectElement).value;
    });

    content.querySelector('[data-field="type"]')?.addEventListener('change', (e) => {
      this.orderType = (e.target as HTMLSelectElement).value as 'buy' | 'sell';
      this.renderPanel();
    });

    content.querySelector('[data-field="amount"]')?.addEventListener('input', (e) => {
      this.amount = (e.target as HTMLInputElement).value;
    });

    content.querySelector('[data-field="limitPrice"]')?.addEventListener('input', (e) => {
      this.limitPrice = (e.target as HTMLInputElement).value;
    });

    content.querySelector('[data-field="stopLoss"]')?.addEventListener('input', (e) => {
      this.stopLoss = (e.target as HTMLInputElement).value;
    });

    content.querySelector('[data-field="takeProfit"]')?.addEventListener('input', (e) => {
      this.takeProfit = (e.target as HTMLInputElement).value;
    });

    content.querySelector('[data-action="submit"]')?.addEventListener('click', () => this.submitOrder());
    content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.loadOrders());

    content.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        if (id) this.cancelOrder(id);
      });
    });
  }

  private async submitOrder(): Promise<void> {
    if (this.submitting) return;
    const amount = parseFloat(this.amount);
    const limitPrice = parseFloat(this.limitPrice);

    if (!amount || amount <= 0) {
      this.showError('Enter a valid amount');
      return;
    }
    if (!limitPrice || limitPrice <= 0) {
      this.showError('Enter a valid limit price');
      return;
    }

    this.submitting = true;
    this.renderPanel();

    try {
      const tokenInfo = TOKENS.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) throw new Error('Invalid token');

      const inTokenAddress = this.orderType === 'buy' ? NATIVE_ETH : tokenInfo.address;
      const outTokenAddress = this.orderType === 'buy' ? tokenInfo.address : NATIVE_ETH;
      const inAmount = BigInt(Math.floor(amount * 1e18)).toString();

      await sendLimitOrder({
        chain: 'base',
        assetsId: PROXY_ASSETS_ID,
        inTokenAddress,
        outTokenAddress,
        inAmount,
        swapType: this.orderType,
        slippage: '500',
        useMev: false,
        limitPrice: String(limitPrice),
        autoSlippage: true,
        autoGas: 'average',
      });

      this.amount = '';
      this.limitPrice = '';
      this.stopLoss = '';
      this.takeProfit = '';
      this.submitting = false;
      this.renderPanel();
      this.loadOrders();
    } catch (err) {
      this.submitting = false;
      this.showError(err instanceof Error ? err.message : 'Failed to place order');
    }
  }

  private async cancelOrder(id: string): Promise<void> {
    try {
      await cancelLimitOrder('base', [id]);
      this.loadOrders();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : 'Failed to cancel order');
    }
  }

  private async loadOrders(): Promise<void> {
    try {
      const data = await getLimitOrders({
        chain: 'base',
        assetsId: PROXY_ASSETS_ID,
        pageSize: 20,
        pageNo: 0,
      });
      this.orders = Array.isArray(data) ? data : [];
    } catch {
      this.orders = [];
    }
    this.renderPanel();
  }

  public async refresh(): Promise<void> {
    await this.loadOrders();
  }

  public load(): void {
    this.loadOrders();
  }
}
