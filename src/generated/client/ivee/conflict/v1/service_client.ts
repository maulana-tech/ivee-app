// @ts-nocheck
export class ConflictServiceClient {
  constructor(baseURL: string, options?: any) {}
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
