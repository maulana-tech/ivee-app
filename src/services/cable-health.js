import { getRpcBaseUrl } from '@/services/rpc-client';
import { InfrastructureServiceClient, } from '@/generated/client/ivee/infrastructure/v1/service_client';
import { createCircuitBreaker } from '@/utils';
const client = new InfrastructureServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({ name: 'Cable Health', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const emptyFallback = { generatedAt: 0, cables: {} };
// ---- Proto enum -> frontend string adapter ----
const STATUS_REVERSE = {
    CABLE_HEALTH_STATUS_FAULT: 'fault',
    CABLE_HEALTH_STATUS_DEGRADED: 'degraded',
    CABLE_HEALTH_STATUS_OK: 'ok',
    CABLE_HEALTH_STATUS_UNSPECIFIED: 'unknown',
};
function toRecord(proto) {
    return {
        status: STATUS_REVERSE[proto.status] || 'unknown',
        score: proto.score,
        confidence: proto.confidence,
        lastUpdated: proto.lastUpdated ? new Date(proto.lastUpdated).toISOString() : new Date().toISOString(),
        evidence: proto.evidence.map((e) => ({
            source: e.source,
            summary: e.summary,
            ts: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
        })),
    };
}
// ---- Local cache (1 minute) ----
let cachedResponse = null;
let cacheExpiry = 0;
const LOCAL_CACHE_MS = 60000;
// ---- Public API ----
export async function fetchCableHealth() {
    const now = Date.now();
    if (cachedResponse && now < cacheExpiry)
        return cachedResponse;
    const resp = await breaker.execute(async () => {
        return client.getCableHealth({});
    }, emptyFallback, { shouldCache: (r) => Object.keys(r.cables).length > 0 });
    const cables = {};
    for (const [id, proto] of Object.entries(resp.cables)) {
        cables[id] = toRecord(proto);
    }
    const result = {
        generatedAt: resp.generatedAt ? new Date(resp.generatedAt).toISOString() : new Date().toISOString(),
        cables,
    };
    cachedResponse = result;
    cacheExpiry = now + LOCAL_CACHE_MS;
    return result;
}
export function getCableHealthRecord(cableId) {
    return cachedResponse?.cables[cableId];
}
export function getCableHealthMap() {
    return cachedResponse?.cables ?? {};
}
