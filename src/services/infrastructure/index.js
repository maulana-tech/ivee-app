/**
 * Unified infrastructure service module -- replaces two legacy services:
 *   - src/services/outages.ts (Cloudflare Radar internet outages)
 *   - ServiceStatusPanel's direct /api/service-status fetch
 *
 * All data now flows through the InfrastructureServiceClient RPC.
 */
import { getRpcBaseUrl } from '@/services/rpc-client';
import { InfrastructureServiceClient, } from '@/generated/client/ivee/infrastructure/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';
import { getHydratedData } from '@/services/bootstrap';
// ---- Client + Circuit Breakers ----
const client = new InfrastructureServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const outageBreaker = createCircuitBreaker({ name: 'Internet Outages', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const statusBreaker = createCircuitBreaker({ name: 'Service Statuses', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const ddosBreaker = createCircuitBreaker({ name: 'DDoS Attacks', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const trafficAnomaliesBreaker = createCircuitBreaker({ name: 'Traffic Anomalies', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const emptyOutageFallback = { outages: [], pagination: undefined };
const emptyStatusFallback = { statuses: [] };
const emptyDdosFallback = { protocol: [], vector: [], dateRangeStart: '', dateRangeEnd: '', topTargetLocations: [] };
const emptyAnomaliesFallback = { anomalies: [], totalCount: 0 };
// ---- Proto enum -> legacy string adapters ----
const SEVERITY_REVERSE = {
    OUTAGE_SEVERITY_PARTIAL: 'partial',
    OUTAGE_SEVERITY_MAJOR: 'major',
    OUTAGE_SEVERITY_TOTAL: 'total',
};
const STATUS_REVERSE = {
    SERVICE_OPERATIONAL_STATUS_OPERATIONAL: 'operational',
    SERVICE_OPERATIONAL_STATUS_DEGRADED: 'degraded',
    SERVICE_OPERATIONAL_STATUS_PARTIAL_OUTAGE: 'degraded',
    SERVICE_OPERATIONAL_STATUS_MAJOR_OUTAGE: 'outage',
    SERVICE_OPERATIONAL_STATUS_MAINTENANCE: 'degraded',
    SERVICE_OPERATIONAL_STATUS_UNSPECIFIED: 'unknown',
};
// ---- Adapter: proto InternetOutage -> legacy InternetOutage ----
function toOutage(proto) {
    return {
        id: proto.id,
        title: proto.title,
        link: proto.link,
        description: proto.description,
        pubDate: proto.detectedAt ? new Date(proto.detectedAt) : new Date(),
        country: proto.country,
        region: proto.region || undefined,
        lat: proto.location?.latitude ?? 0,
        lon: proto.location?.longitude ?? 0,
        severity: SEVERITY_REVERSE[proto.severity] || 'partial',
        categories: proto.categories,
        cause: proto.cause || undefined,
        outageType: proto.outageType || undefined,
        endDate: proto.endedAt ? new Date(proto.endedAt) : undefined,
    };
}
// ========================================================================
// Internet Outages -- replaces src/services/outages.ts
// ========================================================================
let outagesConfigured = null;
export function isOutagesConfigured() {
    return outagesConfigured;
}
export async function fetchInternetOutages() {
    if (!isFeatureAvailable('internetOutages')) {
        outagesConfigured = false;
        return [];
    }
    const hydrated = getHydratedData('outages');
    const resp = (hydrated?.outages?.length ? hydrated : null) ?? await outageBreaker.execute(async () => {
        return client.listInternetOutages({
            country: '',
            start: 0,
            end: 0,
            pageSize: 0,
            cursor: '',
        });
    }, emptyOutageFallback, { shouldCache: (r) => r.outages.length > 0 });
    if (resp.outages.length === 0) {
        if (outagesConfigured === null)
            outagesConfigured = false;
        return [];
    }
    outagesConfigured = true;
    return resp.outages.map(toOutage);
}
export function getOutagesStatus() {
    return outageBreaker.getStatus();
}
// ========================================================================
// DDoS Attacks -- L3/L4 attack summaries from Cloudflare Radar
// ========================================================================
export async function fetchDdosAttacks() {
    const hydrated = getHydratedData('ddosAttacks');
    if (hydrated?.protocol?.length || hydrated?.vector?.length)
        return hydrated;
    return ddosBreaker.execute(async () => {
        return client.listInternetDdosAttacks({});
    }, emptyDdosFallback, { shouldCache: (r) => r.protocol.length > 0 || r.vector.length > 0 });
}
// ========================================================================
// Traffic Anomalies -- anomalous traffic patterns from Cloudflare Radar
// ========================================================================
export async function fetchTrafficAnomalies(country) {
    const hydrated = getHydratedData('trafficAnomalies');
    if (hydrated?.anomalies !== undefined && !country)
        return hydrated;
    return trafficAnomaliesBreaker.execute(async () => {
        return client.listInternetTrafficAnomalies({ country: country || '' });
    }, emptyAnomaliesFallback, { shouldCache: (r) => r.anomalies.length > 0 });
}
// Category map for the service IDs (matches the handler's SERVICES list)
const CATEGORY_MAP = {
    aws: 'cloud', azure: 'cloud', gcp: 'cloud', cloudflare: 'cloud', vercel: 'cloud',
    netlify: 'cloud', digitalocean: 'cloud', render: 'cloud', railway: 'cloud',
    github: 'dev', gitlab: 'dev', npm: 'dev', docker: 'dev', bitbucket: 'dev',
    circleci: 'dev', jira: 'dev', confluence: 'dev', linear: 'dev',
    slack: 'comm', discord: 'comm', zoom: 'comm', notion: 'comm',
    openai: 'ai', anthropic: 'ai', replicate: 'ai',
    stripe: 'saas', twilio: 'saas', datadog: 'saas', sentry: 'saas', supabase: 'saas',
};
function toServiceResult(proto) {
    return {
        id: proto.id,
        name: proto.name,
        category: CATEGORY_MAP[proto.id] || 'saas',
        status: STATUS_REVERSE[proto.status] || 'unknown',
        description: proto.description,
    };
}
function computeSummary(services) {
    return {
        operational: services.filter((s) => s.status === 'operational').length,
        degraded: services.filter((s) => s.status === 'degraded').length,
        outage: services.filter((s) => s.status === 'outage').length,
        unknown: services.filter((s) => s.status === 'unknown').length,
    };
}
export async function fetchServiceStatuses() {
    const hydrated = getHydratedData('serviceStatuses');
    if (hydrated?.statuses?.length) {
        const services = hydrated.statuses.map(toServiceResult);
        return { success: true, timestamp: new Date().toISOString(), summary: computeSummary(services), services };
    }
    const resp = await statusBreaker.execute(async () => {
        return client.listServiceStatuses({
            status: 'SERVICE_OPERATIONAL_STATUS_UNSPECIFIED',
        });
    }, emptyStatusFallback, { shouldCache: (r) => r.statuses.length > 0 });
    const services = resp.statuses.map(toServiceResult);
    return {
        success: true,
        timestamp: new Date().toISOString(),
        summary: computeSummary(services),
        services,
    };
}
