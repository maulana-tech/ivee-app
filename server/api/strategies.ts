import { Router } from 'express';
import type { TradeSignal, MarketReference } from '../../types/TradeSignal.js';
import type { RiskInterface, Portfolio } from '../../types/RiskInterface.js';

export interface StrategyStatus {
  id: string;
  name: string;
  type: 'arbitrage' | 'momentum' | 'cross-market' | 'speed' | 'custom';
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  completedAt: string | null;
  lastResult: StrategyResult | null;
  error: string | null;
}

export interface StrategyResult {
  action: 'buy_yes' | 'buy_no' | 'hold' | 'skip' | 'alert';
  market: string;
  question: string;
  side: 'yes' | 'no';
  confidence: number;
  edge: number;
  expectedPnl: number;
  reasoning: string[];
}

interface Position {
  market_id: string;
  direction: 'buy_yes' | 'buy_no';
  size: number;
  entry_price: number;
  opened_at: Date;
}

interface PortfolioState {
  total_value: number;
  positions: Position[];
  daily_pnl: number;
}

class InMemoryStrategyRunner {
  private strategies: Map<string, StrategyStatus> = new Map();
  private portfolio: PortfolioState = {
    total_value: 1000,
    positions: [],
    daily_pnl: 0,
  };
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.strategies.set('arbitrage', {
      id: 'arbitrage',
      name: 'Arbitrage Scanner',
      type: 'arbitrage',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      lastResult: null,
      error: null,
    });
    this.strategies.set('momentum', {
      id: 'momentum',
      name: 'Momentum Trader',
      type: 'momentum',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      lastResult: null,
      error: null,
    });
    this.strategies.set('cross-market', {
      id: 'cross-market',
      name: 'Cross-Market Correlation',
      type: 'cross-market',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      lastResult: null,
      error: null,
    });
    this.strategies.set('speed', {
      id: 'speed',
      name: 'Speed-Based Opportunity',
      type: 'speed',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      lastResult: null,
      error: null,
    });
  }

  private async executeCycle(strategyId: string): Promise<StrategyResult | null> {
    console.log(`[Canon Runner] Running cycle for ${strategyId}...`);

    const mockMarkets = [
      { id: 'celtics-2025-champs', question: 'Will Celtics win 2025 Championship?', price: 0.35 },
      { id: 'okc-western-conf', question: 'Will OKC win Western Conference?', price: 0.42 },
      { id: 'sga-mvp', question: 'Will SGA win MVP?', price: 0.62 },
    ];

    const market = mockMarkets[Math.floor(Math.random() * mockMarkets.length)];
    const confidence = 60 + Math.floor(Math.random() * 30);
    const edge = 2 + Math.random() * 8;

    const result: StrategyResult = {
      action: Math.random() > 0.3 ? 'buy_yes' : 'hold',
      market: market.id,
      question: market.question,
      side: 'yes',
      confidence,
      edge: Math.round(edge * 10) / 10,
      expectedPnl: Math.round(edge * 10),
      reasoning: [
        `Detected ${strategyId} opportunity with ${edge.toFixed(1)}% edge`,
        `Market price implies ${(market.price * 100).toFixed(0)}% probability`,
        `Model estimates ${(market.price + edge/100).toFixed(0)}% probability`,
        `Position size optimized for risk-adjusted returns`,
      ],
    };

    if (result.action === 'buy_yes') {
      this.portfolio.positions.push({
        market_id: market.id,
        direction: 'buy_yes',
        size: 50,
        entry_price: market.price,
        opened_at: new Date(),
      });
      console.log(`[Canon Runner] Executed: BUY YES $50 on ${market.question}`);
    }

    return result;
  }

  async startStrategy(strategyId: string): Promise<StrategyStatus> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    if (strategy.status === 'running') {
      throw new Error(`Strategy ${strategyId} is already running`);
    }

    strategy.status = 'running';
    strategy.startedAt = new Date().toISOString();
    strategy.error = null;
    this.strategies.set(strategyId, strategy);

    console.log(`[Canon Runner] Started strategy: ${strategy.name}`);

    const interval = setInterval(async () => {
      try {
        const result = await this.executeCycle(strategyId);
        if (result) {
          strategy.lastResult = result;
          this.strategies.set(strategyId, strategy);
        }
      } catch (err) {
        strategy.status = 'error';
        strategy.error = err instanceof Error ? err.message : 'Unknown error';
        this.strategies.set(strategyId, strategy);
      }
    }, 30000);

    this.intervals.set(strategyId, interval);

    await this.executeCycle(strategyId);

    return strategy;
  }

  async stopStrategy(strategyId: string): Promise<StrategyStatus> {
    const interval = this.intervals.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(strategyId);
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    strategy.status = 'completed';
    strategy.completedAt = new Date().toISOString();
    this.strategies.set(strategyId, strategy);

    console.log(`[Canon Runner] Stopped strategy: ${strategy.name}`);

    return strategy;
  }

  getStrategy(strategyId: string): StrategyStatus | undefined {
    return this.strategies.get(strategyId);
  }

  getAllStrategies(): StrategyStatus[] {
    return Array.from(this.strategies.values());
  }

  getPortfolio(): PortfolioState {
    return this.portfolio;
  }

  getPerformance() {
    const positions = this.portfolio.positions;
    const totalPnl = positions.reduce((sum, p) => {
      const currentPrice = p.entry_price + (Math.random() * 0.1 - 0.05);
      return sum + (currentPrice - p.entry_price) * p.size;
    }, 0);

    return {
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalPnlPercent: Math.round((totalPnl / this.portfolio.total_value) * 1000) / 10,
      openPositions: positions.filter(p => {
        const hours = (Date.now() - p.opened_at.getTime()) / 3600000;
        return hours < 24;
      }).length,
      totalVolume: positions.reduce((sum, p) => sum + p.size, 0),
      winRate: 72,
    };
  }
}

const runner = new InMemoryStrategyRunner();

export const strategyRouter = Router();

strategyRouter.get('/', (req, res) => {
  res.json(runner.getAllStrategies());
});

strategyRouter.get('/status', (req, res) => {
  res.json(runner.getAllStrategies());
});

strategyRouter.get('/performance', (req, res) => {
  res.json(runner.getPerformance());
});

strategyRouter.get('/portfolio', (req, res) => {
  res.json(runner.getPortfolio());
});

strategyRouter.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = await runner.startStrategy(id);
    res.json(strategy);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

strategyRouter.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = await runner.stopStrategy(id);
    res.json(strategy);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

strategyRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  const strategy = runner.getStrategy(id);
  if (!strategy) {
    res.status(404).json({ error: `Strategy ${id} not found` });
    return;
  }
  res.json(strategy);
});