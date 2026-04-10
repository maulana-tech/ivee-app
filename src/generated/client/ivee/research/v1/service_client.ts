// @ts-nocheck
export class ResearchServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface TechEvent {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

export interface ListTechEventsResponse {
  items: TechEvent[];
  total: number;
}
