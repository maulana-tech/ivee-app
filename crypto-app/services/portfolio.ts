import { aveGet, isEnabled } from './client';

export interface PortfolioPosition {
  symbol: string;
  amount: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
}

export interface Portfolio {
  totalValueUsd: number;
  positions: PortfolioPosition[];
}

export async function getPortfolio(): Promise<Portfolio> {
  if (!isEnabled()) {
    return generateMockPortfolio();
  }
  
  try {
    const data = await aveGet('/portfolio');
    return data || generateMockPortfolio();
  } catch {
    return generateMockPortfolio();
  }
}

function generateMockPortfolio(): Portfolio {
  const tokens = [
    { symbol: 'WETH', price: 3500 },
    { symbol: 'WBTC', price: 95000 },
    { symbol: 'LINK', price: 18 },
    { symbol: 'UNI', price: 12 },
    { symbol: 'AAVE', price: 280 },
  ];
  
  const positions: PortfolioPosition[] = [];
  let totalValue = 0;
  
  for (const token of tokens) {
    const amount = Math.random() * 10 + 0.1;
    const value = amount * token.price;
    const pnlPercent = (Math.random() - 0.3) * 40;
    const pnl = value * (pnlPercent / 100);
    
    positions.push({
      symbol: token.symbol,
      amount,
      valueUsd: value,
      pnlUsd: pnl,
      pnlPercent,
    });
    totalValue += value;
  }
  
  return { totalValueUsd: totalValue, positions };
}
