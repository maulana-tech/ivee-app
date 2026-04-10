import { getRpcBaseUrl } from '@/services/rpc-client';
import { DisplacementServiceClient, } from '@/generated/client/ivee/displacement/v1/service_client';
import { createCircuitBreaker, getCSSColor } from '@/utils';
// ─── Internal: proto -> legacy mapping ───
const emptyResult = {
    year: new Date().getFullYear(),
    globalTotals: { refugees: 0, asylumSeekers: 0, idps: 0, stateless: 0, total: 0 },
    countries: [],
    topFlows: [],
};
function toDisplaySummary(proto) {
    const s = proto.summary;
    if (!s)
        return { ...emptyResult, globalTotals: { ...emptyResult.globalTotals } };
    const gt = s.globalTotals || { refugees: 0, asylumSeekers: 0, idps: 0, stateless: 0, total: 0 };
    return {
        year: s.year || new Date().getFullYear(),
        globalTotals: {
            refugees: Number(gt.refugees || 0),
            asylumSeekers: Number(gt.asylumSeekers || 0),
            idps: Number(gt.idps || 0),
            stateless: Number(gt.stateless || 0),
            total: Number(gt.total || 0),
        },
        countries: (s.countries || []).map(toDisplayCountry),
        topFlows: (s.topFlows || []).map(toDisplayFlow),
    };
}
function toDisplayCountry(proto) {
    return {
        code: proto.code || '',
        name: proto.name || '',
        refugees: Number(proto.refugees || 0),
        asylumSeekers: Number(proto.asylumSeekers || 0),
        idps: Number(proto.idps || 0),
        stateless: Number(proto.stateless || 0),
        totalDisplaced: Number(proto.totalDisplaced || 0),
        hostRefugees: Number(proto.hostRefugees || 0),
        hostAsylumSeekers: Number(proto.hostAsylumSeekers || 0),
        hostTotal: Number(proto.hostTotal || 0),
        lat: proto.location?.latitude,
        lon: proto.location?.longitude,
    };
}
function toDisplayFlow(proto) {
    return {
        originCode: proto.originCode || '',
        originName: proto.originName || '',
        asylumCode: proto.asylumCode || '',
        asylumName: proto.asylumName || '',
        refugees: Number(proto.refugees || 0),
        originLat: proto.originLocation?.latitude,
        originLon: proto.originLocation?.longitude,
        asylumLat: proto.asylumLocation?.latitude,
        asylumLon: proto.asylumLocation?.longitude,
    };
}
// ─── Client + circuit breaker ───
const client = new DisplacementServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({
    name: 'UNHCR Displacement',
    cacheTtlMs: 10 * 60 * 1000,
    persistCache: true,
});
// ─── Main fetch (public API) ───
export async function fetchUnhcrPopulation() {
    const data = await breaker.execute(async () => {
        const response = await client.getDisplacementSummary({
            year: 0, // 0 = handler uses year fallback
            countryLimit: 0, // 0 = all countries
            flowLimit: 50, // top 50 flows (matching legacy)
        });
        return toDisplaySummary(response);
    }, emptyResult, { shouldCache: (r) => r.countries.length > 0 });
    return {
        ok: data !== emptyResult && data.countries.length > 0,
        data,
    };
}
// ─── Presentation helpers (copied verbatim from legacy src/services/unhcr.ts) ───
export function getDisplacementColor(totalDisplaced) {
    if (totalDisplaced >= 1000000)
        return [255, 50, 50, 200];
    if (totalDisplaced >= 500000)
        return [255, 150, 0, 200];
    if (totalDisplaced >= 100000)
        return [255, 220, 0, 180];
    return [100, 200, 100, 150];
}
export function getDisplacementBadge(totalDisplaced) {
    if (totalDisplaced >= 1000000)
        return { label: 'CRISIS', color: getCSSColor('--semantic-critical') };
    if (totalDisplaced >= 500000)
        return { label: 'HIGH', color: getCSSColor('--semantic-high') };
    if (totalDisplaced >= 100000)
        return { label: 'ELEVATED', color: getCSSColor('--semantic-elevated') };
    return { label: '', color: '' };
}
export function formatPopulation(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(0)}K`;
    return String(n);
}
export function getOriginCountries(data) {
    return [...data.countries]
        .filter(c => c.refugees + c.asylumSeekers > 0)
        .sort((a, b) => (b.refugees + b.asylumSeekers) - (a.refugees + a.asylumSeekers));
}
export function getHostCountries(data) {
    return [...data.countries]
        .filter(c => (c.hostTotal || 0) > 0)
        .sort((a, b) => (b.hostTotal || 0) - (a.hostTotal || 0));
}
