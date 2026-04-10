import { aveGet, isEnabled } from './client';

export interface TradingSignal {
  id: string;
  pair: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reason: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
  timestamp: number;
}

export async function getTradingSignals(limit = 5): Promise<TradingSignal[]> {
  if (!isEnabled()) {
    return generateMockSignals(limit);
  }
  
  try {
    const data = await aveGet('/signals?limit=' + limit);
    return data.signals || [];
  } catch {
    return generateMockSignals(limit);
  }
}

function generateMockSignals(limit: number): TradingSignal[] {
  const pairs = ['WETH-USDC', 'WBTC-USD', 'LINK-USDC', 'UNI-WETH', 'AAVE-USDC'];
  const reasons = [
    'Strong momentum breakout with high volume',
    ' whale activity detected onchain',
    'Technical pattern forming: golden cross',
    'Funding rate divergence indicates reversal',
    'Smart money accumulation detected',
  ];
  const mockSignals: TradingSignal[] = [];
  
  for (let i = 0; i < limit; i++) {
    const action = Math.random() > 0.3 ? (Math.random() > 0.5 ? 'buy' : 'sell') : 'hold';
    mockSignals.push({
      id: `signal-${i}`,
      pair: pairs[Math.floor(Math.random() * pairs.length)],
      action,
      confidence: Math.random() * 0.4 + 0.6,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      entryPrice: Math.random() * 1000 + 100,
      targetPrice: action === 'buy' ? Math.random() * 500 + 1500 : Math.random() * 500 + 500,
      stopLoss: Math.random() * 100 + 50,
      timeframe: ['1h', '4h', '1d'][Math.floor(Math.random() * 3)],
      timestamp: Date.now() - Math.random() * 86400000,
    });
  }
  
  return mockSignals.sort((a, b) => b.confidence - a.confidence);
}
