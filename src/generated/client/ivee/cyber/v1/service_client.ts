// @ts-nocheck

export class CyberServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;

  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async get<T>(path: string, params?: Record<string, string | string[] | number | boolean>): Promise<T> {
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
    const resp = await this.fetchFn(url.toString());
    if (!resp.ok) throw new Error(`CyberService ${path}: ${resp.status}`);
    return resp.json();
  }

  listCyberThreats(req?) { return this.get('/api/cyber/v1/list-cyber-threats', req); }
}
