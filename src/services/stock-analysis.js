import { MARKET_SYMBOLS } from '@/config';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { MarketServiceClient, } from '@/generated/client/ivee/market/v1/service_client';
import { getMarketWatchlistEntries } from '@/services/market-watchlist';
import { runThrottledTargetRequests } from '@/services/throttled-target-requests';
import { premiumFetch } from '@/services/premium-fetch';
const client = new MarketServiceClient(getRpcBaseUrl(), { fetch: premiumFetch });
const DEFAULT_LIMIT = 4;
function isAnalyzableSymbol(symbol) {
    return !symbol.startsWith('^') && !symbol.includes('=');
}
export function getStockAnalysisTargets(limit = DEFAULT_LIMIT) {
    const customEntries = getMarketWatchlistEntries().filter((entry) => isAnalyzableSymbol(entry.symbol));
    const baseEntries = customEntries.length > 0
        ? customEntries.map((entry) => ({
            symbol: entry.symbol,
            name: entry.name || entry.symbol,
            display: entry.display || entry.symbol,
        }))
        : MARKET_SYMBOLS.filter((entry) => isAnalyzableSymbol(entry.symbol));
    const seen = new Set();
    const targets = [];
    for (const entry of baseEntries) {
        if (seen.has(entry.symbol))
            continue;
        seen.add(entry.symbol);
        targets.push({ symbol: entry.symbol, name: entry.name, display: entry.display });
        if (targets.length >= limit)
            break;
    }
    return targets;
}
export async function fetchStockAnalysesForTargets(targets) {
    return runThrottledTargetRequests(targets, async (target) => {
        return client.analyzeStock({
            symbol: target.symbol,
            name: target.name,
            includeNews: true,
        });
    });
}
export async function fetchStockAnalyses(limit = DEFAULT_LIMIT) {
    return fetchStockAnalysesForTargets(getStockAnalysisTargets(limit));
}
