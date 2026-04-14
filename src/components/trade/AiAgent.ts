import {
  startAgent,
  stopAgent,
  onAgentUpdate,
  loadAgentState,
  loadAgentHistory,
  getAgentStats,
  type AgentState,
  type AgentCycleResult,
} from '@/services/ave/auto-agent';

export class AiAgent {
  private el: HTMLElement;
  private state: AgentState = loadAgentState();
  private history: AgentCycleResult[] = loadAgentHistory().slice(-10).reverse();
  private unsub: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ai-agent';
    parent.appendChild(this.el);
    this.render();
    this.unsub = onAgentUpdate((state, result) => {
      this.state = state;
      if (result) {
        this.history = loadAgentHistory().slice(-10).reverse();
      }
      this.render();
    });
  }

  private render(): void {
    const stats = getAgentStats();
    const running = this.state.running;
    const statusMap: Record<string, { color: string; pulse: boolean }> = {
      idle: { color: '#888', pulse: false },
      running: { color: '#22c55e', pulse: true },
      analyzing: { color: '#eab308', pulse: true },
      executing: { color: '#3b82f6', pulse: true },
      error: { color: '#ef4444', pulse: false },
    };
    const st = statusMap[this.state.status] || statusMap.idle;

    const cycleLog = this.history.slice(0, 8).map(c => {
      const actionColor = c.decision.action === 'BUY' ? '#22c55e' : c.decision.action === 'SELL' ? '#ef4444' : '#888';
      const time = new Date(c.timestamp);
      const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
      const execIcon = c.executed ? '<span style="color:#22c55e">✓</span>' : c.error ? `<span style="color:#ef4444" title="${c.error}">✗</span>` : '<span style="color:#555">—</span>';
      return `
        <div class="aa-log-row">
          <span class="aa-log-time">${timeStr}</span>
          <span class="aa-log-token">${c.token}</span>
          <span class="aa-log-action" style="color:${actionColor}">${c.decision.action}</span>
          <span class="aa-log-conf">${c.decision.confidence}%</span>
          ${execIcon}
        </div>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="aa-header">
        <div class="aa-title-row">
          <span class="aa-title">AI Trading Agent</span>
          <span class="aa-status">
            ${st.pulse ? '<span class="aa-pulse"></span>' : ''}
            <span style="color:${st.color}">${this.state.status.toUpperCase()}</span>
          </span>
        </div>
      </div>
      <div class="aa-stats">
        <div class="aa-stat"><span class="aa-stat-label">Cycles</span><span class="aa-stat-value">${stats.totalCycles}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Trades</span><span class="aa-stat-value">${stats.trades}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Wins</span><span class="aa-stat-value" style="color:#22c55e">${stats.wins}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Losses</span><span class="aa-stat-value" style="color:#ef4444">${stats.losses}</span></div>
      </div>
      ${this.state.currentToken ? `
      <div class="aa-current">
        <span class="aa-label">Analyzing</span>
        <span class="aa-current-token">${this.state.currentToken}</span>
        <span class="aa-cycle-num">Cycle #${this.state.cycleCount}</span>
      </div>` : ''}
      <div class="aa-config">
        <div class="aa-row">
          <span class="aa-label">Interval</span>
          <select class="aa-select" data-field="interval">
            <option value="60000" ${this.state.intervalMs === 60000 ? 'selected' : ''}>1 min</option>
            <option value="300000" ${this.state.intervalMs === 300000 ? 'selected' : ''}>5 min</option>
            <option value="900000" ${this.state.intervalMs === 900000 ? 'selected' : ''}>15 min</option>
          </select>
        </div>
        <div class="aa-row">
          <span class="aa-label">Min Confidence</span>
          <select class="aa-select" data-field="confidence">
            <option value="60" ${this.state.minConfidence === 60 ? 'selected' : ''}>60%</option>
            <option value="70" ${this.state.minConfidence === 70 ? 'selected' : ''}>70%</option>
            <option value="80" ${this.state.minConfidence === 80 ? 'selected' : ''}>80%</option>
            <option value="90" ${this.state.minConfidence === 90 ? 'selected' : ''}>90%</option>
          </select>
        </div>
      </div>
      <button class="aa-toggle ${running ? 'stop' : 'start'}" data-action="toggle">
        ${running ? '<span class="aa-pulse"></span> STOP AGENT' : '▶ START AGENT'}
      </button>
      ${this.history.length > 0 ? `
      <div class="aa-log">
        <div class="aa-log-header">Recent Cycles</div>
        ${cycleLog}
      </div>` : ''}
      ${this.css()}`;

    this.el.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
      if (running) {
        stopAgent();
      } else {
        const interval = parseInt((this.el.querySelector('[data-field="interval"]') as HTMLSelectElement)?.value || '300000');
        const confidence = parseInt((this.el.querySelector('[data-field="confidence"]') as HTMLSelectElement)?.value || '70');
        startAgent({ intervalMs: interval, minConfidence: confidence });
      }
    });
  }

  private css(): string {
    return `<style>
      .ai-agent{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column;gap:10px}
      .aa-title-row{display:flex;justify-content:space-between;align-items:center}
      .aa-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
      .aa-status{font-weight:600;font-size:11px;display:flex;align-items:center;gap:6px}
      .aa-pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;animation:aa-pulse-anim 1.5s ease-in-out infinite}
      @keyframes aa-pulse-anim{0%,100%{opacity:1}50%{opacity:.3}}
      .aa-stats{display:flex;gap:8px}
      .aa-stat{display:flex;flex-direction:column;align-items:center;flex:1;background:#0a0a0a;padding:8px 4px;border-radius:6px;border:1px solid #1a1a1a}
      .aa-stat-label{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.03em}
      .aa-stat-value{font-size:16px;font-weight:700;color:#e5e5e5}
      .aa-current{display:flex;align-items:center;gap:8px;background:#0d0d0d;padding:8px 12px;border-radius:6px;border:1px solid #1a1a1a}
      .aa-current-token{color:#fff;font-weight:700;font-size:14px}
      .aa-cycle-num{color:#555;font-size:10px;margin-left:auto}
      .aa-config{display:flex;flex-direction:column;gap:6px}
      .aa-row{display:flex;align-items:center;gap:8px}
      .aa-label{font-size:11px;color:#666;min-width:100px}
      .aa-select{background:#111;border:1px solid #2a2a2a;color:#fff;padding:6px 10px;border-radius:4px;font-size:12px;flex:1}
      .aa-select:focus{outline:none;border-color:#3b82f6}
      .aa-toggle{padding:12px;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px}
      .aa-toggle.start{background:#22c55e}
      .aa-toggle.stop{background:#ef4444}
      .aa-toggle:hover{filter:brightness(1.1)}
      .aa-toggle:active{transform:scale(.98)}
      .aa-log{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:2px;max-height:180px;overflow-y:auto}
      .aa-log-header{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.04em;padding-bottom:4px;border-bottom:1px solid #1a1a1a;margin-bottom:4px}
      .aa-log-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px}
      .aa-log-time{color:#555;min-width:36px;font-family:monospace}
      .aa-log-token{color:#aaa;font-weight:600;min-width:40px}
      .aa-log-action{font-weight:700;min-width:40px;font-size:10px}
      .aa-log-conf{color:#888;min-width:30px;font-family:monospace}
    </style>`;
  }

  destroy(): void {
    this.unsub?.();
  }
}
