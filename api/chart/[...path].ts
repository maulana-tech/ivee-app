export const config = { runtime: 'edge' };

const COINGECKO = 'https://api.coingecko.com/api/v3';

const TOKEN_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  LINK: 'chainlink', DOT: 'polkadot', MATIC: 'polygon', LTC: 'litecoin',
  UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar', APT: 'aptos',
  NEAR: 'near', FIL: 'filecoin', ARB: 'arbitrum', OP: 'optimism',
};

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

  try {
    const resp = await fetch(
      `${COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `CoinGecko ${resp.status}` }), {
        status: resp.status,
        headers: corsHeaders,
      });
    }

    const data = await resp.json();
    const prices: number[][] = data.prices || [];
    const volumes: number[][] = data.total_volumes || [];

    const result = {
      symbol,
      coinId,
      prices: prices.map(([ts, p]) => ({ time: ts, price: p })),
      volumes: volumes.map(([ts, v]) => ({ time: ts, volume: v })),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'fetch failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
