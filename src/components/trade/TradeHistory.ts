import { getTradeHistory, type AgentTrade } from '@/services/ave/trading';
import { getSwapOrder } from '@/services/ave/trading';

export class TradeHistory {
  private el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trade-history';
    parent.appendChild(this.el);
    this.render();
  }

  private render(): void {
    const trades = getTradeHistory().slice(-30).reverse();
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);

    if (trades.length === 0) {
      this.el.innerHTML = `
        <div class="th-empty">No trades yet. Execute your first trade!</div>
        <style>
          .trade-history{font-family:system-ui,monospace;font-size:12px;color:#ccc}
          .th-empty{color:#555;text-align:center;padding:20px}
        </style>
      `;
      return;
    }

    const rows = trades.map(t => {
      const color = t.type === 'buy' ? '#22c55e' : '#ef4444';
      const pnlColor = (t.pnl || 0) >= 0 ? '#22c55e' : '#ef4444';
      const time = new Date(t.timestamp).toLocaleString();
      const txLink = t.txHash ? `<a href="https://basescan.org/tx/${t.txHash}" target="_blank" class="th-link">${t.txHash.slice(0, 8)}</a>` : '—';
      return `
        <tr>
          <td style="color:${color};font-weight:600">${t.type.toUpperCase()}</td>
          <td>${t.symbol}</td>
          <td>${t.amount.toFixed(4)}</td>
          <td>$${t.price.toFixed(2)}</td>
          <td style="color:${pnlColor}">${t.pnl ? (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) : '—'}</td>
          <td>${txLink}</td>
          <td class="th-time">${time}</td>
        </tr>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="th-header">
        <span class="th-title">Trade History (${trades.length})</span>
        <span class="th-pnl" style="color:${totalPnl >= 0 ? '#22c55e' : '#ef4444'}">P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span>
      </div>
      <div class="th-scroll">
        <table class="th-table">
          <thead><tr><th>Type</th><th>Token</th><th>Amount</th><th>Price</th><th>PnL</th><th>TX</th><th>Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <style>
        .trade-history{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column}
        .th-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .th-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
        .th-pnl{font-weight:600;font-size:13px}
        .th-scroll{overflow-x:auto}
        .th-table{width:100%;border-collapse:collapse;min-width:500px}
        .th-table th{text-align:left;color:#555;padding:4px 8px;border-bottom:1px solid #222;font-size:11px;text-transform:uppercase;white-space:nowrap}
        .th-table td{padding:6px 8px;border-bottom:1px solid #111;white-space:nowrap}
        .th-link{color:#3b82f6;text-decoration:none}
        .th-link:hover{text-decoration:underline}
        .th-time{color:#666;font-size:11px}
      </style>
    `;
  }
}
