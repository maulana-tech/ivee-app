import { getRpcBaseUrl } from '@/services/rpc-client';
import { GivingServiceClient, } from '@/generated/client/ivee/giving/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
// ─── Proto -> display mapping ───
function toDisplaySummary(proto) {
    const s = proto.summary;
    return {
        generatedAt: s.generatedAt,
        activityIndex: s.activityIndex,
        trend: s.trend,
        estimatedDailyFlowUsd: s.estimatedDailyFlowUsd,
        platforms: s.platforms.map(toDisplayPlatform),
        categories: s.categories.map(toDisplayCategory),
        crypto: toDisplayCrypto(s.crypto),
        institutional: toDisplayInstitutional(s.institutional),
    };
}
function toDisplayPlatform(proto) {
    return {
        platform: proto.platform,
        dailyVolumeUsd: proto.dailyVolumeUsd,
        activeCampaignsSampled: proto.activeCampaignsSampled,
        newCampaigns24h: proto.newCampaigns24h,
        donationVelocity: proto.donationVelocity,
        dataFreshness: proto.dataFreshness,
        lastUpdated: proto.lastUpdated,
    };
}
function toDisplayCategory(proto) {
    return {
        category: proto.category,
        share: proto.share,
        change24h: proto.change24h,
        activeCampaigns: proto.activeCampaigns,
        trending: proto.trending,
    };
}
function toDisplayCrypto(proto) {
    return {
        dailyInflowUsd: proto?.dailyInflowUsd ?? 0,
        trackedWallets: proto?.trackedWallets ?? 0,
        transactions24h: proto?.transactions24h ?? 0,
        topReceivers: proto?.topReceivers ?? [],
        pctOfTotal: proto?.pctOfTotal ?? 0,
    };
}
function toDisplayInstitutional(proto) {
    return {
        oecdOdaAnnualUsdBn: proto?.oecdOdaAnnualUsdBn ?? 0,
        oecdDataYear: proto?.oecdDataYear ?? 0,
        cafWorldGivingIndex: proto?.cafWorldGivingIndex ?? 0,
        cafDataYear: proto?.cafDataYear ?? 0,
        candidGrantsTracked: proto?.candidGrantsTracked ?? 0,
        dataLag: proto?.dataLag ?? 'Unknown',
    };
}
// ─── Client + circuit breaker + caching ───
const client = new GivingServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const emptyResult = {
    generatedAt: new Date().toISOString(),
    activityIndex: 0,
    trend: 'stable',
    estimatedDailyFlowUsd: 0,
    platforms: [],
    categories: [],
    crypto: { dailyInflowUsd: 0, trackedWallets: 0, transactions24h: 0, topReceivers: [], pctOfTotal: 0 },
    institutional: { oecdOdaAnnualUsdBn: 0, oecdDataYear: 0, cafWorldGivingIndex: 0, cafDataYear: 0, candidGrantsTracked: 0, dataLag: 'Unknown' },
};
const breaker = createCircuitBreaker({
    name: 'Global Giving',
    cacheTtlMs: 30 * 60 * 1000, // 30 min -- data is mostly static baselines
    persistCache: true, // survive page reloads
});
// In-memory cache + request deduplication
let cachedData = null;
let cachedAt = 0;
let fetchPromise = null;
const REFETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 min
// ─── Main fetch (public API) ───
export async function fetchGivingSummary() {
    // Check bootstrap hydration first
    const hydrated = getHydratedData('giving');
    if (hydrated?.summary?.platforms?.length) {
        const data = toDisplaySummary(hydrated);
        cachedData = data;
        cachedAt = Date.now();
        return { ok: true, data };
    }
    // Return in-memory cache if fresh
    const now = Date.now();
    if (cachedData && now - cachedAt < REFETCH_INTERVAL_MS) {
        return { ok: true, data: cachedData, cachedAt: new Date(cachedAt).toISOString() };
    }
    // Deduplicate concurrent requests
    if (fetchPromise)
        return fetchPromise;
    fetchPromise = (async () => {
        try {
            const data = await breaker.execute(async () => {
                const response = await client.getGivingSummary({
                    platformLimit: 0,
                    categoryLimit: 0,
                });
                return toDisplaySummary(response);
            }, emptyResult);
            const ok = data !== emptyResult && data.platforms.length > 0;
            if (ok) {
                cachedData = data;
                cachedAt = Date.now();
            }
            return { ok, data, cachedAt: ok ? new Date(cachedAt).toISOString() : undefined };
        }
        catch {
            // Return stale cache if available
            if (cachedData) {
                return { ok: true, data: cachedData, cachedAt: new Date(cachedAt).toISOString() };
            }
            return { ok: false, data: emptyResult };
        }
        finally {
            fetchPromise = null;
        }
    })();
    return fetchPromise;
}
// ─── Presentation helpers ───
export function formatCurrency(n) {
    if (n >= 1000000000)
        return `$${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000)
        return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
}
export function formatPercent(n) {
    return `${(n * 100).toFixed(1)}%`;
}
export function getActivityColor(index) {
    if (index >= 70)
        return 'var(--semantic-positive)';
    if (index >= 50)
        return 'var(--accent)';
    if (index >= 30)
        return 'var(--semantic-elevated)';
    return 'var(--semantic-critical)';
}
export function getTrendIcon(trend) {
    if (trend === 'rising')
        return '\u25B2'; // ▲
    if (trend === 'falling')
        return '\u25BC'; // ▼
    return '\u25CF'; // ●
}
export function getTrendColor(trend) {
    if (trend === 'rising')
        return 'var(--semantic-positive)';
    if (trend === 'falling')
        return 'var(--semantic-critical)';
    return 'var(--text-muted)';
}
