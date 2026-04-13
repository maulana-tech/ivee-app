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
  return { tokens: [] };
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
  return { timestamp: new Date().toISOString(), etfs: [], rateLimited: false };
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

export const listMarketQuotes = async () => ({ quotes: [] });
export const listCommodityQuotes = async () => ({ quotes: [] });
export const getCountryStockIndex = async (_req: any) => ({ indexes: [] });
export const listGulfQuotes = async () => ({ quotes: [] });
export const analyzeStock = async (_req: any) => ({ analysis: '' });
export const getStockAnalysisHistory = async (_req: any) => ({ history: [] });
export const backtestStock = async (_req: any) => ({ results: [] });
export const listStoredStockBacktests = async () => ({ backtests: [] });
export const listEarningsCalendar = async (_req: any) => ({ earnings: [] });
export const getCotPositioning = async () => ({ positioning: null });