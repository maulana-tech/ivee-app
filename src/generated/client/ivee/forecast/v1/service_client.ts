// @ts-nocheck
export class ForecastServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface Forecast {
  id: string;
  name: string;
  value: number;
  confidence: number;
  targetDate: string;
}
