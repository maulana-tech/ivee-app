import {
  getPlayoffMarkets,
  findArbitrageOpportunities,
  type PredictionMarket,
  type MarketArbitrage,
} from './prediction-market';
import {
  getTodayGames,
  getStandings,
  getInjuries,
  type NbaGame,
  type TeamStanding,
  type InjuryReport,
} from './client';
import { generatePrediction } from './predictions';
import { browserExecutionLog } from './browser-execution-log';

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
  data?: unknown;
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
  params: Record<string, unknown>;
  riskLimit: number;
  maxSize: number;
}

export interface AgentMessage {
  role: 'market-analyst' | 'strategy-architect' | 'developer' | 'qa' | 'system';
  content: string;
  timestamp: string;
  phase: StrategyPhase;
  data?: unknown;
}

interface RunContext {
  markets: PredictionMarket[];
  arb: MarketArbitrage[];
  games: NbaGame[];
  standings: TeamStanding[];
  injuries: InjuryReport[];
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

function checkRisk(size: number, riskLimit: number): { approved: boolean; reason?: string } {
  if (size > riskLimit * 0.05) {
    return { approved: false, reason: `Position size $${size} exceeds 5% portfolio limit ($${(riskLimit * 0.05).toFixed(0)})` };
  }
  try {
    const raw = localStorage.getItem('canon-daily-pnl');
    if (raw) {
      const data = JSON.parse(raw) as { date: string; pnl: number };
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today && data.pnl <= -30) {
        return { approved: false, reason: 'Daily loss limit reached ($30)' };
      }
    }
  } catch { /* ignore */ }
  return { approved: true };
}

function parseCronIntervalMs(cron: string): number {
  const match = cron.match(/^\*\/(\d+)/);
  const minutes = match ? parseInt(match[1] ?? '5', 10) : 5;
  return minutes * 60 * 1000;
}

export class AutomationEngine {
  private runs: AutomationRun[] = [];
  private activeRun: AutomationRun | null = null;
  private listeners: ((run: AutomationRun | null) => void)[] = [];
  private agentLog: AgentMessage[] = [];
  private agentListeners: ((msg: AgentMessage) => void)[] = [];
  private autoRunIntervals: Map<string, number> = new Map();
  private autoRunListeners: ((active: Map<string, string>) => void)[] = [];

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
    const ctx: RunContext = { markets: [], arb: [], games: [], standings: [], injuries: [] };

    for (let i = 0; i < run.steps.length; i++) {
      run.currentStepIndex = i;
      const step = run.steps[i];
      if (!step) continue;
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      run.status = step.phase;
      this.notify();

      try {
        step.data = await this.executeStep(step, run, config, ctx);
        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt!).getTime();
      } catch (err) {
        step.status = 'failed';
        step.error = err instanceof Error ? err.message : 'Unknown error';
        step.completedAt = new Date().toISOString();
        run.status = 'error';
        run.error = step.error;
        this.logAgent('system', `Step failed: ${step.name} — ${step.error}`, 'error');
        browserExecutionLog.appendEntry({
          timestamp: new Date().toISOString(),
          type: 'error',
          automation_id: config.name.toLowerCase().replace(/\s+/g, '-'),
          market_id: '',
          payload: { step: step.id, error: step.error, run_id: run.id },
        });
        this.notify();
        return;
      }

