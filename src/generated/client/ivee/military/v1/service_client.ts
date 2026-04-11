// @ts-nocheck

export class MilitaryServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;

  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async get<T>(path: string, params?: Record<string, string | string[] | number | boolean>): Promise<T> {
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
    const resp = await this.fetchFn(url.toString());
    if (!resp.ok) throw new Error(`MilitaryService ${path}: ${resp.status}`);
    return resp.json();
  }

  getUSNIFleetReport(req?) { return this.get('/api/military/v1/get-usni-fleet-report', req); }
  getTheaterPosture(req?) { return this.get('/api/military/v1/get-theater-posture', req); }
  listMilitaryBases(req?) { return this.get('/api/military/v1/list-military-bases', req); }
  getAircraftDetails(req) { return this.get('/api/military/v1/get-aircraft-details', req); }
  getAircraftDetailsBatch(req) { return this.get('/api/military/v1/get-aircraft-details-batch', req); }
  getWingbitsStatus(req?) { return this.get('/api/military/v1/get-wingbits-status', req); }
  getWingbitsLiveFlight(req?) { return this.get('/api/military/v1/get-wingbits-live-flight', req); }
  listMilitaryFlights(req?) { return this.get('/api/military/v1/list-military-flights', req); }
  listDefensePatents(req?) { return this.get('/api/military/v1/list-defense-patents', req); }
}

export interface DefensePatentFiling {
  id: string;
  title: string;
  filingDate: string;
  assignee: string;
  abstract: string;
}
