// @ts-nocheck
export class WebcamServiceClient {
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

  listWebcams(req?: any, options?: any) { return this.get('/api/webcam/v1/list-webcams', req, options); }
  getWebcamImage(req?: any, options?: any) { return this.get('/api/webcam/v1/get-webcam-image', req, options); }
}

export interface WebcamEntry {
  id: string;
  name: string;
  location: any;
  url: string;
  thumbnailUrl: string;
}

export interface WebcamCluster {
  id: string;
  name: string;
  location: any;
  webcams: WebcamEntry[];
}
