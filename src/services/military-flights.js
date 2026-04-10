import { createCircuitBreaker, toUniqueSortedLowercase } from '@/utils';
import { identifyByCallsign, identifyByAircraftType, isKnownMilitaryHex, getNearbyHotspot, MILITARY_HOTSPOTS, MILITARY_QUERY_REGIONS, } from '@/config/military';
import { getAircraftDetailsBatch, analyzeAircraftDetails, checkWingbitsStatus, } from './wingbits';
import { isFeatureAvailable } from './runtime-config';
import { isDesktopRuntime, toApiUrl } from './runtime';
// Desktop: direct OpenSky proxy path (relay or Vercel)
const OPENSKY_PROXY_URL = toApiUrl('/api/opensky');
const wsRelayUrl = import.meta.env.VITE_WS_RELAY_URL || '';
const DIRECT_OPENSKY_BASE_URL = wsRelayUrl
    ? wsRelayUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/$/, '') + '/opensky'
    : '';
const isLocalhostRuntime = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
// Cache configuration — 2 min for Redis (web), 15 min for direct OpenSky (desktop)
const CACHE_TTL = isDesktopRuntime() ? 15 * 60 * 1000 : 2 * 60 * 1000;
let flightCache = null;
// Track flight history for trails
const flightHistory = new Map();
const HISTORY_MAX_POINTS = 20;
const HISTORY_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let historyCleanupIntervalId = null;
function upsertFlightHistory(historyKey, lat, lon) {
    let history = flightHistory.get(historyKey);
    const now = Date.now();
    if (!history) {
        history = { positions: [], lastUpdate: now };
        flightHistory.set(historyKey, history);
    }
    history.positions.push([lat, lon]);
    if (history.positions.length > HISTORY_MAX_POINTS) {
        history.positions.shift();
    }
    history.lastUpdate = now;
    return history.positions;
}
// Circuit breaker for API calls
const breaker = createCircuitBreaker({
    name: 'Military Flight Tracking',
    maxFailures: 3,
    cooldownMs: 5 * 60 * 1000, // 5 minute cooldown
    cacheTtlMs: 10 * 60 * 1000,
    persistCache: true,
    revivePersistedData: (data) => ({
        ...data,
        flights: data.flights.map((f) => ({
            ...f,
            lastSeen: f.lastSeen instanceof Date ? f.lastSeen : new Date(f.lastSeen),
        })),
    }),
});
async function fetchFromRedis() {
    const resp = await fetch(toApiUrl('/api/military-flights'), {
        headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
        throw new Error(`military-flights API ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.flights || data.flights.length === 0) {
        throw new Error('No flights returned — upstream may be down');
    }
    const now = new Date();
    return data.flights.map((f) => {
        const positions = upsertFlightHistory(f.hexCode.toLowerCase(), f.lat, f.lon);
        return {
            id: f.id,
            callsign: f.callsign,
            hexCode: f.hexCode,
            aircraftType: f.aircraftType,
            operator: f.operator,
            operatorCountry: f.operatorCountry,
            lat: f.lat,
            lon: f.lon,
            altitude: f.altitude,
            heading: f.heading,
            speed: f.speed,
            verticalRate: f.verticalRate,
            onGround: f.onGround,
            squawk: f.squawk,
            lastSeen: f.lastSeenMs ? new Date(f.lastSeenMs) : now,
            track: positions.length > 1 ? [...positions] : undefined,
            confidence: f.confidence,
            isInteresting: f.isInteresting,
            note: f.note,
        };
    });
}
function determineAircraftInfo(callsign, icao24, originCountry) {
    const csMatch = identifyByCallsign(callsign, originCountry);
    if (csMatch) {
        const countryMap = {
            usaf: 'USA', usn: 'USA', usmc: 'USA', usa: 'USA',
            raf: 'UK', rn: 'UK', faf: 'France', gaf: 'Germany',
            plaaf: 'China', plan: 'China', vks: 'Russia',
            iaf: 'Israel', nato: 'NATO', other: 'Unknown',
        };
        return { type: csMatch.aircraftType || 'unknown', operator: csMatch.operator, country: countryMap[csMatch.operator], confidence: 'high' };
    }
    const hexMatch = isKnownMilitaryHex(icao24);
    if (hexMatch)
        return { type: 'unknown', operator: hexMatch.operator, country: hexMatch.country, confidence: 'medium' };
    return { type: 'unknown', operator: 'other', country: 'Unknown', confidence: 'low' };
}
function isMilitaryFlight(state) {
    const callsign = (state[1] || '').trim();
    if (callsign && identifyByCallsign(callsign, state[2]))
        return true;
    if (isKnownMilitaryHex(state[0]))
        return true;
    return false;
}
function parseOpenSkyResponse(data) {
    if (!data.states)
        return [];
    const flights = [];
    const now = new Date();
    for (const state of data.states) {
        if (!isMilitaryFlight(state))
            continue;
        const icao24 = state[0];
        const callsign = (state[1] || '').trim();
        const lat = state[6];
        const lon = state[5];
        if (lat === null || lon === null)
            continue;
        const info = determineAircraftInfo(callsign, icao24, state[2]);
        const positions = upsertFlightHistory(icao24, lat, lon);
        const nearbyHotspot = getNearbyHotspot(lat, lon);
        const baroAlt = state[7];
        const velocity = state[9];
        const track = state[10];
        const vertRate = state[11];
        flights.push({
            id: `opensky-${icao24}`,
            callsign: callsign || `UNKN-${icao24.substring(0, 4).toUpperCase()}`,
            hexCode: icao24.toUpperCase(),
            aircraftType: info.type, operator: info.operator, operatorCountry: info.country,
            lat, lon,
            altitude: baroAlt != null ? Math.round(baroAlt * 3.28084) : 0,
            heading: track != null ? track : 0,
            speed: velocity != null ? Math.round(velocity * 1.94384) : 0,
            verticalRate: vertRate != null ? Math.round(vertRate * 196.85) : undefined,
            onGround: state[8], squawk: state[14] || undefined,
            lastSeen: now,
            track: positions.length > 1 ? [...positions] : undefined,
            confidence: info.confidence,
            isInteresting: nearbyHotspot?.priority === 'high' || info.type === 'bomber' || info.type === 'reconnaissance' || info.type === 'awacs',
            note: nearbyHotspot ? `Near ${nearbyHotspot.name}` : undefined,
        });
    }
    return flights;
}
async function fetchQueryRegion(region) {
    const query = `lamin=${region.lamin}&lamax=${region.lamax}&lomin=${region.lomin}&lomax=${region.lomax}`;
    const urls = [`${OPENSKY_PROXY_URL}?${query}`];
    if (isLocalhostRuntime && DIRECT_OPENSKY_BASE_URL)
        urls.push(`${DIRECT_OPENSKY_BASE_URL}?${query}`);
    try {
        for (const url of urls) {
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!response.ok)
                continue;
            const data = await response.json();
            return { name: region.name, flights: parseOpenSkyResponse(data), ok: true };
        }
        return { name: region.name, flights: [], ok: false };
    }
    catch {
        return { name: region.name, flights: [], ok: false };
    }
}
const STALE_MAX_AGE_MS = 10 * 60 * 1000;
const regionCache = new Map();
async function fetchFromOpenSky() {
    const allFlights = [];
    const seenHexCodes = new Set();
    let allFailed = true;
    const results = await Promise.all(MILITARY_QUERY_REGIONS.map(region => fetchQueryRegion(region)));
    for (const result of results) {
        let flights;
        if (result.ok) {
            allFailed = false;
            regionCache.set(result.name, { flights: result.flights, timestamp: Date.now() });
            flights = result.flights;
        }
        else {
            const stale = regionCache.get(result.name);
            if (stale && (Date.now() - stale.timestamp < STALE_MAX_AGE_MS)) {
                flights = stale.flights;
            }
            else {
                flights = [];
            }
        }
        for (const flight of flights) {
            if (!seenHexCodes.has(flight.hexCode)) {
                seenHexCodes.add(flight.hexCode);
                allFlights.push(flight);
            }
        }
    }
    if (allFailed && allFlights.length === 0)
        throw new Error('All regions failed — upstream may be down');
    return allFlights;
}
/**
 * Enrich flights with Wingbits aircraft details
 * Updates confidence and adds owner/operator info
 */
async function enrichFlightsWithWingbits(flights) {
    // Check if Wingbits is configured
    const isConfigured = await checkWingbitsStatus();
    if (!isConfigured) {
        return flights;
    }
    // Use deterministic ordering to improve cache locality across refreshes.
    const hexCodes = toUniqueSortedLowercase(flights.map((f) => f.hexCode));
    // Batch fetch aircraft details
    const detailsMap = await getAircraftDetailsBatch(hexCodes);
    if (detailsMap.size === 0) {
        return flights;
    }
    // Enrich each flight
    return flights.map(flight => {
        const details = detailsMap.get(flight.hexCode.toLowerCase());
        if (!details)
            return flight;
        const analysis = analyzeAircraftDetails(details);
        // Update flight with enrichment data
        const enrichedFlight = { ...flight };
        // Add enrichment info
        enrichedFlight.enriched = {
            manufacturer: analysis.manufacturer || undefined,
            owner: analysis.owner || undefined,
            operatorName: analysis.operator || undefined,
            typeCode: analysis.typecode || undefined,
            builtYear: analysis.builtYear || undefined,
            confirmedMilitary: analysis.isMilitary,
            militaryBranch: analysis.militaryBranch || undefined,
        };
        // Add registration if not already set
        if (!enrichedFlight.registration && analysis.registration) {
            enrichedFlight.registration = analysis.registration;
        }
        // Add model if available
        if (!enrichedFlight.aircraftModel && analysis.model) {
            enrichedFlight.aircraftModel = analysis.model;
        }
        // Use typecode to refine type if still unknown
        const wingbitsTypeCode = analysis.typecode || details.typecode;
        if (wingbitsTypeCode && enrichedFlight.aircraftType === 'unknown') {
            const typeMatch = identifyByAircraftType(wingbitsTypeCode);
            if (typeMatch) {
                enrichedFlight.aircraftType = typeMatch.type;
                if (enrichedFlight.confidence === 'low') {
                    enrichedFlight.confidence = 'medium';
                }
            }
        }
        // Upgrade confidence if Wingbits confirms military
        if (analysis.isMilitary) {
            if (analysis.confidence === 'confirmed') {
                enrichedFlight.confidence = 'high';
            }
            else if (analysis.confidence === 'likely' && enrichedFlight.confidence === 'low') {
                enrichedFlight.confidence = 'medium';
            }
            // Mark as interesting if confirmed military with known branch
            if (analysis.militaryBranch) {
                enrichedFlight.isInteresting = true;
                if (!enrichedFlight.note) {
                    enrichedFlight.note = `${analysis.militaryBranch}${analysis.owner ? ` - ${analysis.owner}` : ''}`;
                }
            }
        }
        return enrichedFlight;
    });
}
/**
 * Cluster nearby flights for map display
 */
function clusterFlights(flights) {
    const clusters = [];
    const processed = new Set();
    // Check each hotspot for clusters
    for (const hotspot of MILITARY_HOTSPOTS) {
        const nearbyFlights = flights.filter((f) => {
            if (processed.has(f.id))
                return false;
            const distance = Math.sqrt((f.lat - hotspot.lat) ** 2 + (f.lon - hotspot.lon) ** 2);
            return distance <= hotspot.radius;
        });
        if (nearbyFlights.length >= 2) {
            // Mark as processed
            nearbyFlights.forEach((f) => processed.add(f.id));
            // Calculate cluster center
            const avgLat = nearbyFlights.reduce((sum, f) => sum + f.lat, 0) / nearbyFlights.length;
            const avgLon = nearbyFlights.reduce((sum, f) => sum + f.lon, 0) / nearbyFlights.length;
            // Determine dominant operator
            const operatorCounts = new Map();
            for (const f of nearbyFlights) {
                operatorCounts.set(f.operator, (operatorCounts.get(f.operator) || 0) + 1);
            }
            let dominantOperator;
            let maxCount = 0;
            for (const [op, count] of operatorCounts) {
                if (count > maxCount) {
                    maxCount = count;
                    dominantOperator = op;
                }
            }
            // Determine activity type
            const hasTransport = nearbyFlights.some((f) => f.aircraftType === 'transport' || f.aircraftType === 'tanker');
            const hasFighters = nearbyFlights.some((f) => f.aircraftType === 'fighter');
            const hasRecon = nearbyFlights.some((f) => f.aircraftType === 'reconnaissance' || f.aircraftType === 'awacs');
            let activityType = 'unknown';
            if (hasFighters && hasRecon)
                activityType = 'exercise';
            else if (hasFighters || hasRecon)
                activityType = 'patrol';
            else if (hasTransport)
                activityType = 'transport';
            clusters.push({
                id: `cluster-${hotspot.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: hotspot.name,
                lat: avgLat,
                lon: avgLon,
                flightCount: nearbyFlights.length,
                flights: nearbyFlights,
                dominantOperator,
                activityType,
            });
        }
    }
    return clusters;
}
/**
 * Clean up old flight history entries
 */
