const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export interface StrategyStatus {
  id: string;
  name: string;
  type: 'arbitrage' | 'momentum' | 'cross-market' | 'speed' | 'custom';
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  completedAt: string | null;
  lastResult: StrategyResult | null;
  error: string | null;
}

export interface StrategyResult {
  action: 'buy_yes' | 'buy_no' | 'hold' | 'skip' | 'alert';
  market: string;
  question: string;
  side: 'yes' | 'no';
  confidence: number;
  edge: number;
  expectedPnl: number;
  reasoning: string[];
}

export interface StrategyPerformance {
  totalPnl: number;
  totalPnlPercent: number;
  openPositions: number;
  totalVolume: number;
  winRate: number;
}

export interface Position {
  market_id: string;
  direction: 'buy_yes' | 'buy_no';
  size: number;
  entry_price: number;
  opened_at: string;
}

export interface Portfolio {
  total_value: number;
  positions: Position[];
  daily_pnl: number;
}

class CanonServerAPI {
  private baseUrl = SERVER_URL;

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/api/health');
  }

  async getStrategies(): Promise<StrategyStatus[]> {
    return this.request('/api/strategies');
  }

  async getStrategyStatus(id: string): Promise<StrategyStatus> {
    return this.request(`/api/strategies/${id}`);
  }

  async startStrategy(id: string): Promise<StrategyStatus> {
    return this.request(`/api/strategies/${id}/start`, { method: 'POST' });
  }

  async stopStrategy(id: string): Promise<StrategyStatus> {
    return this.request(`/api/strategies/${id}/stop`, { method: 'POST' });
  }

  async getPerformance(): Promise<StrategyPerformance> {
    return this.request('/api/strategies/performance');
  }

  async getPortfolio(): Promise<Portfolio> {
    return this.request('/api/strategies/portfolio');
  }

  isServerAvailable(): Promise<boolean> {
    return this.healthCheck()
      .then(() => true)
      .catch(() => false);
  }
}

export const canonServerAPI = new CanonServerAPI();