// @ts-nocheck
export class ThermalServiceClient {
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

  listThermalEscalations(req?: any, options?: any) { return this.get('/api/thermal/v1/list-thermal-escalations', req, options); }
}

export interface ThermalEscalationCluster {
  id: string;
  countryCode: string;
  countryName: string;
  regionLabel: string;
  centroid: { latitude: number; longitude: number };
  observationCount: number;
  uniqueSourceCount: number;
  maxBrightness: number;
  avgBrightness: number;
  maxFrp: number;
  totalFrp: number;
  nightDetectionShare: number;
  baselineExpectedCount: number;
  baselineExpectedFrp: number;
  countDelta: number;
  frpDelta: number;
  zScore: number;
  persistenceHours: number;
  status: ThermalStatus;
  context: ThermalContext;
  confidence: ThermalConfidence;
  strategicRelevance: ThermalStrategicRelevance;
  nearbyAssets: string[];
  narrativeFlags: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export type ThermalStatus = 'THERMAL_STATUS_NORMAL' | 'THERMAL_STATUS_ELEVATED' | 'THERMAL_STATUS_SPIKE' | 'THERMAL_STATUS_PERSISTENT';
export type ThermalContext = 'THERMAL_CONTEXT_WILDLAND' | 'THERMAL_CONTEXT_URBAN_EDGE' | 'THERMAL_CONTEXT_INDUSTRIAL' | 'THERMAL_CONTEXT_ENERGY_ADJACENT' | 'THERMAL_CONTEXT_CONFLICT_ADJACENT' | 'THERMAL_CONTEXT_LOGISTICS_ADJACENT' | 'THERMAL_CONTEXT_MIXED';
export type ThermalConfidence = 'THERMAL_CONFIDENCE_LOW' | 'THERMAL_CONFIDENCE_MEDIUM' | 'THERMAL_CONFIDENCE_HIGH';
export type ThermalStrategicRelevance = 'THERMAL_RELEVANCE_LOW' | 'THERMAL_RELEVANCE_MEDIUM' | 'THERMAL_RELEVANCE_HIGH';
