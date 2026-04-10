// @ts-nocheck
export class WebcamServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface WebcamEntry {
  id: string;
  name: string;
  location: any;
  url: string;
  thumbnailUrl: string;
}

export interface WebcamCluster {
  id: string;
  name: string;
  location: any;
  webcams: WebcamEntry[];
}
