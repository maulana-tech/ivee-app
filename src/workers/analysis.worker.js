/**
 * Web Worker for heavy computational tasks (clustering & correlation analysis).
 * Runs O(n²) Jaccard clustering and correlation detection off the main thread.
 *
 * All core logic is imported from src/services/analysis-core.ts
 * to maintain a single source of truth.
 */
import { clusterNewsCore, analyzeCorrelationsCore, } from '@/services/analysis-core';
// Worker-local state (persists between messages)
let previousSnapshot = null;
const recentSignalKeys = new Set();
function isRecentDuplicate(key) {
    return recentSignalKeys.has(key);
}
function markSignalSeen(key) {
    recentSignalKeys.add(key);
    setTimeout(() => recentSignalKeys.delete(key), 30 * 60 * 1000);
}
// Worker message handler
self.onmessage = (event) => {
    const message = event.data;
    switch (message.type) {
        case 'cluster': {
            // Deserialize dates (they come as strings over postMessage)
            const items = message.items.map(item => ({
                ...item,
                pubDate: new Date(item.pubDate),
            }));
            const getSourceTier = (source) => message.sourceTiers[source] ?? 4;
            const clusters = clusterNewsCore(items, getSourceTier);
            const result = {
                type: 'cluster-result',
                id: message.id,
                clusters,
            };
            self.postMessage(result);
            break;
        }
        case 'correlation': {
            // Deserialize dates in clusters
            const clusters = message.clusters.map(cluster => ({
                ...cluster,
                firstSeen: new Date(cluster.firstSeen),
                lastUpdated: new Date(cluster.lastUpdated),
                allItems: cluster.allItems.map(item => ({
                    ...item,
                    pubDate: new Date(item.pubDate),
                })),
            }));
            const getSourceType = (source) => message.sourceTypes[source] ?? 'other';
            const { signals, snapshot } = analyzeCorrelationsCore(clusters, message.predictions, message.markets, previousSnapshot, getSourceType, isRecentDuplicate, markSignalSeen);
            previousSnapshot = snapshot;
            const result = {
                type: 'correlation-result',
                id: message.id,
                signals,
            };
            self.postMessage(result);
            break;
        }
        case 'reset': {
            previousSnapshot = null;
            recentSignalKeys.clear();
            break;
        }
    }
};
// Signal that worker is ready
self.postMessage({ type: 'ready' });
