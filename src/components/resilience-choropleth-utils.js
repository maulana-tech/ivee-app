export const RESILIENCE_CHOROPLETH_COLORS = {
    very_low: [239, 68, 68, 160],
    low: [249, 115, 22, 160],
    moderate: [234, 179, 8, 160],
    high: [132, 204, 22, 160],
    very_high: [34, 197, 94, 160],
    insufficient_data: [120, 120, 120, 60],
};
function clampScore(score) {
    return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}
export function getResilienceChoroplethLevel(score) {
    if (score >= 80)
        return 'very_high';
    if (score >= 60)
        return 'high';
    if (score >= 40)
        return 'moderate';
    if (score >= 20)
        return 'low';
    return 'very_low';
}
export function formatResilienceChoroplethLevel(level) {
    return level.replace(/_/g, ' ');
}
export function buildResilienceChoroplethMap(items, greyedOut = []) {
    const scores = new Map();
    for (const item of items) {
        const countryCode = String(item.countryCode || '').trim().toUpperCase();
        const overallScore = Number(item.overallScore);
        if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isFinite(overallScore) || overallScore < 0)
            continue;
        const normalizedScore = clampScore(overallScore);
        scores.set(countryCode, {
            overallScore: normalizedScore,
            level: getResilienceChoroplethLevel(normalizedScore),
            serverLevel: String(item.level || 'unknown'),
            lowConfidence: Boolean(item.lowConfidence),
        });
    }
    for (const item of greyedOut) {
        const countryCode = String(item.countryCode || '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(countryCode))
            continue;
        scores.set(countryCode, {
            overallScore: 0,
            level: 'insufficient_data',
            serverLevel: 'insufficient_data',
            lowConfidence: true,
        });
    }
    return scores;
}
export function normalizeExclusiveChoropleths(layers, previousLayers) {
    if (!layers.resilienceScore || !layers.ciiChoropleth) {
        return { ...layers };
    }
    const resilienceJustEnabled = layers.resilienceScore && !(previousLayers?.resilienceScore ?? false);
    const ciiJustEnabled = layers.ciiChoropleth && !(previousLayers?.ciiChoropleth ?? false);
    if (resilienceJustEnabled && !ciiJustEnabled) {
        return { ...layers, ciiChoropleth: false };
    }
    if (ciiJustEnabled && !resilienceJustEnabled) {
        return { ...layers, resilienceScore: false };
    }
    // Both newly enabled (e.g. bookmark restore): CII is the established layer, keep it
    return { ...layers, resilienceScore: false };
}
