import { createCircuitBreaker } from '@/utils';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { getHydratedData } from '@/services/bootstrap';
import { SanctionsServiceClient, } from '@/generated/client/ivee/sanctions/v1/service_client';
const client = new SanctionsServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker({
    name: 'Sanctions Pressure',
    cacheTtlMs: 30 * 60 * 1000,
    persistCache: true,
});
let latestSanctionsPressureResult = null;
const emptyResult = {
    fetchedAt: new Date(0),
    datasetDate: null,
    totalCount: 0,
    sdnCount: 0,
    consolidatedCount: 0,
    newEntryCount: 0,
    vesselCount: 0,
    aircraftCount: 0,
    countries: [],
    programs: [],
    entries: [],
};
function mapEntityType(value) {
    switch (value) {
        case 'SANCTIONS_ENTITY_TYPE_INDIVIDUAL':
            return 'individual';
        case 'SANCTIONS_ENTITY_TYPE_VESSEL':
            return 'vessel';
        case 'SANCTIONS_ENTITY_TYPE_AIRCRAFT':
            return 'aircraft';
        default:
            return 'entity';
    }
}
function parseEpoch(value) {
    if (value == null)
        return null;
    const asNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0)
        return null;
    return new Date(asNumber);
}
function toEntry(raw) {
    return {
        id: raw.id,
        name: raw.name,
        entityType: mapEntityType(raw.entityType),
        countryCodes: raw.countryCodes ?? [],
        countryNames: raw.countryNames ?? [],
        programs: raw.programs ?? [],
        sourceLists: raw.sourceLists ?? [],
        effectiveAt: parseEpoch(raw.effectiveAt),
        isNew: raw.isNew ?? false,
        note: raw.note ?? '',
    };
}
function toCountry(raw) {
    return {
        countryCode: raw.countryCode,
        countryName: raw.countryName,
        entryCount: raw.entryCount ?? 0,
        newEntryCount: raw.newEntryCount ?? 0,
        vesselCount: raw.vesselCount ?? 0,
        aircraftCount: raw.aircraftCount ?? 0,
    };
}
function toProgram(raw) {
    return {
        program: raw.program,
        entryCount: raw.entryCount ?? 0,
        newEntryCount: raw.newEntryCount ?? 0,
    };
}
function toResult(response) {
    return {
        fetchedAt: parseEpoch(response.fetchedAt) || new Date(),
        datasetDate: parseEpoch(response.datasetDate),
        totalCount: response.totalCount ?? 0,
        sdnCount: response.sdnCount ?? 0,
        consolidatedCount: response.consolidatedCount ?? 0,
        newEntryCount: response.newEntryCount ?? 0,
        vesselCount: response.vesselCount ?? 0,
        aircraftCount: response.aircraftCount ?? 0,
        countries: (response.countries ?? []).map(toCountry),
        programs: (response.programs ?? []).map(toProgram),
        entries: (response.entries ?? []).map(toEntry),
    };
}
export async function fetchSanctionsPressure() {
    const hydrated = getHydratedData('sanctionsPressure');
    if (hydrated?.entries?.length || hydrated?.countries?.length || hydrated?.programs?.length) {
        const result = toResult(hydrated);
        latestSanctionsPressureResult = result;
        return result;
    }
    return breaker.execute(async () => {
        const response = await client.listSanctionsPressure({
            maxItems: 30,
        }, {
            signal: AbortSignal.timeout(25000),
        });
        const result = toResult(response);
        latestSanctionsPressureResult = result;
        if (result.totalCount === 0) {
            // Seed is missing or the feed is down. Evict any stale cache so the
            // panel surfaces "unavailable" instead of serving old designations
            // indefinitely via stale-while-revalidate.
            breaker.clearCache();
        }
        return result;
    }, emptyResult, {
        shouldCache: (result) => result.totalCount > 0,
    });
}
export function getLatestSanctionsPressure() {
    return latestSanctionsPressureResult;
}
