import {
  getTokenKlines,
  getTokenDetail,
  getSwapTransactions,
  searchTokensAdvanced,
  getChainMainTokens,
  type AveKlinePoint,
  type AveToken,
} from './client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

const DEMO_TOKENS = [
  { token: '0x4200000000000000000000000000000000000006', symbol: 'WETH', chain: 'base', name: 'Wrapped Ether', decimal: 18, current_price_usd: '2246.80', price_change_24h: '0.93', tx_volume_u_24h: '159000000', holders: 4969000 },
  { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', chain: 'base', name: 'USD Coin', decimal: 6, current_price_usd: '1.00', price_change_24h: '0.01', tx_volume_u_24h: '890000000', holders: 4200000 },
  { token: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', symbol: 'cbETH', chain: 'base', name: 'Coinbase Wrapped Staked ETH', decimal: 18, current_price_usd: '2890.50', price_change_24h: '2.31', tx_volume_u_24h: '45000000', holders: 89000 },
  { token: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', symbol: 'AERO', chain: 'base', name: 'Aerodrome', decimal: 18, current_price_usd: '0.185', price_change_24h: '-1.24', tx_volume_u_24h: '32000000', holders: 156000 },
  { token: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', symbol: 'WEWE', chain: 'base', name: 'WeWere', decimal: 18, current_price_usd: '0.00028', price_change_24h: '5.67', tx_volume_u_24h: '890000', holders: 4200 },
  { token: '0x4200000000000000000000000000000000000042', symbol: 'OP', chain: 'base', name: 'Optimism', decimal: 18, current_price_usd: '1.92', price_change_24h: '1.85', tx_volume_u_24h: '156000000', holders: 890000 },
];

export type StrategyType = 'momentum' | 'mean_reversion' | 'breakout' | 'volume_profile' | 'whale_following';

export interface TradeSignal {
  id: string;
  tokenId: string;
  symbol: string;
  chain: string;
  strategy: StrategyType;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  reason: string;
  metrics: {
    priceChange1h: number;
    priceChange24h: number;
    volume24h: number;
    volumeRatio: number;
  };
  timestamp: number;
}

export interface BacktestResult {
  strategy: StrategyType;
  tokenId: string;
  symbol: string;
  startDate: number;
  endDate: number;
  trades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  signals: Array<{ time: number; action: 'BUY' | 'SELL'; price: number; pnl?: number }>;
}

const signalsBreaker = createCircuitBreaker<TradeSignal[]>({
  name: 'Trading Skill Signals',
  cacheTtlMs: 5 * 60 * 1000,
  persistCache: false,
});

const backtestBreaker = createCircuitBreaker<BacktestResult>({
  name: 'Trading Skill Backtest',
  cacheTtlMs: 10 * 60 * 1000,
  persistCache: false,
});

const recommendationsBreaker = createCircuitBreaker<TradeSignal[]>({
  name: 'Trading Skill Recommendations',
  cacheTtlMs: 5 * 60 * 1000,
  persistCache: false,
});

function parseNum(val: string | undefined | null): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function computeMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j]!;
      }
      result.push(sum / period);
    }
  }
  return result;
}

function computeAverageVolume(volumes: number[]): number {
  if (volumes.length === 0) return 0;
  return volumes.reduce((a, b) => a + b, 0) / volumes.length;
}

function klinesToArrays(klines: AveKlinePoint[]): {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  times: number[];
} {
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  const times: number[] = [];
  for (const k of klines) {
    opens.push(parseNum(k.open));
    highs.push(parseNum(k.high));
    lows.push(parseNum(k.low));
    closes.push(parseNum(k.close));
    volumes.push(parseNum(k.volume));
    times.push(k.time);
  }
  return { opens, highs, lows, closes, volumes, times };
}

interface StrategySignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  confidence: number;
}

