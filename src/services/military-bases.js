import { getRpcBaseUrl } from '@/services/rpc-client';
import { MilitaryServiceClient, } from '@/generated/client/ivee/military/v1/service_client';
const client = new MilitaryServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const quantize = (v, step) => Math.round(v / step) * step;
function getBboxGridStep(zoom) {
    if (zoom < 5)
        return 5;
    if (zoom <= 7)
        return 1;
    return 0.5;
}
function quantizeBbox(swLat, swLon, neLat, neLon, zoom) {
    const step = getBboxGridStep(zoom);
    return [quantize(swLat, step), quantize(swLon, step), quantize(neLat, step), quantize(neLon, step)].join(':');
}
function entryToEnriched(e) {
    return {
        id: e.id,
        name: e.name,
        lat: e.latitude,
        lon: e.longitude,
        type: (e.type || 'other'),
        country: e.countryIso2,
        arm: e.branch,
        status: (e.status || undefined),
        kind: e.kind,
        tier: e.tier,
        catAirforce: e.catAirforce,
        catNaval: e.catNaval,
        catNuclear: e.catNuclear,
        catSpace: e.catSpace,
        catTraining: e.catTraining,
    };
}
let lastResult = null;
let pendingFetch = null;
export async function fetchMilitaryBases(swLat, swLon, neLat, neLon, zoom, filters) {
    const qBbox = quantizeBbox(swLat, swLon, neLat, neLon, zoom);
    const floorZoom = Math.floor(zoom);
    const cacheKey = `${qBbox}:${floorZoom}:${filters?.type || ''}:${filters?.kind || ''}:${filters?.country || ''}`;
    if (lastResult && lastResult.cacheKey === cacheKey) {
        return lastResult;
    }
    if (pendingFetch)
        return pendingFetch;
    pendingFetch = (async () => {
        try {
            const resp = await client.listMilitaryBases({
                swLat, swLon, neLat, neLon,
                zoom: floorZoom,
                type: filters?.type || '',
                kind: filters?.kind || '',
                country: filters?.country || '',
            });
            const bases = resp.bases.map(entryToEnriched);
            const result = {
                bases,
                clusters: resp.clusters,
                totalInView: resp.totalInView,
                truncated: resp.truncated,
                cacheKey,
            };
            lastResult = result;
            return result;
        }
        catch (err) {
            console.error('[bases-svc] error', err);
            return lastResult;
        }
        finally {
            pendingFetch = null;
        }
    })();
    return pendingFetch;
}
