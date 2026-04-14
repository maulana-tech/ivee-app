type PriceCallback = (prices: Record<string, { price: number; change: number; volume: number }>) => void;

const PRICE_FEED_KEY = 'ivee-price-feed';
const TTL = 30_000;

let listeners: PriceCallback[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let prices: Record<string, { price: number; change: number; volume: number }> = {};
let lastFetch = 0;

async function fetchPrices(): Promise<typeof prices> {
  try {
    const resp = await fetch('/api/market/v1/list-crypto-quotes');
    const data = await resp.json();
    const quotes = data.quotes || [];
    const map: typeof prices = {};
    for (const q of quotes) {
      if (q.symbol && q.price) {
        map[q.symbol] = { price: q.price, change: q.change || 0, volume: q.volume || 0 };
      }
    }
    return map;
  } catch {
    return {};
  }
}

function notify(): void {
  listeners.forEach(fn => { try { fn(prices); } catch {} });
}

export function startPriceFeed(): void {
  if (timer) return;
  const doFetch = async () => {
    const newPrices = await fetchPrices();
    if (Object.keys(newPrices).length > 0) {
      prices = newPrices;
      lastFetch = Date.now();
      notify();
    }
  };
  doFetch();
  timer = setInterval(doFetch, 30_000);
}

export function stopPriceFeed(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export function onPriceUpdate(fn: PriceCallback): () => void {
  listeners.push(fn);
  if (Object.keys(prices).length > 0) fn(prices);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getPrices(): typeof prices {
  return prices;
}

export function formatTicker(prices: typeof prices, maxItems = 6): string {
  const top = Object.entries(prices).slice(0, maxItems);
  return top.map(([sym, d]) => {
    const sign = d.change >= 0 ? '+' : '';
    const color = d.change >= 0 ? '#22c55e' : '#ef4444';
    return `<span style="margin-right:12px;font-size:11px;white-space:nowrap"><b>${sym}</b> <span style="color:${color}">$${fmtP(d.price)}</span> <span style="color:${color};font-size:10px">${sign}${d.change.toFixed(1)}%</span></span>`;
  }).join('');
}

function fmtP(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}