function analyzeMomentum(closes: number[], volumes: number[]): StrategySignal {
  if (closes.length < 4) return { action: 'HOLD', reason: 'Insufficient data for momentum analysis', confidence: 0 };

  let consecutiveGreen = 0;
  let increasingVolume = true;
  for (let i = closes.length - 1; i >= 1; i--) {
    if (closes[i]! > closes[i - 1]!) {
      consecutiveGreen++;
    } else {
      break;
    }
  }

  const recentVolumes = volumes.slice(-consecutiveGreen);
  for (let i = 1; i < recentVolumes.length; i++) {
    if (recentVolumes[i]! < recentVolumes[i - 1]!) {
      increasingVolume = false;
      break;
    }
  }

  if (consecutiveGreen >= 3 && increasingVolume) {
    const strength = Math.min(consecutiveGreen / 6, 1);
    return {
      action: 'BUY',
      reason: `${consecutiveGreen} consecutive green candles with increasing volume`,
      confidence: Math.round(50 + strength * 40),
    };
  }

  let consecutiveRed = 0;
  for (let i = closes.length - 1; i >= 1; i--) {
    if (closes[i]! < closes[i - 1]!) {
      consecutiveRed++;
    } else {
      break;
    }
  }

  if (consecutiveRed >= 3 && increasingVolume) {
    return {
      action: 'SELL',
      reason: `${consecutiveRed} consecutive red candles, bearish momentum`,
      confidence: Math.round(40 + Math.min(consecutiveRed / 6, 1) * 35),
    };
  }

  return { action: 'HOLD', reason: 'No clear momentum pattern detected', confidence: 0 };
}

function analyzeMeanReversion(closes: number[]): StrategySignal {
  if (closes.length < 20) return { action: 'HOLD', reason: 'Insufficient data for mean reversion', confidence: 0 };

  const ma20 = computeMA(closes, 20);
  const currentMA = ma20[ma20.length - 1]!;
  const currentPrice = closes[closes.length - 1]!;

  if (Number.isNaN(currentMA) || currentMA === 0) {
    return { action: 'HOLD', reason: 'Cannot compute MA20', confidence: 0 };
  }

  const deviation = (currentPrice - currentMA) / currentMA;

  if (currentPrice < currentMA * 0.95) {
    const overshoot = Math.min(Math.abs(deviation) / 0.15, 1);
    return {
      action: 'BUY',
      reason: `Price ${((deviation) * 100).toFixed(1)}% below MA20, oversold condition`,
      confidence: Math.round(50 + overshoot * 35),
    };
  }

  if (currentPrice > currentMA * 1.05) {
    const overshoot = Math.min(Math.abs(deviation) / 0.15, 1);
    return {
      action: 'SELL',
      reason: `Price ${(deviation * 100).toFixed(1)}% above MA20, overbought condition`,
      confidence: Math.round(45 + overshoot * 30),
    };
  }

  return { action: 'HOLD', reason: 'Price within normal range of MA20', confidence: 0 };
}

function analyzeBreakout(highs: number[], closes: number[], volumes: number[]): StrategySignal {
  if (highs.length < 24) return { action: 'HOLD', reason: 'Insufficient data for breakout analysis', confidence: 0 };

  const range = highs.slice(0, -1);
  const maxHigh = Math.max(...range);
  const currentHigh = highs[highs.length - 1]!;
  const currentClose = closes[closes.length - 1]!;
  const avgVolume = computeAverageVolume(volumes.slice(0, -1));
  const currentVolume = volumes[volumes.length - 1]!;

  if (currentHigh > maxHigh && currentVolume > avgVolume * 1.5) {
    const volumeConfirm = Math.min((currentVolume / Math.max(avgVolume, 1)) / 3, 1);
    return {
      action: 'BUY',
      reason: `New 24h high with ${(currentVolume / Math.max(avgVolume, 1)).toFixed(1)}x volume confirmation`,
      confidence: Math.round(55 + volumeConfirm * 30),
    };
  }

  const lows = highs.map((_, i) => {
    const o = closes[i] ?? 0;
    return o - (highs[i]! - o) * 0.5;
  });
  const minLow = Math.min(...lows.slice(0, -1));
  const currentLow = lows[lows.length - 1]!;

  if (currentLow < minLow && currentVolume > avgVolume * 1.5) {
    return {
      action: 'SELL',
      reason: `Broke below support with volume confirmation`,
      confidence: Math.round(50 + Math.min(currentVolume / Math.max(avgVolume, 1) / 3, 1) * 25),
    };
  }

  return { action: 'HOLD', reason: 'No breakout pattern detected', confidence: 0 };
}

