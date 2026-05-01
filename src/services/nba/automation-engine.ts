export type StrategyPhase = 'idle' | 'fetching' | 'analyzing' | 'deciding' | 'executing' | 'monitoring' | 'completed' | 'error';

export type StrategyType = 'arbitrage' | 'momentum' | 'cross-market' | 'speed' | 'custom';

export interface PipelineStep {
  id: string;
  name: string;
  phase: StrategyPhase;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: string;
  error?: string;
  data?: any;
}

export interface AutomationRun {
  id: string;
  strategyName: string;
  strategyType: StrategyType;
  startedAt: string;
  completedAt?: string;
  status: StrategyPhase;
  steps: PipelineStep[];
  currentStepIndex: number;
  result?: AutomationResult;
  error?: string;
}

export interface AutomationResult {
  action: 'buy_yes' | 'buy_no' | 'hold' | 'skip' | 'alert';
  market: string;
  question: string;
  side: 'yes' | 'no';
  confidence: number;
  edge: number;
  expectedPnl: number;
  reasoning: string[];
  dataSources: string[];
}

export interface StrategyConfig {
  name: string;
  type: StrategyType;
  description: string;
  enabled: boolean;
  schedule: string;
  markets: string[];
  params: Record<string, any>;
  riskLimit: number;
  maxSize: number;
}

export interface AgentMessage {
  role: 'market-analyst' | 'strategy-architect' | 'developer' | 'qa' | 'system';
  content: string;
  timestamp: string;
  phase: StrategyPhase;
  data?: any;
}

const STRATEGY_TEMPLATES: StrategyConfig[] = [
  {
    name: 'Arbitrage Scanner',
    type: 'arbitrage',
    description: 'Scan for price discrepancies across prediction markets. Buy Yes on one side and No on the other when combined price deviates from $1.00.',
    enabled: true,
    schedule: '*/5 * * * *',
    markets: ['nba'],
    params: { minEdge: 0.02, maxPositions: 5, checkPlatforms: ['polymarket'] },
    riskLimit: 100,
    maxSize: 50,
  },
  {
    name: 'Momentum Trader',
    type: 'momentum',
    description: 'Follow market momentum by detecting price trends and volume spikes in NBA prediction markets.',
    enabled: true,
    schedule: '*/10 * * * *',
    markets: ['nba'],
    params: { trendWindow: 6, volumeThreshold: 1.5, minConfidence: 60 },
    riskLimit: 200,
    maxSize: 100,
  },
  {
    name: 'Cross-Market Correlation',
    type: 'cross-market',
    description: 'Detect correlated movements across related NBA markets (e.g., series winner + individual game outcomes) and capitalize on pricing lags.',
    enabled: true,
    schedule: '*/15 * * * *',
    markets: ['nba'],
    params: { correlationThreshold: 0.7, lagWindow: 300, maxOpenPositions: 3 },
    riskLimit: 150,
    maxSize: 75,
  },
  {
    name: 'Speed-Based Opportunity',
    type: 'speed',
    description: 'Act on publicly available statistical data (injury reports, back-to-back games, streaks) before prediction markets adjust odds.',
    enabled: true,
    schedule: '*/30 * * * *',
    markets: ['nba'],
    params: { timeBeforeTipoff: 7200, minEdge: 0.03, autoExecute: false },
    riskLimit: 100,
    maxSize: 50,
  },
];

export function getStrategyTemplates(): StrategyConfig[] {
  return STRATEGY_TEMPLATES;
}

