// @ts-nocheck
export class NewsServiceClient {
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

  summarizeArticle(req?: any, options?: any) { return this.get('/api/news/v1/summarize-article', req, options); }
  getSummarizeArticleCache(req?: any, options?: any) { return this.get('/api/news/v1/summarize-article-cache', req, options); }
  listFeedDigest(req?: any, options?: any) { return this.get('/api/news/v1/list-feed-digest', req, options); }
}

export interface SummarizeArticleResponse {
  summary: string;
  keywords: string[];
}

export interface ListFeedDigestResponse {
  items: NewsItem[];
  total: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
}

export enum ThreatLevel {
  UNKNOWN = 0,
  LOW = 1,
  MODERATE = 2,
  HIGH = 3,
  SEVERE = 4,
}
