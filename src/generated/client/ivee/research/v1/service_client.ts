// @ts-nocheck
export class ResearchServiceClient {
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

  listArxivPapers(req?: any, options?: any) { return this.get('/api/research/v1/list-arxiv-papers', req, options); }
  listTrendingRepos(req?: any, options?: any) { return this.get('/api/research/v1/list-trending-repos', req, options); }
  listTechEvents(req?: any, options?: any) { return this.get('/api/research/v1/list-tech-events', req, options); }
  listHackernewsItems(req?: any, options?: any) { return this.get('/api/research/v1/list-hackernews-items', req, options); }
}

export interface TechEvent {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

export interface ListTechEventsResponse {
  items: TechEvent[];
  total: number;
}
