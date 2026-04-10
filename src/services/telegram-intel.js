import { proxyUrl } from '@/utils';
import { isDesktopRuntime, toApiUrl } from '@/services/runtime';
export const TELEGRAM_TOPICS = [
    { id: 'all', labelKey: 'components.telegramIntel.filterAll' },
    { id: 'breaking', labelKey: 'components.telegramIntel.filterBreaking' },
    { id: 'conflict', labelKey: 'components.telegramIntel.filterConflict' },
    { id: 'geopolitics', labelKey: 'components.telegramIntel.filterGeopolitics' },
    { id: 'middleeast', labelKey: 'components.telegramIntel.filterMiddleeast' },
    { id: 'osint', labelKey: 'components.telegramIntel.filterOsint' },
    { id: 'cyber', labelKey: 'components.telegramIntel.filterCyber' },
];
let cachedResponse = null;
let cachedAt = 0;
const CACHE_TTL = 30000;
function telegramFeedUrl(limit) {
    const path = `/api/telegram-feed?limit=${limit}`;
    return isDesktopRuntime() ? proxyUrl(path) : toApiUrl(path);
}
export async function fetchTelegramFeed(limit = 50) {
    if (cachedResponse && Date.now() - cachedAt < CACHE_TTL)
        return cachedResponse;
    const res = await fetch(telegramFeedUrl(limit));
    if (!res.ok)
        throw new Error(`Telegram feed ${res.status}`);
    const json = await res.json();
    cachedResponse = json;
    cachedAt = Date.now();
    return json;
}
export function formatTelegramTime(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 0)
        return 'now';
    const secs = Math.floor(diff / 1000);
    if (secs < 60)
        return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60)
        return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
}
