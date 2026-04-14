import { Panel } from '../Panel';
import { getWalletStatus, getTradeHistory, getTotalPnL, getWinRate, executeTrade, connectWallet, type WalletStatus, type AgentTrade } from '@/services/ave/trading';
import { runFullAnalysis, type TradeDecision, type RiskCheck, type AnalystResult, type DebateResult } from '@/services/ave/ai-agent';
import { startAgent, stopAgent, loadAgentState, onAgentUpdate, getAgentStats, type AgentState, type AgentCycleResult } from '@/services/ave/auto-agent';

export class TradingPanel extends Panel {
  private selectedToken = 'WETH';
  private loading = false;
  private analysis: {
    analysts: AnalystResult[];
    debate: DebateResult;
    decision: TradeDecision;
    risk: RiskCheck;
  } | null = null;
  private agentState: AgentState = loadAgentState();
  private unsubscribe?: () => void;

  constructor() {
    super({ id: 'trading', title: 'Trade Execution' });
    this.element.classList.add('trading-panel', 'panel-wide');
  }

  protected renderContent(): void {
    if (!this.analysis && !this.loading) {
      this.runAnalysis();
    }
    this.unsubscribe = onAgentUpdate((state) => {
      this.agentState = state;
      this.renderPanel();
    });
  }

  private async runAnalysis(): Promise<void> {
    this.loading = true;
    this.showLoading('AI analyzing ' + this.selectedToken + '...');
    try {
      this.analysis = await runFullAnalysis(this.selectedToken);
      this.renderPanel();
    } catch {
      this.showError('Analysis failed');
    } finally {
      this.loading = false;
    }
  }

