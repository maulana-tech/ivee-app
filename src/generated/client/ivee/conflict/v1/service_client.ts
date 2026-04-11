// @ts-nocheck
export class ConflictServiceClient {
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

  listAcledEvents(req?: any, options?: any) { return this.get('/api/conflict/v1/list-acled-events', req, options); }
  listUcdpEvents(req?: any, options?: any) { return this.get('/api/conflict/v1/list-ucdp-events', req, options); }
  getHumanitarianSummary(req?: any, options?: any) { return this.get('/api/conflict/v1/get-humanitarian-summary', req, options); }
  getHumanitarianSummaryBatch(req?: any, options?: any) { return this.get('/api/conflict/v1/get-humanitarian-summary-batch', req, options); }
  listIranEvents(req?: any, options?: any) { return this.get('/api/conflict/v1/list-iran-events', req, options); }
}

export class ApiError extends Error {
  statusCode: number;
  body: string;
}

export interface IranEvent {
  id: string;
  title: string;
  date: string;
  location: string;
}

export interface AcledConflictEvent {
  id: string;
  eventDate: string;
  location: string;
  country: string;
  fatalities: number;
  interAction: string;
  actor1: string;
  actor2: string;
}

export interface UcdpViolenceEvent {
  id: string;
  date: string;
  country: string;
  location: string;
  fatalities: number;
  bestEstimate: number;
}

export interface HumanitarianCountrySummary {
  countryCode: string;
  peopleInNeed: number;
  severelyFoodInsecure: number;
  accessConstraints: number;
}

export interface ListAcledEventsResponse {
  events: AcledConflictEvent[];
  total: number;
  updatedAt: number;
}

export interface ListUcdpEventsResponse {
  events: UcdpViolenceEvent[];
  total: number;
  updatedAt: number;
}

export interface GetHumanitarianSummaryResponse {
  summary: HumanitarianCountrySummary;
  updatedAt: number;
}

export interface GetHumanitarianSummaryBatchResponse {
  results: HumanitarianCountrySummary[];
  updatedAt: number;
}

export interface ListIranEventsResponse {
  events: IranEvent[];
  total: number;
  updatedAt: number;
}
