// @ts-nocheck

export class MarketServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;

  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async get<T>(path: string, params?: Record<string, string | string[] | number | boolean>): Promise<T> {
    const url = new URL(path, this.baseURL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"));
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          if (value.length > 0) url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const resp = await this.fetchFn(url.toString());
    if (!resp.ok) throw new Error(`MarketService ${path}: ${resp.status}`);
    return resp.json();
  }

  listMarketQuotes(req) { return this.get('/api/market/v1/list-market-quotes', { symbols: req?.symbols }); }
  listCryptoQuotes(req) { return this.get('/api/market/v1/list-crypto-quotes', { ids: req?.ids }); }
  listCommodityQuotes(req) { return this.get('/api/market/v1/list-commodity-quotes', { symbols: req?.symbols }); }
  getSectorSummary(req) { return this.get('/api/market/v1/get-sector-summary', { period: req?.period }); }
  listStablecoinMarkets(req) { return this.get('/api/market/v1/list-stablecoin-markets', { coins: req?.coins }); }
  listEtfFlows(req) { return this.get('/api/market/v1/list-etf-flows'); }
  getCountryStockIndex(req) { return this.get('/api/market/v1/get-country-stock-index', { country_code: req?.countryCode }); }
  listGulfQuotes(req) { return this.get('/api/market/v1/list-gulf-quotes'); }
  analyzeStock(req) { return this.get('/api/market/v1/analyze-stock', { symbol: req?.symbol, name: req?.name, include_news: req?.includeNews }); }
  getStockAnalysisHistory(req) { return this.get('/api/market/v1/get-stock-analysis-history', { symbols: req?.symbols, limit_per_symbol: req?.limitPerSymbol, include_news: req?.includeNews }); }
  backtestStock(req) { return this.get('/api/market/v1/backtest-stock', { symbol: req?.symbol, name: req?.name, eval_window_days: req?.evalWindowDays }); }
  listStoredStockBacktests(req) { return this.get('/api/market/v1/list-stored-stock-backtests', { symbols: req?.symbols, eval_window_days: req?.evalWindowDays }); }
  listCryptoSectors(req) { return this.get('/api/market/v1/list-crypto-sectors'); }
  listDefiTokens(req) { return this.get('/api/market/v1/list-defi-tokens'); }
  listAiTokens(req) { return this.get('/api/market/v1/list-ai-tokens'); }
  listOtherTokens(req) { return this.get('/api/market/v1/list-other-tokens'); }
  getFearGreedIndex(req) { return this.get('/api/market/v1/get-fear-greed-index'); }
  listEarningsCalendar(req) { return this.get('/api/market/v1/list-earnings-calendar', { fromDate: req?.fromDate, toDate: req?.toDate }); }
  getCotPositioning(req) { return this.get('/api/market/v1/get-cot-positioning'); }
}

export interface ListMarketQuotesResponse {
  quotes: MarketQuote[];
  finnhubSkipped?: boolean;
  skipReason?: string;
  rateLimited?: boolean;
}

export interface MarketQuote {
  symbol: string;
  name?: string;
  display?: string;
  price: number;
  change: number;
  sparkline?: number[];
}

export interface ListCommodityQuotesResponse {
  quotes: CommodityQuote[];
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  display?: string;
  price: number;
  change: number;
  sparkline?: number[];
}

export interface GetSectorSummaryResponse {
  sectors: SectorPerformance[];
}

export interface SectorPerformance {
  symbol: string;
  name: string;
  change: number;
}

export interface ListCryptoQuotesResponse {
  quotes: CryptoQuote[];
}

export interface CryptoQuote {
  name: string;
  symbol: string;
  price: number;
  change: number;
  sparkline?: number[];
  change7d?: number;
}

export interface ListCryptoSectorsResponse {
  sectors: CryptoSector[];
}

export interface CryptoSector {
  id?: string;
  name: string;
  change: number;
}

export interface ListDefiTokensResponse {
  tokens: CryptoQuote[];
}

export interface ListAiTokensResponse {
  tokens: CryptoQuote[];
}

export interface ListOtherTokensResponse {
  tokens: CryptoQuote[];
}
