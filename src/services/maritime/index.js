import { getRpcBaseUrl } from '@/services/rpc-client';
import { MaritimeServiceClient, } from '@/generated/client/ivee/maritime/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { dataFreshness } from '../data-freshness';
import { isFeatureAvailable } from '../runtime-config';
import { startSmartPollLoop, toApiUrl } from '../runtime';
// ---- Proto fallback (desktop safety when relay URL is unavailable) ----
const client = new MaritimeServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const snapshotBreaker = createCircuitBreaker({ name: 'Maritime Snapshot', cacheTtlMs: 10 * 60 * 1000, persistCache: true });
const emptySnapshotFallback = { snapshot: undefined };
const DISRUPTION_TYPE_REVERSE = {
    AIS_DISRUPTION_TYPE_GAP_SPIKE: 'gap_spike',
    AIS_DISRUPTION_TYPE_CHOKEPOINT_CONGESTION: 'chokepoint_congestion',
};
const SEVERITY_REVERSE = {
    AIS_DISRUPTION_SEVERITY_LOW: 'low',
    AIS_DISRUPTION_SEVERITY_ELEVATED: 'elevated',
    AIS_DISRUPTION_SEVERITY_HIGH: 'high',
};
function toDisruptionEvent(proto) {
    return {
        id: proto.id,
        name: proto.name,
        type: DISRUPTION_TYPE_REVERSE[proto.type] || 'gap_spike',
        lat: proto.location?.latitude ?? 0,
        lon: proto.location?.longitude ?? 0,
        severity: SEVERITY_REVERSE[proto.severity] || 'low',
        changePct: proto.changePct,
        windowHours: proto.windowHours,
        darkShips: proto.darkShips,
        vesselCount: proto.vesselCount,
        region: proto.region,
        description: proto.description,
    };
}
function toDensityZone(proto) {
    return {
        id: proto.id,
        name: proto.name,
        lat: proto.location?.latitude ?? 0,
        lon: proto.location?.longitude ?? 0,
        intensity: proto.intensity,
        deltaPct: proto.deltaPct,
        shipsPerDay: proto.shipsPerDay,
        note: proto.note,
    };
}
// ---- Feature Gating ----
const isClientRuntime = typeof window !== 'undefined';
const aisConfigured = isClientRuntime && import.meta.env.VITE_ENABLE_AIS !== 'false';
export function isAisConfigured() {
    return aisConfigured && isFeatureAvailable('aisRelay');
}
const positionCallbacks = new Set();
const lastCallbackTimestampByMmsi = new Map();
// ---- Polling State ----
let pollLoop = null;
let inFlight = false;
let isPolling = false;
let lastPollAt = 0;
let lastSequence = 0;
let latestDisruptions = [];
let latestDensity = [];
let latestStatus = {
    connected: false,
    vessels: 0,
    messages: 0,
};
// ---- Constants ----
const SNAPSHOT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const SNAPSHOT_STALE_MS = 6 * 60 * 1000;
const CALLBACK_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_CALLBACK_TRACKED_VESSELS = 20000;
// ---- Raw Relay URL (for candidate reports path) ----
const SNAPSHOT_PROXY_URL = toApiUrl('/api/ais-snapshot');
const wsRelayUrl = import.meta.env.VITE_WS_RELAY_URL || '';
const DIRECT_RAILWAY_SNAPSHOT_URL = wsRelayUrl
    ? wsRelayUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/$/, '') + '/ais/snapshot'
    : '';