function analyzeVolumeProfile(closes: number[], volumes: number[]): StrategySignal {
  if (volumes.length < 10) return { action: 'HOLD', reason: 'Insufficient data for volume profile', confidence: 0 };

  const avgVolume = computeAverageVolume(volumes.slice(0, -1));
  const currentVolume = volumes[volumes.length - 1]!;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

  if (volumeRatio > 3) {
    const priceChange = closes.length >= 2 ? closes[closes.length - 1]! - closes[closes.length - 2]! : 0;
    const direction: 'BUY' | 'SELL' = priceChange > 0 ? 'BUY' : 'SELL';
    const strength = Math.min((volumeRatio - 3) / 5, 1);
    return {
      action: direction,
      reason: `Unusual volume spike: ${volumeRatio.toFixed(1)}x average`,
      confidence: Math.round(50 + strength * 35),
    };
  }

  if (volumeRatio > 2) {
    const priceChange = closes.length >= 2 ? closes[closes.length - 1]! - closes[closes.length - 2]! : 0;
    const direction: 'BUY' | 'SELL' = priceChange > 0 ? 'BUY' : 'SELL';
    return {
      action: direction,
      reason: `Elevated volume: ${volumeRatio.toFixed(1)}x average`,
      confidence: Math.round(35 + Math.min((volumeRatio - 2) / 3, 1) * 25),
    };
  }

  return { action: 'HOLD', reason: 'Volume within normal range', confidence: 0 };
}

async function analyzeWhaleFollowing(tokenId: string, chain: string): Promise<StrategySignal> {
  try {
    const detail = await getTokenDetail(tokenId);
    const token = detail.token;
    const holders = token.holders;
    const priceChange24h = parseNum(token.price_change_24h);

    if (holders > 0 && priceChange24h > 10) {
      return {
        action: 'BUY',
        reason: `Growing holder base (${holders} holders) with positive price action`,
        confidence: Math.round(45 + Math.min(holders / 1000, 1) * 25 + Math.min(priceChange24h / 50, 1) * 20),
      };
    }

    if (holders > 0 && priceChange24h < -10) {
      return {
        action: 'SELL',
        reason: `Holder distribution with negative price action (${priceChange24h.toFixed(1)}% 24h)`,
        confidence: Math.round(40 + Math.min(Math.abs(priceChange24h) / 30, 1) * 30),
      };
    }

    const pair = detail.pairs?.[0]?.pair;
    if (pair) {
      const txs = await getSwapTransactions(pair, 20);
      const largeTxs = txs.filter(tx => parseNum(tx.amount_usd) > 10000);
      const recentBuys = largeTxs.filter(tx => {
        const toSym = tx.to_token_symbol;
        return toSym === token.symbol;
      }).length;
      const recentSells = largeTxs.length - recentBuys;

      if (recentBuys > recentSells * 1.5 && recentBuys >= 2) {
        return {
          action: 'BUY',
          reason: `${recentBuys} large buy transactions vs ${recentSells} sells detected`,
          confidence: Math.round(50 + Math.min(recentBuys / 5, 1) * 30),
        };
      }

      if (recentSells > recentBuys * 1.5 && recentSells >= 2) {
        return {
          action: 'SELL',
          reason: `${recentSells} large sell transactions vs ${recentBuys} buys detected`,
          confidence: Math.round(50 + Math.min(recentSells / 5, 1) * 30),
        };
      }
    }

    return { action: 'HOLD', reason: 'No significant whale activity detected', confidence: 0 };
  } catch {
    return { action: 'HOLD', reason: 'Unable to analyze whale activity', confidence: 0 };
  }
}

