import { getRpcBaseUrl } from '@/services/rpc-client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { t } from '@/services/i18n';
import { IntelligenceServiceClient, } from '@/generated/client/ivee/intelligence/v1/service_client';
// ---- Sebuf client ----
const client = new IntelligenceServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
// ---- Circuit breakers ----
const pizzintBreaker = createCircuitBreaker({
    name: 'PizzINT',
    maxFailures: 3,
    cooldownMs: 5 * 60 * 1000,
    cacheTtlMs: 30 * 60 * 1000,
    persistCache: true,
});
const gdeltBreaker = createCircuitBreaker({
    name: 'GDELT Tensions',
    maxFailures: 3,
    cooldownMs: 5 * 60 * 1000,
    cacheTtlMs: 15 * 60 * 1000,
    persistCache: true,
});
// ---- Proto → legacy adapters ----
const DEFCON_LABELS = {
    1: 'components.pizzint.defconLabels.1',
    2: 'components.pizzint.defconLabels.2',
    3: 'components.pizzint.defconLabels.3',
    4: 'components.pizzint.defconLabels.4',
    5: 'components.pizzint.defconLabels.5',
};
const FRESHNESS_REVERSE = {
    DATA_FRESHNESS_FRESH: 'fresh',
    DATA_FRESHNESS_STALE: 'stale',
};
const TREND_REVERSE = {
    TREND_DIRECTION_RISING: 'rising',
    TREND_DIRECTION_STABLE: 'stable',
    TREND_DIRECTION_FALLING: 'falling',
};
function toLocation(proto) {
    return {
        place_id: proto.placeId,
        name: proto.name,
        address: proto.address,
        current_popularity: proto.currentPopularity,
        percentage_of_usual: proto.percentageOfUsual || null,
        is_spike: proto.isSpike,
        spike_magnitude: typeof proto.spikeMagnitude === 'number' ? proto.spikeMagnitude : null,
        data_source: proto.dataSource,
        recorded_at: proto.recordedAt,
        data_freshness: FRESHNESS_REVERSE[proto.dataFreshness] || 'stale',
        is_closed_now: proto.isClosedNow,
        lat: proto.lat || undefined,
        lng: proto.lng || undefined,
    };
}
function toStatus(proto) {
    const level = (proto.defconLevel >= 1 && proto.defconLevel <= 5 ? proto.defconLevel : 5);
    return {
        defconLevel: level,
        defconLabel: t(DEFCON_LABELS[level] ?? DEFCON_LABELS[5]),
        aggregateActivity: proto.aggregateActivity,
        activeSpikes: proto.activeSpikes,
        locationsMonitored: proto.locationsMonitored,
        locationsOpen: proto.locationsOpen,
        lastUpdate: proto.updatedAt ? new Date(proto.updatedAt) : new Date(),
        dataFreshness: FRESHNESS_REVERSE[proto.dataFreshness] || 'stale',
        locations: proto.locations.map(toLocation),
    };
}
function toTensionPair(proto) {
    return {
        id: proto.id,
        countries: [proto.countries[0] || '', proto.countries[1] || ''],
        label: proto.label,
        score: proto.score,
        trend: TREND_REVERSE[proto.trend] || 'stable',
        changePercent: proto.changePercent,
        region: proto.region,
    };
}
// ---- Default / fallback values ----
const defaultStatus = {
    defconLevel: 5,
    defconLabel: t('components.pizzint.defconLabels.5'),
    aggregateActivity: 0,
    activeSpikes: 0,
    locationsMonitored: 0,
    locationsOpen: 0,
    lastUpdate: new Date(),
    dataFreshness: 'stale',
    locations: []
};
// ---- Public API ----
export async function fetchPizzIntStatus() {
    const hydrated = getHydratedData('pizzint');
    if (hydrated?.pizzint)
        return toStatus(hydrated.pizzint);
    return pizzintBreaker.execute(async () => {
        const resp = await client.getPizzintStatus({ includeGdelt: false });
        if (!resp.pizzint)
            throw new Error('No PizzINT data');
        return toStatus(resp.pizzint);
    }, defaultStatus);
}
export async function fetchGdeltTensions() {
    return gdeltBreaker.execute(async () => {
        const resp = await client.getPizzintStatus({ includeGdelt: true });
        return resp.tensionPairs.map(toTensionPair);
    }, []);
}
export function getPizzIntStatus() {
    return pizzintBreaker.getStatus();
}
export function getGdeltStatus() {
    return gdeltBreaker.getStatus();
}