function cleanupFlightHistory() {
    const cutoff = Date.now() - HISTORY_CLEANUP_INTERVAL;
    for (const [key, history] of flightHistory) {
        if (history.lastUpdate < cutoff) {
            flightHistory.delete(key);
        }
    }
}
// Set up periodic cleanup
if (typeof window !== 'undefined') {
    historyCleanupIntervalId = setInterval(cleanupFlightHistory, HISTORY_CLEANUP_INTERVAL);
}
/** Stop the periodic flight-history cleanup (for teardown / testing). */
export function stopFlightHistoryCleanup() {
    if (historyCleanupIntervalId) {
        clearInterval(historyCleanupIntervalId);
        historyCleanupIntervalId = null;
    }
}
/**
 * Main function to fetch military flights
 */
export async function fetchMilitaryFlights() {
    const desktop = isDesktopRuntime();
    if (desktop && !isFeatureAvailable('openskyRelay'))
        return { flights: [], clusters: [] };
    if (!desktop && !isFeatureAvailable('militaryFlights'))
        return { flights: [], clusters: [] };
    return breaker.execute(async () => {
        if (flightCache && Date.now() - flightCache.timestamp < CACHE_TTL) {
            const clusters = clusterFlights(flightCache.data);
            return { flights: flightCache.data, clusters };
        }
        let flights = desktop ? await fetchFromOpenSky() : await fetchFromRedis();
        if (flights.length === 0) {
            throw new Error('No flights returned — upstream may be down');
        }
        // Enrich with Wingbits aircraft details (owner, operator, type)
        flights = await enrichFlightsWithWingbits(flights);
        // Update cache
        flightCache = { data: flights, timestamp: Date.now() };
        // Generate clusters
        const clusters = clusterFlights(flights);
        return { flights, clusters };
    }, { flights: [], clusters: [] });
}
/**
 * Get status of military flights tracking
 */
export function getMilitaryFlightsStatus() {
    return breaker.getStatus();
}
/**
 * Get flight by hex code
 */
export function getFlightByHex(hexCode) {
    if (!flightCache)
        return undefined;
    return flightCache.data.find((f) => f.hexCode === hexCode.toUpperCase());
}
/**
 * Get flights by operator
 */
export function getFlightsByOperator(operator) {
    if (!flightCache)
        return [];
    return flightCache.data.filter((f) => f.operator === operator);
}
/**
 * Get interesting flights (near hotspots, special types)
 */
export function getInterestingFlights() {
    if (!flightCache)
        return [];
    return flightCache.data.filter((f) => f.isInteresting);
}