const STRATEGY_ANALYZERS: Record<StrategyType, (closes: number[], volumes: number[], highs?: number[]) => StrategySignal> = {
  momentum: (c, v) => analyzeMomentum(c, v),
  mean_reversion: (c) => analyzeMeanReversion(c),
  breakout: (c, v, h?) => analyzeBreakout(h ?? c, c, v),
  volume_profile: (c, v) => analyzeVolumeProfile(c, v),
  whale_following: () => ({ action: 'HOLD', reason: 'Whale analysis requires async fetch', confidence: 0 }),
};

const ALL_STRATEGIES: StrategyType[] = ['momentum', 'mean_reversion', 'breakout', 'volume_profile', 'whale_following'];

function computeTargetStopLoss(action: 'BUY' | 'SELL', entryPrice: number, confidence: number): { targetPrice: number; stopLoss: number } {
  if (action === 'BUY') {
    const targetPct = 1 + (0.05 + (confidence / 100) * 0.10);
    const stopPct = 1 - (0.05 + (1 - confidence / 100) * 0.03);
    return { targetPrice: entryPrice * targetPct, stopLoss: entryPrice * stopPct };
  }
  const targetPct = 1 - (0.05 + (confidence / 100) * 0.10);
  const stopPct = 1 + (0.05 + (1 - confidence / 100) * 0.03);
  return { targetPrice: entryPrice * targetPct, stopLoss: entryPrice * stopPct };
}

function dedupeTokens(tokens: AveToken[]): AveToken[] {
  const seen = new Set<string>();
  return tokens.filter(t => {
    if (seen.has(t.token)) return false;
    seen.add(t.token);
    return true;
  });
}

export async function generateTradeSignals(chain?: string, strategy?: StrategyType): Promise<TradeSignal[]> {
  return signalsBreaker.execute(
    async () => {
      const strategies = strategy ? [strategy] : ALL_STRATEGIES;
      let allTokens: AveToken[] = [];
      
      try {
        const mainTokens = await getChainMainTokens(chain || 'base');
        allTokens = mainTokens.slice(0, 20);
      } catch {
        allTokens = DEMO_TOKENS.slice(0, 15);
      }

      if (chain) {
        allTokens = allTokens.filter(t => t.chain === chain);
      }

      const signals: TradeSignal[] = [];

      for (const token of allTokens.slice(0, 15)) {
        try {
          const klines = await getTokenKlines(token.token, '60', 48);
          if (klines.length < 5) continue;

          const { closes, volumes, highs, times } = klinesToArrays(klines);
          const entryPrice = closes[closes.length - 1]!;
          const priceChange1h = closes.length >= 2
            ? ((closes[closes.length - 1]! - closes[closes.length - 2]!) / closes[closes.length - 2]!) * 100
            : 0;
          const priceChange24h = parseNum(token.price_change_24h);
          const volume24h = parseNum(token.tx_volume_u_24h);
          const avgVol = computeAverageVolume(volumes);
          const volumeRatio = avgVol > 0 ? (volumes[volumes.length - 1] ?? 0) / avgVol : 0;

          const strategySignals: Array<{ strategy: StrategyType; signal: StrategySignal }> = [];

          for (const s of strategies) {
            if (s === 'whale_following') {
              const ws = await analyzeWhaleFollowing(token.token, token.chain);
              strategySignals.push({ strategy: s, signal: ws });
            } else {
              const analyzer = STRATEGY_ANALYZERS[s];
              const signal = analyzer(closes, volumes, highs);
              strategySignals.push({ strategy: s, signal });
            }
          }

          const activeSignals = strategySignals.filter(ss => ss.signal.action !== 'HOLD');
          if (activeSignals.length === 0) continue;

          const buyVotes = activeSignals.filter(ss => ss.signal.action === 'BUY').length;
          const sellVotes = activeSignals.filter(ss => ss.signal.action === 'SELL').length;

          let bestSignal: StrategySignal;
          let bestStrategy: StrategyType;

          if (buyVotes >= sellVotes) {
            const buySignals = strategySignals.filter(ss => ss.signal.action === 'BUY');
            buySignals.sort((a, b) => b.signal.confidence - a.signal.confidence);
            bestSignal = buySignals[0]!.signal;
            bestStrategy = buySignals[0]!.strategy;
          } else {
            const sellSignals = strategySignals.filter(ss => ss.signal.action === 'SELL');
            sellSignals.sort((a, b) => b.signal.confidence - a.signal.confidence);
            bestSignal = sellSignals[0]!.signal;
            bestStrategy = sellSignals[0]!.strategy;
          }

          const agreementBonus = Math.max(buyVotes, sellVotes) / strategies.length * 15;
          const finalConfidence = Math.min(Math.round(bestSignal.confidence + agreementBonus), 100);

          const action: 'BUY' | 'SELL' = bestSignal.action === 'SELL' ? 'SELL' : 'BUY';
          const { targetPrice, stopLoss } = computeTargetStopLoss(action, entryPrice, finalConfidence);

          const reasons = activeSignals
            .filter(ss => ss.signal.action === bestSignal.action)
            .map(ss => `[${ss.strategy}] ${ss.signal.reason}`)
            .join('; ');

          signals.push({
            id: `${token.token}-${bestStrategy}-${Date.now()}`,
            tokenId: token.token,
            symbol: token.symbol,
            chain: token.chain,
            strategy: bestStrategy,
            action: bestSignal.action,
            confidence: finalConfidence,
            entryPrice,
            targetPrice: Math.round(targetPrice * 1e8) / 1e8,
            stopLoss: Math.round(stopLoss * 1e8) / 1e8,
            timeframe: '1h',
            reason: reasons,
            metrics: {
              priceChange1h: Math.round(priceChange1h * 100) / 100,
              priceChange24h,
              volume24h,
              volumeRatio: Math.round(volumeRatio * 100) / 100,
            },
            timestamp: Date.now(),
          });
        } catch {
          continue;
        }
      }

      return signals.sort((a, b) => b.confidence - a.confidence);
    },
    []
  );
}