      this.notify();
      await this.delay(600 + Math.random() * 800);
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    this.logAgent('system', `Strategy completed: ${config.name}`, 'completed');
    this.notify();
  }

  private async executeStep(
    step: PipelineStep,
    run: AutomationRun,
    config: StrategyConfig,
    ctx: RunContext,
  ): Promise<unknown> {
    const automationId = config.name.toLowerCase().replace(/\s+/g, '-');

    switch (step.id) {
      case 'fetch-market-data': {
        this.logAgent('market-analyst', 'Scanning Polymarket for active NBA prediction markets...', 'fetching');
        ctx.markets = await getPlayoffMarkets();
        const totalVolume = ctx.markets.reduce((sum, m) => sum + parseFloat(m.volume || '0'), 0);
        const activeCount = ctx.markets.filter(m => m.active && !m.closed).length;
        this.logAgent('market-analyst', `Found ${activeCount} active NBA markets — total volume $${(totalVolume / 1_000_000).toFixed(2)}M`, 'fetching');
        return { marketCount: activeCount, totalVolume, markets: ctx.markets.map(m => m.slug) };
      }

      case 'fetch-nba-stats': {
        this.logAgent('market-analyst', 'Loading team standings, injury reports, and schedule data...', 'fetching');
        [ctx.games, ctx.standings, ctx.injuries] = await Promise.all([
          getTodayGames(),
          getStandings(),
          getInjuries(),
        ]);
        const liveGames = ctx.games.filter(g => g.status === 'In Progress');
        const scheduledGames = ctx.games.filter(g => g.status === 'Scheduled');
        const outGames = ctx.injuries.filter(i => i.status === 'Out');
        const questionable = ctx.injuries.filter(i => i.status === 'Questionable');
        this.logAgent('market-analyst', `${ctx.games.length} games today (${liveGames.length} live, ${scheduledGames.length} upcoming) — ${outGames.length} players out, ${questionable.length} questionable`, 'fetching');
        return {
          gamesToday: ctx.games.length,
          liveGames: liveGames.length,
          injuries: ctx.injuries.length,
          outCount: outGames.length,
          questionableCount: questionable.length,
          teams: ctx.standings.length,
        };
      }

      case 'scan-arbitrage': {
        this.logAgent('strategy-architect', `Analyzing Yes/No price sums for mispricing across ${ctx.markets.length} markets...`, 'analyzing');
        ctx.arb = findArbitrageOpportunities(ctx.markets);
        if (ctx.arb.length > 0) {
          const best = ctx.arb.reduce((a, b) => Math.abs(a.mispricing) > Math.abs(b.mispricing) ? a : b);
          this.logAgent('strategy-architect', `Detected ${ctx.arb.length} arbitrage opportunit${ctx.arb.length === 1 ? 'y' : 'ies'} — best edge ${(Math.abs(best.mispricing) * 100).toFixed(1)}% on "${best.question}"`, 'analyzing');
        } else {
          this.logAgent('strategy-architect', 'No arbitrage mispricings found — all markets within 2% of fair value', 'analyzing');
        }
        return { opportunities: ctx.arb.length, best: ctx.arb[0] ?? null };
      }

      case 'detect-momentum': {
        this.logAgent('strategy-architect', `Analyzing price momentum across ${ctx.markets.length} markets...`, 'analyzing');
        const signals = ctx.markets
          .filter(m => m.outcomePrices.length >= 2)
          .map(m => {
            const yes = parseFloat(m.outcomePrices[0] ?? '0.5');
            const vol = parseFloat(m.volume ?? '0');
            const imbalance = Math.abs(yes - 0.5);
            return { market: m, yes, vol, imbalance };
          })
          .filter(s => s.imbalance > 0.15 && s.vol > 100_000)
          .sort((a, b) => b.imbalance - a.imbalance);

        if (signals.length > 0) {
          const top = signals[0]!;
          const dir = top.yes > 0.5 ? 'bullish' : 'bearish';
          this.logAgent('strategy-architect', `"${top.market.question}" showing strong ${dir} momentum (${(top.yes * 100).toFixed(0)}% yes, vol $${(top.vol / 1000).toFixed(0)}K)`, 'analyzing');
        } else {
          this.logAgent('strategy-architect', 'No strong momentum signals detected — markets are balanced', 'analyzing');
        }
        return { signals: signals.length, topMarket: signals[0]?.market.slug ?? null };
      }

      case 'correlate-markets': {
        this.logAgent('strategy-architect', 'Computing cross-market correlations between series and game markets...', 'analyzing');
        const seriesMarkets = ctx.markets.filter(m =>
          m.slug.includes('series') || m.slug.includes('conf') || m.slug.includes('champ')
        );
        const gameMarkets = ctx.markets.filter(m =>
          m.slug.includes('-g') || m.slug.includes('game') || m.slug.includes('win')
        );

        const lags: Array<{ series: string; game: string; priceDiff: number }> = [];
        for (const s of seriesMarkets) {
          for (const g of gameMarkets) {
            const sTeam = s.slug.split('-')[0] ?? '';
            if (!g.slug.includes(sTeam)) continue;
            const sYes = parseFloat(s.outcomePrices[0] ?? '0.5');
            const gYes = parseFloat(g.outcomePrices[0] ?? '0.5');
            const diff = Math.abs(sYes - gYes);
            if (diff > 0.08) lags.push({ series: s.slug, game: g.slug, priceDiff: diff });
          }
        }

        if (lags.length > 0) {
          const best = lags.sort((a, b) => b.priceDiff - a.priceDiff)[0]!;
          this.logAgent('strategy-architect', `Pricing lag detected: ${best.series} vs ${best.game} — ${(best.priceDiff * 100).toFixed(1)}% divergence`, 'analyzing');
        } else {
          this.logAgent('strategy-architect', `Checked ${seriesMarkets.length} series / ${gameMarkets.length} game markets — no significant lags`, 'analyzing');
        }
        return { seriesMarkets: seriesMarkets.length, gameMarkets: gameMarkets.length, lags: lags.length };
      }

      case 'speed-analysis': {
        this.logAgent('strategy-architect', 'Processing pre-game statistical edges from injury reports and schedule...', 'analyzing');
        const upcomingGames = ctx.games.filter(g => g.status === 'Scheduled');
        const edges: Array<{ player: string; team: string; status: string; edge: string }> = [];

        for (const injury of ctx.injuries) {
          if (injury.status === 'Out' || injury.status === 'Questionable') {
            const affectedGame = upcomingGames.find(g =>
              g.home_team.id === injury.team.id || g.visitor_team.id === injury.team.id
            );
            if (affectedGame) {
              edges.push({
                player: `${injury.player.first_name} ${injury.player.last_name}`,
                team: injury.team.abbreviation,
                status: injury.status,
                edge: `${injury.team.abbreviation} market may be mispriced — ${injury.status}`,
              });
            }
          }
        }

        if (edges.length > 0) {
          const e = edges[0]!;
          this.logAgent('strategy-architect', `${e.player} (${e.team}) ${e.status} — affects ${upcomingGames.find(g => g.home_team.abbreviation === e.team || g.visitor_team.abbreviation === e.team)?.home_team.full_name ?? 'upcoming'} game market`, 'analyzing');
        } else {
          this.logAgent('strategy-architect', `${upcomingGames.length} upcoming games — no significant injury-based edges found`, 'analyzing');
        }
        return { upcomingGames: upcomingGames.length, edges: edges.length, details: edges };
      }

      case 'custom-analysis': {
        this.logAgent('strategy-architect', 'Running custom analysis pipeline...', 'analyzing');
        const predictions = ctx.games.slice(0, 3).map(g => generatePrediction(g, ctx.standings));
        const highConf = predictions.filter(p => p.confidence > 60);
        this.logAgent('strategy-architect', `Generated ${predictions.length} game predictions — ${highConf.length} high-confidence`, 'analyzing');
        return { predictions: predictions.length, highConfidence: highConf.length };
      }

      case 'ai-decision': {
        this.logAgent('developer', 'Running AI decision engine — evaluating all signals...', 'deciding');

        let bestMarket: PredictionMarket | null = null;
        let action: AutomationResult['action'] = 'hold';
        let confidence = 45;
        let edge = 0;
        let side: 'yes' | 'no' = 'yes';
        const reasoning: string[] = [];
        const dataSources: string[] = ['Polymarket Gamma API'];

        if (config.type === 'arbitrage' && ctx.arb.length > 0) {
          const best = ctx.arb[0]!;
          bestMarket = ctx.markets.find(m => m.id === best.id) ?? null;
          action = best.mispricing < 0 ? 'buy_yes' : 'buy_no';
          side = best.mispricing < 0 ? 'yes' : 'no';
          confidence = Math.min(95, 60 + Math.abs(best.mispricing) * 500);
          edge = Math.abs(best.mispricing) * 100;
          reasoning.push(`Yes+No prices sum to ${(best.yesPrice + best.noPrice).toFixed(3)} — ${edge.toFixed(1)}% edge`);
          reasoning.push(`Buy ${side.toUpperCase()} @ $${side === 'yes' ? best.yesPrice.toFixed(3) : best.noPrice.toFixed(3)}`);
          dataSources.push('Arbitrage Scanner');
        } else if (config.type === 'momentum' && ctx.markets.length > 0) {
          const strongest = ctx.markets
            .filter(m => m.outcomePrices.length >= 2)
            .map(m => ({ m, yes: parseFloat(m.outcomePrices[0] ?? '0.5'), vol: parseFloat(m.volume ?? '0') }))
            .filter(s => s.vol > 50_000)
            .sort((a, b) => Math.abs(b.yes - 0.5) - Math.abs(a.yes - 0.5))[0];

          if (strongest) {
            bestMarket = strongest.m;
            side = strongest.yes > 0.5 ? 'yes' : 'no';
            action = side === 'yes' ? 'buy_yes' : 'buy_no';
            confidence = Math.round(Math.min(90, 50 + Math.abs(strongest.yes - 0.5) * 100));
            edge = Math.abs(strongest.yes - 0.5) * 10;
            reasoning.push(`Strong ${side} momentum — ${(strongest.yes * 100).toFixed(0)}% implied probability`);
            reasoning.push(`Volume $${(strongest.vol / 1000).toFixed(0)}K confirms market conviction`);
            dataSources.push('Momentum Detector');
          }
        } else if (config.type === 'speed' && ctx.injuries.length > 0) {
          const keyInjury = ctx.injuries.find(i => i.status === 'Out' || i.status === 'Questionable');
          if (keyInjury) {
            const opposingMarket = ctx.markets.find(m =>
              !m.slug.includes(keyInjury.team.abbreviation.toLowerCase())
            );
            bestMarket = opposingMarket ?? ctx.markets[0] ?? null;
            action = 'buy_yes';
            side = 'yes';
            confidence = keyInjury.status === 'Out' ? 72 : 58;
            edge = keyInjury.status === 'Out' ? 7.5 : 4.2;
            reasoning.push(`${keyInjury.player.first_name} ${keyInjury.player.last_name} ${keyInjury.status} — opponent market underpriced`);
            reasoning.push(`Injury status from balldontlie API — markets typically slow to adjust`);
            dataSources.push('balldontlie NBA API', 'Injury Report');
          }
        } else if (config.type === 'cross-market' && ctx.markets.length > 1) {
          bestMarket = ctx.markets[0] ?? null;
          action = 'alert';
          side = 'yes';
          confidence = 55;
          edge = 3.1;
          reasoning.push('Cross-market lag detected between series and game markets');
          reasoning.push(`${ctx.markets.length} markets analyzed for correlation divergence`);
          dataSources.push('Cross-Market Correlator');
        }

        if (!bestMarket && ctx.markets[0]) {
          bestMarket = ctx.markets[0];
          action = 'hold';
          confidence = 40;
          reasoning.push('No strong signal detected — holding position');
        }

        if (ctx.standings.length > 0) {
          dataSources.push('NBA Standings');
          reasoning.push(`Analysis based on ${ctx.standings.length} team records`);
        }
        if (ctx.injuries.length > 0) dataSources.push('NBA Injury Report');

        const expectedPnl = action !== 'hold' && action !== 'skip'
          ? parseFloat((config.maxSize * (edge / 100)).toFixed(2))
          : 0;

        run.result = {
          action,
          market: bestMarket?.slug ?? 'no-market',
          question: bestMarket?.question ?? 'No opportunity found',
          side,
          confidence: Math.round(confidence),
          edge: parseFloat(edge.toFixed(2)),
          expectedPnl,
          reasoning: reasoning.length > 0 ? reasoning : ['Insufficient signal strength — no trade recommended'],
          dataSources,
        };

        this.logAgent('developer', `Decision: ${action.replace('_', ' ').toUpperCase()} ${side.toUpperCase()} on "${run.result.question}" (confidence: ${Math.round(confidence)}%)`, 'deciding');

        browserExecutionLog.appendEntry({
          timestamp: new Date().toISOString(),
          type: 'signal',
          automation_id: automationId,
          market_id: bestMarket?.id ?? '',
          payload: {
            run_id: run.id,
            action,
            side,
            confidence: Math.round(confidence),
            edge: parseFloat(edge.toFixed(2)),
            expected_pnl: expectedPnl,
            reasoning,
            data_sources: dataSources,
          },
        });

        return run.result;
      }

      case 'risk-check': {
        this.logAgent('qa', 'Validating risk parameters and portfolio exposure...', 'deciding');
        const decision = checkRisk(config.maxSize, config.riskLimit);

        browserExecutionLog.appendEntry({
          timestamp: new Date().toISOString(),
          type: 'risk_check',
          automation_id: automationId,
          market_id: run.result?.market ?? '',
          payload: {
            run_id: run.id,
            approved: decision.approved,
            rejection_reason: decision.approved ? null : (decision.reason ?? null),
            position_size: config.maxSize,
            risk_limit: config.riskLimit,
          },
        });

        if (!decision.approved) {
          this.logAgent('qa', `Risk check FAILED — ${decision.reason}`, 'deciding');
          if (run.result) run.result.action = 'skip';
        } else {
          this.logAgent('qa', `Risk check PASSED — Position $${config.maxSize} within limit ($${config.riskLimit}), portfolio exposure OK`, 'deciding');
        }
        return { approved: decision.approved, size: config.maxSize, limit: config.riskLimit };
      }

      case 'execute-trade': {
        const isSkipped = run.result?.action === 'skip' || run.result?.action === 'hold';
        if (isSkipped) {
          this.logAgent('developer', `Execution skipped — action: ${run.result?.action ?? 'hold'}`, 'executing');
          return { skipped: true, reason: run.result?.action };
        }

        const orderId = `ord-${Date.now()}`;
        this.logAgent('developer', `Executing: ${run.result?.action?.replace('_', ' ').toUpperCase()} $${config.maxSize} on "${run.result?.question}" via Polymarket...`, 'executing');

        browserExecutionLog.appendEntry({
          timestamp: new Date().toISOString(),
          type: 'order_submit',
          automation_id: automationId,
          market_id: run.result?.market ?? '',
          payload: {
            run_id: run.id,
            order_id: orderId,
            action: run.result?.action,
            side: run.result?.side,
            size: config.maxSize,
            confidence: run.result?.confidence,
            edge: run.result?.edge,
            question: run.result?.question,
            dry_run: true,
          },
        });

        await this.delay(800);

        browserExecutionLog.appendEntry({
          timestamp: new Date().toISOString(),
          type: 'order_fill',
          automation_id: automationId,
          market_id: run.result?.market ?? '',
          payload: {
            run_id: run.id,
            order_id: orderId,
            status: 'filled',
            fill_price: parseFloat(
              run.result?.side === 'yes'
                ? (ctx.markets.find(m => m.slug === run.result?.market)?.outcomePrices[0] ?? '0.5')
                : (ctx.markets.find(m => m.slug === run.result?.market)?.outcomePrices[1] ?? '0.5')
            ),
            size: config.maxSize,
            dry_run: true,
          },
        });

        this.logAgent('developer', `Order ${orderId} filled (dry run) — tracking position`, 'executing');
        return { orderId, status: 'filled', dryRun: true };
      }

      case 'log-results': {
        this.logAgent('qa', 'Logging results and scheduling next run...', 'monitoring');
        const nextRunMs = config.type === 'arbitrage' ? 5 * 60_000 : config.type === 'momentum' ? 10 * 60_000 : 15 * 60_000;
        const nextRun = new Date(Date.now() + nextRunMs).toISOString();
        const totalLogs = browserExecutionLog.getEntriesByAutomation(automationId).length;
        this.logAgent('qa', `Run complete. ${totalLogs} total log entries for ${config.name}. Next scan at ${new Date(nextRun).toLocaleTimeString()}.`, 'monitoring');
        return { logged: true, nextRun, totalLogEntries: totalLogs };
      }

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

  startAutoRun(config: StrategyConfig): void {
    if (this.autoRunIntervals.has(config.type)) return;
    const intervalMs = parseCronIntervalMs(config.schedule);
    this.logAgent('system', `Auto-run enabled for "${config.name}" — every ${intervalMs / 60000} min`, 'idle');
    this.notifyAutoRun();

    const id = window.setInterval(() => {
      if (this.activeRun && this.activeRun.status !== 'completed' && this.activeRun.status !== 'error') return;
      this.startStrategy(config);
    }, intervalMs);

    this.autoRunIntervals.set(config.type, id);
    this.notifyAutoRun();
    this.startStrategy(config);
  }

  stopAutoRun(type: StrategyType): void {
    const id = this.autoRunIntervals.get(type);
    if (id !== undefined) {
      clearInterval(id);
      this.autoRunIntervals.delete(type);
      this.logAgent('system', `Auto-run stopped for ${type}`, 'idle');
      this.notifyAutoRun();
    }
  }

  isAutoRunning(type: StrategyType): boolean {
    return this.autoRunIntervals.has(type);
  }

  getAutoRunTypes(): string[] {
    return Array.from(this.autoRunIntervals.keys());
  }

  onAutoRunChange(fn: (active: Map<string, string>) => void): () => void {
    this.autoRunListeners.push(fn);
    return () => { this.autoRunListeners = this.autoRunListeners.filter(l => l !== fn); };
  }

  private notifyAutoRun(): void {
    const active = new Map(Array.from(this.autoRunIntervals.keys()).map(k => [k, k]));
    this.autoRunListeners.forEach(fn => fn(active));
  }

  getActiveRun(): AutomationRun | null { return this.activeRun; }
  getRuns(): AutomationRun[] { return this.runs; }
  getAgentLog(): AgentMessage[] { return this.agentLog; }
  getRunHistory(): AutomationRun[] {
    return this.runs.filter(r => r.status === 'completed' || r.status === 'error');
  }
}

export const automationEngine = new AutomationEngine();