const LOCAL_SNAPSHOT_FALLBACK = 'http://localhost:3004/ais/snapshot';
const isLocalhost = isClientRuntime && window.location.hostname === 'localhost';
// ---- Internal Helpers ----
function shouldIncludeCandidates() {
    return positionCallbacks.size > 0;
}
function parseSnapshot(data) {
    if (!data || typeof data !== 'object')
        return null;
    const raw = data;
    if (!Array.isArray(raw.disruptions) || !Array.isArray(raw.density))
        return null;
    const status = raw.status || {};
    return {
        sequence: Number.isFinite(raw.sequence) ? Number(raw.sequence) : 0,
        status: {
            connected: Boolean(status.connected),
            vessels: Number.isFinite(status.vessels) ? Number(status.vessels) : 0,
            messages: Number.isFinite(status.messages) ? Number(status.messages) : 0,
        },
        disruptions: raw.disruptions,
        density: raw.density,
        candidateReports: Array.isArray(raw.candidateReports) ? raw.candidateReports : [],
    };
}
// ---- Hybrid Fetch Strategy ----
async function fetchRawRelaySnapshot(includeCandidates, signal) {
    const query = `?candidates=${includeCandidates ? 'true' : 'false'}`;
    try {
        const proxied = await fetch(`${SNAPSHOT_PROXY_URL}${query}`, { headers: { Accept: 'application/json' }, signal });
        if (proxied.ok)
            return proxied.json();
    }
    catch { /* Proxy unavailable -- fall through */ }
    // Local development fallback only.
    if (isLocalhost && DIRECT_RAILWAY_SNAPSHOT_URL) {
        try {
            const railway = await fetch(`${DIRECT_RAILWAY_SNAPSHOT_URL}${query}`, { headers: { Accept: 'application/json' }, signal });
            if (railway.ok)
                return railway.json();
        }
        catch { /* Railway unavailable -- fall through */ }
    }
    if (isLocalhost) {
        const local = await fetch(`${LOCAL_SNAPSHOT_FALLBACK}${query}`, { headers: { Accept: 'application/json' }, signal });
        if (local.ok)
            return local.json();
    }
    throw new Error('AIS raw relay snapshot unavailable');
}
async function fetchSnapshotPayload(includeCandidates, signal) {
    if (includeCandidates) {
        // Candidate reports are only available on the raw relay endpoint.
        return fetchRawRelaySnapshot(true, signal);
    }
    try {
        // Prefer direct relay path to avoid normal web traffic double-hop via Vercel.
        return await fetchRawRelaySnapshot(false, signal);
    }
    catch (rawError) {
        // Desktop fallback: use proto route when relay URL/local relay is unavailable.
        const response = await snapshotBreaker.execute(async () => {
            return client.getVesselSnapshot({ neLat: 0, neLon: 0, swLat: 0, swLon: 0 });
        }, emptySnapshotFallback);
        if (response.snapshot) {
            return {
                sequence: 0, // Proto payload does not include relay sequence.
                status: { connected: true, vessels: 0, messages: 0 },
                disruptions: response.snapshot.disruptions.map(toDisruptionEvent),
                density: response.snapshot.densityZones.map(toDensityZone),
                candidateReports: [],
            };
        }
        throw rawError;
    }
}
// ---- Callback Emission ----
function pruneCallbackTimestampIndex(now) {
    if (lastCallbackTimestampByMmsi.size <= MAX_CALLBACK_TRACKED_VESSELS) {
        return;
    }
    const threshold = now - CALLBACK_RETENTION_MS;
    for (const [mmsi, ts] of lastCallbackTimestampByMmsi) {
        if (ts < threshold) {
            lastCallbackTimestampByMmsi.delete(mmsi);
        }
    }
    if (lastCallbackTimestampByMmsi.size <= MAX_CALLBACK_TRACKED_VESSELS) {
        return;
    }
    const oldest = Array.from(lastCallbackTimestampByMmsi.entries())
        .sort((a, b) => a[1] - b[1]);
    const toDelete = lastCallbackTimestampByMmsi.size - MAX_CALLBACK_TRACKED_VESSELS;
    for (let i = 0; i < toDelete; i++) {
        const entry = oldest[i];
        if (!entry)
            break;
        lastCallbackTimestampByMmsi.delete(entry[0]);
    }
}
function emitCandidateReports(reports) {
    if (positionCallbacks.size === 0 || reports.length === 0)
        return;
    const now = Date.now();
    for (const report of reports) {
        if (!report?.mmsi || !Number.isFinite(report.lat) || !Number.isFinite(report.lon))
            continue;
        const reportTs = Number.isFinite(report.timestamp) ? Number(report.timestamp) : now;
        const lastTs = lastCallbackTimestampByMmsi.get(report.mmsi) || 0;
        if (reportTs <= lastTs)
            continue;
        lastCallbackTimestampByMmsi.set(report.mmsi, reportTs);
        const callbackData = {
            mmsi: report.mmsi,
            name: report.name || '',
            lat: report.lat,
            lon: report.lon,
            shipType: report.shipType,
            heading: report.heading,
            speed: report.speed,
            course: report.course,
        };
        for (const callback of positionCallbacks) {
            try {
                callback(callbackData);
            }
            catch {
                // Ignore callback errors
            }
        }
    }
    pruneCallbackTimestampIndex(now);
}
// ---- Polling ----
async function pollSnapshot(force = false, signal) {
    if (!isAisConfigured())
        return;
    if (inFlight && !force)
        return;
    if (signal?.aborted)
        return;
    inFlight = true;
    try {
        const includeCandidates = shouldIncludeCandidates();
        const payload = await fetchSnapshotPayload(includeCandidates, signal);
        const snapshot = parseSnapshot(payload);
        if (!snapshot)
            throw new Error('Invalid snapshot payload');
        latestDisruptions = snapshot.disruptions;
        latestDensity = snapshot.density;
        latestStatus = snapshot.status;
        lastPollAt = Date.now();
        if (includeCandidates) {
            if (snapshot.sequence > lastSequence) {
                emitCandidateReports(snapshot.candidateReports);
                lastSequence = snapshot.sequence;
            }
            else if (lastSequence === 0) {
                emitCandidateReports(snapshot.candidateReports);
                lastSequence = snapshot.sequence;
            }
        }
        else {
            lastSequence = snapshot.sequence;
        }
        const itemCount = latestDisruptions.length + latestDensity.length;
        if (itemCount > 0 || latestStatus.vessels > 0) {
            dataFreshness.recordUpdate('ais', itemCount > 0 ? itemCount : latestStatus.vessels);
        }
    }
    catch {
        latestStatus.connected = false;
    }
    finally {
        inFlight = false;
    }
}
function startPolling() {
    if (isPolling || !isAisConfigured())
        return;
    isPolling = true;
    void pollSnapshot(true);
    pollLoop?.stop();
    pollLoop = startSmartPollLoop(({ signal }) => pollSnapshot(false, signal), {
        intervalMs: SNAPSHOT_POLL_INTERVAL_MS,
        // AIS relay traffic is high-cost; pause entirely in hidden tabs.
        pauseWhenHidden: true,
        refreshOnVisible: true,
        runImmediately: false,
    });
}
// ---- Exported Functions ----
export function registerAisCallback(callback) {
    positionCallbacks.add(callback);
    startPolling();
}
export function unregisterAisCallback(callback) {
    positionCallbacks.delete(callback);
    if (positionCallbacks.size === 0) {
        lastCallbackTimestampByMmsi.clear();
    }
}
export function initAisStream() {
    startPolling();
}
export function disconnectAisStream() {
    pollLoop?.stop();
    pollLoop = null;
    isPolling = false;
    inFlight = false;
    latestStatus.connected = false;
}
export function getAisStatus() {
    const isFresh = Date.now() - lastPollAt <= SNAPSHOT_STALE_MS;
    return {
        connected: latestStatus.connected && isFresh,
        vessels: latestStatus.vessels,
        messages: latestStatus.messages,
    };
}
export async function fetchAisSignals() {
    if (!aisConfigured) {
        return { disruptions: [], density: [] };
    }
    startPolling();
    const shouldRefresh = Date.now() - lastPollAt > SNAPSHOT_STALE_MS;
    if (shouldRefresh) {
        await pollSnapshot(true);
    }
    return {
        disruptions: latestDisruptions,
        density: latestDensity,
    };
}
