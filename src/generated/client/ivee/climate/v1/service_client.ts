// @ts-nocheck
export class ClimateServiceClient {
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

  listClimateAnomalies(req?: any, options?: any) { return this.get('/api/climate/v1/list-climate-anomalies', req, options); }
  listClimateDisasters(req?: any, options?: any) { return this.get('/api/climate/v1/list-climate-disasters', req, options); }
  getCo2Monitoring(req?: any, options?: any) { return this.get('/api/climate/v1/get-co2-monitoring', req, options); }
  getOceanIceData(req?: any, options?: any) { return this.get('/api/climate/v1/get-ocean-ice-data', req, options); }
  listAirQualityData(req?: any, options?: any) { return this.get('/api/climate/v1/list-air-quality-data', req, options); }
  listClimateNews(req?: any, options?: any) { return this.get('/api/climate/v1/list-climate-news', req, options); }
}

export interface ListClimateNewsResponse {
  items: ClimateNewsItem[];
  total: number;
}

export interface ClimateNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
}
