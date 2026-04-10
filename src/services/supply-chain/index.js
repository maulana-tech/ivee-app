import { getRpcBaseUrl } from '@/services/rpc-client';
import { SupplyChainServiceClient, } from '@/generated/client/ivee/supply_chain/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
const client = new SupplyChainServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const shippingBreaker = createCircuitBreaker({ name: 'Shipping Rates', cacheTtlMs: 60 * 60 * 1000, persistCache: true });
const chokepointBreaker = createCircuitBreaker({ name: 'Chokepoint Status', cacheTtlMs: 90 * 60 * 1000, persistCache: true });
const mineralsBreaker = createCircuitBreaker({ name: 'Critical Minerals', cacheTtlMs: 24 * 60 * 60 * 1000, persistCache: true });
const emptyShipping = { indices: [], fetchedAt: '', upstreamUnavailable: false };
const emptyChokepoints = { chokepoints: [], fetchedAt: '', upstreamUnavailable: false };
const emptyMinerals = { minerals: [], fetchedAt: '', upstreamUnavailable: false };
export async function fetchShippingRates() {
    const hydrated = getHydratedData('shippingRates');
    if (hydrated?.indices?.length)
        return hydrated;
    try {
        return await shippingBreaker.execute(async () => {
            return client.getShippingRates({});
        }, emptyShipping);
    }
    catch {
        return emptyShipping;
    }
}
export async function fetchChokepointStatus() {
    const hydrated = getHydratedData('chokepoints');
    if (hydrated?.chokepoints?.length)
        return hydrated;
    try {
        return await chokepointBreaker.execute(async () => {
            return client.getChokepointStatus({});
        }, emptyChokepoints);
    }
    catch {
        return emptyChokepoints;
    }
}
export async function fetchCriticalMinerals() {
    const hydrated = getHydratedData('minerals');
    if (hydrated?.minerals?.length)
        return hydrated;
    try {
        return await mineralsBreaker.execute(async () => {
            return client.getCriticalMinerals({});
        }, emptyMinerals);
    }
    catch {
        return emptyMinerals;
    }
}
const emptyShippingStress = { carriers: [], stressScore: 0, stressLevel: 'low', fetchedAt: 0, upstreamUnavailable: false };
export async function fetchShippingStress() {
    const hydrated = getHydratedData('shippingStress');
    if (hydrated?.carriers?.length)
        return hydrated;
    try {
        return await client.getShippingStress({});
    }
    catch {
        return emptyShippingStress;
    }
}
