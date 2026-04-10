import { ForecastServiceClient } from '@/generated/client/ivee/forecast/v1/service_client';
import { getRpcBaseUrl } from '@/services/rpc-client';
export { escapeHtml } from '@/utils/sanitize';
let _client = null;
function getClient() {
    if (!_client) {
        _client = new ForecastServiceClient(getRpcBaseUrl(), {
            fetch: (...args) => globalThis.fetch(...args),
        });
    }
    return _client;
}
export async function fetchForecasts(domain, region) {
    const resp = await getClient().getForecasts({ domain: domain || '', region: region || '' });
    return resp.forecasts || [];
}
export async function fetchSimulationOutcome() {
    const resp = await getClient().getSimulationOutcome({ runId: '' });
    return (resp.found && resp.theaterSummariesJson) ? resp.theaterSummariesJson : '';
}
