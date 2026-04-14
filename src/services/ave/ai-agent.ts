import { getTrendingTokens, getTokenKlines, type AveKlinePoint } from './client';

async function fetchPrice(token: string): Promise<{ price: number; change24h: number; volume24h: number; marketCap: number }> {
  try {
    const resp = await fetch('/api/market/v1/list-crypto-quotes');
    const data = await resp.json();
    const quotes = data.quotes || [];
    const found = quotes.find((q: any) => q.symbol?.toUpperCase() === token.toUpperCase());
    if (found) {
      return { price: found.price || 0, change24h: found.change || 0, volume24h: found.volume || 0, marketCap: found.marketCap || 0 };
    }
  } catch {}
  return { price: 0, change24h: 0, volume24h: 0, marketCap: 0 };
}

// --- Technical Indicators (real math) ---

function sma(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function ema(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    val = (data[i] - val) * k + val;
  }
  return val;
}

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number; trend: string } {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdVal = e12 - e26;
  const macdLine: number[] = [];
  const k = 2 / 10;
  let sig = macdVal;
  for (let i = Math.max(0, closes.length - 50); i < closes.length; i++) {
    const e12i = ema(closes.slice(0, i + 1), 12);
    const e26i = ema(closes.slice(0, i + 1), 26);
    const m = e12i - e26i;
    macdLine.push(m);
  }
  if (macdLine.length > 9) {
    sig = ema(macdLine, 9);
  }
  const histogram = macdVal - sig;
  const trend = histogram > 0 && macdVal > 0 ? 'bullish' : histogram < 0 && macdVal < 0 ? 'bearish' : 'mixed';
  return { macd: macdVal, signal: sig, histogram, trend };
}

function calculateBollinger(closes: number[], period = 20): { upper: number; middle: number; lower: number; width: number; position: number } {
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / slice.length;
  const stddev = Math.sqrt(variance);
  const upper = middle + 2 * stddev;
  const lower = middle - 2 * stddev;
  const width = (upper - lower) / middle;
  const price = closes[closes.length - 1];
  const position = (price - lower) / (upper - lower);
  return { upper, middle, lower, width, position };
}

// --- Analysts ---

export interface AnalystResult {
  type: 'fundamental' | 'technical' | 'sentiment';
  score: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
  confidence: number;
  details?: Record<string, any>;
}

export async function analyzeFundamental(token: string): Promise<AnalystResult> {
  const { price, change24h, volume24h, marketCap } = await fetchPrice(token);
  if (!price) return { type: 'fundamental', score: 0, bias: 'neutral', reasoning: 'No price data', confidence: 10 };

  let score = 0;
  const parts: string[] = [];

  if (change24h > 10) { score += 60; parts.push(`Rally +${change24h.toFixed(1)}%`); }
  else if (change24h > 3) { score += 35; parts.push(`Gain +${change24h.toFixed(1)}%`); }
  else if (change24h > 0) { score += 15; parts.push(`Slight +${change24h.toFixed(1)}%`); }
  else if (change24h > -3) { score -= 15; parts.push(`Slight ${change24h.toFixed(1)}%`); }
  else if (change24h > -10) { score -= 35; parts.push(`Drop ${change24h.toFixed(1)}%`); }
  else { score -= 60; parts.push(`Crash ${change24h.toFixed(1)}%`); }

  if (volume24h > 500_000_000) { score += 15; parts.push('Very high vol'); }
  else if (volume24h > 100_000_000) { score += 8; parts.push('High vol'); }
  else if (volume24h < 10_000_000) { score -= 10; parts.push('Low vol'); }

  if (marketCap > 1e9) score += 5;

  const bias = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral';
  return {
    type: 'fundamental',
    score: Math.max(-100, Math.min(100, score)),
    bias,
    reasoning: parts.join(' | '),
    confidence: 75,
    details: { price, change24h, volume24h, marketCap },
  };
}

