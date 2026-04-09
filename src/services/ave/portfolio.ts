import { getTokenPrice } from './client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface Holding {
  token: string;
  symbol: string;
  chain: string;
  balance: number;
  valueUSD: number;
  price: number;
  change24h: number;
  allocation: number; // percentage
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  change24h: number;
  changePercent24h: number;
  holdings: Holding[];
  lastUpdated: number;
}

const portfolioBreaker = createCircuitBreaker<PortfolioSummary>({
  name: 'Portfolio',
  cacheTtlMs: 30 * 1000, // 30 seconds
  persistCache: false,
});

const STORAGE_KEY = 'worldmonitor-crypto-portfolio';

export interface PortfolioPosition {
  token: string;
  symbol: string;
  chain: string;
  balance: number;
  avgBuyPrice?: number;
}

export function getSavedPositions(): PortfolioPosition[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function savePositions(positions: PortfolioPosition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function addPosition(position: PortfolioPosition): void {
  const positions = getSavedPositions();
  const existing = positions.findIndex(p => p.token === position.token && p.chain === position.chain);
  
  if (existing >= 0) {
    // Update existing - recalculate average
    const old = positions[existing]!;
    const totalBalance = old.balance + position.balance;
    const avgPrice = old.avgBuyPrice && position.avgBuyPrice
      ? (old.balance * old.avgBuyPrice + position.balance * position.avgBuyPrice) / totalBalance
      : position.avgBuyPrice || old.avgBuyPrice;
    
    positions[existing] = { 
      token: position.token, 
      symbol: position.symbol, 
      chain: position.chain,
      balance: totalBalance, 
      avgBuyPrice: avgPrice 
    };
  } else {
    positions.push(position);
  }
  
  savePositions(positions);
}

export function removePosition(token: string, chain: string): void {
  const positions = getSavedPositions().filter(p => !(p.token === token && p.chain === chain));
  savePositions(positions);
}

export async function fetchPortfolio(): Promise<PortfolioSummary> {
  return portfolioBreaker.execute(
    async () => {
      const positions = getSavedPositions();
      
      if (positions.length === 0) {
        return {
          totalValue: 0,
          change24h: 0,
          changePercent24h: 0,
          holdings: [],
          lastUpdated: Math.floor(Date.now() / 1000),
        };
      }
      
      const holdings: Holding[] = [];
      let totalValue = 0;
      let totalChange = 0;
      
      for (const position of positions) {
        const priceData = await getTokenPrice(position.token);
        const price = parseFloat(priceData?.price || priceData?.priceUsd || '0');
        const change24h = parseFloat(priceData?.change24h || '0');
        const valueUSD = position.balance * price;
        
        totalValue += valueUSD;
        totalChange += valueUSD * (change24h / 100);
        
        const avgBuyPrice = position.avgBuyPrice || price;
        const pnl = (price - avgBuyPrice) * position.balance;
        const pnlPercent = avgBuyPrice > 0 ? ((price - avgBuyPrice) / avgBuyPrice) * 100 : 0;
        
        holdings.push({
          token: position.token,
          symbol: position.symbol,
          chain: position.chain,
          balance: position.balance,
          valueUSD,
          price,
          change24h,
          allocation: 0, // will calculate after
          pnl,
          pnlPercent,
        });
      }
      
      // Calculate allocations
      holdings.forEach(h => {
        h.allocation = totalValue > 0 ? (h.valueUSD / totalValue) * 100 : 0;
      });
      
      return {
        totalValue,
        change24h: totalChange,
        changePercent24h: totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0,
        holdings: holdings.sort((a, b) => b.valueUSD - a.valueUSD),
        lastUpdated: Math.floor(Date.now() / 1000),
      };
    },
    {
      totalValue: 0,
      change24h: 0,
      changePercent24h: 0,
      holdings: [],
      lastUpdated: Math.floor(Date.now() / 1000),
    }
  );
}

export function formatCurrency(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(decimals)}M`;
  } else if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(decimals)}K`;
  }
  return `$${value.toFixed(decimals)}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
