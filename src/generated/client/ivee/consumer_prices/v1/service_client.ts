// @ts-nocheck
export class ConsumerPricesServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;
  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }
  private async get<T>(path: string, params?: Record<string, any>, options?: any): Promise<T> {
    const url = new URL(path, this.baseURL);
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

  getConsumerPriceOverview(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/get-consumer-price-overview', req, options); }
  getConsumerPriceBasketSeries(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/get-consumer-price-basket-series', req, options); }
  listConsumerPriceCategories(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/list-consumer-price-categories', req, options); }
  listConsumerPriceMovers(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/list-consumer-price-movers', req, options); }
  listRetailerPriceSpreads(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/list-retailer-price-spreads', req, options); }
  getConsumerPriceFreshness(req?: any, options?: any) { return this.get('/api/consumer-prices/v1/get-consumer-price-freshness', req, options); }
}
