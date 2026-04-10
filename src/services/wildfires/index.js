import { getRpcBaseUrl } from '@/services/rpc-client';
import { WildfireServiceClient, } from '@/generated/client/ivee/wildfire/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
// -- Client --
const client = new WildfireServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({ name: 'Wildfires', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const emptyFallback = { fireDetections: [] };
// -- Public API --
export async function fetchAllFires(_days) {
    const hydrated = getHydratedData('wildfires');
    const response = (hydrated?.fireDetections?.length ? hydrated : null) ?? await breaker.execute(async () => {
        return client.listFireDetections({ start: 0, end: 0, pageSize: 0, cursor: '', neLat: 0, neLon: 0, swLat: 0, swLon: 0 });
    }, emptyFallback);
    const detections = response.fireDetections;
    if (detections.length === 0) {
        return { regions: {}, totalCount: 0, skipped: true, reason: 'no_data' };
    }
    const regions = {};
    for (const d of detections) {
        const r = d.region || 'Unknown';
        (regions[r] ?? (regions[r] = [])).push(d);
    }
    return { regions, totalCount: detections.length };
}
export function computeRegionStats(regions) {
    const stats = [];
    for (const [region, fires] of Object.entries(regions)) {
        const highIntensity = fires.filter(f => f.brightness > 360 && f.confidence === 'FIRE_CONFIDENCE_HIGH');
        const possibleExplosions = fires.filter(f => f.possibleExplosion);
        stats.push({
            region,
            fires,
            fireCount: fires.length,
            totalFrp: fires.reduce((sum, f) => sum + (f.frp || 0), 0),
            highIntensityCount: highIntensity.length,
            possibleExplosionCount: possibleExplosions.length,
        });
    }
    return stats.sort((a, b) => b.fireCount - a.fireCount);
}
export function flattenFires(regions) {
    const all = [];
    for (const fires of Object.values(regions)) {
        for (const f of fires) {
            all.push(f);
        }
    }
    return all;
}
export function toMapFires(fires) {
    return fires.map(f => ({
        lat: f.location?.latitude ?? 0,
        lon: f.location?.longitude ?? 0,
        brightness: f.brightness,
        frp: f.frp,
        confidence: confidenceToNumber(f.confidence),
        region: f.region,
        acq_date: new Date(f.detectedAt).toISOString().slice(0, 10),
        daynight: f.dayNight,
    }));
}
function confidenceToNumber(c) {
    switch (c) {
        case 'FIRE_CONFIDENCE_HIGH': return 95;
        case 'FIRE_CONFIDENCE_NOMINAL': return 50;
        case 'FIRE_CONFIDENCE_LOW': return 20;
        default: return 0;
    }
}
