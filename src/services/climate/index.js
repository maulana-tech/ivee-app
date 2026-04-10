import { getRpcBaseUrl } from '@/services/rpc-client';
import { ClimateServiceClient, } from '@/generated/client/ivee/climate/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { normalizeHydratedOceanIce, toDisplayOceanIceData, } from './ocean-ice';
const client = new ClimateServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({ name: 'Climate Anomalies', cacheTtlMs: 20 * 60 * 1000, persistCache: true });
const co2Breaker = createCircuitBreaker({ name: 'CO2 Monitoring', cacheTtlMs: 6 * 60 * 60 * 1000, persistCache: true });
const oceanIceBreaker = createCircuitBreaker({ name: 'Ocean Ice', cacheTtlMs: 26 * 60 * 60 * 1000, persistCache: true });
const emptyClimateFallback = { anomalies: [] };
const emptyCo2Fallback = {};
const emptyOceanIceFallback = {};
export async function fetchClimateAnomalies() {
    const hydrated = getHydratedData('climateAnomalies');
    if (hydrated && (hydrated.anomalies ?? []).length > 0) {
        const anomalies = hydrated.anomalies.map(toDisplayAnomaly).filter(a => a.severity !== 'normal');
        if (anomalies.length > 0)
            return { ok: true, anomalies };
    }
    const response = await breaker.execute(async () => {
        return client.listClimateAnomalies({ minSeverity: 'ANOMALY_SEVERITY_UNSPECIFIED', pageSize: 0, cursor: '' });
    }, emptyClimateFallback, { shouldCache: (r) => r.anomalies.length > 0 });
    const anomalies = (response.anomalies ?? [])
        .map(toDisplayAnomaly)
        .filter(a => a.severity !== 'normal');
    return { ok: true, anomalies };
}
export async function fetchCo2Monitoring() {
    const hydrated = getHydratedData('co2Monitoring');
    if (hydrated?.monitoring) {
        return toDisplayCo2Monitoring(hydrated.monitoring);
    }
    const response = await co2Breaker.execute(async () => {
        return client.getCo2Monitoring({});
    }, emptyCo2Fallback, { shouldCache: (result) => Boolean(result.monitoring?.currentPpm) });
    return response.monitoring ? toDisplayCo2Monitoring(response.monitoring) : null;
}
export function getHydratedClimateDisasters() {
    return getHydratedData('climateDisasters');
}
export async function fetchOceanIceData() {
    const hydrated = getHydratedData('oceanIce');
    const hydratedProto = normalizeHydratedOceanIce(hydrated);
    if (hydratedProto) {
        return toDisplayOceanIceData(hydratedProto);
    }
    const response = await oceanIceBreaker.execute(async () => {
        return client.getOceanIceData({});
    }, emptyOceanIceFallback, { shouldCache: (result) => Boolean(result.data) });
    return response.data ? toDisplayOceanIceData(response.data) : null;
}
// Presentation helpers (used by ClimateAnomalyPanel)
export function getSeverityIcon(anomaly) {
    switch (anomaly.type) {
        case 'warm': return '\u{1F321}\u{FE0F}'; // thermometer
        case 'cold': return '\u{2744}\u{FE0F}'; // snowflake
        case 'wet': return '\u{1F327}\u{FE0F}'; // rain
        case 'dry': return '\u{2600}\u{FE0F}'; // sun
        case 'mixed': return '\u{26A1}'; // lightning
        default: return '\u{1F321}\u{FE0F}'; // thermometer
    }
}
export function formatDelta(value, unit) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}${unit}`;
}
// Internal: Map proto ClimateAnomaly -> consumer-friendly shape
function toDisplayAnomaly(proto) {
    return {
        zone: proto.zone,
        lat: proto.location?.latitude ?? 0,
        lon: proto.location?.longitude ?? 0,
        tempDelta: proto.tempDelta,
        precipDelta: proto.precipDelta,
        severity: mapSeverity(proto.severity),
        type: mapType(proto.type),
        period: proto.period,
    };
}
function toDisplayCo2Monitoring(proto) {
    const measuredAt = Number(proto.measuredAt);
    return {
        currentPpm: proto.currentPpm,
        yearAgoPpm: proto.yearAgoPpm,
        annualGrowthRate: proto.annualGrowthRate,
        preIndustrialBaseline: proto.preIndustrialBaseline,
        monthlyAverage: proto.monthlyAverage,
        trend12m: (proto.trend12m ?? []).map(toDisplayCo2Point),
        methanePpb: proto.methanePpb,
        nitrousOxidePpb: proto.nitrousOxidePpb,
        measuredAt: Number.isFinite(measuredAt) && measuredAt > 0 ? new Date(measuredAt) : undefined,
        station: proto.station,
    };
}
function toDisplayCo2Point(proto) {
    return {
        month: proto.month,
        ppm: proto.ppm,
        anomaly: proto.anomaly,
    };
}
function mapSeverity(s) {
    switch (s) {
        case 'ANOMALY_SEVERITY_EXTREME': return 'extreme';
        case 'ANOMALY_SEVERITY_MODERATE': return 'moderate';
        default: return 'normal';
    }
}
function mapType(t) {
    switch (t) {
        case 'ANOMALY_TYPE_WARM': return 'warm';
        case 'ANOMALY_TYPE_COLD': return 'cold';
        case 'ANOMALY_TYPE_WET': return 'wet';
        case 'ANOMALY_TYPE_DRY': return 'dry';
        case 'ANOMALY_TYPE_MIXED': return 'mixed';
        default: return 'warm';
    }
}
