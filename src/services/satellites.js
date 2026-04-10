// TODO: Phase 2 — Orbital Surveillance Analysis Panel
// - Overhead Pass Prediction: compute next pass times over user-selected locations
//   (hotspots, conflict zones, bases). "GAOFEN-12 will be overhead Tartus in 14 min"
// - Revisit Time Analysis: how often a location is observed by hostile/friendly sats
// - Imaging Window Alerts: notify when SAR/optical sats are overhead a watched region
// - Sensor Swath Visualization: show ground coverage cone (FOV-based) not just nadir dot
// - Cross-Layer Correlation: satellite overhead + GPS jamming zone = EW context;
//   satellite overhead + conflict zone = battlefield ISR; satellite + AIS gap = maritime recon
// - Satellite Intel Summary Panel: table of tracked sats with orbit type, operator,
//   sensor capability, current position, next pass over user POI
// - Historical Pass Log: which sats passed over a location in the last 24h
//   (useful for identifying imaging windows after events)
import { toApiUrl } from '@/services/runtime';
import { twoline2satrec, propagate, eciToGeodetic, gstime, degreesLong, degreesLat } from 'satellite.js';
let cachedData = null;
let cachedAt = 0;
const CACHE_TTL = 10 * 60 * 1000;
let failures = 0;
let cooldownUntil = 0;
const MAX_FAILURES = 3;
const COOLDOWN_MS = 10 * 60 * 1000;
export async function fetchSatelliteTLEs() {
    const now = Date.now();
    if (now < cooldownUntil)
        return cachedData;
    if (cachedData && now - cachedAt < CACHE_TTL)
        return cachedData;
    try {
        const resp = await fetch(toApiUrl('/api/satellites'), {
            signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok)
            return cachedData;
        const raw = await resp.json();
        const satellites = (raw.satellites ?? []);
        cachedData = satellites;
        cachedAt = now;
        failures = 0;
        return cachedData;
    }
    catch {
        failures++;
        if (failures >= MAX_FAILURES) {
            cooldownUntil = now + COOLDOWN_MS;
        }
        return cachedData;
    }
}
export function initSatRecs(tles) {
    const entries = [];
    for (const tle of tles) {
        try {
            const satrec = twoline2satrec(tle.line1, tle.line2);
            entries.push({
                satrec,
                meta: { noradId: tle.noradId, name: tle.name, type: tle.type, country: tle.country },
            });
        }
        catch { /* skip malformed */ }
    }
    return entries;
}
export function propagatePositions(satRecs, date) {
    const now = date || new Date();
    const gmst = gstime(now);
    const positions = [];
    for (const { satrec, meta } of satRecs) {
        try {
            const pv = propagate(satrec, now);
            if (!pv || !pv.position || typeof pv.position === 'boolean')
                continue;
            const geo = eciToGeodetic(pv.position, gmst);
            const lat = degreesLat(geo.latitude);
            const lng = degreesLong(geo.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                continue;
            const alt = geo.height;
            let velocity = 0;
            if (pv.velocity && typeof pv.velocity !== 'boolean') {
                const { x, y, z } = pv.velocity;
                velocity = Math.sqrt(x * x + y * y + z * z);
            }
            const trail = [];
            for (let t = 1; t <= 15; t++) {
                const pastDate = new Date(now.getTime() - t * 60000);
                const pastGmst = gstime(pastDate);
                try {
                    const pastPv = propagate(satrec, pastDate);
                    if (!pastPv || !pastPv.position || typeof pastPv.position === 'boolean')
                        continue;
                    const pastGeo = eciToGeodetic(pastPv.position, pastGmst);
                    const tLat = degreesLat(pastGeo.latitude);
                    const tLng = degreesLong(pastGeo.longitude);
                    if (!Number.isFinite(tLat) || !Number.isFinite(tLng))
                        continue;
                    trail.push([tLng, tLat, pastGeo.height]);
                }
                catch { /* skip */ }
            }
            const inclination = satrec.inclo * (180 / Math.PI);
            positions.push({ ...meta, lat, lng, alt, velocity, inclination, trail });
        }
        catch { /* skip propagation errors */ }
    }
    return positions;
}
export function startPropagationLoop(satRecs, callback, intervalMs = 3000) {
    const id = setInterval(() => {
        const positions = propagatePositions(satRecs);
        callback(positions);
    }, intervalMs);
    return () => clearInterval(id);
}
export function getSatelliteStatus() {
    if (Date.now() < cooldownUntil)
        return 'cooldown';
    if (failures > 0)
        return 'degraded';
    return 'ok';
}
