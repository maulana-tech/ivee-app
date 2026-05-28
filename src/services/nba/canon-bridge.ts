import type { TradeSignal, MarketReference } from "../../TradeSignal";
import type { RiskInterface, Portfolio, RiskDecision } from "../../RiskInterface";
import type { AutomationResult, StrategyConfig } from "./automation-engine";
import { degasRankService, type DegaPosition } from "./dega-rank";
import { browserExecutionLog } from "./browser-execution-log";

function actionToDirection(action: AutomationResult['action']): TradeSignal['direction'] | null {
  if (action === 'buy_yes') return 'buy_yes';
  if (action === 'buy_no') return 'buy_no';
  return null;
}

export function automationResultToTradeSignal(
  result: AutomationResult,
  config: StrategyConfig
): TradeSignal | null {
  const direction = actionToDirection(result.action);
  if (!direction) return null;

  const marketRef: MarketReference = {
    platform: 'polymarket',
    market_id: result.market,
    question: result.question,
  };

  return {
    automation_id: config.name.toLowerCase().replace(/\s+/g, '-'),
    timestamp: new Date(),
    market: marketRef,
    direction,
    size: config.maxSize,
    confidence: result.confidence / 100,
    urgency: result.confidence >= 75 ? 'immediate' : result.confidence >= 55 ? 'normal' : 'opportunistic',
    metadata: {
      edge: result.edge,
      expectedPnl: result.expectedPnl,
      reasoning: result.reasoning,
      dataSources: result.dataSources,
    },
  };
}

export class BrowserRiskAdapter implements RiskInterface {
  private portfolioValue = 1000;
  private maxPositionPercent = 0.05;
  private maxDailyLoss = 30;

  preTradeCheck(signal: TradeSignal, portfolio: Portfolio): RiskDecision {
    const positionSize = signal.size;
    const portfolioLimit = this.portfolioValue * this.maxPositionPercent;

    if (positionSize > portfolioLimit) {
      return {
        approved: false,
        rejection_reason: `Position size $${positionSize} exceeds 5% portfolio limit ($${portfolioLimit})`,
      };
    }

    const dailyLoss = this.getDailyLoss();
    if (dailyLoss <= -this.maxDailyLoss) {
      return {
        approved: false,
        rejection_reason: `Daily loss limit reached ($${dailyLoss})`,
      };
    }

    return {
      approved: true,
      modified_size: positionSize,
    };
  }

  getExposure() {
    const positions = degasRankService.getMockPositions();
    return {
      total_capital_deployed: positions.reduce((sum, p) => sum + p.size, 0),
      position_count: positions.filter(p => p.status === 'open').length,
      largest_position: Math.max(...positions.map(p => p.size)),
      markets: positions.map(p => p.marketId),
    };
  }

  onCircuitBreaker(reason: string): void {
    console.error('[Risk] Circuit breaker triggered:', reason);
  }

  private getDailyLoss(): number {
    try {
      const raw = localStorage.getItem('canon-daily-pnl');
      if (!raw) return 0;
      const data = JSON.parse(raw) as { date: string; pnl: number };
      const today = new Date().toISOString().split('T')[0];
      return data.date === today ? data.pnl : 0;
    } catch {
      return 0;
    }
  }

  recordDailyPnl(pnl: number): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const current = this.getDailyLoss();
      localStorage.setItem('canon-daily-pnl', JSON.stringify({ date: today, pnl: current + pnl }));
    } catch {
    }
  }
}

export class CanonRunnerBridge {
  private isRunning = false;
  private pollInterval: number | null = null;
  private strategyFn: (() => Promise<TradeSignal[]>) | null = null;
  private riskAdapter = new BrowserRiskAdapter();

  setStrategy(fn: () => Promise<TradeSignal[]>): void {
    this.strategyFn = fn;
  }

  async start(config: { pollIntervalMs: number; dryRun: boolean }): Promise<void> {
    if (this.isRunning || !this.strategyFn) return;
    
    this.isRunning = true;
    console.log('[CanonBridge] Runner started');

    const cycle = async () => {
      if (!this.strategyFn) return;

      try {
        const signals = await this.strategyFn();
        
        for (const signal of signals) {
          const portfolio: Portfolio = {
            total_value: 1000,
            positions: [],
            daily_pnl: 0,
          };
          
          const decision = this.riskAdapter.preTradeCheck(signal, portfolio);
          
          console.log('[CanonBridge]', signal.automation_id, 'approved:', decision.approved);
          
          if (decision.approved) {
            await degasRankService.syncWithCanon(signal);
          }
        }
      } catch (err) {
        console.error('[CanonBridge] Cycle error:', err);
      }
    };

    this.pollInterval = window.setInterval(cycle, config.pollIntervalMs);
    await cycle();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[CanonBridge] Runner stopped');
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const canonBridge = new CanonRunnerBridge();