import { aveGet, isEnabled } from './client';

export interface WhaleAlert {
  id: string;
  chain: string;
  tokenSymbol: string;
  tokenAddress: string;
  amount: number;
  valueUsd: number;
  type: 'buy' | 'sell';
  wallet: string;
  timestamp: number;
}

export async function getWhaleAlerts(limit = 10): Promise<WhaleAlert[]> {
  if (!isEnabled()) {
    return generateMockAlerts(limit);
  }
  
  try {
    const data = await aveGet('/whale-alerts?limit=' + limit);
    return data.alerts || [];
  } catch {
    return generateMockAlerts(limit);
  }
}

function generateMockAlerts(limit: number): WhaleAlert[] {
  const chains = ['Base', 'Ethereum', 'Arbitrum', 'Optimism', 'Polygon'];
  const tokens = ['WETH', 'USDC', 'WBTC', 'DAI', 'LINK', 'UNI'];
  const mockAlerts: WhaleAlert[] = [];
  
  for (let i = 0; i < limit; i++) {
    const chain = chains[Math.floor(Math.random() * chains.length)];
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const amount = Math.random() * 100 + 1;
    const price = token === 'WETH' ? 3500 : token === 'WBTC' ? 95000 : 1;
    const value = amount * price;
    
    mockAlerts.push({
      id: `alert-${i}`,
      chain,
      tokenSymbol: token,
      tokenAddress: '0x...',
      amount,
      valueUsd: value,
      type: Math.random() > 0.5 ? 'buy' : 'sell',
      wallet: `${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now() - Math.random() * 3600000,
    });
  }
  
  return mockAlerts.sort((a, b) => b.timestamp - a.timestamp);
}
