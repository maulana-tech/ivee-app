import {
  startAgent,
  stopAgent,
  onAgentUpdate,
  loadAgentState,
  getAgentStats,
  type AgentState,
  type AgentCycleResult,
} from '@/services/ave/auto-agent';

export class AiAgent {
  private el: HTMLElement;
  private state: AgentState = loadAgentState();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ai-agent';
    parent.appendChild(this.el);
    this.render();
    onAgentUpdate((state) => { this.state = state; this.render(); });
  }

  private render(): void {
    const stats = getAgentStats();
    const statusColor: Record<string, string> = { idle: '#888', running: '#22c55e', analyzing: '#eab308', executing: '#3b82f6', error: '#ef4444' };
    const running = this.state.running;

    this.el.innerHTML = `
      <div class="aa-header">
        <span class="aa-title">AI Trading Agent</span>
        <span class="aa-status" style="color:${statusColor[this.state.status] || '#888'}">${this.state.status.toUpperCase()}</span>
      </div>
      <div class="aa-stats">
        <div class="aa-stat"><span class="aa-stat-label">Cycles</span><span class="aa-stat-value">${stats.totalCycles}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Trades</span><span class="aa-stat-value">${stats.trades}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Wins</span><span class="aa-stat-value">${stats.wins}</span></div>
        <div class="aa-stat"><span class="aa-stat-label">Losses</span><span class="aa-stat-value">${stats.losses}</span></div>
      </div>
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
        ${running ? 'STOP AGENT' : 'START AGENT'}
      </button>
      <style>
        .ai-agent{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column;gap:10px}
        .aa-header{display:flex;justify-content:space-between;align-items:center}
        .aa-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
        .aa-status{font-weight:600;font-size:11px}
        .aa-stats{display:flex;gap:12px}
        .aa-stat{display:flex;flex-direction:column;align-items:center;flex:1;background:#0a0a0a;padding:8px;border-radius:6px;border:1px solid #1a1a1a}
        .aa-stat-label{font-size:10px;color:#666;text-transform:uppercase}
        .aa-stat-value{font-size:16px;font-weight:700;color:#e5e5e5}
        .aa-config{display:flex;flex-direction:column;gap:6px}
        .aa-row{display:flex;align-items:center;gap:8px}
        .aa-label{font-size:12px;color:#888;min-width:100px}
        .aa-select{background:#1a1a1a;border:1px solid #333;color:#fff;padding:6px 10px;border-radius:4px;font-size:12px;flex:1}
        .aa-toggle{padding:12px;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:opacity .15s}
        .aa-toggle.start{background:#22c55e}
        .aa-toggle.stop{background:#ef4444}
        .aa-toggle:hover{opacity:.9}
      </style>
    `;

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
}