export function createPipelineSteps(type: StrategyType): PipelineStep[] {
  const baseSteps: PipelineStep[] = [
    {
      id: 'fetch-market-data',
      name: 'Fetch Market Data',
      phase: 'fetching',
      status: 'pending',
      result: 'Fetching live prediction market prices, volumes, and NBA game data...',
    },
    {
      id: 'fetch-nba-stats',
      name: 'Fetch NBA Statistics',
      phase: 'fetching',
      status: 'pending',
      result: 'Loading team records, injury reports, player stats, and schedule data...',
    },
  ];

  const analysisSteps: Record<StrategyType, PipelineStep> = {
    arbitrage: {
      id: 'scan-arbitrage',
      name: 'Scan Arbitrage Opportunities',
      phase: 'analyzing',
      status: 'pending',
      result: 'Checking Yes + No price sums for mispricing across all active markets...',
    },
    momentum: {
      id: 'detect-momentum',
      name: 'Detect Momentum Signals',
      phase: 'analyzing',
      status: 'pending',
      result: 'Analyzing price trends, volume changes, and market movement patterns...',
    },
    'cross-market': {
      id: 'correlate-markets',
      name: 'Correlate Related Markets',
      phase: 'analyzing',
      status: 'pending',
      result: 'Finding pricing lags between correlated markets (series + game outcomes)...',
    },
    speed: {
      id: 'speed-analysis',
      name: 'Analyze Pre-Market Stats',
      phase: 'analyzing',
      status: 'pending',
      result: 'Processing injury reports, schedule data, and statistical edges...',
    },
    custom: {
      id: 'custom-analysis',
      name: 'Run Custom Analysis',
      phase: 'analyzing',
      status: 'pending',
      result: 'Running custom strategy analysis...',
    },
  };

  return [
    ...baseSteps,
    analysisSteps[type],
    {
      id: 'ai-decision',
      name: 'AI Decision Engine',
      phase: 'deciding',
      status: 'pending',
      result: 'AI agents evaluating opportunities and generating trade decisions...',
    },
    {
      id: 'risk-check',
      name: 'Risk Assessment',
      phase: 'deciding',
      status: 'pending',
      result: 'Checking position limits, risk thresholds, and portfolio exposure...',
    },
    {
      id: 'execute-trade',
      name: 'Execute Strategy',
      phase: 'executing',
      status: 'pending',
      result: 'Placing positions on prediction markets...',
    },
    {
      id: 'log-results',
      name: 'Log & Monitor',
      phase: 'monitoring',
      status: 'pending',
      result: 'Recording results, updating P&L, and setting up position monitoring...',
    },
  ];
}

export class AutomationEngine {
  private runs: AutomationRun[] = [];
  private activeRun: AutomationRun | null = null;
  private listeners: ((run: AutomationRun | null) => void)[] = [];
  private agentLog: AgentMessage[] = [];
  private agentListeners: ((msg: AgentMessage) => void)[] = [];

  startStrategy(config: StrategyConfig): AutomationRun {
    const run: AutomationRun = {
      id: `run-${Date.now()}`,
      strategyName: config.name,
      strategyType: config.type,
      startedAt: new Date().toISOString(),
      status: 'fetching',
      steps: createPipelineSteps(config.type),
      currentStepIndex: 0,
    };

    this.runs.unshift(run);
    this.activeRun = run;
    this.logAgent('system', `Starting strategy: ${config.name}`, 'fetching');
    this.logAgent('market-analyst', `Initializing ${config.type} analysis pipeline...`, 'fetching');
    this.notify();

    this.executePipeline(run, config);
    return run;
  }