  private async renderPanel(): Promise<void> {
    const wallet = await getWalletStatus();
    const trades = getTradeHistory().slice(-5).reverse();
    const totalPnL = getTotalPnL();
    const winRate = getWinRate();
    const canExecute = wallet.connected && wallet.chainId === 8453;
    const stats = getAgentStats();
    const agent = this.agentState;

    const walletHtml = wallet.connected
      ? `<div class="tw-wallet"><div class="tw-wallet-left"><span class="tw-wallet-dot"></span><span class="tw-wallet-label">Connected</span>${wallet.chainId === 8453 ? '<span class="tw-wallet-chain">Base</span>' : '<span class="tw-wallet-chain" style="color:#ef4444">Wrong Network</span>'}</div><div class="tw-wallet-right"><span class="tw-wallet-addr">${wallet.address ? wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4) : ''}</span><span class="tw-wallet-bal">${wallet.balance ? wallet.balance.toFixed(4) + ' ETH' : ''}</span></div></div>`
      : `<div class="tw-wallet tw-wallet-disconnected"><div class="tw-wallet-left"><span class="tw-wallet-dot tw-off"></span><span class="tw-wallet-label" style="color:#888">No Wallet</span></div><button class="tw-connect-btn" data-action="connect">Connect Wallet</button></div>`;

    const agentHtml = `<div class="tw-agent"><div class="tw-agent-header"><span class="tw-agent-title">AI Auto-Agent</span><span class="tw-agent-status ${agent.status}">${agent.status === 'running' ? 'RUNNING' : agent.status === 'analyzing' ? 'ANALYZING' : agent.status === 'executing' ? 'EXECUTING' : agent.status === 'error' ? 'ERROR' : 'IDLE'}</span></div><div class="tw-agent-stats"><div class="tw-agent-stat"><span class="tw-agent-stat-val">${stats.totalCycles}</span><span class="tw-agent-stat-label">Cycles</span></div><div class="tw-agent-stat"><span class="tw-agent-stat-val">${stats.trades}</span><span class="tw-agent-stat-label">Trades</span></div><div class="tw-agent-stat"><span class="tw-agent-stat-val">${stats.trades > 0 ? Math.round(stats.wins / stats.trades * 100) : 0}%</span><span class="tw-agent-stat-label">Win</span></div></div>${agent.currentToken ? `<div class="tw-agent-token">Current: <b>${agent.currentToken}</b></div>` : ''}${agent.lastRun ? `<div class="tw-agent-time">Last: ${new Date(agent.lastRun).toLocaleTimeString()}</div>` : ''}<div class="tw-agent-controls"><button class="tw-agent-btn ${agent.running ? 'stop' : 'start'}" data-action="${agent.running ? 'stop-agent' : 'start-agent'}">${agent.running ? 'Stop Agent' : 'Start Agent'}</button></div></div>`;

    const pnlHtml = `<div class="tw-pnl-bar"><div class="tw-pnl-item"><span class="tw-pnl-label">Total PnL</span><span class="tw-pnl-value" style="color:${totalPnL >= 0 ? '#22c55e' : '#ef4444'}">${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(0)}</span></div><div class="tw-pnl-item"><span class="tw-pnl-label">Win Rate</span><span class="tw-pnl-value" style="color:#22c55e">${winRate}%</span></div><div class="tw-pnl-item"><span class="tw-pnl-label">Trades</span><span class="tw-pnl-value">${getTradeHistory().length}</span></div></div>`;

    const analysisHtml = this.analysis ? this.renderAnalysis(canExecute) : '<div class="tw-empty">Select token and click Analyze</div>';

    const tradeHistoryHtml = trades.length > 0 ? `<div class="tw-section">Trade History</div><div class="tw-trades">${trades.map(t => `<div class="tw-trade"><span class="tw-trade-type ${t.type}">${t.type.toUpperCase()}</span><span class="tw-trade-token">${t.symbol}</span><span class="tw-trade-price">$${t.price.toFixed(2)}</span><span class="tw-trade-pnl" style="color:${(t.pnl || 0) >= 0 ? '#22c55e' : '#ef4444'}">${(t.pnl || 0) >= 0 ? '+' : ''}$${(t.pnl || 0).toFixed(0)}</span></div>`).join('')}</div>` : '<div class="tw-empty">No trades yet</div>';

    (this as any).content.innerHTML = `<div class="tw-root">${walletHtml}${agentHtml}${pnlHtml}<div class="tw-controls"><select class="tw-select" data-action="token">${['WETH', 'USDC', 'cbETH', 'AERO', 'OP', 'WEWE'].map(t => `<option value="${t}" ${this.selectedToken === t ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="tw-btn" data-action="refresh">Analyze</button></div>${analysisHtml}${tradeHistoryHtml}</div><style>.tw-root{padding:12px;color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif;font-size:13px}.tw-wallet{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#0d1b0f;border:1px solid #1a3a1e;border-radius:8px;margin-bottom:8px}.tw-wallet-left{display:flex;align-items:center;gap:8px}.tw-wallet-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e}.tw-wallet-label{font-weight:600;color:#22c55e;font-size:12px}.tw-wallet-right{display:flex;gap:12px;font-size:11px;color:#888}.tw-wallet-addr{font-family:'SF Mono',monospace;color:#555}.tw-wallet-bal{color:#ddd;font-weight:600}.tw-wallet-chain{font-size:10px;padding:2px 6px;background:#052e16;border-radius:3px;color:#22c55e}.tw-wallet-disconnected{border-color:#333}.tw-wallet-dot.tw-off{background:#555;box-shadow:none}.tw-connect-btn{background:#1a3a1e;border:1px solid #22c55e;padding:6px 16px;border-radius:6px;color:#22c55e;cursor:pointer;font-weight:600;font-size:12px}.tw-connect-btn:hover{background:#22c55e;color:#000}.tw-agent{background:#0a0f1a;border:1px solid #1a2a4a;border-radius:8px;padding:10px 12px;margin-bottom:8px}.tw-agent-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.tw-agent-title{font-weight:700;font-size:13px;color:#6ea8fe}.tw-agent-status{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase}.tw-agent-status.idle{background:#1a1a1a;color:#666}.tw-agent-status.running,.tw-agent-status.analyzing,.tw-agent-status.executing{background:#052e16;color:#22c55e;animation:apulse 2s infinite}.tw-agent-status.error{background:#2e0505;color:#ef4444}@keyframes apulse{0%,100%{opacity:1}50%{opacity:.6}}.tw-agent-stats{display:flex;gap:1px;background:#111;border-radius:6px;overflow:hidden;margin-bottom:8px}.tw-agent-stat{flex:1;text-align:center;padding:6px 4px;background:#0a0f1a}.tw-agent-stat-val{display:block;font-size:14px;font-weight:700;color:#6ea8fe}.tw-agent-stat-label{display:block;font-size:9px;color:#555;text-transform:uppercase}.tw-agent-token{font-size:11px;color:#888;margin-bottom:4px}.tw-agent-time{font-size:10px;color:#444;margin-bottom:6px}.tw-agent-controls{display:flex;gap:6px}.tw-agent-btn{flex:1;padding:6px;border-radius:6px;border:1px solid;font-weight:700;font-size:11px;cursor:pointer;text-transform:uppercase}.tw-agent-btn.start{background:#052e16;border-color:#22c55e;color:#22c55e}.tw-agent-btn.start:hover{background:#22c55e;color:#000}.tw-agent-btn.stop{background:#2e0505;border-color:#ef4444;color:#ef4444}.tw-agent-btn.stop:hover{background:#ef4444;color:#000}.tw-pnl-bar{display:flex;gap:1px;background:#1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:12px}.tw-pnl-item{flex:1;text-align:center;padding:10px 8px;background:#111}.tw-pnl-label{display:block;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.tw-pnl-value{display:block;font-size:16px;font-weight:700}.tw-controls{display:flex;gap:8px;margin-bottom:12px}.tw-select{flex:1;background:#1a1a1a;border:1px solid #333;padding:8px 12px;border-radius:6px;color:#fff;font-weight:600}.tw-btn{background:#1a3a1e;border:1px solid #22c55e;padding:8px 16px;border-radius:6px;color:#22c55e;cursor:pointer;font-weight:600}.tw-btn:hover{background:#22c55e;color:#000}.tw-section{font-size:10px;text-transform:uppercase;color:#555;letter-spacing:.06em;margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid #1a1a1a}.tw-analysis{background:#0a0a0a;border:1px solid #222;border-radius:8px;padding:12px;margin-bottom:8px}.tw-decision{display:flex;align-items:center;gap:12px;margin-bottom:8px}.tw-action{font-size:22px;font-weight:800;padding:4px 16px;border-radius:6px}.tw-action.buy{background:#052e16;color:#22c55e}.tw-action.sell{background:#2e0505;color:#ef4444}.tw-action.hold{background:#1a1a0a;color:#f59e0b}.tw-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px}.tw-price-item{text-align:center;padding:6px;background:#111;border-radius:4px}.tw-price-label{color:#555;font-size:9px;text-transform:uppercase}.tw-price-val{font-weight:600;margin-top:2px}.tw-confidence{margin-top:8px}.tw-conf-bar{height:6px;background:#222;border-radius:3px;overflow:hidden}.tw-conf-fill{height:100%;border-radius:3px;transition:width .4s}.tw-conf-text{font-size:10px;color:#666;margin-top:4px}.tw-risk{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;margin-top:6px}.tw-risk.ok{background:#052e16;color:#22c55e}.tw-risk.no{background:#2e0505;color:#ef4444}.tw-trades{display:flex;flex-direction:column;gap:4px}.tw-trade{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#0a0a0a;border-radius:4px;font-size:11px}.tw-trade-type{padding:2px 8px;border-radius:3px;font-weight:700;font-size:10px}.tw-trade-type.buy{background:#052e16;color:#22c55e}.tw-trade-type.sell{background:#2e0505;color:#ef4444}.tw-trade-token{flex:1;font-weight:600}.tw-trade-price{color:#888;font-family:monospace}.tw-trade-pnl{font-weight:700;font-family:monospace}.tw-empty{color:#444;font-size:12px;text-align:center;padding:16px}</style>`;

    this.attachListeners();
  }

  private renderAnalysis(canExecute: boolean): string {
    if (!this.analysis) return '';
    const { decision, risk, analysts } = this.analysis;
    const actionClass = decision.action === 'BUY' ? 'buy' : decision.action === 'SELL' ? 'sell' : 'hold';
    const confColor = decision.confidence >= 70 ? '#22c55e' : decision.confidence >= 40 ? '#f59e0b' : '#ef4444';
    const targetPct = decision.action !== 'HOLD' ? ((decision.targetPrice / decision.entryPrice - 1) * 100).toFixed(1) : '0';
    const stopPct = decision.action !== 'HOLD' ? Math.abs((1 - decision.stopLoss / decision.entryPrice) * 100).toFixed(1) : '0';

    const analystBars = analysts.map(a => {
      const w = Math.abs(a.score);
      const c = a.score > 0 ? '#22c55e' : a.score < 0 ? '#ef4444' : '#f59e0b';
      return `<div style="margin-bottom:6px"><span style="font-size:10px;color:#888;text-transform:uppercase">${a.type}</span><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:4px;background:#222;border-radius:2px;overflow:hidden"><div style="width:${w}%;height:100%;background:${c}"></div></div><span style="font-size:10px;color:${c};min-width:40px;text-align:right">${a.score > 0 ? '+' : ''}${a.score}</span></div><div style="font-size:10px;color:#555;margin-top:1px">${a.reasoning}</div></div>`;
    }).join('');

    return `<div class="tw-analysis">${analystBars}<div class="tw-decision"><span class="tw-action ${actionClass}">${decision.action}</span><span style="font-size:18px;font-weight:700">${this.selectedToken}</span><span style="color:#888;font-size:12px">Size: ${decision.size}/10</span></div><div class="tw-prices"><div class="tw-price-item"><div class="tw-price-label">Entry</div><div class="tw-price-val">$${decision.entryPrice.toFixed(2)}</div></div><div class="tw-price-item"><div class="tw-price-label">Target</div><div class="tw-price-val" style="color:#22c55e">$${decision.targetPrice.toFixed(2)} (${targetPct}%)</div></div><div class="tw-price-item"><div class="tw-price-label">Stop Loss</div><div class="tw-price-val" style="color:#ef4444">$${decision.stopLoss.toFixed(2)} (-${stopPct}%)</div></div></div><div class="tw-confidence"><div class="tw-conf-bar"><div class="tw-conf-fill" style="width:${decision.confidence}%;background:${confColor}"></div></div><div class="tw-conf-text">Confidence: ${decision.confidence}%</div></div><span class="tw-risk ${risk.approved ? 'ok' : 'no'}">${risk.approved ? 'Risk Approved' : 'Risk Rejected'}</span>${risk.approved && canExecute ? `<button class="tw-btn" data-action="execute" style="width:100%;margin-top:8px;padding:10px;font-size:14px">Execute ${decision.action} ${this.selectedToken}</button>` : risk.approved && !canExecute ? `<div style="margin-top:8px;padding:8px;background:#1a1a0a;border:1px solid #333;border-radius:6px;color:#888;font-size:11px;text-align:center">Connect wallet to execute</div>` : ''}</div>`;
  }

  private attachListeners(): void {
    const q = (sel: string) => this.element.querySelector(sel);
    q('[data-action="token"]')?.addEventListener('change', (e) => { this.selectedToken = (e.target as HTMLSelectElement).value; this.analysis = null; this.runAnalysis(); });
    q('[data-action="refresh"]')?.addEventListener('click', () => { this.analysis = null; this.runAnalysis(); });
    q('[data-action="execute"]')?.addEventListener('click', () => { this.handleExecute(); });
    q('[data-action="connect"]')?.addEventListener('click', () => { this.handleConnect(); });
    q('[data-action="start-agent"]')?.addEventListener('click', () => { this.agentState = startAgent({ tokens: [this.selectedToken], intervalMs: 300000, minConfidence: 70 }); this.renderPanel(); });
    q('[data-action="stop-agent"]')?.addEventListener('click', () => { this.agentState = stopAgent(); this.renderPanel(); });
  }

  private async handleExecute(): Promise<void> {
    if (!this.analysis?.risk.approved) return;
    const result = await executeTrade({ token: this.selectedToken, amount: this.analysis.decision.size * 100, type: this.analysis.decision.action === 'BUY' ? 'buy' : 'sell', chain: 'base', slippage: 0.5 });
    if (result.success) this.renderPanel();
  }

  private async handleConnect(): Promise<void> {
    try { await connectWallet(); this.renderPanel(); } catch { this.showError('Wallet connection failed'); }
  }
}
