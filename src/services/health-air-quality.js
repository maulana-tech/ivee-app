import { getRpcBaseUrl } from '@/services/rpc-client';
import { HealthServiceClient, } from '@/generated/client/ivee/health/v1/service_client';
const client = new HealthServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const emptyAirQualityAlerts = { alerts: [], fetchedAt: 0 };
export async function fetchHealthAirQuality() {
    try {
        return await client.listAirQualityAlerts({});
    }
    catch {
        return emptyAirQualityAlerts;
    }
}
