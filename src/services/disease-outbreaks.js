import { getRpcBaseUrl } from '@/services/rpc-client';
import { HealthServiceClient, } from '@/generated/client/ivee/health/v1/service_client';
import { getHydratedData } from '@/services/bootstrap';
const client = new HealthServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const emptyOutbreaks = { outbreaks: [], fetchedAt: 0 };
export async function fetchDiseaseOutbreaks() {
    const hydrated = getHydratedData('diseaseOutbreaks');
    if (hydrated?.outbreaks?.length)
        return hydrated;
    try {
        return await client.listDiseaseOutbreaks({});
    }
    catch {
        return emptyOutbreaks;
    }
}
