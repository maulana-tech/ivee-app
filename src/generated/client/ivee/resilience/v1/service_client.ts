// @ts-nocheck
export class ResilienceServiceClient {
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

  getResilienceScore(req?: any, options?: any) { return this.get('/api/resilience/v1/get-resilience-score', req, options); }
  getResilienceRanking(req?: any, options?: any) { return this.get('/api/resilience/v1/get-resilience-ranking', req, options); }
}

export interface ResilienceDomain {
  name: string;
  score: number;
}

export interface ResilienceDimension {
  name: string;
  score: number;
  domains: ResilienceDomain[];
}

export interface ResilienceRankingItem {
  countryCode: string;
  countryName: string;
  overallScore: number;
  rank: number;
}

export interface GetResilienceScoreResponse {
  countryCode: string;
  countryName: string;
  overallScore: number;
  dimensions: ResilienceDimension[];
}

export interface GetResilienceRankingResponse {
  rankings: ResilienceRankingItem[];
  updatedAt: number;
}
