/**
 * Trade policy intelligence service.
 * WTO MFN baselines, trade flows/barriers, and US customs/effective tariff context.
 */
import { getRpcBaseUrl } from '@/services/rpc-client';
import { TradeServiceClient, } from '@/generated/client/ivee/trade/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';
import { getHydratedData } from '@/services/bootstrap';
const client = new TradeServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const restrictionsBreaker = createCircuitBreaker({ name: 'WTO Restrictions', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const tariffsBreaker = createCircuitBreaker({ name: 'WTO Tariffs', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const flowsBreaker = createCircuitBreaker({ name: 'WTO Flows', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const barriersBreaker = createCircuitBreaker({ name: 'WTO Barriers', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const revenueBreaker = createCircuitBreaker({ name: 'Treasury Revenue', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const comtradeBreaker = createCircuitBreaker({ name: 'Comtrade Flows', cacheTtlMs: 6 * 60 * 60 * 1000, persistCache: true });
const emptyRestrictions = { restrictions: [], fetchedAt: '', upstreamUnavailable: false };
const emptyTariffs = { datapoints: [], fetchedAt: '', upstreamUnavailable: false };
const emptyFlows = { flows: [], fetchedAt: '', upstreamUnavailable: false };
const emptyBarriers = { barriers: [], fetchedAt: '', upstreamUnavailable: false };
const emptyRevenue = { months: [], fetchedAt: '', upstreamUnavailable: false };
const emptyComtrade = { flows: [], fetchedAt: '', upstreamUnavailable: false };
export async function fetchTradeRestrictions(countries = [], limit = 50) {
    if (!isFeatureAvailable('wtoTrade'))
        return emptyRestrictions;
    try {
        return await restrictionsBreaker.execute(async () => {
            return client.getTradeRestrictions({ countries, limit });
        }, emptyRestrictions, { shouldCache: r => (r.restrictions?.length ?? 0) > 0 });
    }
    catch {
        return emptyRestrictions;
    }
}
export async function fetchTariffTrends(reportingCountry, partnerCountry, productSector = '', years = 10) {
    if (!isFeatureAvailable('wtoTrade'))
        return emptyTariffs;
    try {
        return await tariffsBreaker.execute(async () => {
            return client.getTariffTrends({ reportingCountry, partnerCountry, productSector, years });
        }, emptyTariffs, { shouldCache: r => (r.datapoints?.length ?? 0) > 0 });
    }
    catch {
        return emptyTariffs;
    }
}
export async function fetchTradeFlows(reportingCountry, partnerCountry, years = 10) {
    if (!isFeatureAvailable('wtoTrade'))
        return emptyFlows;
    try {
        return await flowsBreaker.execute(async () => {
            return client.getTradeFlows({ reportingCountry, partnerCountry, years });
        }, emptyFlows, { shouldCache: r => (r.flows?.length ?? 0) > 0 });
    }
    catch {
        return emptyFlows;
    }
}
export async function fetchTradeBarriers(countries = [], measureType = '', limit = 50) {
    if (!isFeatureAvailable('wtoTrade'))
        return emptyBarriers;
    try {
        return await barriersBreaker.execute(async () => {
            return client.getTradeBarriers({ countries, measureType, limit });
        }, emptyBarriers, { shouldCache: r => (r.barriers?.length ?? 0) > 0 });
    }
    catch {
        return emptyBarriers;
    }
}
export async function fetchCustomsRevenue() {
    const hydrated = getHydratedData('customsRevenue');
    if (hydrated?.months?.length)
        return hydrated;
    try {
        return await revenueBreaker.execute(async () => {
            return client.getCustomsRevenue({});
        }, emptyRevenue, { shouldCache: r => (r.months?.length ?? 0) > 0 });
    }
    catch {
        return emptyRevenue;
    }
}
export async function fetchComtradeFlows() {
    try {
        return await comtradeBreaker.execute(async () => {
            return client.listComtradeFlows({ reporterCode: '', cmdCode: '', anomaliesOnly: false });
        }, emptyComtrade, { shouldCache: r => (r.flows?.length ?? 0) > 0 });
    }
    catch {
        return emptyComtrade;
    }
}