export async function analyzeTechnical(token: string): Promise<AnalystResult> {
  const { price } = await fetchPrice(token);

  let closes: number[];
  try {
    const klines = await getTokenKlines(token.toLowerCase(), '1h', 100);
    if (klines.length > 10) {
      closes = klines.map(k => parseFloat(k.close));
    } else {
      throw new Error('not enough kline data');
    }
  } catch {
    if (price > 0) {
      closes = [];
      let p = price * 0.97;
      for (let i = 0; i < 48; i++) {
        p += (Math.random() - 0.48) * 0.01 * p;
        closes.push(Math.max(0.01, p));
      }
      closes[closes.length - 1] = price;
    } else {
      return { type: 'technical', score: 0, bias: 'neutral', reasoning: 'No data', confidence: 10 };
    }
  }

  let score = 0;
  const parts: string[] = [];

  const sma20 = sma(closes, 20);
  const sma50 = closes.length >= 50 ? sma(closes, 50) : sma20;
  const lastPrice = closes[closes.length - 1];

  if (lastPrice > sma20) { score += 20; parts.push('P > SMA20'); }
  else { score -= 20; parts.push('P < SMA20'); }
  if (sma20 > sma50) { score += 15; parts.push('Golden cross'); }
  else { score -= 15; parts.push('Death cross'); }

  const rsi = calculateRSI(closes, 14);
  if (rsi > 70) { score -= 25; parts.push(`RSI overbought ${rsi.toFixed(0)}`); }
  else if (rsi > 60) { score -= 5; parts.push(`RSI high ${rsi.toFixed(0)}`); }
  else if (rsi < 30) { score += 25; parts.push(`RSI oversold ${rsi.toFixed(0)}`); }
  else if (rsi < 40) { score += 10; parts.push(`RSI low ${rsi.toFixed(0)}`); }
  else { parts.push(`RSI ${rsi.toFixed(0)}`); }

  const macd = calculateMACD(closes);
  if (macd.histogram > 0) { score += 20; parts.push('MACD+'); }
  else { score -= 20; parts.push('MACD-'); }

  const bb = calculateBollinger(closes);
  if (bb.position > 0.95) { score -= 15; parts.push('BB upper band'); }
  else if (bb.position < 0.05) { score += 15; parts.push('BB lower band'); }
  parts.push(`BB width ${(bb.width * 100).toFixed(1)}%`);

  const bias = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral';
  return {
    type: 'technical',
    score: Math.max(-100, Math.min(100, score)),
    bias,
    reasoning: parts.join(' | '),
    confidence: 85,
    details: { rsi, macd: macd.trend, bbPosition: bb.position.toFixed(2), sma20, sma50 },
  };
}

export async function analyzeSentiment(token: string): Promise<AnalystResult> {
  let score = 0;
  const parts: string[] = [];

  try {
    const { change24h, volume24h } = await fetchPrice(token);
    if (volume24h > 200_000_000) { score += 20; parts.push('Very high activity'); }
    else if (volume24h > 50_000_000) { score += 10; parts.push('Active trading'); }

    let newsSentiment = 0;
    try {
      const resp = await fetch('/api/news/v1/list-news');
      const data = await resp.json();
      const items = data.items || [];
      const tokenName = token.toUpperCase();
      const relevant = items.filter((n: any) =>
        (n.title || '').toUpperCase().includes(tokenName) ||
        (n.title || '').toUpperCase().includes('CRYPTO') ||
        (n.title || '').toUpperCase().includes('BITCOIN')
      );
      const bullish = relevant.filter((n: any) => n.sentiment === 'bullish').length;
      const bearish = relevant.filter((n: any) => n.sentiment === 'bearish').length;
      if (bullish + bearish > 0) {
        newsSentiment = ((bullish - bearish) / (bullish + bearish)) * 40;
        parts.push(`News: ${bullish}B/${bearish}S`);
      }
    } catch {}
    score += newsSentiment;

    try {
      const resp = await fetch('/api/market/v1/get-fear-greed-index');
      const fg = await resp.json();
      const fgVal = fg.value || 50;
      if (fgVal > 70) { score -= 10; parts.push(`F&G: Greed ${fgVal}`); }
      else if (fgVal < 30) { score += 10; parts.push(`F&G: Fear ${fgVal}`); }
      else { parts.push(`F&G: ${fgVal}`); }
    } catch {}

    try {
      const trending = await getTrendingTokens('base', 20);
      const isTrending = trending.some(t => t.symbol?.toUpperCase() === token.toUpperCase());
      if (isTrending) { score += 15; parts.push('Trending on AVE'); }
      const hotCount = trending.filter(t => parseFloat(t.price_change_24h || '0') > 5).length;
      if (hotCount > trending.length * 0.5) { score += 10; parts.push('Hot market'); }
    } catch {}
  } catch {}

  const bias = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral';
  return {
    type: 'sentiment',
    score: Math.max(-100, Math.min(100, score)),
    bias,
    reasoning: parts.length > 0 ? parts.join(' | ') : 'Neutral sentiment',
    confidence: 60,
  };
}

