import { getRpcBaseUrl } from '@/services/rpc-client';
import { ClimateServiceClient, } from '@/generated/client/ivee/climate/v1/service_client';
const client = new ClimateServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const emptyClimateAirQuality = { stations: [], fetchedAt: 0 };
export async function fetchClimateAirQuality() {
    try {
        return await client.listAirQualityData({});
    }
    catch {
        return emptyClimateAirQuality;
    }
}
