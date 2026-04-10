// @ts-nocheck
export class IntelligenceServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export class ApiError extends Error {
  statusCode: number;
  body: string;
}

export enum ThreatLevel {
  UNKNOWN = 0,
  LOW = 1,
  MODERATE = 2,
  HIGH = 3,
  SEVERE = 4,
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
  threatLevel: ThreatLevel;
}

export interface IranEvent {
  id: string;
  title: string;
  date: string;
  location: string;
}

export interface ClassifyEventResponse {
  eventId: string;
  threatLevel: ThreatLevel;
  confidence: number;
  reasoning: string;
}

export interface ListFeedDigestResponse {
  items: NewsItem[];
  total: number;
}

export interface GetCountryFactsResponse {
  facts: any[];
}

export interface GetCountryEnergyProfileResponse {
  profile: any;
}

export interface GetCountryPortActivityResponse {
  activity: any[];
}

export interface DeductSituationResponse {
  deductions: any[];
}