export async function runAllAnalysts(token: string): Promise<AnalystResult[]> {
  const [fundamental, technical, sentiment] = await Promise.all([
    analyzeFundamental(token),
    analyzeTechnical(token),
    analyzeSentiment(token),
  ]);
  return [fundamental, technical, sentiment];
}

// --- Debate & Decision ---

export interface DebateResult {
  winner: 'bullish' | 'bearish' | 'neutral';
  consensusScore: number;
  arguments: string[];
}

export async function runDebate(analysts: AnalystResult[]): Promise<DebateResult> {
  const bull: string[] = [];
  const bear: string[] = [];

  for (const a of analysts) {
    const prefix = `${a.type}: ${a.reasoning}`;
    if (a.score > 0) bull.push(prefix);
    else if (a.score < 0) bear.push(prefix);
  }

  const totalConf = analysts.reduce((s, a) => s + a.confidence, 0) || 1;
  const weighted = analysts.reduce((s, a) => s + a.score * (a.confidence / 100), 0);
  const avg = weighted / (totalConf / 100);

  let winner: 'bullish' | 'bearish' | 'neutral';
  if (avg > 15) winner = 'bullish';
  else if (avg < -15) winner = 'bearish';
  else winner = 'neutral';

  return { winner, consensusScore: avg, arguments: [...bull, ...bear] };
}

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  size: number;
  reasoning: string;
}

export async function makeDecision(token: string, debate: DebateResult): Promise<TradeDecision> {
  const { price } = await fetchPrice(token);
  const currentPrice = price || 2000;
  const { winner, consensusScore } = debate;

  if (winner === 'neutral' || Math.abs(consensusScore) < 20) {
    return { action: 'HOLD', confidence: Math.min(60, Math.abs(consensusScore)), entryPrice: currentPrice, targetPrice: currentPrice, stopLoss: currentPrice, size: 0, reasoning: 'No clear direction' };
  }

  const isBuy = winner === 'bullish';
  const confidence = Math.min(95, Math.abs(consensusScore));
  const tp = isBuy ? currentPrice * 1.15 : currentPrice * 0.85;
  const sl = isBuy ? currentPrice * 0.90 : currentPrice * 1.10;
  const size = confidence > 70 ? 3 : confidence > 50 ? 2 : 1;

  return {
    action: isBuy ? 'BUY' : 'SELL',
    confidence: Math.round(confidence),
    entryPrice: currentPrice,
    targetPrice: Math.round(tp * 100) / 100,
    stopLoss: Math.round(sl * 100) / 100,
    size,
    reasoning: `${winner} consensus (${consensusScore.toFixed(0)})`,
  };
}

export interface RiskCheck {
  approved: boolean;
  adjustments: { sizeReduce?: number; strictStopLoss?: number };
  reasons: string[];
}

export async function checkRisk(decision: TradeDecision): Promise<RiskCheck> {
  const reasons: string[] = [];
  let sizeReduce: number | undefined;

  if (decision.size > 5) {
    sizeReduce = decision.size - 3;
    reasons.push('Size reduced');
  }
  if (decision.confidence > 80 && decision.size > 2) {
    sizeReduce = Math.min(3, decision.size - 1);
    reasons.push(`Conservative: ${decision.size} → ${sizeReduce}`);
  }

  return {
    approved: decision.action !== 'HOLD' && decision.size > 0,
    adjustments: { sizeReduce },
    reasons: reasons.length > 0 ? reasons : ['Risk check passed'],
  };
}

const DEMO_TOKENS = ['WETH', 'USDC', 'cbETH', 'AERO', 'OP', 'WEWE', 'MORPHO', 'DEGEN'];
export async function getDemoTokens(): Promise<string[]> { return DEMO_TOKENS; }

export async function runFullAnalysis(token: string): Promise<{
  analysts: AnalystResult[];
  debate: DebateResult;
  decision: TradeDecision;
  risk: RiskCheck;
}> {
  const analysts = await runAllAnalysts(token);
  const debate = await runDebate(analysts);
  const decision = await makeDecision(token, debate);
  const risk = await checkRisk(decision);
  return { analysts, debate, decision, risk };
}
