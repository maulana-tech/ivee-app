import { getRecentSwaps, getTokenPrice } from './client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface WhaleAlert {
  id: string;
  token: string;
  tokenSymbol: string;
  amount: number;
  amountUSD: number;
  type: 'buy' | 'sell';
  trader: string;
  traderShort: string;
  timestamp: number;
  timeAgo: string;
}

export interface PriceAlert {
  token: string;
  symbol: string;
  previousPrice: number;
  currentPrice: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down';
}

const whaleBreaker = createCircuitBreaker<WhaleAlert[]>({
  name: 'Whale Alerts',
  cacheTtlMs: 30 * 1000, // 30 seconds
  persistCache: false,
});

const priceBreaker = createCircuitBreaker<PriceAlert[]>({
  name: 'Price Alerts',
  cacheTtlMs: 60 * 1000, // 1 minute
  persistCache: false,
});

let previousPrices: Map<string, number> = new Map();

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export async function getWhaleAlerts(
  pair: string,
  chain = 'base',
  minValueUSD = 10000,
  limit = 20
): Promise<WhaleAlert[]> {
  return whaleBreaker.execute(
    async () => {
      const swaps = await getRecentSwaps(pair, chain, limit * 2);
      
      const alerts: WhaleAlert[] = swaps
        .filter(s => s.amountUSD >= minValueUSD)
        .slice(0, limit)
        .map(swap => {
          const isBuy = swap.type === 'buy';
          return {
            id: swap.id,
            token: isBuy ? swap.token1.address : swap.token0.address,
            tokenSymbol: isBuy ? swap.token1.symbol : swap.token0.symbol,
            amount: parseFloat(isBuy ? swap.amount1 : swap.amount0),
            amountUSD: swap.amountUSD,
            type: swap.type,
            trader: swap.trader,
            traderShort: formatAddress(swap.trader),
            timestamp: swap.timestamp,
            timeAgo: timeAgo(swap.timestamp),
          };
        });
      
      return alerts;
    },
    [] // fallback
  );
}

export async function watchPriceChanges(
  tokens: Array<{ id: string; symbol: string }>,
  thresholdPercent = 5
): Promise<PriceAlert[]> {
  return priceBreaker.execute(
    async () => {
      const alerts: PriceAlert[] = [];
      
      for (const token of tokens) {
        const priceData = await getTokenPrice(token.id);
        if (!priceData) continue;
        
        const currentPrice = parseFloat(priceData.price || priceData.priceUsd || '0');
        const previousPrice = previousPrices.get(token.id) || currentPrice;
        
        if (previousPrice > 0) {
          const change = currentPrice - previousPrice;
          const changePercent = (change / previousPrice) * 100;
          
          if (Math.abs(changePercent) >= thresholdPercent) {
            alerts.push({
              token: token.id,
              symbol: token.symbol,
              previousPrice,
              currentPrice,
              change,
              changePercent,
              direction: change > 0 ? 'up' : 'down',
            });
          }
        }
        
        previousPrices.set(token.id, currentPrice);
      }
      
      return alerts;
    },
    []
  );
}

export function clearPriceCache(): void {
  previousPrices.clear();
}
