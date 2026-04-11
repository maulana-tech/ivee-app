import {
  isEnabled,
  getTokenDetail,
  getTokenKlines,
  getTopHolders,
  getTokensByRank,
  type AveToken,
  type AveKlinePoint,
} from './client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface PriceAlert {
  id: string;
  tokenId: string;
  symbol: string;
  chain: string;
  type: 'above' | 'below' | 'stop_loss' | 'take_profit';
  targetPrice: number;
  currentPrice: number;
  triggered: boolean;
  createdAt: number;
}

export interface AnomalyEvent {
  id: string;
  type: 'volume_spike' | 'price_surge' | 'price_crash' | 'whale_accumulation' | 'whale_distribution' | 'holder_change' | 'liquidity_drain';
  tokenId: string;
  symbol: string;
  chain: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface RiskWarning {
  tokenId: string;
  symbol: string;
  chain: string;
  riskScore: number;
  riskLevel: number;
  isHoneypot: boolean;
  highSellTax: boolean;
  liquidityLocked: boolean;
  ownerRenounced: boolean;
  warnings: string[];
  timestamp: number;
}

const ALERTS_STORAGE_KEY = 'ave-price-alerts';

const anomalyBreaker = createCircuitBreaker<AnomalyEvent[]>({
  name: 'Anomaly Detection',
  cacheTtlMs: 2 * 60 * 1000,
  persistCache: false,
});

const riskBreaker = createCircuitBreaker<RiskWarning>({
  name: 'Risk Analysis',
  cacheTtlMs: 5 * 60 * 1000,
  persistCache: false,
});

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAlertsFromStorage(): PriceAlert[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAlertsToStorage(alerts: PriceAlert[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
}

export function getPriceAlerts(): PriceAlert[] {
  return readAlertsFromStorage();
}

export function addPriceAlert(alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>): PriceAlert {
  const newAlert: PriceAlert = {
    ...alert,
    id: generateId(),
    triggered: false,
    createdAt: Date.now(),
  };
  const alerts = readAlertsFromStorage();
  alerts.push(newAlert);
  writeAlertsToStorage(alerts);
  return newAlert;
}

export function removePriceAlert(id: string): void {
  const alerts = readAlertsFromStorage().filter(a => a.id !== id);
  writeAlertsToStorage(alerts);
}

export async function checkPriceAlerts(): Promise<PriceAlert[]> {
  const alerts = readAlertsFromStorage().filter(a => !a.triggered);
  if (alerts.length === 0) return [];

  const triggered: PriceAlert[] = [];
  const tokenIds = [...new Set(alerts.map(a => a.tokenId))];

  const detailMap = new Map<string, { price: number }>();
  for (const tokenId of tokenIds) {
    try {
      const detail = await getTokenDetail(tokenId);
      const price = parseFloat(detail.token.current_price_usd || '0');
      detailMap.set(tokenId, { price });
    } catch {
      continue;
    }
  }

  const allAlerts = readAlertsFromStorage();
  for (const alert of allAlerts) {
    if (alert.triggered) continue;
    const info = detailMap.get(alert.tokenId);
    if (!info) continue;
    alert.currentPrice = info.price;

    const hit =
      (alert.type === 'above' || alert.type === 'take_profit') && info.price >= alert.targetPrice ||
      (alert.type === 'below' || alert.type === 'stop_loss') && info.price <= alert.targetPrice;

    if (hit) {
      alert.triggered = true;
      triggered.push(alert);
    }
  }

  writeAlertsToStorage(allAlerts);
  return triggered;
}

function computeAverageVolume(klines: AveKlinePoint[]): number {
  if (klines.length === 0) return 0;
  const total = klines.reduce((sum, k) => sum + parseFloat(k.volume || '0'), 0);
  return total / klines.length;
}

function computePriceChangePercent(klines: AveKlinePoint[]): number {
  if (klines.length < 2) return 0;
  const first = parseFloat(klines[0].close || '0');
  const last = parseFloat(klines[klines.length - 1].close || '0');
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

function buildVolumeAnomaly(token: AveToken, avgVol: number, currentVol: number): AnomalyEvent | null {
  if (avgVol === 0) return null;
  const ratio = currentVol / avgVol;
  if (ratio <= 5) return null;
  const severity = ratio > 20 ? 'critical' : ratio > 10 ? 'high' : 'medium';
  return {
    id: generateId(),
    type: 'volume_spike',
    tokenId: token.token,
    symbol: token.symbol,
    chain: token.chain,
    severity,
    title: `${token.symbol} volume spike: ${ratio.toFixed(1)}x average`,
    description: `Trading volume for ${token.symbol} is ${ratio.toFixed(1)}x the recent average. Avg: $${avgVol.toLocaleString()}, Current: $${currentVol.toLocaleString()}.`,
    data: { avgVolume: avgVol, currentVolume: currentVol, ratio },
    timestamp: Date.now(),
  };
}

function buildPriceAnomaly(token: AveToken, changePct: number): AnomalyEvent | null {
  if (Math.abs(changePct) < 15) return null;
  const isCrash = changePct < 0;
  const absChange = Math.abs(changePct);
  const severity = absChange > 50 ? 'critical' : absChange > 30 ? 'high' : 'medium';
  return {
    id: generateId(),
    type: isCrash ? 'price_crash' : 'price_surge',
    tokenId: token.token,
    symbol: token.symbol,
    chain: token.chain,
    severity,
    title: `${token.symbol} ${isCrash ? 'crashed' : 'surged'} ${absChange.toFixed(1)}%`,
    description: `${token.symbol} price ${isCrash ? 'dropped' : 'increased'} by ${absChange.toFixed(1)}% in the last hour. Current price: $${parseFloat(token.current_price_usd || '0').toLocaleString()}.`,
    data: { changePercent: changePct },
    timestamp: Date.now(),
  };
}

async function checkWhaleActivity(token: AveToken): Promise<AnomalyEvent[]> {
  const events: AnomalyEvent[] = [];
  try {
    const holders = await getTopHolders(token.token, 10);
    if (holders.length === 0) return events;

    const topHolder = holders[0];
    if (topHolder.balance_ratio > 0.05) {
      const severity = topHolder.balance_ratio > 0.2 ? 'critical' : topHolder.balance_ratio > 0.1 ? 'high' : 'medium';
      const isAccumulating = topHolder.unrealized_profit > 0 && topHolder.transfer_in > topHolder.transfer_out;
      events.push({
        id: generateId(),
        type: isAccumulating ? 'whale_accumulation' : 'whale_distribution',
        tokenId: token.token,
        symbol: token.symbol,
        chain: token.chain,
        severity,
        title: `Whale holds ${(topHolder.balance_ratio * 100).toFixed(1)}% of ${token.symbol}`,
        description: `Top holder owns ${(topHolder.balance_ratio * 100).toFixed(1)}% of ${token.symbol} supply (${isAccumulating ? 'accumulating' : 'distributing'}). Unrealized P&L: $${topHolder.unrealized_profit.toLocaleString()}.`,
        data: {
          holder: topHolder.holder,
          balanceRatio: topHolder.balance_ratio,
          unrealizedProfit: topHolder.unrealized_profit,
          transferIn: topHolder.transfer_in,
          transferOut: topHolder.transfer_out,
        },
        timestamp: Date.now(),
      });
    }
  } catch {}
  return events;
}

export async function detectAnomalies(chain?: string): Promise<AnomalyEvent[]> {
  return anomalyBreaker.execute(
    async () => {
      if (!isEnabled()) return [];

      const events: AnomalyEvent[] = [];
      const seen = new Set<string>();

      const topics = ['hot', 'gainer'] as const;
      const allTokens: AveToken[] = [];

      for (const topic of topics) {
        try {
          const tokens = await getTokensByRank(topic, 20);
          allTokens.push(...tokens);
        } catch {}
      }

      const uniqueTokens = allTokens.filter(t => {
        if (seen.has(t.token)) return false;
        seen.add(t.token);
        if (chain && t.chain !== chain) return false;
        return true;
      });

      for (const token of uniqueTokens.slice(0, 15)) {
        try {
          const klines = await getTokenKlines(token.token, '1h', 24);
          if (klines.length < 2) continue;

          const avgVol = computeAverageVolume(klines.slice(0, -1));
          const latestVol = parseFloat(klines[klines.length - 1].volume || '0');
          const volumeAnomaly = buildVolumeAnomaly(token, avgVol, latestVol);
          if (volumeAnomaly) events.push(volumeAnomaly);

          const changePct = computePriceChangePercent(klines);
          const priceAnomaly = buildPriceAnomaly(token, changePct);
          if (priceAnomaly) events.push(priceAnomaly);

          const change1h = parseFloat(token.price_change_1h || '0');
          if (Math.abs(change1h) > 20) {
            const absChange = Math.abs(change1h);
            const isCrash = change1h < 0;
            if (!priceAnomaly || Math.abs(changePct) < absChange) {
              const severity = absChange > 50 ? 'critical' : 'high';
              events.push({
                id: generateId(),
                type: isCrash ? 'price_crash' : 'price_surge',
                tokenId: token.token,
                symbol: token.symbol,
                chain: token.chain,
                severity,
                title: `${token.symbol} ${isCrash ? 'crashed' : 'surged'} ${absChange.toFixed(1)}% (1h)`,
                description: `${token.symbol} moved ${absChange.toFixed(1)}% in the last hour. Price: $${parseFloat(token.current_price_usd || '0').toLocaleString()}.`,
                data: { changePercent: change1h, period: '1h' },
                timestamp: Date.now(),
              });
            }
          }
        } catch {
          continue;
        }

        try {
          const whaleEvents = await checkWhaleActivity(token);
          events.push(...whaleEvents);
        } catch {}
      }

      events.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      return events;
    },
    []
  );
}

export async function analyzeRisk(tokenId: string): Promise<RiskWarning> {
  const cacheKey = `risk-${tokenId}`;
  return riskBreaker.execute(
    async () => {
      const detail = await getTokenDetail(tokenId);
      const token = detail.token;
      const riskScore = parseFloat(token.risk_score || '0');
      const riskLevel = token.risk_level || 0;
      const warnings: string[] = [];

      const isHoneypot = riskLevel >= 4;
      if (isHoneypot) {
        warnings.push('Token flagged as potential honeypot');
      }

      let highSellTax = false;
      let liquidityLocked = false;
      let ownerRenounced = false;

      if (detail.pairs && detail.pairs.length > 0) {
        const mainPair = detail.pairs[0];
        const reserve0 = parseFloat(mainPair.reserve0 || '0');
        const reserve1 = parseFloat(mainPair.reserve1 || '0');
        if (reserve0 === 0 && reserve1 === 0) {
          warnings.push('Liquidity pool appears to be empty (possible liquidity drain)');
        }
        if (mainPair.tx_count < 10) {
          warnings.push('Very low transaction count — may be a new or inactive token');
        }
      }

      if (riskScore > 70) {
        warnings.push(`High risk score: ${riskScore.toFixed(0)}/100`);
      } else if (riskScore > 50) {
        warnings.push(`Moderate risk score: ${riskScore.toFixed(0)}/100`);
      }

      if (token.holders < 50) {
        warnings.push(`Very few holders (${token.holders}) — concentrated ownership risk`);
      }

      if (token.total && token.total !== '0') {
        const launchPrice = parseFloat(token.launch_price || '0');
        const currentPrice = parseFloat(token.current_price_usd || '0');
        if (launchPrice > 0 && currentPrice > 0) {
          const dropFromLaunch = ((launchPrice - currentPrice) / launchPrice) * 100;
          if (dropFromLaunch > 90) {
            warnings.push(`Price dropped ${dropFromLaunch.toFixed(0)}% from launch — potential rug pull`);
          }
        }
      }

      if (token.tx_volume_u_24h && token.market_cap) {
        const vol = parseFloat(token.tx_volume_u_24h || '0');
        const mcap = parseFloat(token.market_cap || '0');
        if (mcap > 0 && vol / mcap > 2) {
          warnings.push('Volume significantly exceeds market cap — wash trading suspected');
        }
      }

      if (warnings.length === 0) {
        warnings.push('No significant risk indicators detected');
      }

      return {
        tokenId: token.token,
        symbol: token.symbol,
        chain: token.chain,
        riskScore,
        riskLevel,
        isHoneypot,
        highSellTax,
        liquidityLocked,
        ownerRenounced,
        warnings,
        timestamp: Date.now(),
      };
    },
    {
      tokenId,
      symbol: '',
      chain: '',
      riskScore: 0,
      riskLevel: 0,
      isHoneypot: false,
      highSellTax: false,
      liquidityLocked: false,
      ownerRenounced: false,
      warnings: ['Risk analysis unavailable — using fallback data'],
      timestamp: Date.now(),
    },
    { cacheKey }
  );
}

export async function scanRisk(tokenIds: string[]): Promise<RiskWarning[]> {
  const results: RiskWarning[] = [];
  for (const tokenId of tokenIds) {
    try {
      const warning = await analyzeRisk(tokenId);
      results.push(warning);
    } catch {
      results.push({
        tokenId,
        symbol: '',
        chain: '',
        riskScore: 0,
        riskLevel: 0,
        isHoneypot: false,
        highSellTax: false,
        liquidityLocked: false,
        ownerRenounced: false,
        warnings: ['Failed to analyze risk'],
        timestamp: Date.now(),
      });
    }
  }
  return results.sort((a, b) => b.riskScore - a.riskScore);
}
