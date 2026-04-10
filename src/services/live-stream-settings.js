/**
 * Live stream playback preferences shared across Live News + Live Webcams.
 *
 * Default: Always On (no idle auto-pause). Users can enable Eco mode to
 * pause streams after inactivity to reduce CPU/bandwidth.
 */
const STORAGE_KEY_LIVE_STREAMS_ALWAYS_ON = 'wm-live-streams-always-on';
const EVENT_NAME = 'wm-live-streams-settings-changed';
function readBool(key, defaultValue) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null)
            return defaultValue;
        return raw === 'true';
    }
    catch {
        return defaultValue;
    }
}
function writeBool(key, value) {
    try {
        localStorage.setItem(key, String(value));
    }
    catch {
        // ignore
    }
}
export function getLiveStreamsAlwaysOn() {
    return readBool(STORAGE_KEY_LIVE_STREAMS_ALWAYS_ON, true);
}
export function setLiveStreamsAlwaysOn(alwaysOn) {
    writeBool(STORAGE_KEY_LIVE_STREAMS_ALWAYS_ON, alwaysOn);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { alwaysOn } }));
}
export function subscribeLiveStreamsSettingsChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.alwaysOn ?? getLiveStreamsAlwaysOn());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}
