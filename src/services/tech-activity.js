import { inferHubsFromTitle } from './tech-hub-index';
import { deriveHubActivityLevel, deriveHubTrend, normalizeHubScore } from './hub-activity-scoring';
const TIER_BONUS = {
    mega: 15,
    major: 8,
    emerging: 0,
};
export function aggregateTechActivity(clusters) {
    const hubAccumulators = new Map();
    // Match each cluster to potential tech hubs
    for (const cluster of clusters) {
        const matches = inferHubsFromTitle(cluster.primaryTitle);
        for (const match of matches) {
            // Only consider matches with reasonable confidence
            if (match.confidence < 0.5)
                continue;
            let acc = hubAccumulators.get(match.hubId);
            if (!acc) {
                acc = {
                    hub: match.hub,
                    clusters: [],
                    matchedKeywords: new Set(),
                    totalVelocity: 0,
                    hasBreaking: false,
                };
                hubAccumulators.set(match.hubId, acc);
            }
            acc.clusters.push(cluster);
            acc.matchedKeywords.add(match.matchedKeyword);
            if (cluster.velocity?.sourcesPerHour) {
                acc.totalVelocity += cluster.velocity.sourcesPerHour;
            }
            if (cluster.isAlert) {
                acc.hasBreaking = true;
            }
        }
    }
    // First pass: calculate raw scores to find max
    const rawScores = [];
    let maxRawScore = 0;
    for (const [hubId, acc] of hubAccumulators) {
        const newsCount = acc.clusters.length;
        const tierBonus = TIER_BONUS[acc.hub.tier] || 0;
        // Raw score formula
        const rawScore = newsCount * 10 +
            (acc.hasBreaking ? 20 : 0) +
            acc.totalVelocity * 3 +
            tierBonus;
        rawScores.push({ hubId, acc, rawScore });
        maxRawScore = Math.max(maxRawScore, rawScore);
    }
    // Calculate activity scores and build result
    const activities = [];
    for (const { hubId, acc, rawScore } of rawScores) {
        const newsCount = acc.clusters.length;
        // Normalize to 0-100 scale relative to top hub
        const score = normalizeHubScore(rawScore, maxRawScore);
        const activityLevel = deriveHubActivityLevel(score, acc.hasBreaking);
        // Get top stories (up to 3)
        const topStories = acc.clusters
            .slice(0, 3)
            .map(c => ({ title: c.primaryTitle, link: c.primaryLink }));
        // Determine trend based on velocity
        const trend = deriveHubTrend(acc.totalVelocity, newsCount);
        activities.push({
            hubId,
            name: acc.hub.name,
            city: acc.hub.city,
            country: acc.hub.country,
            lat: acc.hub.lat,
            lon: acc.hub.lon,
            tier: acc.hub.tier,
            activityLevel,
            score,
            newsCount,
            hasBreaking: acc.hasBreaking,
            topStories,
            trend,
            matchedKeywords: Array.from(acc.matchedKeywords),
        });
    }
    // Sort by score descending
    activities.sort((a, b) => b.score - a.score);
    return activities;
}
export function getTopActiveHubs(clusters, limit = 10) {
    return aggregateTechActivity(clusters).slice(0, limit);
}
export function getHubActivity(hubId, clusters) {
    const activities = aggregateTechActivity(clusters);
    return activities.find(a => a.hubId === hubId);
}
