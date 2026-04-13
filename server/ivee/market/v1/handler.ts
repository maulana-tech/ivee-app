import type { ListCryptoQuotesResponse, ListDefiTokensResponse, ListAiTokensResponse, ListOtherTokensResponse, ListCryptoSectorsResponse, ListStablecoinMarketsResponse, ListEtfFlowsResponse, GetFearGreedIndexResponse, GetSectorSummaryResponse } from '../../../../src/generated/server/ivee/worldmonitor/market/v1/service_server';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60 * 1000;

let cache: { quotes?: any[]; sectors?: any[]; ts?: number } = {};

const TOP_100_IDS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'usd-coin', 'cardano', 'avalanche-2', 'dogecoin',
  'polkadot', 'tron', 'chainlink', 'polygon', 'wrapper-bitcoin', 'shiba-inu', 'litecoin', 'bitcoin-cash', 'dai', 'uniswap',
  'avalanche', 'chainlink', 'internet-computer', 'filecoin', 'theta-token', 'axie-infinity', 'fantom', 'elrond', 'near', 'algorand',
];

export async function listCryptoQuotes(): Promise<ListCryptoQuotesResponse> {
  try {
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${TOP_100_IDS.join(',')}&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h,7d`);
    const data = await resp.json();
    return {
      quotes: (data || []).map((c: any) => ({
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change: c.price_change_percentage_24h,
        change7d: c.price_change_percentage_7d_in_currency,
        sparkline: c.sparkline_in_7d?.price?.slice(-24) || [],
        marketCap: c.market_cap,
        volume: c.total_volume,
      })),
    };
  } catch (e) {
    console.error('[market] listCryptoQuotes error:', e);
    return { quotes: [] };
  }
}

export const listCryptoSectors = async (): Promise<ListCryptoSectorsResponse> => {
  const sectors = [
    { id: 'layer1', name: 'Layer 1', change: 0 },
    { id: 'defi', name: 'DeFi', change: 0 },
    { id: 'ai', name: 'AI & ML', change: 0 },
    { id: 'meme', name: 'Meme', change: 0 },
    { id: 'gaming', name: 'Gaming', change: 0 },
    { id: 'rwa', name: 'RWA', change: 0 },
  ];
  return { sectors };
};

export const listDefiTokens = async (): Promise<ListDefiTokensResponse> => {
  try {
    const ids = 'uniswap,aave,chainlink,maker,compound-governance-token,curve-dao-token,synthetix-network-token,lido-dao,rocket-pool,pendle';
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`);
    const data = await resp.json();
    return { tokens: (data || []).map((c: any) => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
  } catch { return { tokens: [] }; }
};

export const listAiTokens = async (): Promise<ListAiTokensResponse> => {
  try {
    const ids = 'render-token,fetch-ai,akash-network,tao-network,worldcoin-wld,virtual-protocol,io-coin,grass';
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`);
    const data = await resp.json();
    return { tokens: (data || []).map((c: any) => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
  } catch { return { tokens: [] }; }
};

export const listOtherTokens = async (): Promise<ListOtherTokensResponse> => {
  try {
    const ids = 'pepe,dogecoin,shiba-inu,bonk,floki,pepe-classic,first-neiro-on-ethereum,memecoin,mog-coin,wojak';
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`);
    const data = await resp.json();
    return { tokens: (data || []).map((c: any) => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
  } catch { return { tokens: [] }; }
};

export const listStablecoinMarkets = async (_req?: { coins?: string[] }): Promise<ListStablecoinMarketsResponse> => {
  const coinIds = _req?.coins?.join(',') || 'tether,usd-coin,dai,true-usd,paxos-standard,frax,binance-usd,husd';
  try {
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false`);
    const data = await resp.json();
    const stablecoins = (data || []).map((c: any) => ({
      id: c.id,
      peg: c.current_price > 0.99 && c.current_price < 1.01 ? 1 : c.current_price,
      marketCap: c.market_cap,
      volume: c.total_volume,
    }));
    return { timestamp: new Date().toISOString(), stablecoins };
  } catch { return { timestamp: new Date().toISOString(), stablecoins: [] }; }
};

export const listEtfFlows = async (): Promise<any> => {
  try {
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc&sparkline=false`);
    const data = await resp.json();
    const btc = (data || []).find((c: any) => c.symbol === 'btc');
    const eth = (data || []).find((c: any) => c.symbol === 'eth');
    const btcChange = btc?.price_change_percentage_24h ?? 0;
    const ethChange = eth?.price_change_percentage_24h ?? 0;
    const btcFlow = Math.round((btc?.total_volume || 0) * (btcChange > 0 ? 0.03 : -0.02));
    const ethFlow = Math.round((eth?.total_volume || 0) * (ethChange > 0 ? 0.025 : -0.015));

    const etfs = [
      { ticker: 'IBIT', issuer: 'BlackRock', estFlow: Math.round(btcFlow * 0.45), volume: Math.round((btc?.total_volume || 0) * 0.35), priceChange: btcChange, direction: btcChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'FBTC', issuer: 'Fidelity', estFlow: Math.round(btcFlow * 0.3), volume: Math.round((btc?.total_volume || 0) * 0.25), priceChange: btcChange, direction: btcChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'BITB', issuer: 'Bitwise', estFlow: Math.round(btcFlow * 0.12), volume: Math.round((btc?.total_volume || 0) * 0.08), priceChange: btcChange, direction: btcChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'ARKB', issuer: '21Shares', estFlow: Math.round(btcFlow * 0.08), volume: Math.round((btc?.total_volume || 0) * 0.06), priceChange: btcChange, direction: btcChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'EZBC', issuer: 'Invesco', estFlow: Math.round(btcFlow * 0.05), volume: Math.round((btc?.total_volume || 0) * 0.04), priceChange: btcChange, direction: btcChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'ETHA', issuer: 'BlackRock', estFlow: Math.round(ethFlow * 0.4), volume: Math.round((eth?.total_volume || 0) * 0.3), priceChange: ethChange, direction: ethChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'FETH', issuer: 'Fidelity', estFlow: Math.round(ethFlow * 0.25), volume: Math.round((eth?.total_volume || 0) * 0.2), priceChange: ethChange, direction: ethChange >= 0 ? 'inflow' : 'outflow' },
      { ticker: 'ETHW', issuer: 'Bitwise', estFlow: Math.round(ethFlow * 0.15), volume: Math.round((eth?.total_volume || 0) * 0.1), priceChange: ethChange, direction: ethChange >= 0 ? 'inflow' : 'outflow' },
    ].filter(e => Math.abs(e.estFlow) > 0);

    const totalEstFlow = etfs.reduce((s, e) => s + e.estFlow, 0);
    const totalVolume = etfs.reduce((s, e) => s + e.volume, 0);
    const inflowCount = etfs.filter(e => e.direction === 'inflow').length;
    const outflowCount = etfs.filter(e => e.direction === 'outflow').length;

    return {
      timestamp: new Date().toISOString(),
      etfs,
      summary: {
        etfCount: etfs.length,
        totalVolume,
        totalEstFlow,
        netDirection: totalEstFlow >= 0 ? 'NET_INFLOW' : 'NET_OUTFLOW',
        inflowCount,
        outflowCount,
      },
      rateLimited: false,
    };
  } catch {
    return { timestamp: new Date().toISOString(), etfs: [], rateLimited: false };
  }
};

export const getFearGreedIndex = async (): Promise<any> => {
  try {
    const resp = await fetch('https://alternative.me/crypto/api/fear_and_greed.json');
    const data = await resp.json();
    return { value: parseInt(data?.data?.[0]?.value || '50'), valueClassification: data?.data?.[0]?.value_classification || 'Neutral' };
  } catch { return { value: 50, valueClassification: 'Neutral' }; }
};

export const getSectorSummary = async (): Promise<any> => {
  return { sectors: [] };
};

export const listMarketQuotes = async (): Promise<any> => {
  const quotes = await listCryptoQuotes();
  return { quotes: quotes.quotes.slice(0, 20) };
};

export const listCommodityQuotes = async (): Promise<any> => {
  return { quotes: [] };
};

export const getCountryStockIndex = async (_req: any) => ({ indexes: [] });
export const listGulfQuotes = async () => ({ quotes: [] });
export const analyzeStock = async (_req: any) => ({ analysis: '' });
export const getStockAnalysisHistory = async (_req: any) => ({ history: [] });
export const backtestStock = async (_req: any) => ({ results: [] });
export const listStoredStockBacktests = async () => ({ backtests: [] });
export const listEarningsCalendar = async (_req: any) => ({ earnings: [] });
export const getCotPositioning = async () => ({ positioning: null });

// Add missing endpoints
export const getEconomicCalendar = async (_req: any) => ({ events: [] });

export const listFeedDigest = async (_req: any) => ({
  items: []
});

// Compose handlers for the RPC router
export const marketHandler: any = {
  listMarketQuotes,
  listCryptoQuotes,
  listCommodityQuotes,
  getSectorSummary,
  listStablecoinMarkets,
  listEtfFlows,
  getCountryStockIndex,
  listGulfQuotes,
  analyzeStock,
  getStockAnalysisHistory,
  backtestStock,
  listStoredStockBacktests,
  listCryptoSectors,
  listDefiTokens,
  listAiTokens,
  listOtherTokens,
  getFearGreedIndex,
  listEarningsCalendar,
  getCotPositioning,
};