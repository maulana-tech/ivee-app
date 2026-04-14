import { runFullAnalysis, type TradeDecision, type RiskCheck, type AnalystResult } from './ai-agent';
import { getTrendingTokens } from './client';
import { sendMarketOrder, getProxyWallets, type ProxyWallet } from './trading';

const AGENT_STATE_KEY = 'ivee-agent-state';
const AGENT_HISTORY_KEY = 'ivee-agent-history';

export interface AgentState {
  running: boolean;
  assetsId: string | null;
  chain: string;
  intervalMs: number;
  minConfidence: number;
  maxSize: number;
  tokens: string[];
  currentToken: string | null;
  cycleCount: number;
  lastRun: number | null;
  status: 'idle' | 'running' | 'analyzing' | 'executing' | 'error';
  error?: string;
}

export interface AgentCycleResult {
  token: string;
  timestamp: number;
  decision: TradeDecision;
  risk: RiskCheck;
  analysts: AnalystResult[];
  executed: boolean;
  txId?: string;
  error?: string;
}

export function loadAgentState(): AgentState {
  try {
    const stored = localStorage.getItem(AGENT_STATE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    running: false,
    assetsId: null,
    chain: 'base',
    intervalMs: 300000,
    minConfidence: 70,
    maxSize: 3,
    tokens: [],
    currentToken: null,
    cycleCount: 0,
    lastRun: null,
    status: 'idle',
  };
}

export function saveAgentState(state: Partial<AgentState>): AgentState {
  const current = loadAgentState();
  const updated = { ...current, ...state };
  localStorage.setItem(AGENT_STATE_KEY, JSON.stringify(updated));
  return updated;
}

export function loadAgentHistory(): AgentCycleResult[] {
  try {
    return JSON.parse(localStorage.getItem(AGENT_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(result: AgentCycleResult): void {
  const history = loadAgentHistory();
  history.push(result);
  if (history.length > 200) history.splice(0, history.length - 200);
  localStorage.setItem(AGENT_HISTORY_KEY, JSON.stringify(history));
}

export function getAgentStats(): { totalCycles: number; trades: number; wins: number; losses: number; pnl: number } {
  const history = loadAgentHistory();
  const trades = history.filter(h => h.executed);
  const wins = trades.filter(t => (t.decision.action === 'BUY' && t.decision.confidence > 60) || (t.decision.action === 'SELL' && t.decision.confidence > 60)).length;
  return {
    totalCycles: history.length,
    trades: trades.length,
    wins,
    losses: trades.length - wins,
    pnl: 0,
  };
}

let agentTimer: ReturnType<typeof setInterval> | null = null;
let listeners: ((state: AgentState, result?: AgentCycleResult) => void)[] = [];

export function onAgentUpdate(fn: (state: AgentState, result?: AgentCycleResult) => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function notify(state: AgentState, result?: AgentCycleResult): void {
  listeners.forEach(fn => { try { fn(state, result); } catch {} });
}

async function selectToken(): Promise<string> {
  const state = loadAgentState();
  if (state.tokens.length > 0) {
    return state.tokens[state.cycleCount % state.tokens.length];
  }
  try {
    const trending = await getTrendingTokens('base', 10);
    if (trending.length > 0) {
      const token = trending[Math.floor(Math.random() * trending.length)];
      return token.symbol?.toUpperCase() || 'WETH';
    }
  } catch {}
  return 'WETH';
}

async function ensureWallet(): Promise<string | null> {
  const state = loadAgentState();
  if (state.assetsId) return state.assetsId;

  try {
    const wallets = await getProxyWallets();
    if (wallets.length > 0) {
      saveAgentState({ assetsId: wallets[0].assetsId });
      return wallets[0].assetsId;
    }

    const { createProxyWallet } = await import('./trading');
    const wallet = await createProxyWallet('ivee-agent');
    saveAgentState({ assetsId: wallet.assetsId });
    return wallet.assetsId;
  } catch (e) {
    console.error('[agent] wallet error:', e);
    return null;
  }
}

async function runCycle(): Promise<void> {
  let state = loadAgentState();
  if (!state.running) return;

  state = saveAgentState({ status: 'analyzing' });
  notify(state);

  try {
    const token = await selectToken();
    state = saveAgentState({ currentToken: token, status: 'analyzing' });
    notify(state);

    const analysis = await runFullAnalysis(token);

    const result: AgentCycleResult = {
      token,
      timestamp: Date.now(),
      decision: analysis.decision,
      risk: analysis.risk,
      analysts: analysis.analysts,
      executed: false,
    };

    if (analysis.risk.approved && analysis.decision.confidence >= state.minConfidence && analysis.decision.action !== 'HOLD') {
      state = saveAgentState({ status: 'executing' });
      notify(state);

      const assetsId = await ensureWallet();
      if (assetsId) {
        try {
          const chain = state.chain;
          const isBuy = analysis.decision.action === 'BUY';
          const amountEth = analysis.decision.size * 0.01;
          const amountWei = BigInt(Math.floor(amountEth * 1e18)).toString();

          const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
          const WETH = '0x4200000000000000000000000000000000000006';
          const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

          const order = await sendMarketOrder({
            chain,
            assetsId,
            inTokenAddress: isBuy ? NATIVE : WETH,
            outTokenAddress: isBuy ? WETH : NATIVE,
            inAmount: amountWei,
            swapType: isBuy ? 'buy' : 'sell',
            slippage: '500',
            useMev: false,
            autoSlippage: true,
            autoGas: 'average',
            ...(isBuy ? {
              autoSellConfig: [
                { priceChange: '-5000', sellRatio: '10000', type: 'default' as const },
                { priceChange: '5000', sellRatio: '5000', type: 'default' as const },
                { priceChange: '1000', sellRatio: '10000', type: 'trailing' as const },
              ],
            } : {}),
          });

          result.executed = true;
          result.txId = order.id;
        } catch (e: any) {
          result.error = e.message || 'Trade failed';
        }
      } else {
        result.error = 'No proxy wallet';
      }
    }

    saveHistory(result);
    state = saveAgentState({
      cycleCount: state.cycleCount + 1,
      lastRun: Date.now(),
      status: 'running',
    });
    notify(state, result);
  } catch (e: any) {
    state = saveAgentState({ status: 'error', error: e.message });
    notify(state);
  }
}

export function startAgent(config?: Partial<Pick<AgentState, 'tokens' | 'intervalMs' | 'minConfidence' | 'chain'>>): AgentState {
  stopAgent();
  const state = saveAgentState({ ...config, running: true, status: 'running', cycleCount: 0 });
  agentTimer = setInterval(runCycle, state.intervalMs);
  runCycle();
  notify(state);
  return state;
}

export function stopAgent(): AgentState {
  if (agentTimer) {
    clearInterval(agentTimer);
    agentTimer = null;
  }
  const state = saveAgentState({ running: false, status: 'idle' });
  notify(state);
  return state;
}

export function isAgentRunning(): boolean {
  return loadAgentState().running;
}
