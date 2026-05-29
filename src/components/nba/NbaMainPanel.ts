import { Panel, type PanelOptions } from '../Panel';
import { automationEngine, getStrategyTemplates, type AutomationRun, type AgentMessage, type StrategyConfig } from '@/services/nba/automation-engine';

export class NbaMainPanel extends Panel {
  private activeRun: AutomationRun | null = null;
  private agentLog: AgentMessage[] = [];
  private unsubscribePipeline: (() => void) | null = null;
  private unsubscribeAgent: (() => void) | null = null;

  constructor(options: PanelOptions) {
    super(options);
    this.element.classList.add('nba-main-panel');
  }

  protected renderContent(): void {
    this.activeRun = automationEngine.getActiveRun();
    this.agentLog = automationEngine.getAgentLog();
    this.renderDashboard();
    this.unsubscribePipeline = automationEngine.onPipelineUpdate((run) => {
      this.activeRun = run;
      this.renderDashboard();
    });
    this.unsubscribeAgent = automationEngine.onAgentMessage((msg) => {
      this.agentLog.push(msg);
      this.appendToTerminal(msg);
    });
  }

  private renderDashboard(): void {
    const templates = getStrategyTemplates();
    const hasRun = this.activeRun !== null && this.activeRun.status !== 'idle';

    const html = `
      <div class="nba-main-layout">
        <div class="nba-main-agents">
          ${this.renderAgentCard('market-analyst', 'Market Analyst', '\uD83D\uDD0D')}
          ${this.renderAgentCard('strategy-architect', 'Strategy Architect', '\uD83D\uDCD0')}
          ${this.renderAgentCard('developer', 'Developer', '\u26A1')}
          ${this.renderAgentCard('qa', 'QA', '\u2713')}
        </div>
        <div class="nba-main-pipeline">
          ${hasRun ? this.renderActivePipeline() : this.renderIdle(templates)}
        </div>
        <div class="nba-main-terminal">
          <div class="nba-main-terminal-header">
            <span class="nba-main-terminal-dot"></span>
            <span class="nba-main-terminal-title">Agent Terminal</span>
            <span class="nba-main-terminal-count">${this.agentLog.length} msgs</span>
          </div>
          <div class="nba-main-terminal-body" id="nba-main-terminal-body">
            ${this.agentLog.length === 0 ? '<div class="nba-main-terminal-empty">Run a strategy to see agent activity...</div>' : this.agentLog.slice(-20).map(msg => this.renderTerminalLine(msg)).join('')}
          </div>
        </div>
      </div>
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private renderAgentCard(role: string, name: string, icon: string): string {
    const isActive = this.activeRun !== null && this.activeRun.status !== 'idle' && this.activeRun.status !== 'completed';
    const lastMsg = this.agentLog.filter(m => m.role === role).pop();
    const phase = lastMsg?.phase || 'idle';
    const lastAction = lastMsg?.content ? this.truncate(lastMsg.content, 50) : 'Waiting...';

    return `
      <div class="nba-main-agent-card ${isActive ? 'active' : ''}" data-role="${role}">
        <div class="nba-main-agent-header">
          <span class="nba-main-agent-icon">${icon}</span>
          <span class="nba-main-agent-name">${name}</span>
          <span class="nba-main-agent-status ${phase}"></span>
        </div>
        <div class="nba-main-agent-action">${lastAction}</div>
      </div>
    `;
  }

  private renderIdle(templates: StrategyConfig[]): string {
    return `
      <div class="nba-main-idle">
        <div class="nba-main-idle-icon">\uD83E\uDD16</div>
        <div class="nba-main-idle-title">NBA Automation Engine</div>
        <div class="nba-main-idle-sub">Select a strategy to start automated prediction market trading</div>
        <div class="nba-main-idle-strategies">
          ${templates.map(t => `
            <div class="nba-main-idle-strategy" data-type="${t.type}">
              <div class="nba-main-idle-strategy-name">${t.name}</div>
              <div class="nba-main-idle-strategy-desc">${t.description}</div>
            </div>
          `).join('')}
        </div>
        <button class="nba-main-start-btn" data-type="${templates[0].type}">Start Strategy</button>
      </div>
    `;
  }

  private renderActivePipeline(): string {
    if (!this.activeRun) return '';
    const result = this.activeRun.result;

    return `
      <div class="nba-main-pipeline-header">
        <div>
          <div class="nba-main-pipeline-title">${this.activeRun.strategyName}</div>
          <div class="nba-main-pipeline-status ${this.activeRun.status}">${this.activeRun.status.toUpperCase()}</div>
        </div>
        <div class="nba-main-pipeline-progress">Step ${this.activeRun.currentStepIndex + 1}/${this.activeRun.steps.length}</div>
      </div>
      <div class="nba-main-pipeline-steps">
        ${this.activeRun.steps.map(s => this.renderStep(s)).join('')}
      </div>
      ${result ? `
        <div class="nba-main-decision">
          <div class="nba-main-decision-header">DECISION</div>
          <div class="nba-main-decision-action ${result.action === 'buy_yes' ? 'buy' : result.action === 'buy_no' ? 'sell' : ''}">
            ${result.action === 'buy_yes' ? 'BUY YES' : result.action === 'buy_no' ? 'BUY NO' : result.action.toUpperCase()}
          </div>
          <div class="nba-main-decision-market">${result.question}</div>
          <div class="nba-main-decision-metrics">
            <div class="nba-main-decision-metric">
              <span class="nba-metric-label">Confidence</span>
              <span class="nba-metric-value">${result.confidence}%</span>
            </div>
            <div class="nba-main-decision-metric">
              <span class="nba-metric-label">Edge</span>
              <span class="nba-metric-value edge">${result.edge}%</span>
            </div>
            <div class="nba-main-decision-metric">
              <span class="nba-metric-label">Exp. P&L</span>
              <span class="nba-metric-value pnl">$${result.expectedPnl}</span>
            </div>
          </div>
          <div class="nba-main-decision-reasoning">
            ${result.reasoning.map(r => `<div class="nba-main-decision-reason">\u2022 ${r}</div>`).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  private renderStep(step: { id: string; name: string; status: string; result?: string }): string {
    const isActive = step.status === 'running';
    const isDone = step.status === 'completed';
    const isFailed = step.status === 'failed';
    const cls = isActive ? 'active' : isDone ? 'completed' : isFailed ? 'failed' : 'pending';
    const icon = isActive ? '\u23F3' : isDone ? '\u2713' : isFailed ? '\u2716' : '\u25CB';

    return `
      <div class="nba-main-step ${cls}">
        <span class="nba-main-step-icon">${icon}</span>
        <span class="nba-main-step-name">${step.name}</span>
        ${step.result ? `<span class="nba-main-step-result">${this.truncate(step.result, 60)}</span>` : ''}
      </div>
    `;
  }

  private renderTerminalLine(msg: AgentMessage): string {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const agentLabel = msg.role === 'market-analyst' ? 'Analyst'
      : msg.role === 'strategy-architect' ? 'Architect'
      : msg.role === 'developer' ? 'Dev'
      : msg.role === 'qa' ? 'QA'
      : 'System';
    return `
      <div class="nba-main-terminal-line ${msg.role}">
        <span class="nba-main-term-time">${time}</span>
        <span class="nba-main-term-agent ${msg.role}">[${agentLabel}]</span>
        <span class="nba-main-term-msg">${msg.content}</span>
      </div>
    `;
  }

  private appendToTerminal(msg: AgentMessage): void {
    const body = this.element.querySelector('#nba-main-terminal-body');
    if (!body) return;
    const line = document.createElement('div');
    line.className = `nba-main-terminal-line ${msg.role}`;
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const agentLabel = msg.role === 'market-analyst' ? 'Analyst'
      : msg.role === 'strategy-architect' ? 'Architect'
      : msg.role === 'developer' ? 'Dev'
      : msg.role === 'qa' ? 'QA'
      : 'System';
    line.innerHTML = `<span class="nba-main-term-time">${time}</span><span class="nba-main-term-agent ${msg.role}">[${agentLabel}]</span><span class="nba-main-term-msg">${msg.content}</span>`;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
    const count = this.element.querySelector('.nba-main-terminal-count');
    if (count) count.textContent = `${this.agentLog.length} msgs`;
  }

  private attachEvents(): void {
    this.element.querySelectorAll('.nba-main-idle-strategy').forEach(el => {
      el.addEventListener('click', () => {
        this.element.querySelectorAll('.nba-main-idle-strategy').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        const btn = this.element.querySelector('.nba-main-start-btn') as HTMLButtonElement;
        if (btn) btn.dataset.type = (el as HTMLElement).dataset.type || '';
      });
    });

    this.element.querySelector('.nba-main-start-btn')?.addEventListener('click', () => {
      const btn = this.element.querySelector('.nba-main-start-btn') as HTMLButtonElement;
      const type = btn.dataset.type || 'arbitrage';
      const templates = getStrategyTemplates();
      const config = templates.find(t => t.type === type) || templates[0];
      automationEngine.startStrategy(config);
    });
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  public async refresh(): Promise<void> {
    this.activeRun = automationEngine.getActiveRun();
    this.agentLog = automationEngine.getAgentLog();
    this.renderDashboard();
  }

  public dispose(): void {
    this.unsubscribePipeline?.();
    this.unsubscribeAgent?.();
  }
}
