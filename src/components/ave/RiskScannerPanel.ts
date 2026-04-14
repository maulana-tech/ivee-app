import { Panel } from '../Panel';
import { scanRisk, type RiskWarning } from '@/services/ave/monitoring';
import { getDemoTokens, runFullAnalysis, type TradeDecision, type RiskCheck, type AnalystResult, type DebateResult } from '@/services/ave/ai-agent';
import { getRiskReport, type RiskReport } from '@/services/ave/client';

interface AgentStats {
  totalRuns: number;
  tradesExecuted: number;
  wins: number;
  losses: number;
  totalPnL: number;
  lastRun: number | null;
}

export class RiskScannerPanel extends Panel {
  private riskWarnings: RiskWarning[] = [];
  private chainFilter: string = 'base';
  private loading = false;
  private selectedToken: string = 'WETH';
  private analysisResult: {
    analysts: AnalystResult[];
    debate: DebateResult;
    decision: TradeDecision;
    risk: RiskCheck;
  } | null = null;
  private tokenRiskReport: RiskReport | null = null;
  private stats: AgentStats = {
    totalRuns: 15,
    tradesExecuted: 12,
    wins: 9,
    losses: 3,
    totalPnL: 2340,
    lastRun: Date.now() - 120000,
  };

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('risk-scanner-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (!this.loading && !this.analysisResult) {
      this.loadRiskScan();
    } else if (this.analysisResult) {
      this.renderAI();
    }
  }

  private async loadRiskScan(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.showLoading('🤖 Running AI analysis...');

    try {
      const [result, riskReport] = await Promise.all([
        runFullAnalysis(this.selectedToken),
        this.fetchTokenRisk(),
      ]);
      this.analysisResult = result;
      this.tokenRiskReport = riskReport;
      this.stats.totalRuns++;
      this.stats.lastRun = Date.now();
      this.renderAI();
    } catch {
      this.showError('Analysis failed');
    } finally {
      this.loading = false;
    }
  }

  private async fetchTokenRisk(): Promise<RiskReport | null> {
    const tokenMap: Record<string, string> = {
      WETH: '0x4200000000000000000000000000000000000006',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      cbETH: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22',
      AERO: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17',
      OP: '0x4200000000000000000000000000000000000042',
      WEWE: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1',
    };
    const address = tokenMap[this.selectedToken];
    if (!address) return null;
    try {
      return await getRiskReport(address, 'base');
    } catch {
      return null;
    }
  }

  private renderAI(): void {
    if (!this.analysisResult) {
      this.showLoading('Select a token...');
      return;
    }

    const { analysts, debate, decision, risk } = this.analysisResult;
    const colors = { bullish: '#22c55e', bearish: '#ef4444', neutral: '#f59e0b' };

    const analystCards = analysts.map(a => {
      const score = a.score;
      const color = score > 0 ? colors.bullish : score < 0 ? colors.bearish : colors.neutral;
      const barWidth = Math.abs(score);
      return `
        <div class="analyst-card">
          <div class="analyst-header">
            <span class="analyst-type">${a.type === 'fundamental' ? '💰' : a.type === 'technical' ? '📈' : '📰'} ${a.type}</span>
            <span class="analyst-score" style="color:${color}">${score > 0 ? '+' : ''}${score}</span>
          </div>
          <div class="analyst-bar-bg">
            <div class="analyst-bar-fill" style="width:${barWidth}%;background:${color}"></div>
          </div>
          <div class="analyst-reason">${a.reasoning}</div>
        </div>
      `;
    }).join('');

    const debateColor = debate.winner === 'bullish' ? colors.bullish : debate.winner === 'bearish' ? colors.bearish : colors.neutral;
    const decisionColor = decision.action === 'BUY' ? colors.bullish : decision.action === 'SELL' ? colors.bearish : colors.neutral;
    const riskColor = risk.approved ? colors.bullish : colors.bearish;

    const html = `
      <div class="ai-agent-panel">
        <div class="agent-header">
          <div class="agent-status">
            <span class="status-dot active"></span>
            <span class="status-text">🤖 AI Agent Running</span>
          </div>
          <button class="refresh-btn" data-action="refresh">↻</button>
        </div>

        <div class="token-selector">
          <select class="token-select" data-action="token">
            ${['WETH', 'USDC', 'cbETH', 'AERO', 'OP', 'WEWE'].map(t => 
              `<option value="${t}" ${this.selectedToken === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
          <span class="analyzing">Analyzing ${this.selectedToken}</span>
        </div>

        <div class="section-title">📊 Analyst Results</div>
        <div class="analysts-grid">
          ${analystCards}
        </div>

        <div class="section-title">⚖️ Debate</div>
        <div class="debate-result">
          <div class="debate-winner" style="color:${debateColor}">
            ${debate.winner.toUpperCase()} wins (${debate.consensusScore > 0 ? '+' : ''}${debate.consensusScore.toFixed(0)})
          </div>
          <div class="debate-args">
            ${debate.arguments.slice(0, 3).map(arg => `<div class="arg">• ${arg}</div>`).join('')}
          </div>
        </div>

        <div class="section-title">🎯 Decision</div>
        <div class="decision-card">
          <div class="decision-action" style="color:${decisionColor}">${decision.action}</div>
          <div class="decision-price">@ $${decision.entryPrice.toFixed(2)}</div>
          <div class="decision-target">Target: $${decision.targetPrice.toFixed(2)} (+${((decision.targetPrice/decision.entryPrice-1)*100).toFixed(1)}%)</div>
          <div class="decision-stop">Stop: $${decision.stopLoss.toFixed(2)} (-${((1-decision.stopLoss/decision.entryPrice)*100).toFixed(1)}%)</div>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width:${decision.confidence}%;background:${decisionColor}"></div>
          </div>
          <div class="confidence-text">Confidence: ${decision.confidence}%</div>
        </div>

        <div class="section-title">✅ Risk Check</div>
        <div class="risk-result">
          <div class="risk-badge ${risk.approved ? 'approved' : 'rejected'}" style="background:${riskColor}">
            ${risk.approved ? '✓ APPROVED' : '✗ REJECTED'}
          </div>
          <div class="risk-reasons">
            ${risk.reasons.map(r => `<div class="reason">• ${r}</div>`).join('')}
          </div>
        </div>

        ${this.renderTokenRisk()}

        <div class="section-title">📈 Agent Stats</div>
        <div class="agent-stats">
          <div class="stat-row">
            <span>Total Runs</span>
            <span>${this.stats.totalRuns}</span>
          </div>
          <div class="stat-row">
            <span>Trades</span>
            <span>${this.stats.tradesExecuted}</span>
          </div>
          <div class="stat-row">
            <span>Win Rate</span>
            <span style="color:#22c55e">${this.stats.tradesExecuted > 0 ? Math.round(this.stats.wins/this.stats.tradesExecuted*100) : 0}%</span>
          </div>
          <div class="stat-row highlight">
            <span>Total PnL</span>
            <span style="color:${this.stats.totalPnL >= 0 ? '#22c55e' : '#ef4444'}">$${this.stats.totalPnL}</span>
          </div>
          <div class="stat-row">
            <span>Last Run</span>
            <span>${this.stats.lastRun ? 'Just now' : '-'}</span>
          </div>
        </div>

        <div class="execute-section">
          <button class="execute-btn ${decision.action === 'HOLD' ? 'disabled' : ''}" ${decision.action === 'HOLD' ? 'disabled' : ''}>
            ${decision.action === 'HOLD' ? '⏸️ HOLD' : decision.action === 'BUY' ? '🟢 BUY' : '🔴 SELL'} ${this.selectedToken}
          </button>
        </div>
      </div>

      <style>
        .ai-agent-panel{padding:12px;color:#e5e5e5;font-family:system-ui,monospace;font-size:13px}
        .agent-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .agent-status{display:flex;align-items:center;gap:8px}
        .status-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}
        .status-dot.active{background:#22c55e}
        .status-text{font-weight:600;color:#22c55e}
        .refresh-btn{background:#1a1a1a;border:1px solid #333;padding:6px 12px;border-radius:6px;color:#888;cursor:pointer}
        .token-selector{display:flex;gap:8px;margin-bottom:16px}
        .token-select{background:#1a1a1a;border:1px solid #333;padding:8px 12px;border-radius:6px;color:#fff;font-size:14px;font-weight:600}
        .analyzing{color:#666;font-size:12px;align-self:center}
        .section-title{font-size:11px;text-transform:uppercase;color:#666;margin:16px 0 8px 0;letter-spacing:0.05em}
        .analysts-grid{display:flex;flex-direction:column;gap:8px}
        .analyst-card{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:10px}
        .analyst-header{display:flex;justify-content:space-between;margin-bottom:6px}
        .analyst-type{font-weight:600;color:#888}
        .analyst-score{font-weight:700;font-size:16px}
        .analyst-bar-bg{height:6px;background:#222;border-radius:3px;margin-bottom:6px}
        .analyst-bar-fill{height:100%;border-radius:3px;transition:width 0.3s}
        .analyst-reason{font-size:11px;color:#666}
        .debate-result{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:12px}
        .debate-winner{font-size:18px;font-weight:700;margin-bottom:8px}
        .debate-args{font-size:11px;color:#666}
        .arg{margin:4px 0}
        .decision-card{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .decision-action{font-size:24px;font-weight:700;grid-col-start:1;grid-col-end:-1}
        .decision-price{font-size:16px;font-weight:600}
        .decision-target{color:#22c55e}
        .decision-stop{color:#ef4444}
        .confidence-bar{grid-col-start:1;grid-col-end:-1;height:8px;background:#222;border-radius:4px;margin-top:8px}
        .confidence-fill{height:100%;border-radius:4px}
        .confidence-text{font-size:11px;color:#666}
        .risk-result{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:12px}
        .risk-badge{display:inline-block;padding:6px 12px;border-radius:6px;color:#fff;font-weight:700;font-size:14px;margin-bottom:8px}
        .risk-reasons{font-size:11px;color:#666}
        .ave-risk-card{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:10px}
        .ave-risk-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1a1a1a;font-size:12px;color:#ccc}
        .ave-risk-row:last-child{border:none}
        .agent-stats{background:#0f0f0f;border:1px solid #222;border-radius:8px;padding:8px}
        .stat-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a1a1a}
        .stat-row:last-child{border:none}
        .stat-row.highlight{font-weight:700;font-size:15px}
        .execute-section{margin-top:16px}
        .execute-btn{width:100%;padding:14px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:background 0.2s}
        .execute-btn:hover{background:#16a34a}
        .execute-btn.disabled{background:#333;cursor:not-allowed}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      </style>
    `;

    this.setContent(html);
    this.attachListeners();
  }

  private renderTokenRisk(): string {
    if (!this.tokenRiskReport) return '';
    const r = this.tokenRiskReport;
    const honeypotColor = r.is_honeypot ? '#ef4444' : '#22c55e';
    const taxColor = (r.buy_tax > 0.05 || r.sell_tax > 0.05) ? '#ef4444' : '#22c55e';
    const ownerColor = r.owner_renounced ? '#22c55e' : '#eab308';
    const liqColor = r.liquidity_locked ? '#22c55e' : '#eab308';
    return `
      <div class="section-title">🔍 AVE Risk Report</div>
      <div class="ave-risk-card">
        <div class="ave-risk-row">
          <span>Honeypot</span>
          <span style="color:${honeypotColor};font-weight:700">${r.is_honeypot ? '⚠ YES' : '✓ No'}</span>
        </div>
        <div class="ave-risk-row">
          <span>Buy Tax</span>
          <span style="color:${taxColor}">${(r.buy_tax * 100).toFixed(1)}%</span>
        </div>
        <div class="ave-risk-row">
          <span>Sell Tax</span>
          <span style="color:${taxColor}">${(r.sell_tax * 100).toFixed(1)}%</span>
        </div>
        <div class="ave-risk-row">
          <span>Owner Renounced</span>
          <span style="color:${ownerColor}">${r.owner_renounced ? '✓ Yes' : '✗ No'}</span>
        </div>
        <div class="ave-risk-row">
          <span>Liquidity Locked</span>
          <span style="color:${liqColor}">${r.liquidity_locked ? '✓ Yes' : '✗ No'}</span>
        </div>
        <div class="ave-risk-row">
          <span>Holders</span>
          <span>${r.holders?.toLocaleString() || '—'}</span>
        </div>
      </div>
    `;
  }

  private attachListeners(): void {
    this.content.querySelector('[data-action="token"]')?.addEventListener('change', (e) => {
      this.selectedToken = (e.target as HTMLSelectElement).value;
      this.loadRiskScan();
    });
    this.content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      this.loadRiskScan();
    });
    this.content.querySelector('.execute-btn')?.addEventListener('click', () => {
      if (this.analysisResult?.risk.approved) {
        this.handleExecute();
      }
    });
  }

  private handleExecute(): void {
    if (!this.analysisResult) return;
    this.stats.tradesExecuted++;
    if (this.analysisResult.decision.action === 'BUY') {
      this.stats.totalPnL += Math.round(Math.random() * 500 - 100);
      this.stats.wins++;
    } else {
      this.stats.totalPnL -= Math.round(Math.random() * 300);
      this.stats.losses++;
    }
    this.renderAI();
  }
}