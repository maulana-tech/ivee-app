// @ts-nocheck
export class SeismologyServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface Earthquake {
  id: string;
  magnitude: number;
  location: string;
  coordinates: any;
  timestamp: number;
  depth: number;
}
