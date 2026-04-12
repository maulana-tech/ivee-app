
async function fetchPrice(token: string): Promise<{price: number; change24h: number; volume24h: number}> {
  try {
    const resp = await fetch('/api/market/v1/list-crypto-quotes');
    const data = await resp.json();
    const quotes = data.quotes || [];
    const found = quotes.find((q: any) => q.symbol?.toUpperCase() === token.toUpperCase());
    if (found) {
      return { price: found.price || 0, change24h: found.change || 0, volume24h: found.volume || 0 };
    }
  } catch {}
  return { price: 2000, change24h: 2.5, volume24h: 50000000 };
}

function generateKlines(basePrice: number, change24h: number, count = 48): number[] {
  const closes: number[] = [];
  let price = basePrice / (1 + change24h / 100);
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.48) * 0.02 * price;
    price += noise;
    closes.push(Math.max(0.01, price));
  }
  closes[closes.length - 1] = basePrice;
  return closes;
}

export interface AnalystResult {
  type: 'fundamental' | 'technical' | 'sentiment';
  score: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
  confidence: number;
}

export async function analyzeFundamental(token: string): Promise<AnalystResult> {
  try {
    const { price, change24h, volume24h } = await fetchPrice(token);

    if (!price) {
      return { type: 'fundamental', score: 0, bias: 'neutral', reasoning: 'No price data', confidence: 10 };
    }

    let score = 0;
    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let reasoning = '';

    if (change24h > 5) { score = 70; bias = 'bullish'; reasoning = `Strong gain: +${change24h.toFixed(1)}%`; }
    else if (change24h > 0) { score = 30 * (change24h / 5); bias = 'bullish'; reasoning = `Positive: +${change24h.toFixed(1)}%`; }
    else if (change24h < -5) { score = -70; bias = 'bearish'; reasoning = `Sharp drop: ${change24h.toFixed(1)}%`; }
    else if (change24h < 0) { score = 30 * (change24h / 5); bias = 'bearish'; reasoning = `Negative: ${change24h.toFixed(1)}%`; }
    else { score = 0; bias = 'neutral'; reasoning = 'Price flat'; }

    if (volume24h > 100_000_000) { score += 15; reasoning += ', High vol'; }
    else if (volume24h < 10_000_000) { score -= 10; reasoning += ', Low vol'; }

    return { type: 'fundamental', score: Math.max(-100, Math.min(100, score)), bias, reasoning, confidence: 75 };
  } catch {
    return { type: 'fundamental', score: 0, bias: 'neutral', reasoning: 'Unavailable', confidence: 10 };
  }
}

export async function analyzeTechnical(token: string): Promise<AnalystResult> {
  try {
    const { price, change24h } = await fetchPrice(token);
    const closes = generateKlines(price, change24h);

    let score = 0;
    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let reasoning = '';

    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma9 = closes.slice(-9).reduce((a, b) => a + b, 0) / 9;

    if (price > sma20 && sma20 > sma9) { score = 50; bias = 'bullish'; reasoning = 'Uptrend: P > SMA20 > SMA9'; }
    else if (price < sma20 && sma20 < sma9) { score = -50; bias = 'bearish'; reasoning = 'Downtrend: P < SMA20 < SMA9'; }
    else { score = 10; bias = 'neutral'; reasoning = 'Mixed trend'; }

    const rsi = calculateRSI(closes, 14);
    if (rsi > 70) { score -= 20; reasoning += `, RSI overbought: ${rsi.toFixed(0)}`; }
    else if (rsi < 30) { score += 20; reasoning += `, RSI oversold: ${rsi.toFixed(0)}`; }
    else { reasoning += `, RSI: ${rsi.toFixed(0)}`; }

    const macd = calculateMACD(closes);
    if (macd.histogram > 0) { score += 15; reasoning += ', MACD bullish'; }
    else { score -= 15; reasoning += ', MACD bearish'; }

    return { type: 'technical', score: Math.max(-100, Math.min(100, score)), bias, reasoning, confidence: 80 };
  } catch {
    return { type: 'technical', score: 0, bias: 'neutral', reasoning: 'No chart data', confidence: 10 };
  }
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA([macd], 9);
  return {
    macd,
    signal,
    histogram: macd - signal,
  };
}

function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  return ema;
}

