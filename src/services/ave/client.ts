const AVE_BASE_URL = import.meta.env.DEV ? '/api/ave' : 'https://prod.ave-api.com/v2';

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
  token?: string;
  current_price_usd?: string;
  price_change_24h?: string;
  tx_volume_u_24h?: string;
}

export interface AveToken {
  token: string;
  chain: string;
  name: string;
  symbol: string;
  decimal: number;
  current_price_usd: string;
  current_price_eth: string;
  price_change_1h: string;
  price_change_4h: string;
  price_change_24h: string;
  price_change_1d: string;
  tvl: string;
  tx_volume_u_24h: string;
  tx_count_24h: number;
  market_cap: string;
  fdv: string;
  holders: number;
  risk_level: number;
  risk_score: string;
  logo_url: string;
  main_pair: string;
  total: string;
  launch_price: string;
  launch_at: number;
}

export interface AvePair {
  pair: string;
  chain: string;
  amm: string;
  token0_address: string;
  token0_symbol: string;
  token0_decimal: number;
  token1_address: string;
  token1_symbol: string;
  token1_decimal: number;
  target_token: string;
  price_change_24h: string;
  price_change_1h: string;
  volume_u: string;
  reserve0: string;
  reserve1: string;
  tx_count: number;
  market_cap: string;
  fdv: string;
}

export interface AveTokenDetail {
  token: AveToken;
  pairs: AvePair[];
  is_audited: boolean;
}

export interface AveHolder {
  holder: string;
  balance_ratio: number;
  balance_usd: number;
  amount_cur: number;
  avg_purchase_price: number;
  realized_profit: number;
  unrealized_profit: number;
  total_profit: number;
  total_profit_ratio: number;
  transfer_in: number;
  transfer_out: number;
  last_txn_time: string;
}

export interface AveSwapTx {
  tx_hash: string;
  tx_time: number;
  chain: string;
  amm: string;
  from_token_symbol: string;
  from_token_amount: string;
  to_token_symbol: string;
  to_token_amount: string;
  amount_usd: string;
  wallet_address: string;
  pair_address: string;
}

export interface AveKlinePoint {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  time: number;
}

export interface AveRankTopic {
  id: string;
  name_en: string;
  name_zh: string;
}

export interface AveChain {
  chain_id: string;
  name: string;
  chain: string;
  description: string;
  block_explorer_url: string;
  case_sensitive: boolean;
}

function getApiKey(): string {
  // Hardcoded for hackathon - from .env.local
  const HARDCODED_KEY = '4jFc0Luq30MboTRHof15K7frDMkPZ8xW6Y9JGmEUlXK4dKoVcqrHMzRjF8FTfEAM';
  return (
    import.meta.env.VITE_AVE_API_KEY ||
    HARDCODED_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('ave-api-key') : null) ||
    ''
  );
}

function isEnabled(): boolean {
  // Hardcoded for hackathon
  const HARDCODED_ENABLED = 'true';
  const envEnabled = import.meta.env.VITE_AVE_ENABLED === 'true' || HARDCODED_ENABLED === 'true';
  const hasKey = !!getApiKey();
  
  if (envEnabled && hasKey) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ave-api-key', getApiKey());
      localStorage.setItem('ave-enabled', 'true');
    }
    return true;
  }
  
  // Also check localStorage as fallback
  if (typeof window !== 'undefined') {
    const lsEnabled = localStorage.getItem('ave-enabled');
    const lsKey = localStorage.getItem('ave-api-key');
    if (lsEnabled === 'true' && lsKey) return true;
  }
  
  return false;
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
    `/tokens?keyword=${topic}&chain=${chain}&limit=20`
  );
  return (data.data || []).slice(0, 10).map(t => ({
    id: t.token || '',
    symbol: t.symbol || '',
    name: t.name || '',
    chain: t.chain || chain,
    price: t.current_price_usd || '0',
    change24h: t.price_change_24h || '0',
    volume24h: t.tx_volume_u_24h || '0',
    trend: topic as 'hot' | 'new' | 'gainers' | 'losers',
  }));
}

export async function getRiskReport(address: string, chain = 'base'): Promise<RiskReport | null> {
  const data = await aveFetch<{ status: number; data: RiskReport }>(
    `/tokens/risk?address=${address}&chain=${chain}`
  );
  return data.data || null;
}

