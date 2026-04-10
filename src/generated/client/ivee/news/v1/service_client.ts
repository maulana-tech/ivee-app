// @ts-nocheck
export class NewsServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface SummarizeArticleResponse {
  summary: string;
  keywords: string[];
}

export interface ListFeedDigestResponse {
  items: NewsItem[];
  total: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
}

export enum ThreatLevel {
  UNKNOWN = 0,
  LOW = 1,
  MODERATE = 2,
  HIGH = 3,
  SEVERE = 4,
}
