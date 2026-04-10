import { createCircuitBreaker, getCSSColor } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { toApiUrl } from '@/services/runtime';
const breaker = createCircuitBreaker({ name: 'NWS Weather', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
function mapAlert(a) {
    return {
        id: a.id,
        event: a.event,
        severity: a.severity,
        headline: a.headline,
        description: a.description,
        areaDesc: a.areaDesc,
        onset: new Date(a.onset),
        expires: new Date(a.expires),
        coordinates: a.coordinates,
        centroid: a.centroid,
    };
}
export async function fetchWeatherAlerts() {
    return breaker.execute(async () => {
        const hydrated = getHydratedData('weatherAlerts');
        if (hydrated?.alerts?.length) {
            return hydrated.alerts.map(mapAlert);
        }
        const resp = await fetch(toApiUrl('/api/bootstrap?keys=weatherAlerts'), { signal: AbortSignal.timeout(8000) });
        if (!resp.ok)
            throw new Error(`Bootstrap fetch failed: ${resp.status}`);
        const json = await resp.json();
        const alerts = json.data?.weatherAlerts?.alerts;
        if (alerts?.length)
            return alerts.map(mapAlert);
        throw new Error('No weather data in bootstrap');
    }, []);
}
export function getWeatherStatus() {
    return breaker.getStatus();
}
export function getSeverityColor(severity) {
    switch (severity) {
        case 'Extreme': return getCSSColor('--semantic-critical');
        case 'Severe': return getCSSColor('--semantic-high');
        case 'Moderate': return getCSSColor('--semantic-elevated');
        case 'Minor': return getCSSColor('--semantic-elevated');
        default: return getCSSColor('--text-dim');
    }
}
