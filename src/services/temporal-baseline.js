import { InfrastructureServiceClient } from '@/generated/client/ivee/infrastructure/v1/service_client';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { getHydratedData } from '@/services/bootstrap';
const client = new InfrastructureServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const TYPE_LABELS = {
    military_flights: 'Military flights',
    vessels: 'Naval vessels',
    protests: 'Protests',
    news: 'News velocity',
    ais_gaps: 'Dark ship activity',
    satellite_fires: 'Satellite fire detections',
};
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const SERVER_TYPES = new Set(['news', 'satellite_fires']);
function formatAnomalyMessage(type, _region, count, mean, multiplier) {
    const now = new Date();
    const weekday = WEEKDAY_NAMES[now.getUTCDay()];
    const month = MONTH_NAMES[now.getUTCMonth() + 1];
    const mult = multiplier < 10 ? `${multiplier.toFixed(1)}x` : `${Math.round(multiplier)}x`;
    return `${TYPE_LABELS[type]} ${mult} normal for ${weekday} (${month}) — ${count} vs baseline ${Math.round(mean)}`;
}
function getSeverity(zScore) {
    if (zScore >= 3.0)
        return 'critical';
    if (zScore >= 2.0)
        return 'high';
    return 'medium';
}
function mapServerAnomaly(a) {
    return {
        type: a.type,
        region: a.region,
        currentCount: a.currentCount,
        expectedCount: a.expectedCount,
        zScore: a.zScore,
        severity: getSeverity(a.zScore),
        message: a.message,
    };
}
export function consumeServerAnomalies() {
    const raw = getHydratedData('temporalAnomalies');
    if (!raw?.anomalies)
        return { anomalies: [], trackedTypes: [] };
    return {
        anomalies: raw.anomalies.map(mapServerAnomaly),
        trackedTypes: raw.trackedTypes ?? [],
    };
}
export async function fetchLiveAnomalies() {
    try {
        const resp = await client.listTemporalAnomalies({});
        return {
            anomalies: (resp.anomalies ?? []).map(mapServerAnomaly),
            trackedTypes: resp.trackedTypes ?? [],
        };
    }
    catch (e) {
        console.warn('[TemporalBaseline] Live fetch failed:', e);
        return { anomalies: [], trackedTypes: [] };
    }
}
// Client-side baseline for types NOT handled server-side (military_flights, vessels, ais_gaps)
async function reportMetrics(updates) {
    try {
        await client.recordBaselineSnapshot({ updates });
    }
    catch (e) {
        console.warn('[TemporalBaseline] Update failed:', e);
    }
}
async function checkAnomaly(type, region, count) {
    try {
        const data = await client.getTemporalBaseline({ type, region, count });
        if (!data.anomaly)
            return null;
        return {
            type,
            region,
            currentCount: count,
            expectedCount: Math.round(data.baseline?.mean ?? 0),
            zScore: data.anomaly.zScore,
            severity: getSeverity(data.anomaly.zScore),
            message: formatAnomalyMessage(type, region, count, data.baseline?.mean ?? 0, data.anomaly.multiplier),
        };
    }
    catch (e) {
        console.warn('[TemporalBaseline] Check failed:', e);
        return null;
    }
}
export async function updateAndCheck(metrics) {
    const clientOnly = metrics.filter(m => !SERVER_TYPES.has(m.type));
    if (clientOnly.length === 0)
        return [];
    reportMetrics(clientOnly).catch(() => { });
    const results = await Promise.allSettled(clientOnly.map(m => checkAnomaly(m.type, m.region, m.count)));
    return results
        .filter((r) => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((a) => a !== null)
        .sort((a, b) => b.zScore - a.zScore);
}
