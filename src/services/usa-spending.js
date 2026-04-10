import { getHydratedData } from '@/services/bootstrap';
import { toApiUrl } from '@/services/runtime';
function toSummary(raw) {
    return {
        awards: raw.awards,
        totalAmount: raw.totalAmount ?? raw.awards.reduce((s, a) => s + a.amount, 0),
        periodStart: raw.periodStart ?? '',
        periodEnd: raw.periodEnd ?? '',
        fetchedAt: raw.fetchedAt ? new Date(raw.fetchedAt) : new Date(),
    };
}
const EMPTY_SUMMARY = { awards: [], totalAmount: 0, periodStart: '', periodEnd: '', fetchedAt: new Date() };
export async function fetchRecentAwards() {
    const hydrated = getHydratedData('spending');
    if (hydrated?.awards?.length)
        return toSummary(hydrated);
    try {
        const resp = await fetch(toApiUrl('/api/bootstrap?keys=spending'), { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
            const json = await resp.json();
            const raw = json.data?.spending;
            if (raw?.awards?.length)
                return toSummary(raw);
        }
    }
    catch { /* fall through to empty */ }
    return EMPTY_SUMMARY;
}
export function formatAwardAmount(amount) {
    if (amount >= 1000000000) {
        return `$${(amount / 1000000000).toFixed(1)}B`;
    }
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
}
export function getAwardTypeIcon(type) {
    switch (type) {
        case 'contract': return '📄';
        case 'grant': return '🎁';
        case 'loan': return '💰';
        default: return '📋';
    }
}
