import { getLimitOrders, cancelLimitOrder, type LimitOrderRecord } from '@/services/ave/trading';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  waiting: { bg: 'rgba(234,179,8,.12)', color: '#eab308', label: 'Waiting' },
  generated: { bg: 'rgba(59,130,246,.12)', color: '#3b82f6', label: 'Generated' },
  sent: { bg: 'rgba(59,130,246,.12)', color: '#3b82f6', label: 'Sent' },
  confirmed: { bg: 'rgba(34,197,94,.12)', color: '#22c55e', label: 'Filled' },
  error: { bg: 'rgba(239,68,68,.12)', color: '#ef4444', label: 'Error' },
  auto_cancelled: { bg: 'rgba(107,114,128,.12)', color: '#6b7280', label: 'Cancelled' },
  partial: { bg: 'rgba(168,85,247,.12)', color: '#a855f7', label: 'Partial' },
};

export class OpenOrders {
  private el: HTMLElement;
  private orders: LimitOrderRecord[] = [];
  private loading = false;
  private chain: string;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private cancelling: Set<string> = new Set();

  constructor(parent: HTMLElement, chain = 'base') {
    this.chain = chain;
    this.el = document.createElement('div');
    this.el.className = 'open-orders';
    parent.appendChild(this.el);
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.renderLoading();
    try {
      this.orders = await getLimitOrders({ chain: this.chain, assetsId: PROXY_ASSETS_ID, status: 'waiting', pageSize: 50, pageNo: 0 });
    } catch { this.orders = []; }
    this.loading = false;
    this.render();
  }

  private renderLoading(): void {
    const existing = this.el.querySelector('.oo-table tbody');
    if (!existing) {
      this.el.innerHTML = '<div class="oo-empty"><span class="oo-pulse"></span> Loading orders...</div>' + this.css();
    }
  }

  private render(): void {
    if (this.orders.length === 0) {
      this.el.innerHTML = `
        <div class="oo-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          <div>No open orders</div>
          <div class="oo-hint">Place a limit order from the Order Entry panel</div>
        </div>
        ${this.css()}`;
      return;
    }

    const activeOrders = this.orders.filter(o => ['waiting', 'generated', 'sent'].includes(o.status));
    const rows = this.orders.map(o => {
      const typeColor = o.swapType === 'buy' ? '#22c55e' : '#ef4444';
      const st = STATUS_COLORS[o.status] || { bg: '#1a1a1a', color: '#888', label: o.status };
      const isCancelling = this.cancelling.has(o.id);
      const amt = o.inAmount ? (parseFloat(o.inAmount) / 1e18).toFixed(4) : '—';
      const limitDisplay = o.limitPrice ? `$${parseFloat(o.limitPrice).toFixed(2)}` : '—';

      return `
        <tr class="oo-row">
          <td><span class="oo-type" style="background:${typeColor}22;color:${typeColor}">${o.swapType.toUpperCase()}</span></td>
          <td class="oo-amount">${amt}</td>
          <td class="oo-limit">${limitDisplay}</td>
          <td><span class="oo-badge" style="background:${st.bg};color:${st.color}">${st.label}</span></td>
          <td>${isCancelling ? '<span class="oo-pulse"></span>' : (activeOrders.includes(o) ? `<button class="oo-cancel" data-id="${o.id}">Cancel</button>` : '—')}</td>
        </tr>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="oo-header">
        <span class="oo-title">Open Orders <span class="oo-count">${this.orders.length}</span></span>
        <div class="oo-actions">
          <span class="oo-auto">Auto-refresh 30s</span>
          <button class="oo-refresh" data-action="refresh">↻</button>
        </div>
      </div>
      <table class="oo-table">
        <thead><tr><th>Type</th><th>Amount</th><th>Limit</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${this.css()}`;

    this.el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load());
    this.el.querySelectorAll('.oo-cancel').forEach(btn => {
      btn.addEventListener('click', () => this.cancel((btn as HTMLElement).dataset.id!));
    });
  }

  private css(): string {
    return `<style>
      .open-orders{font-family:system-ui,monospace;font-size:12px;color:#ccc}
      .oo-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .oo-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600;display:flex;align-items:center;gap:6px}
      .oo-count{background:#222;color:#aaa;padding:1px 6px;border-radius:4px;font-size:10px}
      .oo-actions{display:flex;align-items:center;gap:8px}
      .oo-auto{font-size:10px;color:#444}
      .oo-refresh{background:#1a1a1a;border:1px solid #333;color:#888;padding:4px 10px;border-radius:4px;cursor:pointer;transition:all .15s}
      .oo-refresh:hover{color:#fff;border-color:#555}
      .oo-table{width:100%;border-collapse:collapse}
      .oo-table th{text-align:left;color:#555;padding:6px 8px;border-bottom:1px solid #222;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .oo-table td{padding:8px;border-bottom:1px solid #111}
      .oo-row:hover{background:rgba(255,255,255,.02)}
      .oo-type{padding:2px 8px;border-radius:4px;font-weight:700;font-size:10px}
      .oo-amount,.oo-limit{font-family:monospace;color:#aaa}
      .oo-badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
      .oo-cancel{background:transparent;border:1px solid #ef4444;color:#ef4444;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px;transition:all .15s}
      .oo-cancel:hover{background:#ef4444;color:#fff}
      .oo-empty-state{text-align:center;padding:30px;color:#333;display:flex;flex-direction:column;align-items:center;gap:8px}
      .oo-hint{font-size:11px;color:#333}
      .oo-pulse{display:inline-block;width:10px;height:10px;border:2px solid rgba(59,130,246,.3);border-top-color:#3b82f6;border-radius:50%;animation:oo-spin .6s linear infinite}
      @keyframes oo-spin{to{transform:rotate(360deg)}}
    </style>`;
  }

  private async cancel(id: string): Promise<void> {
    this.cancelling.add(id);
    this.render();
    try {
      await cancelLimitOrder(this.chain, [id]);
      await this.load();
    } catch (e: any) {
      this.cancelling.delete(id);
      this.el.querySelector('.oo-header')?.insertAdjacentHTML('afterend', `<div style="color:#ef4444;padding:6px 8px;font-size:11px;background:rgba(239,68,68,.06);border-radius:4px;margin-bottom:8px">${e.message}</div>`);
    }
  }

  destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }
}
