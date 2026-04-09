const AVE_BASE_URL = 'https://prod.ave-api.com/v2';

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  price: string;
  priceUsd: string;
  change24h: string;
  volume24h: string;
  marketCap: string;
  tvl: string;
}

export interface RiskReport {
  is_honeypot: boolean;
  buy_tax: number;
  sell_tax: number;
  owner: string;
  owner_renounced: boolean;
  liquidity_locked: boolean;
  liquidity: string;
  total_supply: string;
  holders: number;
}

export interface SwapTransaction {
  id: string;
  block: number;
  timestamp: number;
  token0: { symbol: string; address: string };
  token1: { symbol: string; address: string };
  amount0: string;
  amount1: string;
  amountUSD: number;
  trader: string;
  type: 'buy' | 'sell';
}

export interface TrendingToken {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  price: string;
  change24h: string;
  volume24h: string;
  trend: 'hot' | 'new' | 'gainers' | 'losers';
}

function getApiKey(): string {
  return import.meta.env.VITE_AVE_API_KEY || '';
}

function isEnabled(): boolean {
  return import.meta.env.VITE_AVE_ENABLED === 'true' && !!getApiKey();
}

async function aveFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!isEnabled()) {
    throw new Error('AVE integration is not enabled. Set VITE_AVE_ENABLED=true and VITE_AVE_API_KEY');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${AVE_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-KEY': getApiKey(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`AVE API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function searchTokens(keyword: string, chain = 'base'): Promise<TokenInfo[]> {
  const data = await aveFetch<{ status: number; data: TokenInfo[] }>(
    `/tokens?keyword=${encodeURIComponent(keyword)}&chain=${chain}&limit=20`
  );
  return data.data || [];
}

export async function getTokenPrice(tokenId: string): Promise<TokenInfo | null> {
  const data = await aveFetch<{ status: number; data: Record<string, { current_price_usd: string; price_change_percentage_24h: string }> }>(
    '/tokens/price',
    {
      method: 'POST',
      body: JSON.stringify({ token_ids: [tokenId] }),
    }
  );

  const priceData = data.data?.[tokenId];
  if (!priceData) return null;

  return {
    id: tokenId,
    symbol: '',
    name: '',
    chain: '',
    price: priceData.current_price_usd,
    priceUsd: priceData.current_price_usd,
    change24h: priceData.price_change_percentage_24h || '0',
    volume24h: '',
    marketCap: '',
    tvl: '',
  };
}

export async function getTrendingTokens(chain = 'base', topic = 'hot'): Promise<TrendingToken[]> {
  const data = await aveFetch<{ status: number; data: TrendingToken[] }>(
    `/ranks?chain=${chain}&topic=${topic}`
  );
  return data.data || [];
}

export async function getRiskReport(address: string, chain = 'base'): Promise<RiskReport | null> {
  const data = await aveFetch<{ status: number; data: RiskReport }>(
    `/tokens/risk?address=${address}&chain=${chain}`
  );
  return data.data || null;
}

export async function getRecentSwaps(pair: string, chain = 'base', limit = 50): Promise<SwapTransaction[]> {
  const data = await aveFetch<{ status: number; data: SwapTransaction[] }>(
    `/swaps?pair=${pair}&chain=${chain}&limit=${limit}`
  );
  return data.data || [];
}

export async function getTokenHolders(address: string, chain = 'base'): Promise<{ address: string; balance: string; percentage: number }[]> {
  const data = await aveFetch<{ status: number; data: { address: string; balance: string; percentage: number }[] }>(
    `/holders?address=${address}&chain=${chain}&limit=100`
  );
  return data.data || [];
}

export async function getChains(): Promise<{ id: string; name: string; icon: string }[]> {
  const data = await aveFetch<{ status: number; data: { chain_id: string; name: string; icon: string }[] }>(
    '/chains'
  );
  return (data.data || []).map(c => ({ id: c.chain_id, name: c.name, icon: c.icon }));
}

export { isEnabled, getApiKey };
