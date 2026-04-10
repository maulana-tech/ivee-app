import { getRpcBaseUrl } from '@/services/rpc-client';
import { NATURAL_EVENT_CATEGORIES } from '@/types';
import { NaturalServiceClient, } from '@/generated/client/ivee/natural/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
const CATEGORY_ICONS = {
    severeStorms: '🌀',
    wildfires: '🔥',
    volcanoes: '🌋',
    earthquakes: '🔴',
    floods: '🌊',
    landslides: '⛰️',
    drought: '☀️',
    dustHaze: '🌫️',
    snow: '❄️',
    tempExtremes: '🌡️',
    seaLakeIce: '🧊',
    waterColor: '🦠',
    manmade: '⚠️',
};
export function getNaturalEventIcon(category) {
    return CATEGORY_ICONS[category] || '⚠️';
}
function normalizeNaturalCategory(category) {
    if (!category)
        return 'manmade';
    return NATURAL_EVENT_CATEGORIES.has(category)
        ? category
        : 'manmade';
}
const client = new NaturalServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({ name: 'NaturalEvents', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const emptyFallback = { events: [] };
function toNaturalEvent(e) {
    return {
        id: e.id,
        title: e.title,
        description: e.description || undefined,
        category: normalizeNaturalCategory(e.category),
        categoryTitle: e.categoryTitle,
        lat: e.lat,
        lon: e.lon,
        date: new Date(e.date),
        magnitude: e.magnitude ?? undefined,
        magnitudeUnit: e.magnitudeUnit ?? undefined,
        sourceUrl: e.sourceUrl || undefined,
        sourceName: e.sourceName || undefined,
        closed: e.closed,
        stormId: e.stormId || undefined,
        stormName: e.stormName || undefined,
        basin: e.basin || undefined,
        stormCategory: e.stormCategory ?? undefined,
        classification: e.classification || undefined,
        windKt: e.windKt ?? undefined,
        pressureMb: e.pressureMb ?? undefined,
        movementDir: e.movementDir ?? undefined,
        movementSpeedKt: e.movementSpeedKt ?? undefined,
        forecastTrack: e.forecastTrack?.length ? e.forecastTrack : undefined,
        conePolygon: e.conePolygon?.length
            ? e.conePolygon.map(ring => ring.points.map(p => [p.lon, p.lat]))
            : undefined,
        pastTrack: e.pastTrack?.length ? e.pastTrack : undefined,
    };
}
export async function fetchNaturalEvents(_days = 30) {
    const hydrated = getHydratedData('naturalEvents');
    const response = (hydrated?.events?.length ? hydrated : null) ?? await breaker.execute(async () => {
        return client.listNaturalEvents({ days: 30 });
    }, emptyFallback, { shouldCache: (r) => r.events.length > 0 });
    return (response.events || []).map(toNaturalEvent);
}