function simulateStrategy(
  strategy: StrategyType,
  closes: number[],
  volumes: number[],
  highs: number[],
  times: number[]
): BacktestResult['signals'] {
  const signals: BacktestResult['signals'] = [];
  let position: 'long' | null = null;
  let entryPrice = 0;

  for (let i = 20; i < closes.length; i++) {
    const windowCloses = closes.slice(0, i + 1);
    const windowVolumes = volumes.slice(0, i + 1);
    const windowHighs = highs.slice(0, i + 1);

    let action: 'BUY' | 'SELL' | null = null;

    switch (strategy) {
      case 'momentum': {
        let green = 0;
        for (let j = i; j >= Math.max(i - 5, 1); j--) {
          if (closes[j]! > closes[j - 1]!) green++;
          else break;
        }
        if (green >= 3 && !position) action = 'BUY';
        let red = 0;
        for (let j = i; j >= Math.max(i - 5, 1); j--) {
          if (closes[j]! < closes[j - 1]!) red++;
          else break;
        }
        if (red >= 3 && position) action = 'SELL';
        break;
      }
      case 'mean_reversion': {
        const ma20 = computeMA(windowCloses, 20);
        const ma = ma20[ma20.length - 1]!;
        if (!Number.isNaN(ma) && ma > 0) {
          if (closes[i]! < ma * 0.95 && !position) action = 'BUY';
          if (closes[i]! > ma * 1.05 && position) action = 'SELL';
        }
        break;
      }
      case 'breakout': {
        if (i >= 24) {
          const rangeHighs = highs.slice(i - 24, i);
          const maxH = Math.max(...rangeHighs);
          const avgV = computeAverageVolume(volumes.slice(i - 24, i));
          if (highs[i]! > maxH && volumes[i]! > avgV * 1.5 && !position) action = 'BUY';
          if (position && closes[i]! < entryPrice * 0.95) action = 'SELL';
          if (position && closes[i]! > entryPrice * 1.1) action = 'SELL';
        }
        break;
      }
      case 'volume_profile': {
        const avgV = computeAverageVolume(windowVolumes.slice(0, -1));
        if (avgV > 0 && volumes[i]! > avgV * 3) {
          if (closes[i]! > closes[i - 1]! && !position) action = 'BUY';
          if (closes[i]! < closes[i - 1]! && position) action = 'SELL';
        }
        break;
      }
      case 'whale_following': {
        const avgV = computeAverageVolume(windowVolumes.slice(0, -1));
        if (avgV > 0 && volumes[i]! > avgV * 4) {
          if (closes[i]! > (closes[i - 1] ?? 0) && !position) action = 'BUY';
          if (position && closes[i]! < entryPrice * 0.93) action = 'SELL';
          if (position && closes[i]! > entryPrice * 1.12) action = 'SELL';
        }
        break;
      }
    }

    if (action === 'BUY' && !position) {
      position = 'long';
      entryPrice = closes[i]!;
      signals.push({ time: times[i]!, action: 'BUY', price: closes[i]! });
    } else if (action === 'SELL' && position) {
      const pnl = closes[i]! - entryPrice;
      signals.push({ time: times[i]!, action: 'SELL', price: closes[i]!, pnl: Math.round(pnl * 1e8) / 1e8 });
      position = null;
      entryPrice = 0;
    }
  }

  return signals;
}

