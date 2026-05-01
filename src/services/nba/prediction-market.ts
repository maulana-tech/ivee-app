const POLYMARKET_BASE = 'https://gamma-api.polymarket.com';

interface PredictionMarket {
  id: string;
  question: string;
  slug: string;
  endDate: string | null;
  image: string;
  outcomePrices: string[];
  outcomes: string[];
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  category: string;
}

interface MarketArbitrage {
  id: string;
  question: string;
  platform: string;
  yesPrice: number;
  noPrice: number;
  mispricing: number;
  volume: string;
}

async function polymarketFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${POLYMARKET_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
  return res.json();
}

export async function getNbaMarkets(): Promise<PredictionMarket[]> {
  try {
    const data = await polymarketFetch<PredictionMarket[]>('/markets', {
      tag: 'nba',
      closed: 'false',
      limit: '50',
      order: 'volume',
      ascending: 'false',
    });
    return data || [];
  } catch {
    return getMockMarkets();
  }
}

export async function getPlayoffMarkets(): Promise<PredictionMarket[]> {
  try {
    const data = await polymarketFetch<PredictionMarket[]>('/markets', {
      tag: 'nba',
      closed: 'false',
      limit: '30',
      order: 'volume',
      ascending: 'false',
    });
    return data || [];
  } catch {
    return getMockMarkets();
  }
}

export async function searchMarkets(query: string): Promise<PredictionMarket[]> {
  try {
    const data = await polymarketFetch<PredictionMarket[]>('/markets', {
      closed: 'false',
      limit: '20',
      order: 'volume',
      ascending: 'false',
    });
    return (data || []).filter(m =>
      m.question.toLowerCase().includes(query.toLowerCase())
    );
  } catch {
    return [];
  }
}

export function findArbitrageOpportunities(markets: PredictionMarket[]): MarketArbitrage[] {
  const opportunities: MarketArbitrage[] = [];

  for (const market of markets) {
    if (!market.outcomePrices || market.outcomePrices.length < 2) continue;

    const yesPrice = parseFloat(market.outcomePrices[0]);
    const noPrice = parseFloat(market.outcomePrices[1]);
    const total = yesPrice + noPrice;

    if (total < 0.98 || total > 1.02) {
      opportunities.push({
        id: market.id,
        question: market.question,
        platform: 'Polymarket',
        yesPrice,
        noPrice,
        mispricing: Math.abs(1.0 - total),
        volume: market.volume,
      });
    }
  }

  return opportunities.sort((a, b) => b.mispricing - a.mispricing);
}

export function calculateMarketSentiment(markets: PredictionMarket[]): {
  label: string;
  score: number;
  bullish: number;
  bearish: number;
} {
  if (markets.length === 0) {
    return { label: 'Neutral', score: 50, bullish: 0, bearish: 0 };
  }

  let totalYes = 0;
  let count = 0;
  for (const m of markets) {
    if (m.outcomePrices?.[0]) {
      totalYes += parseFloat(m.outcomePrices[0]);
      count++;
    }
  }

  const avgYes = count > 0 ? totalYes / count : 0.5;
  const score = Math.round(avgYes * 100);
  const label = score > 65 ? 'Bullish' : score < 35 ? 'Bearish' : 'Neutral';

  return {
    label,
    score,
    bullish: markets.filter(m => parseFloat(m.outcomePrices?.[0] || '0') > 0.6).length,
    bearish: markets.filter(m => parseFloat(m.outcomePrices?.[0] || '0') < 0.4).length,
  };
}

function getMockMarkets(): PredictionMarket[] {
  return [
    {
      id: '1', question: 'Will the Boston Celtics win the 2025 NBA Championship?',
      slug: 'celtics-2025-champs', endDate: '2025-06-30',
      image: '', outcomePrices: ['0.35', '0.65'], outcomes: ['Yes', 'No'],
      volume: '1250000', liquidity: '500000', active: true, closed: false, category: 'NBA',
    },
    {
      id: '2', question: 'Will OKC Thunder win the Western Conference?',
      slug: 'okc-western-conf', endDate: '2025-06-15',
      image: '', outcomePrices: ['0.42', '0.58'], outcomes: ['Yes', 'No'],
      volume: '890000', liquidity: '340000', active: true, closed: false, category: 'NBA',
    },
    {
      id: '3', question: 'Will LeBron James score 30+ points in Game 5?',
      slug: 'lebron-30pts-g5', endDate: '2025-05-10',
      image: '', outcomePrices: ['0.28', '0.72'], outcomes: ['Yes', 'No'],
      volume: '450000', liquidity: '180000', active: true, closed: false, category: 'NBA',
    },
    {
      id: '4', question: 'Celtics vs Cavaliers - Who wins Game 3?',
      slug: 'celtics-cavs-g3', endDate: '2025-05-08',
      image: '', outcomePrices: ['0.55', '0.45'], outcomes: ['Celtics', 'Cavaliers'],
      volume: '720000', liquidity: '280000', active: true, closed: false, category: 'NBA',
    },
    {
      id: '5', question: 'Will Shai Gilgeous-Alexander win MVP?',
      slug: 'sga-mvp', endDate: '2025-06-01',
      image: '', outcomePrices: ['0.62', '0.38'], outcomes: ['Yes', 'No'],
      volume: '980000', liquidity: '420000', active: true, closed: false, category: 'NBA',
    },
    {
      id: '6', question: 'Thunder vs Nuggets - Who wins the series?',
      slug: 'okc-den-series', endDate: '2025-05-20',
      image: '', outcomePrices: ['0.58', '0.42'], outcomes: ['Thunder', 'Nuggets'],
      volume: '650000', liquidity: '250000', active: true, closed: false, category: 'NBA',
    },
  ];
}

export type { PredictionMarket, MarketArbitrage };
