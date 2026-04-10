import { getRpcBaseUrl } from '@/services/rpc-client';
import { AviationServiceClient, } from '@/generated/client/ivee/aviation/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
/** Returns true if a quote has a known expiry that has passed. */
export function isPriceExpired(q) {
    return q.expiresAt !== null && q.expiresAt.getTime() < Date.now();
}
// ---- Enum maps ----
const SEVERITY_MAP = {
    FLIGHT_DELAY_SEVERITY_NORMAL: 'normal',
    FLIGHT_DELAY_SEVERITY_MINOR: 'minor',
    FLIGHT_DELAY_SEVERITY_MODERATE: 'moderate',
    FLIGHT_DELAY_SEVERITY_MAJOR: 'major',
    FLIGHT_DELAY_SEVERITY_SEVERE: 'severe',
};
const DELAY_TYPE_MAP = {
    FLIGHT_DELAY_TYPE_GROUND_STOP: 'ground_stop',
    FLIGHT_DELAY_TYPE_GROUND_DELAY: 'ground_delay',
    FLIGHT_DELAY_TYPE_DEPARTURE_DELAY: 'departure_delay',
    FLIGHT_DELAY_TYPE_ARRIVAL_DELAY: 'arrival_delay',
    FLIGHT_DELAY_TYPE_GENERAL: 'general',
    FLIGHT_DELAY_TYPE_CLOSURE: 'closure',
};
const REGION_MAP = {
    AIRPORT_REGION_AMERICAS: 'americas',
    AIRPORT_REGION_EUROPE: 'europe',
    AIRPORT_REGION_APAC: 'apac',
    AIRPORT_REGION_MENA: 'mena',
    AIRPORT_REGION_AFRICA: 'africa',
};
const SOURCE_MAP = {
    FLIGHT_DELAY_SOURCE_FAA: 'faa',
    FLIGHT_DELAY_SOURCE_EUROCONTROL: 'eurocontrol',
    FLIGHT_DELAY_SOURCE_COMPUTED: 'computed',
    FLIGHT_DELAY_SOURCE_AVIATIONSTACK: 'aviationstack',
    FLIGHT_DELAY_SOURCE_NOTAM: 'notam',
};
const FLIGHT_STATUS_MAP = {
    FLIGHT_INSTANCE_STATUS_SCHEDULED: 'scheduled',
    FLIGHT_INSTANCE_STATUS_BOARDING: 'boarding',
    FLIGHT_INSTANCE_STATUS_DEPARTED: 'departed',
    FLIGHT_INSTANCE_STATUS_AIRBORNE: 'airborne',
    FLIGHT_INSTANCE_STATUS_LANDED: 'landed',
    FLIGHT_INSTANCE_STATUS_ARRIVED: 'arrived',
    FLIGHT_INSTANCE_STATUS_CANCELLED: 'cancelled',
    FLIGHT_INSTANCE_STATUS_DIVERTED: 'diverted',
};
// ---- Normalizers ----
function msToDt(ms) { return ms ? new Date(ms) : null; }
function toDisplayAlert(p) {
    return {
        id: p.id, iata: p.iata, icao: p.icao, name: p.name, city: p.city, country: p.country,
        lat: p.location?.latitude ?? 0, lon: p.location?.longitude ?? 0,
        region: REGION_MAP[p.region] ?? 'americas',
        delayType: DELAY_TYPE_MAP[p.delayType] ?? 'general',
        severity: SEVERITY_MAP[p.severity] ?? 'normal',
        avgDelayMinutes: p.avgDelayMinutes,
        delayedFlightsPct: p.delayedFlightsPct || undefined,
        cancelledFlights: p.cancelledFlights || undefined,
        totalFlights: p.totalFlights || undefined,
        reason: p.reason || undefined,
        source: SOURCE_MAP[p.source] ?? 'computed',
        updatedAt: new Date(p.updatedAt),
    };
}
function toDisplayOps(p) {
    return {
        iata: p.iata, icao: p.icao, name: p.name,
        delayPct: p.delayPct, avgDelayMinutes: p.avgDelayMinutes, cancellationRate: p.cancellationRate,
        totalFlights: p.totalFlights, closureStatus: p.closureStatus,
        notamFlags: p.notamFlags ?? [], severity: SEVERITY_MAP[p.severity] ?? 'normal',
        topDelayReasons: p.topDelayReasons ?? [], source: p.source, updatedAt: new Date(p.updatedAt),
    };
}
function toDisplayFlight(p) {
    return {
        flightNumber: p.flightNumber, date: p.date,
        carrier: { iata: p.operatingCarrier?.iataCode ?? '', name: p.operatingCarrier?.name ?? '' },
        origin: { iata: p.origin?.iata ?? '', name: p.origin?.name ?? '' },
        destination: { iata: p.destination?.iata ?? '', name: p.destination?.name ?? '' },
        scheduledDeparture: msToDt(p.scheduledDeparture), scheduledArrival: msToDt(p.scheduledArrival),
        estimatedDeparture: msToDt(p.estimatedDeparture || p.scheduledDeparture),
        estimatedArrival: msToDt(p.estimatedArrival || p.scheduledArrival),
        status: FLIGHT_STATUS_MAP[p.status ?? ''] ?? 'unknown',
        delayMinutes: p.delayMinutes, cancelled: p.cancelled, diverted: p.diverted,
        gate: p.gate, terminal: p.terminal, aircraftType: p.aircraftType, source: p.source,
    };
}
function toDisplayCarrierOps(p) {
    return {
        carrierIata: p.carrier?.iataCode ?? '', carrierName: p.carrier?.name ?? p.carrier?.iataCode ?? '',
        airport: p.airport, totalFlights: p.totalFlights, delayedCount: p.delayedCount,
        cancelledCount: p.cancelledCount, avgDelayMinutes: p.avgDelayMinutes,
        delayPct: p.delayPct, cancellationRate: p.cancellationRate, updatedAt: new Date(p.updatedAt),
    };
}
function toDisplayPosition(p) {
    return {
        icao24: p.icao24, callsign: p.callsign, lat: p.lat, lon: p.lon,
        altitudeFt: Math.round(p.altitudeM * 3.281),
        groundSpeedKts: p.groundSpeedKts, trackDeg: p.trackDeg, onGround: p.onGround,
        source: p.source, observedAt: new Date(p.observedAt),
    };
}
function toDisplayPriceQuote(p) {
    return {
        id: p.id, origin: p.origin, destination: p.destination, departureDate: p.departureDate,
        carrierIata: p.carrier?.iataCode ?? '', carrierName: p.carrier?.name ?? '',
        priceAmount: p.priceAmount,
        currency: p.currency?.toUpperCase() || 'USD',
        cabin: p.cabin?.replace('CABIN_CLASS_', '').replace(/_/g, ' ') ?? 'Economy',
        stops: p.stops, durationMinutes: p.durationMinutes, isIndicative: p.isIndicative,
        provider: p.provider || 'demo',
        expiresAt: p.expiresAt > 0 ? new Date(p.expiresAt) : null,
        checkoutRef: p.checkoutRef || '',
    };
}
function toDisplayNewsItem(p) {
    return {
        id: p.id, title: p.title, url: p.url, sourceName: p.sourceName,
        publishedAt: new Date(p.publishedAt), snippet: p.snippet,
        matchedEntities: p.matchedEntities ?? [],
    };
}
function toDisplayGoogleFlight(p) {
    return {
        legs: (p.legs ?? []).map(l => ({
            airlineCode: l.airlineCode ?? '',
            flightNumber: l.flightNumber ?? '',
            departureAirport: l.departureAirport ?? '',
            arrivalAirport: l.arrivalAirport ?? '',
            departureDatetime: l.departureDatetime ?? '',
            arrivalDatetime: l.arrivalDatetime ?? '',
            durationMinutes: l.durationMinutes ?? 0,
        })),
        price: p.price ?? 0,
        durationMinutes: p.durationMinutes ?? 0,
        stops: p.stops ?? 0,
    };
}
function toDisplayDatePrice(p) {
    return { date: p.date ?? '', returnDate: p.returnDate ?? '', price: p.price ?? 0 };
}
// ---- Client + circuit breakers ----
const client = new AviationServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breakerDelays = createCircuitBreaker({ name: 'Flight Delays v2', cacheTtlMs: 2 * 60 * 60 * 1000, persistCache: true });
const breakerOps = createCircuitBreaker({ name: 'Airport Ops', cacheTtlMs: 6 * 60 * 1000, persistCache: true });
const breakerFlights = createCircuitBreaker({ name: 'Airport Flights', cacheTtlMs: 5 * 60 * 1000, persistCache: false });
const breakerCarrier = createCircuitBreaker({ name: 'Carrier Ops', cacheTtlMs: 5 * 60 * 1000, persistCache: false });
const breakerStatus = createCircuitBreaker({ name: 'Flight Status', cacheTtlMs: 6 * 60 * 1000, persistCache: false });
const breakerTrack = createCircuitBreaker({ name: 'Track Aircraft', cacheTtlMs: 15 * 1000, persistCache: false });
const breakerPrices = createCircuitBreaker({ name: 'Flight Prices', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const breakerNews = createCircuitBreaker({ name: 'Aviation News', cacheTtlMs: 15 * 60 * 1000, persistCache: true });
// No client-side cache for Google Flights search (gateway is no-store, prices change rapidly)
const breakerGoogleFlights = createCircuitBreaker({ name: 'Google Flights', cacheTtlMs: 0, persistCache: false });
// 5-min client cache (server has 10-min Redis + medium gateway cache)
const breakerGoogleDates = createCircuitBreaker({ name: 'Google Dates', cacheTtlMs: 5 * 60 * 1000, persistCache: false });
// ---- Public API ----
export async function fetchFlightDelays() {
    const hydrated = getHydratedData('flightDelays');
    if (hydrated?.alerts?.length)
        return hydrated.alerts.map(toDisplayAlert);
    return breakerDelays.execute(async () => {
        const r = await client.listAirportDelays({ region: 'AIRPORT_REGION_UNSPECIFIED', minSeverity: 'FLIGHT_DELAY_SEVERITY_UNSPECIFIED', pageSize: 0, cursor: '' });
        return r.alerts.map(toDisplayAlert);
    }, [], { shouldCache: (r) => r.length > 0 });
}
export async function fetchAirportOpsSummary(airports) {
    return breakerOps.execute(async () => {
        const r = await client.getAirportOpsSummary({ airports });
        return r.summaries.map(toDisplayOps);
    }, [], { cacheKey: airports.join(',') });
}
export async function fetchAirportFlights(airport, direction = 'both', limit = 30) {
    const dirMap = { departure: 'FLIGHT_DIRECTION_DEPARTURE', arrival: 'FLIGHT_DIRECTION_ARRIVAL', both: 'FLIGHT_DIRECTION_BOTH' };
    return breakerFlights.execute(async () => {
        const r = await client.listAirportFlights({ airport, direction: dirMap[direction], limit });
        return r.flights.map(toDisplayFlight);
    }, [], { cacheKey: `${airport}:${direction}:${limit}` });
}
export async function fetchCarrierOps(airports) {
    return breakerCarrier.execute(async () => {
        const r = await client.getCarrierOps({ airports, minFlights: 3 });
        return r.carriers.map(toDisplayCarrierOps);
    }, [], { cacheKey: airports.join(',') });
}
export async function fetchFlightStatus(flightNumber, date, origin) {
    return breakerStatus.execute(async () => {
        const r = await client.getFlightStatus({ flightNumber, date: date ?? '', origin: origin ?? '' });
        return r.flights.map(toDisplayFlight);
    }, [], { cacheKey: `${flightNumber}:${date ?? ''}:${origin ?? ''}` });
}
export async function fetchAircraftPositions(opts) {
    return breakerTrack.execute(async () => {
        const r = await client.trackAircraft({ icao24: opts.icao24 ?? '', callsign: opts.callsign ?? '', swLat: opts.swLat ?? 0, swLon: opts.swLon ?? 0, neLat: opts.neLat ?? 0, neLon: opts.neLon ?? 0 });
        return r.positions.map(toDisplayPosition);
    }, [], { cacheKey: `${opts.icao24 ?? ''}:${opts.callsign ?? ''}:${opts.swLat ?? 0}:${opts.swLon ?? 0}:${opts.neLat ?? 0}:${opts.neLon ?? 0}` });
}
export async function fetchFlightPrices(opts) {
    const cacheKey = `${opts.origin}:${opts.destination}:${opts.departureDate}:${opts.returnDate ?? ''}:${opts.adults ?? 1}:${opts.cabin ?? 'CABIN_CLASS_ECONOMY'}:${opts.nonstopOnly ?? false}:${opts.maxResults ?? 10}:${opts.currency ?? 'usd'}:${opts.market ?? ''}`;
    return breakerPrices.execute(async () => {
        const r = await client.searchFlightPrices({
            origin: opts.origin, destination: opts.destination,
            departureDate: opts.departureDate, returnDate: opts.returnDate ?? '',
            adults: opts.adults ?? 1, cabin: opts.cabin ?? 'CABIN_CLASS_ECONOMY',
            nonstopOnly: opts.nonstopOnly ?? false, maxResults: opts.maxResults ?? 10,
            currency: opts.currency ?? 'usd', market: opts.market ?? '',
        });
        return {
            quotes: r.quotes.map(toDisplayPriceQuote),
            isDemoMode: r.isDemoMode,
            isIndicative: r.isIndicative ?? true,
            provider: r.provider,
        };
    }, { quotes: [], isDemoMode: true, isIndicative: true, provider: 'demo' }, { cacheKey });
}
export async function fetchAviationNews(entities, windowHours = 24, maxItems = 20) {
    const cacheKey = `${entities.join(',')}:${windowHours}:${maxItems}`;
    return breakerNews.execute(async () => {
        const r = await client.listAviationNews({ entities, windowHours, maxItems });
        return r.items.map(toDisplayNewsItem);
    }, [], { cacheKey });
}
export async function fetchGoogleFlights(opts) {
    const cacheKey = `${opts.origin}:${opts.destination}:${opts.departureDate}:${opts.returnDate ?? ''}:${opts.cabinClass ?? 'ECONOMY'}:${opts.maxStops ?? ''}:${opts.sortBy ?? ''}:${opts.passengers ?? 1}`;
    return breakerGoogleFlights.execute(async () => {
        const r = await client.searchGoogleFlights({
            origin: opts.origin, destination: opts.destination,
            departureDate: opts.departureDate, returnDate: opts.returnDate ?? '',
            cabinClass: opts.cabinClass ?? 'ECONOMY', maxStops: opts.maxStops ?? '',
            departureWindow: '', airlines: [], sortBy: opts.sortBy ?? '',
            passengers: opts.passengers ?? 1,
        });
        return { flights: r.flights.map(toDisplayGoogleFlight), degraded: r.degraded ?? false, error: r.error ?? '' };
    }, { flights: [], degraded: true, error: 'Request failed' }, { cacheKey });
}
export async function fetchGoogleDates(opts) {
    const cacheKey = `${opts.origin}:${opts.destination}:${opts.startDate}:${opts.endDate}:${opts.tripDuration ?? 0}:${opts.isRoundTrip ?? false}:${opts.cabinClass ?? 'ECONOMY'}:${opts.maxStops ?? ''}:${opts.passengers ?? 1}`;
    return breakerGoogleDates.execute(async () => {
        const r = await client.searchGoogleDates({
            origin: opts.origin, destination: opts.destination,
            startDate: opts.startDate, endDate: opts.endDate,
            tripDuration: opts.tripDuration ?? 0, isRoundTrip: opts.isRoundTrip ?? false,
            cabinClass: opts.cabinClass ?? 'ECONOMY', maxStops: opts.maxStops ?? '',
            departureWindow: '', airlines: [], sortByPrice: true,
            passengers: opts.passengers ?? 1,
        });
        return { dates: r.dates.map(toDisplayDatePrice), degraded: r.degraded ?? false, error: r.error ?? '' };
    }, { dates: [], degraded: true, error: 'Request failed' }, { cacheKey });
}
