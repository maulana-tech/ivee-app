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

export async function searchTokensAdvanced(
  keyword: string,
  chain?: string,
  limit?: number,
  orderby?: string
): Promise<AveToken[]> {
  const params = new URLSearchParams({ keyword });
  if (chain) params.set('chain', chain);
  if (limit) params.set('limit', String(limit));
  if (orderby) params.set('orderby', orderby);
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/tokens?${params}`);
  return data.data || [];
}

export async function getTokenDetail(tokenId: string): Promise<AveTokenDetail> {
  const data = await aveFetch<{ status: number; data: AveTokenDetail }>(`/tokens/${encodeURIComponent(tokenId)}`);
  return data.data;
}

export async function getTokenKlines(
  tokenId: string,
  interval: string,
  limit?: number
): Promise<AveKlinePoint[]> {
  const params = new URLSearchParams({ interval });
  if (limit) params.set('limit', String(limit));
  const data = await aveFetch<{ status: number; data: AveKlinePoint[] }>(
    `/klines/token/${encodeURIComponent(tokenId)}?${params}`
  );
  return data.data || [];
}

export async function getPairKlines(
  pairId: string,
  interval: string,
  limit?: number
): Promise<AveKlinePoint[]> {
  const params = new URLSearchParams({ interval });
  if (limit) params.set('limit', String(limit));
  const data = await aveFetch<{ status: number; data: AveKlinePoint[] }>(
    `/klines/pair/${encodeURIComponent(pairId)}?${params}`
  );
  return data.data || [];
}

export async function getTopHolders(tokenId: string, limit?: number): Promise<AveHolder[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const data = await aveFetch<{ status: number; data: AveHolder[] }>(
    `/tokens/top100/${encodeURIComponent(tokenId)}?${params}`
  );
  return data.data || [];
}

export async function getSwapTransactions(pairId: string, limit?: number): Promise<AveSwapTx[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const data = await aveFetch<{ status: number; data: AveSwapTx[] }>(
    `/txs/${encodeURIComponent(pairId)}?${params}`
  );
  return data.data || [];
}

export async function getRankTopics(): Promise<AveRankTopic[]> {
  const data = await aveFetch<{ status: number; data: AveRankTopic[] }>('/ranks/topics');
  return data.data || [];
}

export async function getTokensByRank(topic: string, limit?: number): Promise<AveToken[]> {
  const params = new URLSearchParams({ topic });
  if (limit) params.set('limit', String(limit));
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/ranks?${params}`);
  return data.data || [];
}

export async function getSupportedChains(): Promise<AveChain[]> {
  const data = await aveFetch<{ status: number; data: AveChain[] }>('/supported_chains');
  return data.data || [];
}

export async function getChainMainTokens(chain: string): Promise<AveToken[]> {
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/tokens/main?chain=${encodeURIComponent(chain)}`);
  return data.data || [];
}

export async function getTrendingTokensV2(
  chain: string,
  page?: number,
  pageSize?: number
): Promise<AveToken[]> {
  const params = new URLSearchParams({ chain });
  if (page) params.set('current_page', String(page));
  if (pageSize) params.set('page_size', String(pageSize));
  const data = await aveFetch<{ status: number; data: AveToken[] }>(`/tokens/trending?${params}`);
  return data.data || [];
}

export { isEnabled, getApiKey };
