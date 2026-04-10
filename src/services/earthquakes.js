import { getRpcBaseUrl } from '@/services/rpc-client';
import { SeismologyServiceClient, } from '@/generated/client/ivee/seismology/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
const client = new SeismologyServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({ name: 'Seismology', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const emptyFallback = { earthquakes: [] };
export async function fetchEarthquakes() {
    const hydrated = getHydratedData('earthquakes');
    if (hydrated?.earthquakes?.length)
        return hydrated.earthquakes;
    const response = await breaker.execute(async () => {
        return client.listEarthquakes({ minMagnitude: 0, start: 0, end: 0, pageSize: 0, cursor: '' });
    }, emptyFallback, { shouldCache: (r) => r.earthquakes.length > 0 });
    return response.earthquakes;
}
