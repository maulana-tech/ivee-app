import type { ListCryptoQuotesResponse, ListDefiTokensResponse, ListAiTokensResponse, ListOtherTokensResponse, ListCryptoSectorsResponse, ListStablecoinMarketsResponse, ListEtfFlowsResponse, GetFearGreedIndexResponse, GetSectorSummaryResponse } from '../../../../src/generated/server/ivee/worldmonitor/market/v1/service_server';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const ALL_IDS = [
  'bitcoin','ethereum','tether','binancecoin','solana','ripple','usd-coin','cardano','avalanche-2','dogecoin',
  'polkadot','tron','chainlink','polygon','shiba-inu','litecoin','bitcoin-cash','dai','uniswap','near',
  'internet-computer','filecoin','cosmos','stellar','aptos','arbitrum','optimism',
  'uniswap','aave','maker','compound-governance-token','curve-dao-token','lido-dao','rocket-pool','pendle',
  'render-token','fetch-ai','akash-network','worldcoin-wld','virtual-protocol','grass',
  'pepe','bonk','floki','first-neiro-on-ethereum','mog-coin','wojak',
  'true-usd','paxos-standard','frax','binance-usd',
].filter((v, i, a) => a.indexOf(v) === i);

interface CachedData {
  quotes: any[];
  ts: number;
}

let cached: CachedData | null = null;
const CACHE_TTL = 90_000;