export async function backtestStrategy(tokenId: string, strategy: StrategyType, days = 7): Promise<BacktestResult> {
  return backtestBreaker.execute(
    async () => {
      const detail = await getTokenDetail(tokenId);
      const symbol = detail.token.symbol;
      const chain = detail.token.chain;

      const klines = await getTokenKlines(tokenId, '60', days * 24);

      if (klines.length < 24) {
        return {
          strategy,
          tokenId,
          symbol,
          startDate: Date.now() - days * 86400000,
          endDate: Date.now(),
          trades: 0,
          winRate: 0,
          totalReturn: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          signals: [],
        };
      }

      const { closes, volumes, highs, times } = klinesToArrays(klines);

      const tradeSignals = simulateStrategy(strategy, closes, volumes, highs, times);

      const sellSignals = tradeSignals.filter(s => s.action === 'SELL');
      const wins = sellSignals.filter(s => (s.pnl ?? 0) > 0).length;
      const losses = sellSignals.length - wins;
      const winRate = sellSignals.length > 0 ? (wins / sellSignals.length) * 100 : 0;

      let totalPnl = 0;
      let peak = 0;
      let maxDrawdown = 0;
      let equity = 0;

      for (const s of sellSignals) {
        totalPnl += s.pnl ?? 0;
        equity += s.pnl ?? 0;
        if (equity > peak) peak = equity;
        const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      const initialPrice = closes[0] ?? 1;
      const totalReturn = initialPrice > 0 ? (totalPnl / initialPrice) * 100 : 0;

      const returns = sellSignals.map(s => s.pnl ?? 0).filter(r => r !== 0);
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const variance = returns.length > 1
        ? returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

      return {
        strategy,
        tokenId,
        symbol,
        startDate: times[0]! * 1000,
        endDate: times[times.length - 1]! * 1000,
        trades: sellSignals.length,
        winRate: Math.round(winRate * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        signals: tradeSignals,
      };
    },
    {
      strategy,
      tokenId,
      symbol: '',
      startDate: Date.now() - days * 86400000,
      endDate: Date.now(),
      trades: 0,
      winRate: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      signals: [],
    },
    { cacheKey: `${tokenId}-${strategy}-${days}` }
  );
}

export async function getRecommendations(chain?: string, limit = 10): Promise<TradeSignal[]> {
  return recommendationsBreaker.execute(
    async () => {
      const allSignals = await generateTradeSignals(chain);

      const buySignals = allSignals.filter(s => s.action === 'BUY');
      const uniqueTokens = new Map<string, TradeSignal>();

      for (const signal of buySignals) {
        const existing = uniqueTokens.get(signal.tokenId);
        if (!existing || signal.confidence > existing.confidence) {
          uniqueTokens.set(signal.tokenId, signal);
        }
      }

      return Array.from(uniqueTokens.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
    },
    [],
    { cacheKey: chain ?? 'all' }
  );
}
