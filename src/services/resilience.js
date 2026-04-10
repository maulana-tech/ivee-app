import { ResilienceServiceClient, } from '@/generated/client/ivee/resilience/v1/service_client';
import { getRpcBaseUrl } from '@/services/rpc-client';
let _client = null;
function getClient() {
    if (!_client) {
        _client = new ResilienceServiceClient(getRpcBaseUrl(), {
            fetch: (...args) => globalThis.fetch(...args),
        });
    }
    return _client;
}
function normalizeCountryCode(countryCode) {
    const normalized = countryCode.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}
export async function getResilienceScore(countryCode) {
    return getClient().getResilienceScore({
        countryCode: normalizeCountryCode(countryCode),
    });
}
export async function getResilienceRanking() {
    return getClient().getResilienceRanking({});
}
