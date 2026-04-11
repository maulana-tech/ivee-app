// @ts-nocheck
export class TradeServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;
  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }
  private async get<T>(path: string, params?: Record<string, any>, options?: any): Promise<T> {
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
    const resp = await this.fetchFn(url.toString(), { signal: options?.signal });
    if (!resp.ok) throw new Error(`Service ${path}: ${resp.status}`);
    return resp.json();
  }

  getTariffTrends(req?: any, options?: any) { return this.get('/api/trade/v1/get-tariff-trends', req, options); }
  getTradeFlows(req?: any, options?: any) { return this.get('/api/trade/v1/get-trade-flows', req, options); }
  getTradeBarriers(req?: any, options?: any) { return this.get('/api/trade/v1/get-trade-barriers', req, options); }
  getTradeRestrictions(req?: any, options?: any) { return this.get('/api/trade/v1/get-trade-restrictions', req, options); }
  getCustomsRevenue(req?: any, options?: any) { return this.get('/api/trade/v1/get-customs-revenue', req, options); }
  listComtradeFlows(req?: any, options?: any) { return this.get('/api/trade/v1/list-comtrade-flows', req, options); }
}
