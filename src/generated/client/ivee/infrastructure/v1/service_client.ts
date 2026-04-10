// @ts-nocheck

export class InfrastructureServiceClient {
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
    if (!resp.ok) throw new Error(`InfrastructureService ${path}: ${resp.status}`);
    return resp.json();
  }

  listInternetOutages(req?) { return this.get('/api/infrastructure/v1/list-internet-outages', req); }
  listInternetDdosAttacks(req?) { return this.get('/api/infrastructure/v1/list-internet-ddos-attacks', req); }
  listInternetTrafficAnomalies(req?) { return this.get('/api/infrastructure/v1/list-internet-traffic-anomalies', req); }
  listServiceStatuses(req?) { return this.get('/api/infrastructure/v1/list-service-statuses', req); }
  listTemporalAnomalies(req?) { return this.get('/api/infrastructure/v1/list-temporal-anomalies', req); }
  recordBaselineSnapshot(req) { return this.get('/api/infrastructure/v1/record-baseline-snapshot', req); }
  getTemporalBaseline(req?) { return this.get('/api/infrastructure/v1/get-temporal-baseline', req); }
  getCableHealth(req?) { return this.get('/api/infrastructure/v1/get-cable-health', req); }
}

export interface TemporalAnomaly {
  id: string;
  type: string;
  location: any;
  timestamp: number;
}

export interface TrafficAnomaly {
  id: string;
  type: string;
  location: any;
  timestamp: number;
}

export interface DdosLocationHit {
  countryCode: string;
  attackCount: number;
}
