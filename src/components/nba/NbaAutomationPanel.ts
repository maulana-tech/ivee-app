import { Panel } from '../Panel';
import {
  automationEngine,
  getStrategyTemplates,
  type AutomationRun,
  type StrategyConfig,
  type AgentMessage,
  type PipelineStep,
} from '@/services/nba/automation-engine';

const AGENT_ICONS: Record<string, string> = {
  'market-analyst': '&#128200;',
  'strategy-architect': '&#127919;',
  'developer': '&#128187;',
  'qa': '&#9989;',
  'system': '&#9881;',
};

const AGENT_COLORS: Record<string, string> = {
  'market-analyst': '#4488ff',
  'strategy-architect': '#ffaa00',
  'developer': '#00ff88',
  'qa': '#ff44ff',
  'system': '#888888',
};

export class NbaAutomationPanel extends Panel {
  private selectedStrategy: StrategyConfig | null = null;
  private activeRun: AutomationRun | null = null;
  private agentLog: AgentMessage[] = [];
  private unsubscribePipeline: (() => void) | null = null;
  private unsubscribeAgent: (() => void) | null = null;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-automation-panel');
  }

  protected renderContent(): void {
    this.renderDashboard();
    this.unsubscribePipeline = automationEngine.onPipelineUpdate((run) => {
      this.activeRun = run;
      this.updatePipeline();
    });
    this.unsubscribeAgent = automationEngine.onAgentMessage((msg) => {
      this.agentLog.push(msg);
      this.appendAgentLog(msg);
    });
  }

  private renderDashboard(): void {
    const templates = getStrategyTemplates();
    const activeRun = automationEngine.getActiveRun();

    const html = `
      <div class="nba-auto-layout">
        <div class="nba-auto-sidebar">
          <div class="nba-auto-sidebar-header">
            <h3>Strategy Templates</h3>
            <span class="nba-auto-badge">Canon</span>
          </div>
          <div class="nba-auto-templates">
            ${templates.map(t => this.renderTemplateCard(t)).join('')}
          </div>
          <div class="nba-auto-history">
            <h4>Run History</h4>
            <div class="nba-auto-history-list" id="autoHistory">
              ${this.renderHistory()}
            </div>
          </div>
        </div>
        <div class="nba-auto-main">
          <div class="nba-auto-pipeline" id="autoPipeline">
            ${activeRun ? this.renderPipeline(activeRun) : this.renderIdleState()}
          </div>
          <div class="nba-auto-terminal">
            <div class="nba-auto-terminal-header">
              <span class="nba-auto-terminal-dot" style="background:#ff5f57"></span>
              <span class="nba-auto-terminal-dot" style="background:#febc2e"></span>
              <span class="nba-auto-terminal-dot" style="background:#28c840"></span>
              <span class="nba-auto-terminal-title">Agent Console</span>
            </div>
            <div class="nba-auto-terminal-body" id="autoTerminal">
              <div class="nba-auto-terminal-line system">
                <span class="nba-auto-prompt">$</span> IVEE Automation Engine v1.0 ready
              </div>
              <div class="nba-auto-terminal-line system">
                <span class="nba-auto-prompt">$</span> Select a strategy and click "Start" to begin
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.setContent(html);
    this.attachEvents();
  }

  private renderTemplateCard(template: StrategyConfig): string {
    const typeLabels: Record<string, string> = {
      'arbitrage': 'Arbitrage',
      'momentum': 'Momentum',
      'cross-market': 'Cross-Market',
      'speed': 'Speed',
      'custom': 'Custom',
    };

    return `
      <div class="nba-auto-template ${template.type}" data-type="${template.type}">
        <div class="nba-auto-template-header">
          <span class="nba-auto-type-badge">${typeLabels[template.type]}</span>
          <span class="nba-auto-schedule">${template.schedule}</span>
        </div>
        <div class="nba-auto-template-name">${template.name}</div>
        <div class="nba-auto-template-desc">${template.description}</div>
        <div class="nba-auto-template-meta">
          <span>Risk: $${template.riskLimit}</span>
          <span>Max: $${template.maxSize}</span>
        </div>
        <button class="nba-auto-start-btn" data-type="${template.type}">Start</button>
      </div>
    `;
  }

  private renderIdleState(): string {
    return `
      <div class="nba-auto-idle">
        <div class="nba-auto-idle-icon">&#9889;</div>
        <h3>No Active Automation</h3>
        <p>Select a strategy template and click Start to begin the automation pipeline.</p>
        <div class="nba-auto-pipeline-flow">
          <div class="nba-auto-flow-step">Fetch Data</div>
          <div class="nba-auto-flow-arrow">&#8594;</div>
          <div class="nba-auto-flow-step">Analyze</div>
          <div class="nba-auto-flow-arrow">&#8594;</div>
          <div class="nba-auto-flow-step">Decide</div>
          <div class="nba-auto-flow-arrow">&#8594;</div>
          <div class="nba-auto-flow-step">Execute</div>
          <div class="nba-auto-flow-arrow">&#8594;</div>
          <div class="nba-auto-flow-step">Monitor</div>
        </div>
      </div>
    `;
  }

  private renderPipeline(run: AutomationRun): string {
    return `
      <div class="nba-auto-pipeline-active">
        <div class="nba-auto-pipeline-header">
          <h3>${run.strategyName}</h3>
          <span class="nba-auto-run-status ${run.status}">${run.status.toUpperCase()}</span>
        </div>
        <div class="nba-auto-steps">
          ${run.steps.map((step, i) => this.renderStep(step, i, run.currentStepIndex)).join('')}
        </div>
        ${run.result ? this.renderResult(run.result) : ''}
      </div>
    `;
  }

  private renderStep(step: PipelineStep, index: number, currentIndex: number): string {
    const isActive = index === currentIndex && step.status === 'running';
    const icon = step.status === 'completed' ? '&#10003;'
      : step.status === 'failed' ? '&#10007;'
      : isActive ? '<span class="nba-auto-spinner">&#9696;</span>'
      : '&#9675;';

    const statusClass = step.status === 'completed' ? 'completed'
      : step.status === 'failed' ? 'failed'
      : isActive ? 'active'
      : 'pending';

    return `
      <div class="nba-auto-step ${statusClass} ${isActive ? 'active' : ''}">
        <div class="nba-auto-step-icon">${icon}</div>
        <div class="nba-auto-step-info">
          <div class="nba-auto-step-name">${step.name}</div>
          <div class="nba-auto-step-detail">${step.status === 'running' ? step.result : step.status === 'completed' && step.duration ? `${step.duration}ms` : ''}</div>
        </div>
        <div class="nba-auto-step-phase">${step.phase}</div>
      </div>
      ${index < 7 ? '<div class="nba-auto-step-connector"></div>' : ''}
    `;
  }

  private renderResult(result: any): string {
    return `
      <div class="nba-auto-result">
        <div class="nba-auto-result-header">Decision</div>
        <div class="nba-auto-result-action">${result.action.replace('_', ' ').toUpperCase()}</div>
        <div class="nba-auto-result-market">${result.question}</div>
        <div class="nba-auto-result-details">
          <span>Side: ${result.side.toUpperCase()} @ $${result.confidence / 100}</span>
          <span>Edge: ${result.edge}%</span>
          <span>Expected P&L: $${result.expectedPnl}</span>
        </div>
        <div class="nba-auto-result-reasoning">
          ${result.reasoning.map((r: string) => `<div class="nba-auto-reason">&#8226; ${r}</div>`).join('')}
        </div>
      </div>
    `;
  }

  private renderHistory(): string {
    const history = automationEngine.getRunHistory();
    if (history.length === 0) return '<div class="nba-auto-history-empty">No runs yet</div>';
    return history.slice(0, 10).map(r => `
      <div class="nba-auto-history-item ${r.status}">
        <span class="nba-auto-history-name">${r.strategyName}</span>
        <span class="nba-auto-history-status">${r.status === 'completed' ? '&#10003;' : '&#10007;'}</span>
      </div>
    `).join('');
  }

  private appendAgentLog(msg: AgentMessage): void {
    const terminal = this.element.querySelector('#autoTerminal');
    if (!terminal) return;

    const line = document.createElement('div');
    line.className = `nba-auto-terminal-line ${msg.role}`;
    const icon = AGENT_ICONS[msg.role] || '&#9679;';
    const color = AGENT_COLORS[msg.role] || '#888';
    const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    line.innerHTML = `<span class="nba-auto-agent-badge" style="color:${color}">${icon} ${msg.role.replace('-', ' ')}</span> <span class="nba-auto-time">${time}</span> ${msg.content}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }

  private updatePipeline(): void {
    const pipelineEl = this.element.querySelector('#autoPipeline');
    if (!pipelineEl || !this.activeRun) return;
    pipelineEl.innerHTML = this.renderPipeline(this.activeRun);
  }

  private attachEvents(): void {
    this.element.querySelectorAll('.nba-auto-start-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.type as StrategyConfig['type'];
        const template = getStrategyTemplates().find(t => t.type === type);
        if (template) {
          this.activeRun = null;
          this.agentLog = [];
          const terminal = this.element.querySelector('#autoTerminal');
          if (terminal) terminal.innerHTML = '';
          automationEngine.startStrategy(template);
        }
      });
    });
  }

  public dispose(): void {
    this.unsubscribePipeline?.();
    this.unsubscribeAgent?.();
  }

  public async refresh(): Promise<void> {
    this.renderDashboard();
  }
}
