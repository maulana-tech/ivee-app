/**
 * Client-side service for positive geo events.
 * Fetches geocoded positive news from server-side GDELT GEO RPC
 * and geocodes curated RSS items via inferGeoHubsFromTitle.
 */
import { getRpcBaseUrl } from '@/services/rpc-client';
import { PositiveEventsServiceClient } from '@/generated/client/ivee/positive_events/v1/service_client';
import { inferGeoHubsFromTitle } from './geo-hub-index';
import { createCircuitBreaker } from '@/utils';
const client = new PositiveEventsServiceClient(getRpcBaseUrl(), {
    fetch: (...args) => globalThis.fetch(...args),
});
const breaker = createCircuitBreaker({
    name: 'Positive Geo Events',
    cacheTtlMs: 10 * 60 * 1000, // 10min — GDELT data refreshes frequently
    persistCache: true,
});
/**
 * Fetch geocoded positive events from server-side GDELT GEO RPC.
 * Returns instantly from IndexedDB cache on subsequent loads.
 */
export async function fetchPositiveGeoEvents() {
    return breaker.execute(async () => {
        const response = await client.listPositiveGeoEvents({});
        return response.events.map(event => ({
            lat: event.latitude,
            lon: event.longitude,
            name: event.name,
            category: (event.category || 'humanity-kindness'),
            count: event.count,
            timestamp: event.timestamp,
        }));
    }, [], { shouldCache: (r) => r.length > 0 });
}
/**
 * Geocode curated RSS items using the geo-hub keyword index.
 * Items without location mentions in their titles are filtered out.
 */
export function geocodePositiveNewsItems(items) {
    const events = [];
    for (const item of items) {
        const matches = inferGeoHubsFromTitle(item.title);
        const firstMatch = matches[0];
        if (firstMatch) {
            events.push({
                lat: firstMatch.hub.lat,
                lon: firstMatch.hub.lon,
                name: item.title,
                category: item.category || 'humanity-kindness',
                count: 1,
                timestamp: Date.now(),
            });
        }
    }
    return events;
}