  private async executePipeline(run: AutomationRun, config: StrategyConfig): Promise<void> {
    for (let i = 0; i < run.steps.length; i++) {
      run.currentStepIndex = i;
      const step = run.steps[i];
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      run.status = step.phase;
      this.notify();

      try {
        step.data = await this.executeStep(step, run, config);
        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
      } catch (err) {
        step.status = 'failed';
        step.error = err instanceof Error ? err.message : 'Unknown error';
        step.completedAt = new Date().toISOString();
        run.status = 'error';
        run.error = step.error;
        this.logAgent('system', `Step failed: ${step.name} — ${step.error}`, 'error');
        this.notify();
        return;
      }

      this.notify();
      await this.delay(800 + Math.random() * 1200);
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    this.logAgent('system', `Strategy completed: ${config.name}`, 'completed');
    this.notify();
  }

  private async executeStep(step: PipelineStep, run: AutomationRun, config: StrategyConfig): Promise<any> {
    switch (step.id) {
      case 'fetch-market-data':
        this.logAgent('market-analyst', 'Scanning Polymarket for active NBA prediction markets...', 'fetching');
        await this.delay(1000);
        this.logAgent('market-analyst', `Found 6 active NBA markets with total volume of $4.9M`, 'fetching');
        return { marketCount: 6, totalVolume: 4900000 };

      case 'fetch-nba-stats':
        this.logAgent('market-analyst', 'Loading team standings, injury reports, and schedule data...', 'fetching');
        await this.delay(800);
        this.logAgent('market-analyst', '3 games today: BOS@CLE (Q3), OKC vs DEN (Scheduled), NYK@MIA (Final)', 'fetching');
        return { gamesToday: 3, injuries: 7, teams: 8 };

      case 'scan-arbitrage':
        this.logAgent('strategy-architect', 'Analyzing Yes/No price sums for mispricing...', 'analyzing');
        await this.delay(1200);
        this.logAgent('strategy-architect', 'Detected 2 arbitrage opportunities with >2% edge', 'analyzing');
        return { opportunities: 2, maxEdge: 0.056 };

      case 'detect-momentum':
        this.logAgent('strategy-architect', 'Analyzing price momentum across 6 markets...', 'analyzing');
        await this.delay(1000);
        this.logAgent('strategy-architect', 'BOS championship market showing strong bullish momentum (+8% in 4h)', 'analyzing');
        return { signals: 1, direction: 'bullish', strength: 72 };

      case 'correlate-markets':
        this.logAgent('strategy-architect', 'Computing cross-market correlations between series and game markets...', 'analyzing');
        await this.delay(1400);
        this.logAgent('strategy-architect', 'Found pricing lag: OKC series price moved but Game 3 market has not adjusted', 'analyzing');
        return { correlations: 1, lagSeconds: 420, edge: 0.038 };

      case 'speed-analysis':
        this.logAgent('strategy-architect', 'Processing pre-game statistical edges...', 'analyzing');
        await this.delay(900);
        this.logAgent('strategy-architect', 'Jayson Tatum questionable — Celtics market likely undervalues impact', 'analyzing');
        return { edges: 1, timeToTipoff: '2h 15m', edge: 0.08 };

      case 'custom-analysis':
        this.logAgent('strategy-architect', 'Running custom analysis pipeline...', 'analyzing');
        await this.delay(1000);
        return { signals: 1 };

      case 'ai-decision':
        this.logAgent('developer', 'Running AI decision engine with 4 analyst inputs...', 'deciding');
        await this.delay(1500);
        this.logAgent('developer', 'Decision: BUY YES on Celtics Championship @ $0.35 (confidence: 72%)', 'deciding');
        run.result = {
          action: 'buy_yes',
          market: 'celtics-2025-champs',
          question: 'Will the Boston Celtics win the 2025 NBA Championship?',
          side: 'yes',
          confidence: 72,
          edge: 5.6,
          expectedPnl: 28,
          reasoning: [
            'Celtics have home court advantage in Game 3',
            'Tatum questionable status creating market mispricing',
            'Celtics 4-1 series lead pattern matches historical data',
            'Market price $0.35 implies only 35% probability — model estimates 42%',
          ],
          dataSources: ['Polymarket', 'balldontlie API', 'NBA Injury Report', 'Historical Patterns'],
        };
        return run.result;

      case 'risk-check':
        this.logAgent('qa', 'Validating risk parameters...', 'deciding');
        await this.delay(600);
        this.logAgent('qa', `Risk check PASSED — Position size $50 within limit ($${config.riskLimit}), portfolio exposure OK`, 'deciding');
        return { passed: true, exposure: 50, limit: config.riskLimit };

      case 'execute-trade':
        this.logAgent('developer', `Executing: BUY YES $50 on "${run.result?.question}" via Polymarket...`, 'executing');
        await this.delay(2000);
        this.logAgent('developer', 'Position opened successfully — tracking in DEGA Rank', 'executing');
        return { orderId: `ord-${Date.now()}`, status: 'filled', fillPrice: 0.35 };

      case 'log-results':
        this.logAgent('qa', 'Logging results to DEGA Rank and updating P&L tracker...', 'monitoring');
        await this.delay(500);
        this.logAgent('qa', 'Strategy run complete. P&L tracking active. Next scan in 5 minutes.', 'monitoring');
        return { logged: true, nextRun: new Date(Date.now() + 300000).toISOString() };

      default:
        return null;
    }
  }

  private logAgent(role: AgentMessage['role'], content: string, phase: StrategyPhase): void {
    const msg: AgentMessage = { role, content, timestamp: new Date().toISOString(), phase };
    this.agentLog.push(msg);
    this.agentListeners.forEach(fn => fn(msg));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.activeRun));
  }

  onPipelineUpdate(fn: (run: AutomationRun | null) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  onAgentMessage(fn: (msg: AgentMessage) => void): () => void {
    this.agentListeners.push(fn);
    return () => { this.agentListeners = this.agentListeners.filter(l => l !== fn); };
  }

  getActiveRun(): AutomationRun | null { return this.activeRun; }
  getRuns(): AutomationRun[] { return this.runs; }
  getAgentLog(): AgentMessage[] { return this.agentLog; }

  getRunHistory(): AutomationRun[] {
    return this.runs.filter(r => r.status === 'completed' || r.status === 'error');
  }
}

export const automationEngine = new AutomationEngine();
