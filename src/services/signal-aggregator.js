/**
 * Signal Aggregator Service
 * Collects all map signals and correlates them by country/region
 * Feeds geographic context to AI Insights
 */
import { getCountryAtCoordinates, getCountryNameByCode, nameToCountryCode, ME_STRIKE_BOUNDS, resolveCountryFromBounds } from './country-geometry';
const REGION_DEFINITIONS = {
    middle_east: {
        name: 'Middle East',
        countries: ['IR', 'IL', 'SA', 'AE', 'IQ', 'SY', 'YE', 'JO', 'LB', 'KW', 'QA', 'OM', 'BH'],
    },
    east_asia: {
        name: 'East Asia',
        countries: ['CN', 'TW', 'JP', 'KR', 'KP', 'HK', 'MN'],
    },
    south_asia: {
        name: 'South Asia',
        countries: ['IN', 'PK', 'BD', 'AF', 'NP', 'LK', 'MM'],
    },
    europe_east: {
        name: 'Eastern Europe',
        countries: ['UA', 'RU', 'BY', 'PL', 'RO', 'MD', 'HU', 'CZ', 'SK', 'BG'],
    },
    africa_north: {
        name: 'North Africa',
        countries: ['EG', 'LY', 'DZ', 'TN', 'MA', 'SD', 'SS'],
    },
    africa_sahel: {
        name: 'Sahel Region',
        countries: ['ML', 'NE', 'BF', 'TD', 'NG', 'CM', 'CF'],
    },
};
function normalizeCountryCode(country) {
    if (country.length === 2)
        return country.toUpperCase();
    return nameToCountryCode(country) || country.slice(0, 2).toUpperCase();
}
function getCountryName(code) {
    return getCountryNameByCode(code) || code;
}
class SignalAggregator {
    constructor() {
        Object.defineProperty(this, "signals", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "WINDOW_MS", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 24 * 60 * 60 * 1000
        });
        // Tracks which source event type each temporal anomaly signal came from
        Object.defineProperty(this, "temporalSourceMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        // Tracks signals added by ingestTheaterPostures so they can be cleared on re-ingestion
        Object.defineProperty(this, "theaterPostureSignals", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    clearSignalType(type) {
        this.signals = this.signals.filter(s => s.type !== type);
    }
    ingestOutages(outages) {
        this.clearSignalType('internet_outage');
        for (const o of outages) {
            const code = normalizeCountryCode(o.country);
            this.signals.push({
                type: 'internet_outage',
                country: code,
                countryName: o.country,
                lat: o.lat,
                lon: o.lon,
                severity: o.severity === 'total' ? 'high' : o.severity === 'major' ? 'medium' : 'low',
                title: o.title,
                timestamp: o.pubDate,
            });
        }
        this.pruneOld();
    }
    ingestFlights(flights) {
        this.clearSignalType('military_flight');
        const countryCounts = new Map();
        for (const f of flights) {
            const code = this.coordsToCountryWithFallback(f.lat, f.lon);
            const count = countryCounts.get(code) || 0;
            countryCounts.set(code, count + 1);
        }
        for (const [code, count] of countryCounts) {
            this.signals.push({
                type: 'military_flight',
                country: code,
                countryName: getCountryName(code),
                lat: 0,
                lon: 0,
                severity: count >= 10 ? 'high' : count >= 5 ? 'medium' : 'low',
                title: `${count} military aircraft detected`,
                timestamp: new Date(),
            });
        }
        this.pruneOld();
    }
    ingestVessels(vessels) {
        this.clearSignalType('military_vessel');
        const regionCounts = new Map();
        for (const v of vessels) {
            const code = this.coordsToCountryWithFallback(v.lat, v.lon);
            const existing = regionCounts.get(code);
            if (existing) {
                existing.count++;
            }
            else {
                regionCounts.set(code, { count: 1, lat: v.lat, lon: v.lon });
            }
        }
        for (const [code, data] of regionCounts) {
            this.signals.push({
                type: 'military_vessel',
                country: code,
                countryName: getCountryName(code),
                lat: data.lat,
                lon: data.lon,
                severity: data.count >= 5 ? 'high' : data.count >= 2 ? 'medium' : 'low',
                title: `${data.count} naval vessels near region`,
                timestamp: new Date(),
            });
        }
        this.pruneOld();
    }
    ingestProtests(events) {
        this.clearSignalType('protest');
        const countryCounts = new Map();
        for (const e of events) {
            const code = normalizeCountryCode(e.country) || this.coordsToCountry(e.lat, e.lon);
            const existing = countryCounts.get(code);
            if (existing) {
                existing.count++;
            }
            else {
                countryCounts.set(code, { count: 1, lat: e.lat, lon: e.lon });
            }
        }
        for (const [code, data] of countryCounts) {
            this.signals.push({
                type: 'protest',
                country: code,
                countryName: getCountryName(code),
                lat: data.lat,
                lon: data.lon,
                severity: data.count >= 10 ? 'high' : data.count >= 5 ? 'medium' : 'low',
                title: `${data.count} protest events`,
                timestamp: new Date(),
            });
        }
        this.pruneOld();
    }
    ingestAisDisruptions(events) {
        this.clearSignalType('ais_disruption');
        for (const e of events) {
            const code = this.coordsToCountry(e.lat, e.lon);
            // Map 'elevated' to 'medium' for our type
            const severity = e.severity === 'elevated' ? 'medium' : e.severity;
            this.signals.push({
                type: 'ais_disruption',
                country: code,
                countryName: e.name,
                lat: e.lat,
                lon: e.lon,
                severity,
                title: e.description,
                timestamp: new Date(),
            });
        }
        this.pruneOld();
    }
    // ============ NEW SIGNAL INGESTION METHODS ============
    /**
     * Ingest satellite fire detection from NASA FIRMS
     * Source: src/services/wildfires
     */
    ingestSatelliteFires(fires) {
        this.clearSignalType('satellite_fire');
        for (const fire of fires) {
            const code = this.coordsToCountry(fire.lat, fire.lon) || normalizeCountryCode(fire.region);
            const severity = fire.brightness > 360 ? 'high' : fire.brightness > 320 ? 'medium' : 'low';
            this.signals.push({
                type: 'satellite_fire',
                country: code,
                countryName: fire.region,
                lat: fire.lat,
                lon: fire.lon,
                severity,
                title: `Thermal anomaly detected (${Math.round(fire.brightness)}K, ${fire.frp.toFixed(1)}MW)`,
                timestamp: new Date(fire.acq_date),
            });
        }
        this.pruneOld();
    }
    ingestRadiationObservations(observations) {
        this.clearSignalType('radiation_anomaly');
        for (const observation of observations) {
            if (observation.severity === 'normal')
                continue;
            const code = normalizeCountryCode(observation.country) || this.coordsToCountry(observation.lat, observation.lon);
            this.signals.push({
                type: 'radiation_anomaly',
                country: code,
                countryName: getCountryName(code),
                lat: observation.lat,
                lon: observation.lon,
                severity: observation.severity === 'spike' ? 'high' : 'medium',
                title: `${observation.severity === 'spike' ? 'Radiation spike' : 'Elevated radiation'} at ${observation.location} (${observation.delta >= 0 ? '+' : ''}${observation.delta.toFixed(1)} ${observation.unit} vs baseline)`,
                timestamp: observation.observedAt,
            });
        }
        this.pruneOld();
    }
    /**
     * Ingest temporal baseline anomalies.
     * Deduplicates by message — safe to call from multiple async sources.
     */
    ingestTemporalAnomalies(anomalies, trackedTypes) {
        // Clear signals for tracked types (server tells us which types it covers)
        const typesToClear = trackedTypes?.length
            ? new Set(trackedTypes)
            : new Set(anomalies.map(a => a.type));
        this.signals = this.signals.filter(s => s.type !== 'temporal_anomaly' ||
            !typesToClear.has(this.temporalSourceMap.get(s) || ''));
        for (const a of anomalies) {
            const signal = {
                type: 'temporal_anomaly',
                country: 'XX',
                countryName: a.region,
                lat: 0,
                lon: 0,
                severity: a.severity === 'critical' ? 'high' : a.severity === 'high' ? 'high' : 'medium',
                title: a.message,
                timestamp: new Date(),
            };
            this.signals.push(signal);
            this.temporalSourceMap.set(signal, a.type);
        }
        this.pruneOld();
    }
    ingestSanctionsPressure(countries) {
        this.clearSignalType('sanctions_pressure');
        for (const country of countries) {
            const code = normalizeCountryCode(country.countryCode || country.countryName);
            const severity = country.newEntryCount >= 5 || country.entryCount >= 50
                ? 'high'
                : country.newEntryCount >= 1 || country.entryCount >= 20
                    ? 'medium'
                    : 'low';
            if (country.newEntryCount === 0 && country.entryCount < 20)
                continue;
            this.signals.push({
                type: 'sanctions_pressure',
                country: code,
                countryName: country.countryName || getCountryName(code),
                lat: 0,
                lon: 0,
                severity,
                title: country.newEntryCount > 0
                    ? `${country.newEntryCount} new OFAC designation${country.newEntryCount === 1 ? '' : 's'} tied to ${country.countryName}`
                    : `${country.entryCount} OFAC-linked designations tied to ${country.countryName}`,
                timestamp: new Date(),
            });
        }
        this.pruneOld();
    }
    ingestConflictEvents(events) {
        this.clearSignalType('active_strike');
        const seen = new Set();
        const deduped = events.filter(e => {
            if (seen.has(e.id))
                return false;
            seen.add(e.id);
            return true;
        });
        const byCountry = new Map();
        for (const e of deduped) {
            const code = this.coordsToCountryWithFallback(e.latitude, e.longitude);
            if (code === 'XX')
                continue;
            const arr = byCountry.get(code) || [];
            arr.push(e);
            byCountry.set(code, arr);
        }
        const MAX_PER_COUNTRY = 50;
        for (const [code, countryEvents] of byCountry) {
            const capped = countryEvents.slice(0, MAX_PER_COUNTRY);
            const highCount = capped.filter(e => {
                const sev = e.severity.toLowerCase();
                return sev === 'high' || sev === 'critical';
            }).length;
            const timestamps = capped.map(e => e.timestamp < 1e12 ? e.timestamp * 1000 : e.timestamp);
            const maxTs = timestamps.length > 0 ? Math.max(...timestamps) : 0;
            const safeTs = maxTs > 0 ? maxTs : Date.now();
            this.signals.push({
                type: 'active_strike',
                country: code,
                countryName: getCountryName(code),
                lat: capped[0].latitude,
                lon: capped[0].longitude,
                severity: highCount >= 5 ? 'high' : highCount >= 2 ? 'medium' : 'low',
                title: `${capped.length} strikes (${highCount} high severity)`,
                timestamp: new Date(safeTs),
                strikeCount: capped.length,
                highSeverityStrikeCount: highCount,
            });
        }
        this.pruneOld();
    }
    ingestTheaterPostures(postures) {
        const TARGET_CODES = {
            'Iran': 'IR', 'Taiwan': 'TW', 'North Korea': 'KP',
            'Gaza': 'PS', 'Yemen': 'YE',
        };
        // Remove previously-added theater posture signals before re-ingesting (idempotency)
        const prev = new Set(this.theaterPostureSignals);
        this.signals = this.signals.filter(s => !prev.has(s));
        this.theaterPostureSignals = [];
        // Remove real signals only for the specific type that will be replaced by theater summary.
        // Tracked per-type so that e.g. an aircraft-only posture doesn't erase real vessel signals.
        const activeFlightCodes = new Set();
        const activeVesselCodes = new Set();
        for (const p of postures) {
            if (!p.targetNation || p.postureLevel === 'normal')
                continue;
            const code = TARGET_CODES[p.targetNation];
            if (!code)
                continue;
            if (p.totalAircraft > 0)
                activeFlightCodes.add(code);
            if (p.totalVessels > 0)
                activeVesselCodes.add(code);
        }
        if (activeFlightCodes.size > 0 || activeVesselCodes.size > 0) {
            this.signals = this.signals.filter(s => {
                if (s.type === 'military_flight' && activeFlightCodes.has(s.country))
                    return false;
                if (s.type === 'military_vessel' && activeVesselCodes.has(s.country))
                    return false;
                return true;
            });
        }
        for (const p of postures) {
            if (!p.targetNation || p.postureLevel === 'normal')
                continue;
            const code = TARGET_CODES[p.targetNation];
            if (!code)
                continue;
            if (p.totalAircraft > 0) {
                const sig = {
                    type: 'military_flight',
                    country: code,
                    countryName: getCountryName(code),
                    lat: 0,
                    lon: 0,
                    severity: p.postureLevel === 'critical' ? 'high' : 'medium',
                    title: `${p.totalAircraft} military aircraft in ${p.theaterName}`,
                    timestamp: new Date(),
                };
                this.signals.push(sig);
                this.theaterPostureSignals.push(sig);
            }
            if (p.totalVessels > 0) {
                const sig = {
                    type: 'military_vessel',
                    country: code,
                    countryName: getCountryName(code),
                    lat: 0,
                    lon: 0,
                    severity: p.totalVessels >= 5 ? 'high' : 'medium',
                    title: `${p.totalVessels} naval vessels in ${p.theaterName}`,
                    timestamp: new Date(),
                };
                this.signals.push(sig);
                this.theaterPostureSignals.push(sig);
            }
        }
    }
    coordsToCountry(lat, lon) {
        const hit = getCountryAtCoordinates(lat, lon);
        return hit?.code ?? 'XX';
    }
    coordsToCountryWithFallback(lat, lon) {
        const hit = getCountryAtCoordinates(lat, lon);
        if (hit?.code)
            return hit.code;
        return resolveCountryFromBounds(lat, lon, ME_STRIKE_BOUNDS) ?? 'XX';
    }
    pruneOld() {
        const cutoff = Date.now() - this.WINDOW_MS;
        this.signals = this.signals.filter(s => s.timestamp.getTime() > cutoff);
    }
    getCountryClusters() {
        const byCountry = new Map();
        for (const s of this.signals) {
            const existing = byCountry.get(s.country) || [];
            existing.push(s);
            byCountry.set(s.country, existing);
        }
        const clusters = [];
        for (const [country, signals] of byCountry) {
            const signalTypes = new Set(signals.map(s => s.type));
            const highCount = signals.filter(s => s.severity === 'high').length;
            const typeBonus = signalTypes.size * 20;
            const countBonus = Math.min(30, signals.length * 5);
            const severityBonus = highCount * 10;
            const convergenceScore = Math.min(100, typeBonus + countBonus + severityBonus);
            clusters.push({
                country,
                countryName: getCountryName(country),
                signals,
                signalTypes,
                totalCount: signals.length,
                highSeverityCount: highCount,
                convergenceScore,
            });
        }
        return clusters.sort((a, b) => b.convergenceScore - a.convergenceScore);
    }
    getRegionalConvergence() {
        const clusters = this.getCountryClusters();
        const convergences = [];
        for (const [_regionId, def] of Object.entries(REGION_DEFINITIONS)) {
            const regionClusters = clusters.filter(c => def.countries.includes(c.country));
            if (regionClusters.length < 2)
                continue;
            const allTypes = new Set();
            let totalSignals = 0;
            for (const cluster of regionClusters) {
                cluster.signalTypes.forEach(t => allTypes.add(t));
                totalSignals += cluster.totalCount;
            }
            if (allTypes.size >= 2) {
                const typeLabels = {
                    internet_outage: 'internet disruptions',
                    military_flight: 'military air activity',
                    military_vessel: 'naval presence',
                    protest: 'civil unrest',
                    ais_disruption: 'shipping anomalies',
                    satellite_fire: 'thermal anomalies',
                    radiation_anomaly: 'radiation anomalies',
                    temporal_anomaly: 'baseline anomalies',
                    sanctions_pressure: 'sanctions pressure',
                    active_strike: 'active strikes',
                };
                const typeDescriptions = [...allTypes].map(t => typeLabels[t]).join(', ');
                const countries = regionClusters.map(c => c.countryName).join(', ');
                convergences.push({
                    region: def.name,
                    countries: regionClusters.map(c => c.country),
                    signalTypes: [...allTypes],
                    totalSignals,
                    description: `${def.name}: ${typeDescriptions} detected across ${countries}`,
                });
            }
        }
        return convergences.sort((a, b) => b.signalTypes.length - a.signalTypes.length);
    }
    generateAIContext() {
        const clusters = this.getCountryClusters().slice(0, 5);
        const convergences = this.getRegionalConvergence().slice(0, 3);
        if (clusters.length === 0 && convergences.length === 0) {
            return '';
        }
        const lines = ['[GEOGRAPHIC SIGNALS]'];
        if (convergences.length > 0) {
            lines.push('Regional convergence detected:');
            for (const c of convergences) {
                lines.push(`- ${c.description}`);
            }
        }
        if (clusters.length > 0) {
            lines.push('Top countries by signal activity:');
            for (const c of clusters) {
                const types = [...c.signalTypes].join(', ');
                lines.push(`- ${c.countryName}: ${c.totalCount} signals (${types}), convergence score: ${c.convergenceScore}`);
            }
        }
        return lines.join('\n');
    }
    getSummary() {
        const byType = {
            internet_outage: 0,
            military_flight: 0,
            military_vessel: 0,
            protest: 0,
            ais_disruption: 0,
            satellite_fire: 0,
            radiation_anomaly: 0,
            temporal_anomaly: 0,
            sanctions_pressure: 0,
            active_strike: 0,
        };
        for (const s of this.signals) {
            byType[s.type]++;
        }
        return {
            timestamp: new Date(),
            totalSignals: this.signals.length,
            byType,
            convergenceZones: this.getRegionalConvergence(),
            topCountries: this.getCountryClusters().slice(0, 10),
            aiContext: this.generateAIContext(),
        };
    }
    clear() {
        this.signals = [];
    }
    getSignalCount() {
        return this.signals.length;
    }
}
export const signalAggregator = new SignalAggregator();
