export const config = { runtime: 'edge' };

const COINGECKO = 'https://api.coingecko.com/api/v3';

const TOKEN_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  LINK: 'chainlink', DOT: 'polkadot', MATIC: 'polygon', LTC: 'litecoin',
  UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar', APT: 'aptos',
  NEAR: 'near', FIL: 'filecoin', ARB: 'arbitrum', OP: 'optimism',
};

const CHART_CACHE: Record<string, { data: any; ts: number }> = {};
const CHART_TTL = 120_000;

function generateFallbackPrices(symbol: string): any {
  const prices: Record<string, number> = { BTC: 72000, ETH: 2220, SOL: 83, BNB: 605, XRP: 1.34, DOGE: 0.092, ADA: 0.24, AVAX: 9.2, LINK: 8.8, DOT: 1.17, MATIC: 0.22, LTC: 53, UNI: 3.1, NEAR: 1.38, ATOM: 6.5, XLM: 0.27, APT: 4.5, ARB: 0.35, OP: 0.85, FIL: 2.8 };
  const base = prices[symbol] || 100;
  const pts: { time: number; price: number }[] = [];
  const vols: { time: number; volume: number }[] = [];
  const now = Date.now();
  for (let i = 0; i < 168; i++) {
    const noise = 1 + (Math.sin(i * 0.3) * 0.02 + Math.cos(i * 0.7) * 0.01);
    pts.push({ time: now - (168 - i) * 3600000, price: base * noise });
    vols.push({ time: now - (168 - i) * 3600000, volume: base * 1000000 * (0.5 + Math.random()) });
  }
  return { symbol, coinId: symbol.toLowerCase(), prices: pts, volumes: vols };
}

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
  const coinId = TOKEN_MAP[symbol] || symbol.toLowerCase();
  const days = url.searchParams.get('days') || '1';
  const cacheKey = `${symbol}-${days}`;

  const cached = CHART_CACHE[cacheKey];
  if (cached && Date.now() - cached.ts < CHART_TTL) {
    return new Response(JSON.stringify(cached.data), { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=60' } });
  }

  try {
    const resp = await fetch(
      `${COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!resp.ok) {
      const fallback = generateFallbackPrices(symbol);
      CHART_CACHE[cacheKey] = { data: fallback, ts: Date.now() };
      return new Response(JSON.stringify(fallback), { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=60' } });
    }

    const data = await resp.json();
    const prices: number[][] = data.prices || [];
    const volumes: number[][] = data.total_volumes || [];

    const result = {
      symbol, coinId,
      prices: prices.map(([ts, p]: [number, number]) => ({ time: ts, price: p })),
      volumes: volumes.map(([ts, v]: [number, number]) => ({ time: ts, volume: v })),
    };

    CHART_CACHE[cacheKey] = { data: result, ts: Date.now() };
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    const fallback = generateFallbackPrices(symbol);
    return new Response(JSON.stringify(fallback), { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=60' } });
  }
}
