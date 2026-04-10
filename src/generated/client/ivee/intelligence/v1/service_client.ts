// @ts-nocheck
export class IntelligenceServiceClient {
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

  getCountryIntelBrief(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-country-intel-brief', req, options); }
  getGdeltTopicTimeline(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-gdelt-topic-timeline', req, options); }
  getCountryRisk(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-country-risk', req, options); }
  getRiskScores(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-risk-scores', req, options); }
  getPizzintStatus(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-pizzint-status', req, options); }
  classifyEvent(req?: any, options?: any) { return this.get('/api/intelligence/v1/classify-event', req, options); }
  searchGdeltDocuments(req?: any, options?: any) { return this.get('/api/intelligence/v1/search-gdelt-documents', req, options); }
  listSecurityAdvisories(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-security-advisories', req, options); }
  listSatellites(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-satellites', req, options); }
  listGpsInterference(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-gps-interference', req, options); }
  listCrossSourceSignals(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-cross-source-signals', req, options); }
  listOrefAlerts(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-oref-alerts', req, options); }
  listTelegramFeed(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-telegram-feed', req, options); }
  getCompanyEnrichment(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-company-enrichment', req, options); }
  listCompanySignals(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-company-signals', req, options); }
  listMarketImplications(req?: any, options?: any) { return this.get('/api/intelligence/v1/list-market-implications', req, options); }
  getCountryFacts(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-country-facts', req, options); }
  getSocialVelocity(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-social-velocity', req, options); }
  getCountryEnergyProfile(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-country-energy-profile', req, options); }
  computeEnergyShock(req?: any, options?: any) { return this.get('/api/intelligence/v1/compute-energy-shock', req, options); }
  getCountryPortActivity(req?: any, options?: any) { return this.get('/api/intelligence/v1/get-country-port-activity', req, options); }
  deductSituation(req?: any, options?: any) { return this.get('/api/intelligence/v1/deduct-situation', req, options); }
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
  headOfState: string;
  headOfStateTitle: string;
  wikipediaSummary: string;
  wikipediaThumbnailUrl: string;
  population: number | string;
  capital: string;
  languages: string[];
  currencies: string[];
  areaSqKm: number;
  countryName: string;
}

export interface GetCountryEnergyProfileResponse {
  mixAvailable: boolean;
  mixYear: number;
  coalShare: number;
  gasShare: number;
  oilShare: number;
  nuclearShare: number;
  renewShare: number;
  windShare: number;
  solarShare: number;
  hydroShare: number;
  importShare: number;
  gasStorageAvailable: boolean;
  available: boolean;
}

export interface GetCountryPortActivityResponse {
  available: boolean;
  ports: Array<{
    portId: string;
    portName: string;
    lat: number;
    lon: number;
    tankerCalls30d: number;
    trendDeltaPct: number;
    importTankerDwt: number;
    exportTankerDwt: number;
    anomalySignal: string;
  }>;
  fetchedAt: string;
}

export interface DeductSituationResponse {
  deductions: any[];
}

export interface GdeltArticle {
  title: string;
  url: string;
  source: string;
  date: string;
  image: string;
  language: string;
  tone: number;
}

export interface GdeltTimelinePoint {
  date: string;
  value: number;
}

export interface SearchGdeltDocumentsResponse {
  articles: GdeltArticle[];
  query: string;
  error: string;
}

export interface PizzintStatus {
  status: string;
  defconLevel: string;
  timestamp: number;
  summary: string;
}

export interface PizzintLocation {
  name: string;
  lat: number;
  lon: number;
  status: string;
}

export interface GdeltTensionPair {
  date: string;
  tone: number;
  vol: number;
}

export interface GetPizzintStatusResponse {
  status: PizzintStatus;
  locations: PizzintLocation[];
  gdeltTension: GdeltTensionPair[];
  includeGdelt: boolean;
}

export interface GetSocialVelocityResponse {
  posts: SocialVelocityPost[];
  fetchedAt: number;
}

export interface SocialVelocityPost {
  id: string;
  platform: string;
  author: string;
  content: string;
  url: string;
  publishedAt: number;
  velocity: number;
}

export interface ListSecurityAdvisoriesResponse {
  advisories: any[];
  fetchedAt: number;
}

export interface ListCrossSourceSignalsResponse {
  signals: any[];
  evaluatedAt: number;
  compositeCount: number;
}

export interface CiiScore {
  countryCode: string;
  score: number;
  level: string;
  trend: string;
  change24h: number;
  components: any[];
}

export interface StrategicRisk {
  category: string;
  level: string;
  score: number;
}

export interface GetRiskScoresResponse {
  scores: CiiScore[];
  fetchedAt: number;
}
