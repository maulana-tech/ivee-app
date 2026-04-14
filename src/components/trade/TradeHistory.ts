import { getTradeHistory, type AgentTrade } from '@/services/ave/trading';

export class TradeHistory {
  private el: HTMLElement;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trade-history';
    parent.appendChild(this.el);
    this.render();
    this.refreshTimer = setInterval(() => this.render(), 10000);
  }

  private render(): void {
    const trades = getTradeHistory().slice(-50).reverse();
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = trades.filter(t => (t.pnl || 0) > 0).length;
    const losses = trades.filter(t => (t.pnl || 0) < 0).length;

    if (trades.length === 0) {
      this.el.innerHTML = `
        <div class="th-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div>No trades yet</div>
          <div class="th-hint">Execute your first trade from the Order Entry panel</div>
        </div>
        ${this.css()}`;
      return;
    }

    const pnlColor = totalPnl >= 0 ? '#22c55e' : '#ef4444';
    const pnlSign = totalPnl >= 0 ? '+' : '';
    const winRate = trades.length > 0 ? Math.round((wins / trades.filter(t => t.pnl !== undefined).length) * 100) || 0 : 0;

    const rows = trades.map(t => {
      const typeColor = t.type === 'buy' ? '#22c55e' : '#ef4444';
      const pnlVal = t.pnl || 0;
      const pnlColor = pnlVal >= 0 ? '#22c55e' : '#ef4444';
      const time = new Date(t.timestamp);
      const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
      const statusBg = t.status === 'filled' ? 'rgba(34,197,94,.12)' : t.status === 'pending' ? 'rgba(234,179,8,.12)' : 'rgba(239,68,68,.12)';
      const statusColor = t.status === 'filled' ? '#22c55e' : t.status === 'pending' ? '#eab308' : '#ef4444';

      return `
        <tr class="th-row">
          <td><span class="th-type" style="background:${typeColor}22;color:${typeColor}">${t.type.toUpperCase()}</span></td>
          <td class="th-symbol">${t.symbol}</td>
          <td class="th-num">${t.amount.toFixed(4)}</td>
          <td class="th-num">$${t.price.toFixed(2)}</td>
          <td class="th-pnl" style="color:${pnlColor}">${pnlVal ? (pnlVal >= 0 ? '+' : '') + '$' + Math.abs(pnlVal).toFixed(2) : '—'}</td>
          <td><span class="th-badge" style="background:${statusBg};color:${statusColor}">${t.status}</span></td>
          <td class="th-time">${timeStr}</td>
        </tr>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="th-header">
        <div class="th-header-left">
          <span class="th-title">Trade History <span class="th-count">${trades.length}</span></span>
        </div>
        <div class="th-stats">
          <div class="th-stat"><span class="th-stat-label">P&L</span><span class="th-stat-value" style="color:${pnlColor}">${pnlSign}$${Math.abs(totalPnl).toFixed(2)}</span></div>
          <div class="th-stat"><span class="th-stat-label">W/L</span><span class="th-stat-value" style="color:#22c55e">${wins}</span><span style="color:#555">/</span><span class="th-stat-value" style="color:#ef4444">${losses}</span></div>
          <div class="th-stat"><span class="th-stat-label">Win%</span><span class="th-stat-value">${winRate}%</span></div>
        </div>
      </div>
      <div class="th-scroll">
        <table class="th-table">
          <thead><tr><th>Type</th><th>Token</th><th>Amount</th><th>Price</th><th>PnL</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${this.css()}`;
  }

  private css(): string {
    return `<style>
      .trade-history{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column}
      .th-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .th-header-left{display:flex;align-items:center;gap:8px}
      .th-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600;display:flex;align-items:center;gap:6px}
      .th-count{background:#222;color:#aaa;padding:1px 6px;border-radius:4px;font-size:10px}
      .th-stats{display:flex;gap:12px;align-items:center}
      .th-stat{display:flex;align-items:center;gap:4px;font-size:11px}
      .th-stat-label{color:#555;font-size:9px;text-transform:uppercase}
      .th-stat-value{font-weight:700;font-size:12px;color:#ccc}
      .th-scroll{overflow-x:auto}
      .th-table{width:100%;border-collapse:collapse;min-width:500px}
      .th-table th{text-align:left;color:#555;padding:6px 8px;border-bottom:1px solid #222;font-size:10px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
      .th-table td{padding:8px;border-bottom:1px solid #111;white-space:nowrap}
      .th-row:hover{background:rgba(255,255,255,.02)}
      .th-type{padding:2px 8px;border-radius:4px;font-weight:700;font-size:10px}
      .th-symbol{color:#fff;font-weight:600}
      .th-num{color:#aaa;font-family:monospace}
      .th-pnl{font-weight:600;font-family:monospace}
      .th-badge{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:capitalize}
      .th-time{color:#555;font-size:11px}
      .th-empty-state{text-align:center;padding:30px;color:#333;display:flex;flex-direction:column;align-items:center;gap:8px}
      .th-hint{font-size:11px;color:#333}
    </style>`;
  }

  destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }
}
