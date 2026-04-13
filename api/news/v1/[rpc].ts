export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const variant = url.searchParams.get('variant') || 'crypto';
  const lang = url.searchParams.get('lang') || 'en';

  const cryptoFeeds = {
    crypto: [
      'CoinDesk', 'Cointelegraph', 'The Block', 'Decrypt', 'Blockworks',
      'Bitcoin Magazine', 'CryptoSlate', 'Unchained', 'DeFi News',
      'Bloomberg Crypto', 'Reuters Crypto', 'Crypto News',
    ],
    markets: [
      'CNBC', 'Yahoo Finance', 'Bloomberg Markets', 'Reuters Markets', 'Seeking Alpha',
    ],
    forex: ['Forex News', 'Dollar Watch', 'Central Bank Rates'],
    bonds: ['Bond Market', 'Treasury Watch'],
  };

  const items: any[] = [];
  for (const [category, sources] of Object.entries(cryptoFeeds)) {
    for (const source of sources.slice(0, 3)) {
      items.push({
        title: `${source}: Latest ${category} updates`,
        description: `Top ${category} news from ${source}`,
        source,
        category,
        url: '#',
        publishedAt: new Date().toISOString(),
        sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
      });
    }
  }

  return new Response(JSON.stringify({ items, variant, lang }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, s-maxage=120',
    },
  });
}
