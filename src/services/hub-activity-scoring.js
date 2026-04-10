export function normalizeHubScore(rawScore, maxRawScore) {
    if (maxRawScore <= 0)
        return 0;
    return Math.round((rawScore / maxRawScore) * 100);
}
export function deriveHubActivityLevel(score, hasBreaking) {
    if (score >= 70 || hasBreaking) {
        return 'high';
    }
    if (score >= 40) {
        return 'elevated';
    }
    return 'low';
}
export function deriveHubTrend(totalVelocity, newsCount) {
    if (totalVelocity > 2) {
        return 'rising';
    }
    if (totalVelocity < 0.5 && newsCount > 1) {
        return 'falling';
    }
    return 'stable';
}
