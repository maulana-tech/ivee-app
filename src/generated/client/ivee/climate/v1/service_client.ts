// @ts-nocheck
export class ClimateServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface ListClimateNewsResponse {
  items: ClimateNewsItem[];
  total: number;
}

export interface ClimateNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
}