export async function analyzeSentiment(token: string): Promise<AnalystResult> {
  const demoScores: Record<string, { score: number; bias: 'bullish' | 'bearish' | 'neutral'; reasoning: string }> = {
    WETH: { score: 65, bias: 'bullish', reasoning: 'ActiveDeFi volume, positive Twitter buzz' },
    USDC: { score: 10, bias: 'neutral', reasoning: 'Stable, minimal social activity' },
    OP: { score: 45, bias: 'bullish', reasoning: 'Upcoming upgrade speculation' },
    AERO: { score: 80, bias: 'bullish', reasoning: 'Viral oncrypto Twitter, trending' },
    cbETH: { score: 30, bias: 'bullish', reasoning: 'Staking buzz' },
  };

  const demo = demoScores[token.toUpperCase()] || {
    score: (Math.random() * 60) - 30,
    bias: 'neutral' as const,
    reasoning: 'Simulated sentiment (no real data)',
  };

  return {
    type: 'sentiment',
    score: demo.score,
    bias: demo.bias,
    reasoning: demo.reasoning,
    confidence: 50,
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

export interface DebateResult {
  winner: 'bullish' | 'bearish' | 'neutral';
  consensusScore: number;
  arguments: string[];
}

export async function runDebate(analysts: AnalystResult[]): Promise<DebateResult> {
  const bullishArgs: string[] = [];
  const bearishArgs: string[] = [];

  for (const a of analysts) {
    if (a.score > 0) {
      bullishArgs.push(`${a.type}: ${a.reasoning} (${a.score > 0 ? '+' : ''}${a.score})`);
    } else if (a.score < 0) {
      bearishArgs.push(`${a.type}: ${a.reasoning} (${a.score})`);
    }
  }

  const totalScore = analysts.reduce((sum, a) => sum + a.score * (a.confidence / 100), 0);
  const avgScore = totalScore / analysts.reduce((sum, a) => sum + a.confidence, 0);

  let winner: 'bullish' | 'bearish' | 'neutral';
  if (avgScore > 15) winner = 'bullish';
  else if (avgScore < -15) winner = 'bearish';
  else winner = 'neutral';

  const allArgs = [...bullishArgs, ...bearishArgs];

  return {
    winner,
    consensusScore: avgScore,
    arguments: allArgs,
  };
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
    return {
      action: 'HOLD',
      confidence: Math.min(60, Math.abs(consensusScore)),
      entryPrice: currentPrice,
      targetPrice: currentPrice,
      stopLoss: currentPrice,
      size: 0,
      reasoning: 'No clear direction',
    };
  }

  const isBuy = winner === 'bullish';
  const confidence = Math.min(95, Math.abs(consensusScore));
  
  const targetPercent = isBuy ? 0.15 : 0.15;
  const stopPercent = 0.10;
  
  const targetPrice = isBuy 
    ? currentPrice * (1 + targetPercent)
    : currentPrice * (1 - targetPercent);
    
  const stopLoss = isBuy
    ? currentPrice * (1 - stopPercent)
    : currentPrice * (1 + stopPercent);

  const size = confidence > 70 ? 3 : confidence > 50 ? 2 : 1;

  return {
    action: isBuy ? 'BUY' : 'SELL',
    confidence: Math.round(confidence),
    entryPrice: currentPrice,
    targetPrice: Math.round(targetPrice * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    size,
    reasoning: `${winner} consensus: ${consensusScore.toFixed(0)}, ${confidence.toFixed(0)}% confidence`,
  };
}

export interface RiskCheck {
  approved: boolean;
  adjustments: {
    sizeReduce?: number;
    strictStopLoss?: number;
  };
  reasons: string[];
}

export async function checkRisk(decision: TradeDecision): Promise<RiskCheck> {
  const reasons: string[] = [];
  let sizeReduce: number | undefined;
  let strictStopLoss: number | undefined;

  if (decision.size > 5) {
    sizeReduce = decision.size - 3;
    reasons.push('Position size reduced for risk management');
  }

  if (decision.confidence > 80 && decision.size > 2) {
    const recommendedSize = Math.min(3, decision.size - 1);
    sizeReduce = recommendedSize;
    reasons.push(`Size reduced (${decision.size} → ${recommendedSize}) due to high confidence but risk`);
  }

  const approved = decision.action !== 'HOLD' && decision.size > 0;

  return {
    approved,
    adjustments: {
      sizeReduce,
      strictStopLoss,
    },
    reasons: reasons.length > 0 ? reasons : ['Risk check passed'],
  };
}

const DEMO_TOKENS = [
  'WETH', 'USDC', 'cbETH', 'AERO', 'OP', 'WEWE', 'MORPHO', 'DEGEN',
];

export async function getDemoTokens(): Promise<string[]> {
  return DEMO_TOKENS;
}

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