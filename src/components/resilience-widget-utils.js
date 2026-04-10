export const RESILIENCE_VISUAL_LEVEL_COLORS = {
    very_high: '#22c55e',
    high: '#84cc16',
    moderate: '#eab308',
    low: '#f97316',
    very_low: '#ef4444',
    unknown: 'var(--text-faint)',
};
const DOMAIN_LABELS = {
    economic: 'Economic',
    infrastructure: 'Infra & Supply',
    energy: 'Energy',
    'social-governance': 'Social & Gov',
    'health-food': 'Health & Food',
};
export function getResilienceVisualLevel(score) {
    if (!Number.isFinite(score))
        return 'unknown';
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
export function getResilienceTrendArrow(trend) {
    if (trend === 'rising')
        return '↑';
    if (trend === 'falling')
        return '↓';
    return '→';
}
export function getResilienceDomainLabel(domainId) {
    return DOMAIN_LABELS[domainId] ?? domainId;
}
export function formatResilienceConfidence(data) {
    if (data.lowConfidence)
        return 'Low confidence — sparse data';
    const coverages = data.domains.flatMap((d) => d.dimensions.map((dim) => dim.coverage));
    const avgCoverage = coverages.length > 0
        ? Math.round((coverages.reduce((s, c) => s + c, 0) / coverages.length) * 100)
        : 0;
    return `Coverage ${avgCoverage}% ✓`;
}
export function formatResilienceChange30d(change30d) {
    const rounded = Number.isFinite(change30d) ? change30d.toFixed(1) : '0.0';
    const sign = change30d > 0 ? '+' : '';
    return `30d ${sign}${rounded}`;
}
export function formatBaselineStress(baseline, stress) {
    const b = Number.isFinite(baseline) ? Math.round(baseline) : 0;
    const s = Number.isFinite(stress) ? Math.round(stress) : 0;
    return `Baseline: ${b} | Stress: ${s}`;
}
