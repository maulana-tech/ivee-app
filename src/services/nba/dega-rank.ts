import type { TradeSignal } from "../../TradeSignal";
import type { Portfolio, Position, RiskDecision } from "../../RiskInterface";
import { browserExecutionLog } from "./browser-execution-log";

export interface DegaPosition {
  id: string;
  marketId: string;
  question: string;
  side: 'yes' | 'no';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  status: 'open' | 'settled' | 'closed';
}

export interface DegaPerformance {
  totalPnl: number;
  totalPnlPercent: number;
  openPositions: number;
  totalVolume: number;
  winRate: number;
  activeStrategies: string[];
  lastUpdated: string;
}

export interface DegaLeaderboard {
  rank: number;
  username: string;
  profit: number;
  profitPercent: number;
  trades: number;
  winRate: number;
}

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

interface PolymarketPosition {
  asset_id: string;
  condition_id: string;
  contract_id: string;
  entry_price: number;
  outcome: string;
  size: number;
  asset_uuid: string;
}

interface PolymarketOrder {
  asset_id: string;
  side: 'yes' | 'no';
  size: number;
  price: number;
  status: 'open' | 'filled' | 'cancelled';
  created_at: string;
}

export class DegaRankService {
  private walletAddress: string = '';
  private positions: DegaPosition[] = [];
  private listeners: ((perf: DegaPerformance) => void)[] = [];

  setWalletAddress(addr: string): void {
    this.walletAddress = addr;
  }

  getWalletAddress(): string {
    return this.walletAddress;
  }

  async fetchPositions(): Promise<DegaPosition[]> {
    if (!this.walletAddress) {
      return this.getMockPositions();
    }

    try {
      const response = await fetch(
        `${POLYMARKET_API}/positions?address=${this.walletAddress}`
      );
      if (!response.ok) throw new Error('Failed to fetch positions');
      
      const data = await response.json();
      return this.mapPolymarketPositions(data);
    } catch {
      return this.getMockPositions();
    }
  }

  private mapPolymarketPositions(data: any[]): DegaPosition[] {
    return data.map((pos, i) => ({
      id: `pos-${i}`,
      marketId: pos.condition_id || `market-${i}`,
      question: pos.title || 'Unknown Market',
      side: pos.outcome === 'Yes' ? 'yes' : 'no',
      size: pos.size || 0,
      entryPrice: pos.entry_price || 0.5,
      currentPrice: 0.5,
      pnl: 0,
      pnlPercent: 0,
      openedAt: pos.timestamp || new Date().toISOString(),
      status: 'open',
    }));
  }

  getMockPositions(): DegaPosition[] {
    return [
      {
        id: 'pos-1',
        marketId: 'celtics-2025-champs',
        question: 'Will the Boston Celtics win the 2025 NBA Championship?',
        side: 'yes',
        size: 50,
        entryPrice: 0.35,
        currentPrice: 0.42,
        pnl: 10,
        pnlPercent: 20,
        openedAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'open',
      },
      {
        id: 'pos-2',
        marketId: 'okc-western-conf',
        question: 'Will OKC Thunder win the Western Conference?',
        side: 'no',
        size: 30,
        entryPrice: 0.58,
        currentPrice: 0.52,
        pnl: 3.1,
        pnlPercent: 10.3,
        openedAt: new Date(Date.now() - 7200000).toISOString(),
        status: 'open',
      },
      {
        id: 'pos-3',
        marketId: 'sga-mvp',
        question: 'Will Shai Gilgeous-Alexander win MVP?',
        side: 'yes',
        size: 25,
        entryPrice: 0.62,
        currentPrice: 0.68,
        pnl: 2.4,
        pnlPercent: 9.6,
        openedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'settled',
      },
    ];
  }

  getPerformance(): DegaPerformance {
    const positions = this.positions.length ? this.positions : this.getMockPositions();
    const open = positions.filter(p => p.status === 'open');
    const settled = positions.filter(p => p.status === 'settled');
    
    const totalPnl = open.reduce((sum, p) => sum + p.pnl, 0) + 
                     settled.reduce((sum, p) => sum + p.pnl, 0);
    const totalSize = positions.reduce((sum, p) => sum + p.size, 0);
    const wins = settled.filter(p => p.pnl > 0).length;
    
    return {
      totalPnl,
      totalPnlPercent: totalSize > 0 ? (totalPnl / totalSize) * 100 : 0,
      openPositions: open.length,
      totalVolume: totalSize,
      winRate: settled.length > 0 ? (wins / settled.length) * 100 : 0,
      activeStrategies: ['Arbitrage Scanner', 'Momentum Trader'],
      lastUpdated: new Date().toISOString(),
    };
  }

  getLeaderboard(): DegaLeaderboard[] {
    return [
      { rank: 1, username: 'AlphaTrader', profit: 234.50, profitPercent: 47.2, trades: 23, winRate: 78 },
      { rank: 2, username: 'QuantMaster', profit: 189.30, profitPercent: 35.8, trades: 31, winRate: 71 },
      { rank: 3, username: 'IVEE_Bot', profit: 156.80, profitPercent: 28.4, trades: 18, winRate: 82 },
      { rank: 4, username: 'SportsBettor', profit: 98.20, profitPercent: 19.6, trades: 42, winRate: 65 },
      { rank: 5, username: 'DataDriven', profit: 67.50, profitPercent: 12.4, trades: 15, winRate: 73 },
    ];
  }

  async syncWithCanon(signal: TradeSignal): Promise<void> {
    const positionId = `pos-${Date.now()}`;
    const newPosition: DegaPosition = {
      id: positionId,
      marketId: signal.market.market_id,
      question: signal.market.question,
      side: signal.direction === 'buy_yes' ? 'yes' : 'no',
      size: signal.size,
      entryPrice: 0.5,
      currentPrice: 0.5,
      pnl: 0,
      pnlPercent: 0,
      openedAt: signal.timestamp.toISOString(),
      status: 'open',
    };

    this.positions.push(newPosition);

    browserExecutionLog.appendEntry({
      timestamp: new Date().toISOString(),
      type: 'order_submit',
      automation_id: signal.automation_id,
      market_id: signal.market.market_id,
      payload: {
        position_id: positionId,
        direction: signal.direction,
        size: signal.size,
        confidence: signal.confidence,
        urgency: signal.urgency,
        question: signal.market.question,
        source: 'canon-bridge',
      },
    });

    const perf = this.getPerformance();
    this.listeners.forEach(fn => fn(perf));
  }

  onPerformanceUpdate(fn: (perf: DegaPerformance) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  async startTracking(): Promise<void> {
    await this.fetchPositions();
    const perf = this.getPerformance();
    this.listeners.forEach(fn => fn(perf));
    
    setInterval(async () => {
      await this.fetchPositions();
      const perf = this.getPerformance();
      this.listeners.forEach(fn => fn(perf));
    }, 30000);
  }
}

export const degasRankService = new DegaRankService();