import { getRpcBaseUrl } from '@/services/rpc-client';
import { getHydratedData } from '@/services/bootstrap';
import { dataFreshness } from './data-freshness';
import { IntelligenceServiceClient, } from '@/generated/client/ivee/intelligence/v1/service_client';
const client = new IntelligenceServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
function normalizeAdvisories(raw) {
    if (!raw?.advisories?.length)
        return [];
    return raw.advisories.map(a => ({
        title: a.title,
        link: a.link,
        pubDate: new Date(a.pubDate),
        source: a.source,
        sourceCountry: a.sourceCountry,
        level: (a.level || 'info'),
        ...(a.country ? { country: a.country } : {}),
    }));
}
let cachedResult = null;
let lastFetch = 0;
const CACHE_TTL = 15 * 60 * 1000;
export async function loadAdvisoriesFromServer() {
    const now = Date.now();
    if (cachedResult && now - lastFetch < CACHE_TTL) {
        return { ok: true, advisories: cachedResult };
    }
    const hydrated = getHydratedData('securityAdvisories');
    if (hydrated?.advisories?.length) {
        const advisories = normalizeAdvisories(hydrated);
        cachedResult = advisories;
        lastFetch = now;
        dataFreshness.recordUpdate('security_advisories', advisories.length);
        return { ok: true, advisories };
    }
    try {
        const resp = await client.listSecurityAdvisories({});
        const advisories = normalizeAdvisories(resp);
        cachedResult = advisories;
        lastFetch = now;
        if (advisories.length > 0) {
            dataFreshness.recordUpdate('security_advisories', advisories.length);
        }
        return { ok: true, advisories };
    }
    catch (e) {
        console.warn('[SecurityAdvisories] RPC failed:', e);
    }
    return { ok: true, advisories: [] };
}
/** @deprecated Use loadAdvisoriesFromServer() instead */
export async function fetchSecurityAdvisories() {
    return loadAdvisoriesFromServer();
}
