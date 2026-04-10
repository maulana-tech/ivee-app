// @ts-nocheck
export class InfrastructureServiceClient {
  constructor(baseURL: string, options?: any) {}
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
