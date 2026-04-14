import { getLimitOrders, cancelLimitOrder, type LimitOrderRecord } from '@/services/ave/trading';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';

export class OpenOrders {
  private el: HTMLElement;
  private orders: LimitOrderRecord[] = [];
  private loading = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'open-orders';
    parent.appendChild(this.el);
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.render();
    try {
      this.orders = await getLimitOrders({ chain: 'base', assetsId: PROXY_ASSETS_ID, status: 'waiting', pageSize: 50, pageNo: 0 });
    } catch { this.orders = []; }
    this.loading = false;
    this.render();
  }

  private render(): void {
    if (this.loading) {
      this.el.innerHTML = '<div class="oo-loading">Loading orders...</div>';
      return;
    }

    if (this.orders.length === 0) {
      this.el.innerHTML = '<div class="oo-empty">No open orders</div>';
      return;
    }

    const rows = this.orders.map(o => {
      const color = o.swapType === 'buy' ? '#22c55e' : '#ef4444';
      const isActive = o.status === 'waiting' || o.status === 'generated' || o.status === 'sent';
      return `
        <tr>
          <td style="color:${color};font-weight:600">${o.swapType.toUpperCase()}</td>
          <td>${o.inAmount ? (parseFloat(o.inAmount) / 1e18).toFixed(4) : '—'}</td>
          <td>$${o.limitPrice || '—'}</td>
          <td class="oo-status">${o.status}</td>
          <td>${isActive ? `<button class="oo-cancel" data-id="${o.id}">Cancel</button>` : '—'}</td>
        </tr>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="oo-header">
        <span class="oo-title">Open Orders (${this.orders.length})</span>
        <button class="oo-refresh" data-action="refresh">↻</button>
      </div>
      <table class="oo-table">
        <thead><tr><th>Type</th><th>Amount</th><th>Limit</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <style>
        .open-orders{font-family:system-ui,monospace;font-size:12px;color:#ccc}
        .oo-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .oo-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
        .oo-refresh{background:#1a1a1a;border:1px solid #333;color:#888;padding:4px 10px;border-radius:4px;cursor:pointer}
        .oo-refresh:hover{color:#fff}
        .oo-table{width:100%;border-collapse:collapse}
        .oo-table th{text-align:left;color:#555;padding:4px 8px;border-bottom:1px solid #222;font-size:11px;text-transform:uppercase}
        .oo-table td{padding:6px 8px;border-bottom:1px solid #111}
        .oo-cancel{background:#ef4444;border:none;color:#fff;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px}
        .oo-cancel:hover{background:#dc2626}
        .oo-status{color:#888;font-size:11px}
        .oo-loading,.oo-empty{color:#555;text-align:center;padding:20px;font-size:12px}
      </style>
    `;

    this.el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load());
    this.el.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => this.cancel((btn as HTMLElement).dataset.id!));
    });
  }

  private async cancel(id: string): Promise<void> {
    try {
      await cancelLimitOrder('base', [id]);
      this.load();
    } catch (e: any) {
      this.el.querySelector('.oo-header')!.insertAdjacentHTML('afterend', `<div style="color:#ef4444;padding:4px 8px;font-size:11px">${e.message}</div>`);
    }
  }
}
