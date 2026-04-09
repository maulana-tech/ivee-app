import { getTokenPrice, getTrendingTokens } from './client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

export type SignalType = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
export type SignalReason = 'whale_activity' | 'trend_reversal' | 'volume_surge' | 'breakout' | 'breakdown';

export interface TradingSignal {
  id: string;
  token: string;
  symbol: string;
  chain: string;
  signal: SignalType;
  confidence: number; // 0-100
  reason: SignalReason;
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  timestamp: number;
  timeAgo: string;
  details: string;
}

const signalsBreaker = createCircuitBreaker<TradingSignal[]>({
  name: 'Trading Signals',
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  persistCache: false,
});

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getSignalFromChange(change24h: number, volumeRatio: number): { signal: SignalType; confidence: number } {
  // Simple signal logic based on 24h change and volume
  let confidence = Math.min(Math.abs(change24h) * 5 + volumeRatio * 30, 100);
  
  if (change24h > 20 && confidence > 60) {
    return { signal: 'strong_buy', confidence };
  } else if (change24h > 5 && confidence > 40) {
    return { signal: 'buy', confidence };
  } else if (change24h < -20 && confidence > 60) {
    return { signal: 'strong_sell', confidence };
  } else if (change24h < -5 && confidence > 40) {
    return { signal: 'sell', confidence };
  }
  
  return { signal: 'neutral', confidence: 30 };
}

function getReason(change24h: number, volumeRatio: number): SignalReason {
  if (volumeRatio > 3) return 'volume_surge';
  if (change24h > 15) return 'breakout';
  if (change24h < -15) return 'breakdown';
  if (change24h > 0 && change24h < 5) return 'whale_activity';
  return 'trend_reversal';
}

export async function generateSignals(
  chain = 'base',
  topics = ['hot', 'gainers'] as ('hot' | 'gainers' | 'losers' | 'new')[],
  limit = 10
): Promise<TradingSignal[]> {
  return signalsBreaker.execute(
    async () => {
      const signals: TradingSignal[] = [];
      
      for (const topic of topics) {
        const trending = await getTrendingTokens(chain, topic);
        
        for (const token of trending.slice(0, limit)) {
          const priceData = await getTokenPrice(token.id);
          if (!priceData) continue;
          
          const change24h = parseFloat(priceData.change24h || '0');
          const currentPrice = parseFloat(priceData.price || priceData.priceUsd || '0');
          
          // Simulate volume ratio (in real implementation, would fetch actual volume data)
          const volumeRatio = Math.random() * 2 + 0.5;
          
          const { signal, confidence } = getSignalFromChange(change24h, volumeRatio);
          
          if (signal !== 'neutral') {
            const reason = getReason(change24h, volumeRatio);
            const timestamp = Math.floor(Date.now() / 1000);
            
            let entryPrice = currentPrice;
            let targetPrice: number | undefined;
            let stopLoss: number | undefined;
            
            if (signal.includes('buy')) {
              targetPrice = currentPrice * (1 + Math.abs(change24h) / 100 * 2);
              stopLoss = currentPrice * 0.95;
            } else {
              targetPrice = currentPrice * (1 - Math.abs(change24h) / 100 * 2);
              stopLoss = currentPrice * 1.05;
            }
            
            signals.push({
              id: `${token.id}-${timestamp}`,
              token: token.id,
              symbol: token.symbol,
              chain: token.chain,
              signal,
              confidence: Math.round(confidence),
              reason,
              entryPrice,
              targetPrice: Math.round(targetPrice * 1000000) / 1000000,
              stopLoss: Math.round((stopLoss || 0) * 1000000) / 1000000,
              timestamp,
              timeAgo: timeAgo(timestamp),
              details: `${token.name} showing ${reason.replace('_', ' ')} pattern`,
            });
          }
        }
      }
      
      // Sort by confidence
      return signals.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
    },
    []
  );
}

export function formatSignalBadge(signal: SignalType): { emoji: string; color: string } {
  switch (signal) {
    case 'strong_buy':
      return { emoji: '🚀', color: '#00ff00' };
    case 'buy':
      return { emoji: '📈', color: '#00cc00' };
    case 'neutral':
      return { emoji: '➡️', color: '#888888' };
    case 'sell':
      return { emoji: '📉', color: '#ff6600' };
    case 'strong_sell':
      return { emoji: '💥', color: '#ff0000' };
  }
}