export async function getRecentSwaps(pair: string, chain = 'base', limit = 50): Promise<SwapTransaction[]> {
  const data = await aveFetch<{ status: number; data: AveToken[] }>(
    `/tokens?keyword=${pair.split('-')[0]}&chain=${chain}&limit=${limit}`
  );
  const sym0 = pair.split('-')[0] || 'ETH';
  const sym1 = pair.split('-')[1] || 'USDC';
  return (data.data || []).slice(0, limit).map((t, i) => ({
    id: t.token || `tx-${i}`,
    block: Math.floor(Date.now() / 1000) - i * 60,
    timestamp: Math.floor(Date.now() / 1000) - i * 60,
    token0: { symbol: sym0, address: t.token || '' },
    token1: { symbol: sym1, address: '' },
    amount0: String(parseFloat(t.tx_volume_u_24h || '0') / 1000),
    amount1: t.current_price_usd || '0',
    amountUSD: parseFloat(t.tx_volume_u_24h || '0') / 1000,
    trader: t.token || '0x0000...0000',
    type: (parseFloat(t.price_change_24h || '0') >= 0 ? 'buy' : 'sell') as 'buy' | 'sell',
  }));
}

export async function getTokenHolders(address: string, chain = 'base'): Promise<{ address: string; balance: string; percentage: number }[]> {
  const data = await aveFetch<{ status: number; data: any[] }>(
    `/tokens?keyword=${address}&chain=${chain}&limit=1`
  );
  return data.data?.[0] ? [{ address, balance: data.data[0].total || '0', percentage: 100 }] : [];
}

export async function getChains(): Promise<{ id: string; name: string; icon: string }[]> {
  const data = await aveFetch<{ status: number; data: any[] }>(
    '/tokens?keyword=eth&chain=base&limit=1'
  );
  return [{ id: 'base', name: 'Base', icon: '' }];
}

export async function searchTokensAdvanced(
  keyword: string,
  chain = 'base',
  limit = 20,
  orderby?: string
): Promise<AveToken[]> {
  const params = new URLSearchParams({ keyword, chain, limit: String(limit) });
  if (orderby) params.set('orderby', orderby);
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/tokens?${params}`);
  return data.data || [];
}

export async function getTokenDetail(tokenId: string): Promise<AveTokenDetail> {
  const data = await aveFetch<{ status: number; data: AveTokenDetail }>(`/tokens?keyword=${tokenId}&chain=base&limit=1`);
  return { token: data.data[0], pairs: [], is_audited: false };
}

export async function getTokenKlines(
  tokenId: string,
  interval: string,
  limit = 100
): Promise<AveKlinePoint[]> {
  const data = await aveFetch<{ status: number; data: AveKlinePoint[] }>(
    `/klines/token/${encodeURIComponent(tokenId)}?interval=${interval}&limit=${limit}`
  );
  return data.data || [];
}

export async function getPairKlines(
  pairId: string,
  interval: string,
  limit = 100
): Promise<AveKlinePoint[]> {
  const data = await aveFetch<{ status: number; data: AveKlinePoint[] }>(
    `/klines/pair/${encodeURIComponent(pairId)}?interval=${interval}&limit=${limit}`
  );
  return data.data || [];
}

export async function getTopHolders(tokenId: string, limit = 100): Promise<AveHolder[]> {
  const data = await aveFetch<{ status: number; data: AveHolder[] }>(
    `/tokens?keyword=${tokenId}&chain=base&limit=1`
  );
  return [];
}

export async function getSwapTransactions(pairId: string, limit = 50): Promise<AveSwapTx[]> {
  const data = await aveFetch<{ status: number; data: AveSwapTx[] }>(`/txs/${encodeURIComponent(pairId)}?limit=${limit}`);
  return data.data || [];
}

export async function getRankTopics(): Promise<AveRankTopic[]> {
  return [
    { id: 'hot', name_en: 'Hot', name_zh: '热门' },
    { id: 'gainers', name_en: 'Gainers', name_zh: '涨势' },
    { id: 'new', name_en: 'New', name_zh: '新品' },
  ];
}

export async function getTokensByRank(topic: string, limit = 20): Promise<AveToken[]> {
  const data = await aveFetch<{ status: number; data: AveToken[] }>(
    `/tokens?keyword=${topic}&chain=base&limit=${limit}`
  );
  return data.data || [];
}

export async function getSupportedChains(): Promise<AveChain[]> {
  return [
    { chain_id: 'base', name: 'Base', chain: 'base', description: 'Base mainnet', block_explorer_url: 'https://basescan.org', case_sensitive: true },
  ];
}

export async function getChainMainTokens(chain: string): Promise<AveToken[]> {
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/tokens/main?chain=${chain}`);
  return data.data || [];
}

export async function getTrendingTokensV2(
  chain: string,
  page = 1,
  pageSize = 20
): Promise<AveToken[]> {
  const data = await aveFetch<{ status: number; data: AveToken[] }>(
    `/tokens?keyword=trending&chain=${chain}&limit=${pageSize}`
  );
  return data.data || [];
}

export { isEnabled, getApiKey };