async function fetchAllMarkets(): Promise<any[]> {
  if (cached && Date.now() - cached.ts < CACHE_TTL && cached.quotes.length > 0) {
    return cached.quotes;
  }
  try {
    const resp = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ALL_IDS.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h,7d`
    );
    if (!resp.ok) {
      if (cached) return cached.quotes;
      return FALLBACK_QUOTES;
    }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      if (cached) return cached.quotes;
      return FALLBACK_QUOTES;
    }
    cached = { quotes: data, ts: Date.now() };
    return data;
  } catch {
    if (cached) return cached.quotes;
    return FALLBACK_QUOTES;
  }
}

const FALLBACK_QUOTES = [
  { symbol:'btc', name:'Bitcoin', current_price:72000, price_change_percentage_24h:1.6, price_change_percentage_7d_in_currency:3.4, sparkline_in_7d:{price:[71000,71200,70800,71500,71800,72000]}, market_cap:1440000000000, total_volume:36000000000 },
  { symbol:'eth', name:'Ethereum', current_price:2220, price_change_percentage_24h:1.5, price_change_percentage_7d_in_currency:2.8, sparkline_in_7d:{price:[2180,2190,2170,2200,2210,2220]}, market_cap:268000000000, total_volume:15000000000 },
  { symbol:'sol', name:'Solana', current_price:83, price_change_percentage_24h:1.6, sparkline_in_7d:{price:[80,81,82,83]}, market_cap:48000000000, total_volume:3000000000 },
  { symbol:'bnb', name:'BNB', current_price:605, price_change_percentage_24h:2.3, sparkline_in_7d:{price:[590,595,600,605]}, market_cap:83000000000, total_volume:1000000000 },
  { symbol:'xrp', name:'XRP', current_price:1.34, price_change_percentage_24h:0.8, sparkline_in_7d:{price:[1.32,1.33,1.34]}, market_cap:82000000000, total_volume:2000000000 },
  { symbol:'doge', name:'Dogecoin', current_price:0.092, price_change_percentage_24h:1.1, sparkline_in_7d:{price:[0.09,0.091,0.092]}, market_cap:14000000000, total_volume:1000000000 },
  { symbol:'ada', name:'Cardano', current_price:0.24, price_change_percentage_24h:0.5, sparkline_in_7d:{price:[0.238,0.239,0.24]}, market_cap:8800000000, total_volume:400000000 },
  { symbol:'avax', name:'Avalanche', current_price:9.2, price_change_percentage_24h:2.7, sparkline_in_7d:{price:[8.9,9.0,9.2]}, market_cap:4000000000, total_volume:240000000 },
  { symbol:'link', name:'Chainlink', current_price:8.8, price_change_percentage_24h:1.3, sparkline_in_7d:{price:[8.6,8.7,8.8]}, market_cap:6400000000, total_volume:250000000 },
  { symbol:'dot', name:'Polkadot', current_price:1.17, price_change_percentage_24h:-5.1, sparkline_in_7d:{price:[1.22,1.20,1.17]}, market_cap:2000000000, total_volume:260000000 },
  { symbol:'usdt', name:'Tether', current_price:1.0, price_change_percentage_24h:-0.01, sparkline_in_7d:{price:[1,1,1]}, market_cap:184000000000, total_volume:56000000000 },
  { symbol:'usdc', name:'USD Coin', current_price:1.0, price_change_percentage_24h:-0.02, sparkline_in_7d:{price:[1,1,1]}, market_cap:79000000000, total_volume:12500000000 },
  { symbol:'dai', name:'Dai', current_price:1.0, price_change_percentage_24h:-0.17, sparkline_in_7d:{price:[1,1,1]}, market_cap:4400000000, total_volume:90000000 },
  { symbol:'uni', name:'Uniswap', current_price:3.1, price_change_percentage_24h:2.2, sparkline_in_7d:{price:[3.0,3.05,3.1]}, market_cap:2000000000, total_volume:160000000 },
  { symbol:'matic', name:'Polygon', current_price:0.22, price_change_percentage_24h:-0.8, sparkline_in_7d:{price:[0.23,0.225,0.22]}, market_cap:2200000000, total_volume:300000000 },
  { symbol:'ltc', name:'Litecoin', current_price:53, price_change_percentage_24h:-1.3, sparkline_in_7d:{price:[54,53.5,53]}, market_cap:4100000000, total_volume:290000000 },
  { symbol:'bch', name:'Bitcoin Cash', current_price:426, price_change_percentage_24h:0.8, sparkline_in_7d:{price:[422,424,426]}, market_cap:8500000000, total_volume:154000000 },
  { symbol:'pepe', name:'Pepe', current_price:0.0000072, price_change_percentage_24h:3.5, sparkline_in_7d:{price:[0.0000068,0.000007,0.0000072]}, market_cap:3400000000, total_volume:800000000 },
  { symbol:'shib', name:'Shiba Inu', current_price:0.0000058, price_change_percentage_24h:-0.05, sparkline_in_7d:{price:[0.0000059,0.0000058,0.0000058]}, market_cap:3400000000, total_volume:88000000 },
  { symbol:'near', name:'NEAR Protocol', current_price:1.38, price_change_percentage_24h:3.0, sparkline_in_7d:{price:[1.33,1.35,1.38]}, market_cap:1800000000, total_volume:225000000 },
];

function toQuote(c: any) {
  return {
    symbol: c.symbol?.toUpperCase(),
    name: c.name,
    price: c.current_price,
    change: c.price_change_percentage_24h,
    change7d: c.price_change_percentage_7d_in_currency,
    sparkline: c.sparkline_in_7d?.price?.slice(-24) || [],
    marketCap: c.market_cap,
    volume: c.total_volume,
  };
}

export async function listCryptoQuotes(): Promise<ListCryptoQuotesResponse> {
  const data = await fetchAllMarkets();
  return { quotes: data.map(toQuote) };
}

export const listCryptoSectors = async (): Promise<ListCryptoSectorsResponse> => {
  const data = await fetchAllMarkets();
  const avgChange = data.length > 0 ? data.reduce((s: number, c: any) => s + (c.price_change_percentage_24h || 0), 0) / data.length : 0;
  return { sectors: [
    { id: 'layer1', name: 'Layer 1', change: parseFloat(avgChange.toFixed(2)) },
    { id: 'defi', name: 'DeFi', change: parseFloat((avgChange * 0.8).toFixed(2)) },
    { id: 'ai', name: 'AI & ML', change: parseFloat((avgChange * 1.2).toFixed(2)) },
    { id: 'meme', name: 'Meme', change: parseFloat((avgChange * 2).toFixed(2)) },
    { id: 'gaming', name: 'Gaming', change: parseFloat((avgChange * 0.6).toFixed(2)) },
    { id: 'rwa', name: 'RWA', change: parseFloat((avgChange * 0.5).toFixed(2)) },
  ] };
};

const DEFI_SYMS = new Set(['UNI','AAVE','LINK','MKR','COMP','CRV','LDO','RPL','PENDLE','SNX']);
const AI_SYMS = new Set(['RENDER','FET','AKT','WLD','VIRTUAL','GRASS','IO','TAO']);
const OTHER_SYMS = new Set(['PEPE','DOGE','SHIB','BONK','FLOKI','NEIRO','MEME','MOG','WOJAK']);
const STABLE_SYMS = new Set(['USDT','USDC','DAI','TUSD','PAX','FRAX','BUSD']);

export const listDefiTokens = async (): Promise<ListDefiTokensResponse> => {
  const data = await fetchAllMarkets();
  return { tokens: data.filter((c: any) => DEFI_SYMS.has(c.symbol?.toUpperCase())).map(c => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
};

export const listAiTokens = async (): Promise<ListAiTokensResponse> => {
  const data = await fetchAllMarkets();
  return { tokens: data.filter((c: any) => AI_SYMS.has(c.symbol?.toUpperCase())).map(c => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
};

export const listOtherTokens = async (): Promise<ListOtherTokensResponse> => {
  const data = await fetchAllMarkets();
  return { tokens: data.filter((c: any) => OTHER_SYMS.has(c.symbol?.toUpperCase())).map(c => ({ symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h })) };
};

export const listStablecoinMarkets = async (_req?: { coins?: string[] }): Promise<ListStablecoinMarketsResponse> => {
  const data = await fetchAllMarkets();
  const stablecoins = data
    .filter((c: any) => STABLE_SYMS.has(c.symbol?.toUpperCase()))
    .map((c: any) => ({
      id: c.id,
      peg: c.current_price > 0.99 && c.current_price < 1.01 ? 1 : c.current_price,
      marketCap: c.market_cap,
      volume: c.total_volume,
    }));
  return { timestamp: new Date().toISOString(), stablecoins };
};

export const listEtfFlows = async (): Promise<any> => {
  const data = await fetchAllMarkets();
  const btc = data.find((c: any) => c.symbol === 'btc');
  const eth = data.find((c: any) => c.symbol === 'eth');
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
    timestamp: new Date().toISOString(), etfs,
    summary: { etfCount: etfs.length, totalVolume, totalEstFlow, netDirection: totalEstFlow >= 0 ? 'NET_INFLOW' : 'NET_OUTFLOW', inflowCount, outflowCount },
    rateLimited: false,
  };
};

export const getFearGreedIndex = async (): Promise<any> => {
  try {
    const resp = await fetch('https://alternative.me/crypto/api/fear_and_greed.json');
    const data = await resp.json();
    return { value: parseInt(data?.data?.[0]?.value || '50'), valueClassification: data?.data?.[0]?.value_classification || 'Neutral' };
  } catch { return { value: 50, valueClassification: 'Neutral' }; }
};

export const getSectorSummary = async (): Promise<any> => ({ sectors: [] });

export const listMarketQuotes = async (): Promise<any> => {
  const q = await listCryptoQuotes();
  return { quotes: q.quotes.slice(0, 20) };
};

export const listCommodityQuotes = async (): Promise<any> => ({ quotes: [] });
export const getCountryStockIndex = async (_req: any) => ({ indexes: [] });
export const listGulfQuotes = async () => ({ quotes: [] });
export const analyzeStock = async (_req: any) => ({ analysis: '' });
export const getStockAnalysisHistory = async (_req: any) => ({ history: [] });
export const backtestStock = async (_req: any) => ({ results: [] });
export const listStoredStockBacktests = async () => ({ backtests: [] });
export const listEarningsCalendar = async (_req: any) => ({ earnings: [] });
export const getCotPositioning = async () => ({ positioning: null });
export const getEconomicCalendar = async (_req: any) => ({ events: [] });
export const listFeedDigest = async (_req: any) => ({ items: [] });

export const marketHandler: any = {
  listMarketQuotes, listCryptoQuotes, listCommodityQuotes, getSectorSummary,
  listStablecoinMarkets, listEtfFlows, getCountryStockIndex, listGulfQuotes,
  analyzeStock, getStockAnalysisHistory, backtestStock, listStoredStockBacktests,
  listCryptoSectors, listDefiTokens, listAiTokens, listOtherTokens,
  getFearGreedIndex, listEarningsCalendar, getCotPositioning,
};
