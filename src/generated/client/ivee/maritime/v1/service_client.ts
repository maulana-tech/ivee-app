// @ts-nocheck
export class MaritimeServiceClient {
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

  getVesselSnapshot(req?: any, options?: any) { return this.get('/api/maritime/v1/get-vessel-snapshot', req, options); }
  listNavigationalWarnings(req?: any, options?: any) { return this.get('/api/maritime/v1/list-navigational-warnings', req, options); }
}

export interface NavigationalWarning {
  id: string;
  title: string;
  description: string;
  coordinates: any;
  validFrom: number;
  validTo: number;
}
