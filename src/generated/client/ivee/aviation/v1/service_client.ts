// @ts-nocheck
export class AviationServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;
  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }
  private async get<T>(path: string, params?: Record<string, any>, options?: any): Promise<T> {
    const url = new URL(path, this.baseURL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"));
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

  listAirportDelays(req?: any, options?: any) { return this.get('/api/aviation/v1/list-airport-delays', req, options); }
  getAirportOpsSummary(req?: any, options?: any) { return this.get('/api/aviation/v1/get-airport-ops-summary', req, options); }
  listAirportFlights(req?: any, options?: any) { return this.get('/api/aviation/v1/list-airport-flights', req, options); }
  getCarrierOps(req?: any, options?: any) { return this.get('/api/aviation/v1/get-carrier-ops', req, options); }
  getFlightStatus(req?: any, options?: any) { return this.get('/api/aviation/v1/get-flight-status', req, options); }
  trackAircraft(req?: any, options?: any) { return this.get('/api/aviation/v1/track-aircraft', req, options); }
  searchFlightPrices(req?: any, options?: any) { return this.get('/api/aviation/v1/search-flight-prices', req, options); }
  searchGoogleFlights(req?: any, options?: any) { return this.get('/api/aviation/v1/search-google-flights', req, options); }
  searchGoogleDates(req?: any, options?: any) { return this.get('/api/aviation/v1/search-google-dates', req, options); }
  listAviationNews(req?: any, options?: any) { return this.get('/api/aviation/v1/list-aviation-news', req, options); }
  getYoutubeLiveStreamInfo(req?: any, options?: any) { return this.get('/api/aviation/v1/get-youtube-live-stream-info', req, options); }
}

export interface AirportDelayAlert {
  id: string;
  iata: string;
  icao: string;
  name: string;
  region: string;
  severity: string;
  type: string;
  source: string;
  reason: string;
  avgDelayMinutes: number;
  affectedFlights: number;
  startTime: string;
  endTime: string;
}

export interface AirportOpsSummary {
  iata: string;
  name: string;
  arrivals24h: number;
  departures24h: number;
  cancelled24h: number;
  avgDelayMinutes: number;
}

export interface FlightInstance {
  callsign: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  status: string;
  scheduledDeparture: string;
  estimatedDeparture: string;
  actualDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  actualArrival: string;
  aircraftType: string;
  registration: string;
  delayMinutes: number;
}

export interface CarrierOpsSummary {
  airline: string;
  flightCount: number;
  delayRate: number;
  avgDelayMinutes: number;
  cancelledCount: number;
}

export interface PositionSample {
  icao24: string;
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundSpeed: number;
  heading: number;
  timestamp: number;
  onGround: boolean;
  squawk: string;
}

export interface PriceQuote {
  airline: string;
  price: number;
  durationMinutes: number;
  stops: number;
  isDemoMode: boolean;
  isIndicative: boolean;
  provider: string;
}

export interface AviationNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
  entities: string[];
}

export type CabinClass = 'CABIN_CLASS_ECONOMY' | 'CABIN_CLASS_PREMIUM_ECONOMY' | 'CABIN_CLASS_BUSINESS' | 'CABIN_CLASS_FIRST';

export interface GoogleFlightResult {
  airline: string;
  price: number;
  durationMinutes: number;
  stops: number;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  bookingUrl: string;
}

export interface DatePriceEntry {
  date: string;
  returnDate: string;
  price: number;
}
