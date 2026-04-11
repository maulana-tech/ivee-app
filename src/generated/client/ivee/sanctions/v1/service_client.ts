// @ts-nocheck
export class SanctionsServiceClient {
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

  listSanctionsPressure(req?: any, options?: any) { return this.get('/api/sanctions/v1/list-sanctions-pressure', req, options); }
  lookupSanctionEntity(req?: any, options?: any) { return this.get('/api/sanctions/v1/lookup-sanction-entity', req, options); }
}

export interface SanctionsEntry {
  id: string;
  name: string;
  entityType: SanctionsEntityType;
  countryCodes: string[];
  countryNames: string[];
  programs: string[];
  sourceLists: string[];
  effectiveAt: string | number;
  isNew: boolean;
  note: string;
}

export type SanctionsEntityType = 'SANCTIONS_ENTITY_TYPE_ENTITY' | 'SANCTIONS_ENTITY_TYPE_INDIVIDUAL' | 'SANCTIONS_ENTITY_TYPE_VESSEL' | 'SANCTIONS_ENTITY_TYPE_AIRCRAFT';

export interface CountrySanctionsPressure {
  countryCode: string;
  countryName: string;
  entryCount: number;
  newEntryCount: number;
  vesselCount: number;
  aircraftCount: number;
}

export interface ProgramSanctionsPressure {
  program: string;
  entryCount: number;
  newEntryCount: number;
}

export interface ListSanctionsPressureResponse {
  fetchedAt: string | number;
  datasetDate: string | number;
  totalCount: number;
  sdnCount: number;
  consolidatedCount: number;
  newEntryCount: number;
  vesselCount: number;
  aircraftCount: number;
  countries: CountrySanctionsPressure[];
  programs: ProgramSanctionsPressure[];
  entries: SanctionsEntry[];
}
