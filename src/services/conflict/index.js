import { getRpcBaseUrl } from '@/services/rpc-client';
import { ConflictServiceClient, ApiError, } from '@/generated/client/ivee/conflict/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { toApiUrl } from '@/services/runtime';
// ---- Client + Circuit Breakers (per-RPC; HAPI uses per-country map) ----
const client = new ConflictServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const acledBreaker = createCircuitBreaker({ name: 'ACLED Conflicts', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const ucdpBreaker = createCircuitBreaker({ name: 'UCDP Events', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const hapiBreakers = new Map();
function getHapiBreaker(iso2) {
    if (!hapiBreakers.has(iso2)) {
        hapiBreakers.set(iso2, createCircuitBreaker({
            name: `HDX HAPI:${iso2}`,
            cacheTtlMs: 10 * 60 * 1000,
            persistCache: true,
        }));
    }
    return hapiBreakers.get(iso2);
}
const iranBreaker = createCircuitBreaker({ name: 'Iran Events', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const emptyIranFallback = { events: [], scrapedAt: '0' };
// ---- Adapter 1: Proto AcledConflictEvent -> legacy ConflictEvent ----
function mapProtoEventType(eventType) {
    const lower = eventType.toLowerCase();
    if (lower.includes('battle'))
        return 'battle';
    if (lower.includes('explosion'))
        return 'explosion';
    if (lower.includes('remote violence'))
        return 'remote_violence';
    if (lower.includes('violence against'))
        return 'violence_against_civilians';
    return 'battle';
}
function toConflictEvent(proto) {
    return {
        id: proto.id,
        eventType: mapProtoEventType(proto.eventType),
        subEventType: '',
        country: proto.country,
        region: proto.admin1 || undefined,
        location: '',
        lat: proto.location?.latitude ?? 0,
        lon: proto.location?.longitude ?? 0,
        time: new Date(proto.occurredAt),
        fatalities: proto.fatalities,
        actors: proto.actors,
        source: proto.source,
    };
}
// ---- Adapter 2: Proto UcdpViolenceEvent -> legacy UcdpGeoEvent ----
const VIOLENCE_TYPE_REVERSE = {
    UCDP_VIOLENCE_TYPE_STATE_BASED: 'state-based',
    UCDP_VIOLENCE_TYPE_NON_STATE: 'non-state',
    UCDP_VIOLENCE_TYPE_ONE_SIDED: 'one-sided',
};
function toUcdpGeoEvent(proto) {
    return {
        id: proto.id,
        date_start: proto.dateStart ? new Date(proto.dateStart).toISOString().substring(0, 10) : '',
        date_end: proto.dateEnd ? new Date(proto.dateEnd).toISOString().substring(0, 10) : '',
        latitude: proto.location?.latitude ?? 0,
        longitude: proto.location?.longitude ?? 0,
        country: proto.country,
        side_a: proto.sideA,
        side_b: proto.sideB,
        deaths_best: proto.deathsBest,
        deaths_low: proto.deathsLow,
        deaths_high: proto.deathsHigh,
        type_of_violence: VIOLENCE_TYPE_REVERSE[proto.violenceType] || 'state-based',
        source_original: proto.sourceOriginal,
    };
}
// ---- Adapter 3: Proto HumanitarianCountrySummary -> legacy HapiConflictSummary ----
const HAPI_COUNTRY_CODES = [
    'US', 'RU', 'CN', 'UA', 'IR', 'IL', 'TW', 'KP', 'SA', 'TR',
    'PL', 'DE', 'FR', 'GB', 'IN', 'PK', 'SY', 'YE', 'MM', 'VE',
];
function toHapiSummary(proto) {
    // Proto fields now accurately represent HAPI conflict event data (MEDIUM-1 fix)
    return {
        iso2: proto.countryCode || '',
        locationName: proto.countryName,
        month: proto.referencePeriod || '',
        eventsTotal: proto.conflictEventsTotal || 0,
        eventsPoliticalViolence: proto.conflictPoliticalViolenceEvents || 0,
        eventsCivilianTargeting: 0, // Included in conflictPoliticalViolenceEvents
        eventsDemonstrations: proto.conflictDemonstrations || 0,
        fatalitiesTotalPoliticalViolence: proto.conflictFatalities || 0,
        fatalitiesTotalCivilianTargeting: 0, // Included in conflictFatalities
    };
}
// ---- UCDP classification derivation heuristic ----
function deriveUcdpClassifications(events) {
    const byCountry = new Map();
    for (const e of events) {
        const country = e.country;
        if (!byCountry.has(country))
            byCountry.set(country, []);
        byCountry.get(country).push(e);
    }
    const now = Date.now();
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    const result = new Map();
    for (const [country, countryEvents] of byCountry) {
        // Filter to trailing 2-year window
        const recentEvents = countryEvents.filter(e => (now - e.dateStart) < twoYearsMs);
        const totalDeaths = recentEvents.reduce((sum, e) => sum + e.deathsBest, 0);
        const eventCount = recentEvents.length;
        let intensity;
        if (totalDeaths > 1000 || eventCount > 100) {
            intensity = 'war';
        }
        else if (eventCount > 10) {
            intensity = 'minor';
        }
        else {
            intensity = 'none';
        }
        // Find the highest-death event for sideA/sideB
        let maxDeathEvent;
        for (const e of recentEvents) {
            if (!maxDeathEvent || e.deathsBest > maxDeathEvent.deathsBest) {
                maxDeathEvent = e;
            }
        }
        // Most recent event year
        const mostRecentEvent = recentEvents.reduce((latest, e) => (!latest || e.dateStart > latest.dateStart) ? e : latest, undefined);
        const year = mostRecentEvent ? new Date(mostRecentEvent.dateStart).getFullYear() : new Date().getFullYear();
        result.set(country, {
            location: country,
            intensity,
            year,
            sideA: maxDeathEvent?.sideA,
            sideB: maxDeathEvent?.sideB,
        });
    }
    return result;
}
// ---- Haversine helper (ported exactly from legacy ucdp-events.ts) ----
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ---- Empty fallbacks ----
const emptyAcledFallback = { events: [], pagination: undefined };
const emptyUcdpFallback = { events: [], pagination: undefined };
const emptyHapiFallback = { summary: undefined };
const emptyHapiBatchFallback = { results: {}, fetched: 0, requested: 0 };
const hapiBatchBreaker = createCircuitBreaker({ name: 'HDX HAPI Batch', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
// ---- Exported Functions ----
export async function fetchConflictEvents() {
    const resp = await acledBreaker.execute(async () => {
        return client.listAcledEvents({ country: '', start: 0, end: 0, pageSize: 0, cursor: '' });
    }, emptyAcledFallback, { shouldCache: (r) => r.events.length > 0 });
    const events = resp.events.map(toConflictEvent);
    const byCountry = new Map();
    let totalFatalities = 0;
    for (const event of events) {
        totalFatalities += event.fatalities;
        const existing = byCountry.get(event.country) || [];
        existing.push(event);
        byCountry.set(event.country, existing);
    }
    return {
        events,
        byCountry,
        totalFatalities,
        count: events.length,
    };
}
export async function fetchUcdpClassifications(hydrated) {
    if (hydrated?.events?.length)
        return deriveUcdpClassifications(hydrated.events);
    const resp = await ucdpBreaker.execute(async () => {
        return client.listUcdpEvents({ country: '', start: 0, end: 0, pageSize: 0, cursor: '' });
    }, emptyUcdpFallback, { shouldCache: (r) => r.events.length > 0 });
    return deriveUcdpClassifications(resp.events);
}
export async function fetchHapiSummary() {
    const byCode = new Map();
    const resp = await hapiBatchBreaker.execute(async () => {
        try {
            return await client.getHumanitarianSummaryBatch({ countryCodes: [...HAPI_COUNTRY_CODES] }, { signal: AbortSignal.timeout(60000) });
        }
        catch (err) {
            // 404 deploy-skew fallback: batch endpoint not yet deployed, use per-item calls
            if (err instanceof ApiError && err.statusCode === 404) {
                const HAPI_CONCURRENT = 5;
                const allFallback = [];
                for (let i = 0; i < HAPI_COUNTRY_CODES.length; i += HAPI_CONCURRENT) {
                    const batch = HAPI_COUNTRY_CODES.slice(i, i + HAPI_CONCURRENT);
                    const results = await Promise.allSettled(batch.map(async (iso2) => {
                        const r = await getHapiBreaker(iso2).execute(async () => {
                            return client.getHumanitarianSummary({ countryCode: iso2 });
                        }, emptyHapiFallback);
                        return { iso2, r };
                    }));
                    for (const result of results) {
                        if (result.status === 'fulfilled')
                            allFallback.push(result.value);
                    }
                }
                const fallbackResults = {};
                for (const { iso2, r } of allFallback) {
                    if (r.summary)
                        fallbackResults[iso2] = r.summary;
                }
                return { results: fallbackResults, fetched: Object.keys(fallbackResults).length, requested: HAPI_COUNTRY_CODES.length };
            }
            throw err;
        }
    }, emptyHapiBatchFallback, { shouldCache: (r) => r.fetched > 0 });
    for (const [cc, summary] of Object.entries(resp.results)) {
        byCode.set(cc, toHapiSummary(summary));
    }
    return byCode;
}
export async function fetchUcdpEvents(hydrated) {
    if (hydrated?.events?.length) {
        const events = hydrated.events.map(toUcdpGeoEvent);
        return { success: true, count: events.length, data: events, cached_at: '' };
    }
    const resp = await ucdpBreaker.execute(async () => {
        return client.listUcdpEvents({ country: '', start: 0, end: 0, pageSize: 0, cursor: '' });
    }, emptyUcdpFallback, { shouldCache: (r) => r.events.length > 0 });
    const events = resp.events.map(toUcdpGeoEvent);
    return {
        success: events.length > 0,
        count: events.length,
        data: events,
        cached_at: '',
    };
}
export function deduplicateAgainstAcled(ucdpEvents, acledEvents) {
    if (!acledEvents.length)
        return ucdpEvents;
    return ucdpEvents.filter(ucdp => {
        const uLat = ucdp.latitude;
        const uLon = ucdp.longitude;
        const uDate = new Date(ucdp.date_start).getTime();
        const uDeaths = ucdp.deaths_best;
        for (const acled of acledEvents) {
            const aLat = Number(acled.latitude);
            const aLon = Number(acled.longitude);
            const aDate = new Date(acled.event_date).getTime();
            const aDeaths = Number(acled.fatalities) || 0;
            const dayDiff = Math.abs(uDate - aDate) / (1000 * 60 * 60 * 24);
            if (dayDiff > 7)
                continue;
            const dist = haversineKm(uLat, uLon, aLat, aLon);
            if (dist > 50)
                continue;
            if (uDeaths === 0 && aDeaths === 0)
                return false;
            if (uDeaths > 0 && aDeaths > 0) {
                const ratio = uDeaths / aDeaths;
                if (ratio >= 0.5 && ratio <= 2.0)
                    return false;
            }
        }
        return true;
    });
}
export function groupByCountry(events) {
    const map = new Map();
    for (const e of events) {
        const country = e.country || 'Unknown';
        if (!map.has(country))
            map.set(country, []);
        map.get(country).push(e);
    }
    return map;
}
export function groupByType(events) {
    return {
        'state-based': events.filter(e => e.type_of_violence === 'state-based'),
        'non-state': events.filter(e => e.type_of_violence === 'non-state'),
        'one-sided': events.filter(e => e.type_of_violence === 'one-sided'),
    };
}
const IRAN_RED_CATEGORIES = new Set(['military', 'airstrike', 'defense']);
const IRAN_ORANGE_CATEGORIES = new Set(['political', 'international']);
function iranColorTier(ev) {
    if (ev.severity === 'critical' || IRAN_RED_CATEGORIES.has(ev.category))
        return 'red';
    if (IRAN_ORANGE_CATEGORIES.has(ev.category))
        return 'orange';
    return 'yellow';
}
const IRAN_RGBA = {
    red: [255, 50, 50, 220], orange: [255, 165, 0, 200], yellow: [255, 255, 0, 180],
};
const IRAN_CSS = {
    red: 'rgba(255,50,50,0.85)', orange: 'rgba(255,165,0,0.8)', yellow: 'rgba(255,255,0,0.7)',
};
export function getIranEventColor(ev) {
    return IRAN_RGBA[iranColorTier(ev)];
}
export function getIranEventCssColor(ev) {
    return IRAN_CSS[iranColorTier(ev)];
}
export function getIranEventHexColor(ev) {
    if (ev.severity === 'high' || ev.severity === 'critical')
        return '#ff3030';
    if (ev.severity === 'elevated')
        return '#ff8800';
    return '#ffcc00';
}
export function getIranEventRadius(severity) {
    if (severity === 'high' || severity === 'critical')
        return 20000;
    if (severity === 'elevated')
        return 15000;
    return 10000;
}
export function getIranEventSize(severity) {
    if (severity === 'high' || severity === 'critical')
        return 14;
    if (severity === 'elevated')
        return 11;
    return 8;
}
export async function fetchIranEvents() {
    const hydrated = getHydratedData('iranEvents');
    if (hydrated?.events?.length)
        return hydrated.events;
    const resp = await iranBreaker.execute(async () => {
        const cacheBust = Math.floor(Date.now() / 120000);
        const r = await globalThis.fetch(toApiUrl(`/api/conflict/v1/list-iran-events?_v=${cacheBust}`));
        if (!r.ok)
            throw new Error(`HTTP ${r.status}`);
        return r.json();
    }, emptyIranFallback);
    return resp.events;
}
