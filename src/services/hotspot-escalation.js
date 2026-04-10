import { INTEL_HOTSPOTS } from '@/config/geo';
import { getHotspotCountries } from '@/config/countries';
const COMPONENT_WEIGHTS = {
    news: 0.35,
    cii: 0.25,
    geo: 0.25,
    military: 0.15,
};
const scores = new Map();
const lastSignalTime = new Map();
const SIGNAL_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 48;
let ciiGetter = null;
let geoAlertGetter = null;
export function setCIIGetter(fn) {
    ciiGetter = fn;
}
export function setGeoAlertGetter(fn) {
    geoAlertGetter = fn;
}
function getStaticBaseline(hotspot) {
    return hotspot.escalationScore ?? 3;
}
function getCIIForHotspot(hotspotId) {
    if (!ciiGetter)
        return null;
    const countryCodes = getHotspotCountries(hotspotId);
    if (countryCodes.length === 0)
        return null;
    const scores = countryCodes.map(code => ciiGetter(code)).filter((s) => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
}
function getGeoAlertForHotspot(hotspot) {
    if (!geoAlertGetter)
        return null;
    return geoAlertGetter(hotspot.lat, hotspot.lon, 150);
}
function normalizeNewsActivity(matches, hasBreaking, velocity) {
    return Math.min(100, matches * 15 + (hasBreaking ? 30 : 0) + velocity * 5);
}
function normalizeCII(score) {
    return score ?? 30;
}
function normalizeGeo(alertScore, alertTypes) {
    if (alertScore === 0)
        return 0;
    return Math.min(100, alertScore + alertTypes * 10);
}
function normalizeMilitary(flights, vessels) {
    return Math.min(100, flights * 10 + vessels * 15);
}
function calculateDynamicRaw(components) {
    return (components.newsActivity * COMPONENT_WEIGHTS.news +
        components.ciiContribution * COMPONENT_WEIGHTS.cii +
        components.geoConvergence * COMPONENT_WEIGHTS.geo +
        components.militaryActivity * COMPONENT_WEIGHTS.military);
}
function rawToScore(raw) {
    return 1 + (raw / 100) * 4;
}
function blendScores(staticBaseline, dynamicScore) {
    return staticBaseline * 0.3 + dynamicScore * 0.7;
}
function pruneHistory(history) {
    const cutoff = Date.now() - HISTORY_WINDOW_MS;
    const pruned = history.filter(h => h.timestamp >= cutoff);
    if (pruned.length > MAX_HISTORY_POINTS) {
        return pruned.slice(-MAX_HISTORY_POINTS);
    }
    return pruned;
}
function detectTrend(history) {
    if (history.length < 3)
        return 'stable';
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    let validCount = 0;
    for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        if (!entry)
            continue;
        sumX += validCount;
        sumY += entry.score;
        sumXY += validCount * entry.score;
        sumX2 += validCount * validCount;
        validCount++;
    }
    if (validCount < 3)
        return 'stable';
    const denominator = validCount * sumX2 - sumX * sumX;
    if (denominator === 0)
        return 'stable';
    const slope = (validCount * sumXY - sumX * sumY) / denominator;
    if (slope > 0.1)
        return 'escalating';
    if (slope < -0.1)
        return 'de-escalating';
    return 'stable';
}
export function calculateDynamicScore(hotspotId, inputs) {
    const hotspot = INTEL_HOTSPOTS.find(h => h.id === hotspotId);
    if (!hotspot) {
        throw new Error(`Hotspot not found: ${hotspotId}`);
    }
    const staticBaseline = getStaticBaseline(hotspot);
    const existing = scores.get(hotspotId);
    const now = Date.now();
    const components = {
        newsActivity: normalizeNewsActivity(inputs.newsMatches, inputs.hasBreaking, inputs.newsVelocity),
        ciiContribution: normalizeCII(inputs.ciiScore),
        geoConvergence: normalizeGeo(inputs.geoAlertScore, inputs.geoAlertTypes),
        militaryActivity: normalizeMilitary(inputs.flightsNearby, inputs.vesselsNearby),
    };
    const dynamicRaw = calculateDynamicRaw(components);
    const dynamicScore = rawToScore(dynamicRaw);
    const combinedScore = blendScores(staticBaseline, dynamicScore);
    let history = existing?.history ?? [];
    history = pruneHistory(history);
    history.push({ timestamp: now, score: combinedScore });
    const trend = detectTrend(history);
    const result = {
        hotspotId,
        staticBaseline,
        dynamicScore: Math.round(dynamicScore * 10) / 10,
        combinedScore: Math.round(combinedScore * 10) / 10,
        trend,
        components,
        history,
        lastUpdated: new Date(),
    };
    scores.set(hotspotId, result);
    return result;
}
export function getHotspotEscalation(hotspotId) {
    return scores.get(hotspotId) ?? null;
}
export function getAllEscalationScores() {
    return Array.from(scores.values());
}
export function shouldEmitSignal(hotspotId, oldScore, newScore) {
    const lastSignal = lastSignalTime.get(hotspotId) ?? 0;
    if (Date.now() - lastSignal < SIGNAL_COOLDOWN_MS)
        return null;
    if (oldScore === null)
        return null;
    const oldInt = Math.floor(oldScore);
    const newInt = Math.floor(newScore);
    if (newInt > oldInt && newScore >= 2) {
        return { type: 'threshold_crossed', oldScore, newScore, threshold: newInt };
    }
    if (newScore - oldScore >= 0.5) {
        return { type: 'rapid_increase', oldScore, newScore };
    }
    if (newScore >= 4.5 && oldScore < 4.5) {
        return { type: 'critical_reached', oldScore, newScore };
    }
    return null;
}
export function markSignalEmitted(hotspotId) {
    lastSignalTime.set(hotspotId, Date.now());
}
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function countMilitaryNearHotspot(hotspot, flights, vessels, radiusKm = 200) {
    let flightCount = 0;
    let vesselCount = 0;
    for (const f of flights) {
        if (haversineKm(hotspot.lat, hotspot.lon, f.lat, f.lon) <= radiusKm) {
            flightCount++;
        }
    }
    for (const v of vessels) {
        if (haversineKm(hotspot.lat, hotspot.lon, v.lat, v.lon) <= radiusKm) {
            vesselCount++;
        }
    }
    return { flights: flightCount, vessels: vesselCount };
}
let militaryData = { flights: [], vessels: [] };
export function setMilitaryData(flights, vessels) {
    militaryData = { flights, vessels };
}
export function updateHotspotEscalation(hotspotId, newsMatches, hasBreaking, newsVelocity) {
    const hotspot = INTEL_HOTSPOTS.find(h => h.id === hotspotId);
    if (!hotspot)
        return null;
    const ciiScore = getCIIForHotspot(hotspotId);
    const geoAlert = getGeoAlertForHotspot(hotspot);
    const military = countMilitaryNearHotspot(hotspot, militaryData.flights, militaryData.vessels);
    const inputs = {
        newsMatches,
        hasBreaking,
        newsVelocity,
        ciiScore,
        geoAlertScore: geoAlert?.score ?? 0,
        geoAlertTypes: geoAlert?.types ?? 0,
        flightsNearby: military.flights,
        vesselsNearby: military.vessels,
    };
    return calculateDynamicScore(hotspotId, inputs);
}
export function getEscalationChange24h(hotspotId) {
    const score = scores.get(hotspotId);
    if (!score || score.history.length < 2)
        return null;
    const now = Date.now();
    const h24Ago = now - HISTORY_WINDOW_MS;
    const oldestInWindow = score.history.find(h => h.timestamp >= h24Ago);
    const newest = score.history[score.history.length - 1];
    if (!oldestInWindow || !newest)
        return null;
    return {
        change: Math.round((newest.score - oldestInWindow.score) * 10) / 10,
        start: Math.round(oldestInWindow.score * 10) / 10,
        end: Math.round(newest.score * 10) / 10,
    };
}
export function clearEscalationData() {
    scores.clear();
    lastSignalTime.clear();
}
