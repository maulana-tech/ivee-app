/**
 * Quick Settings — Web-only user preferences for AI pipeline and map behavior.
 * Desktop (Tauri) manages AI config via its own settings window.
 *
 * TODO: Migrate panel visibility, sources, and language selector into this
 *       settings hub once the UI is extended with additional sections.
 */
const STORAGE_KEY_BROWSER_MODEL = 'wm-ai-flow-browser-model';
const STORAGE_KEY_CLOUD_LLM = 'wm-ai-flow-cloud-llm';
const STORAGE_KEY_MAP_NEWS_FLASH = 'wm-map-news-flash';
const STORAGE_KEY_HEADLINE_MEMORY = 'wm-headline-memory';
const STORAGE_KEY_BADGE_ANIMATION = 'wm-badge-animation';
const STORAGE_KEY_STREAM_QUALITY = 'wm-stream-quality';
const EVENT_NAME = 'ai-flow-changed';
const STREAM_QUALITY_EVENT = 'stream-quality-changed';
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
        // Quota or private-browsing; silently ignore
    }
}
const STORAGE_KEY_MAP = {
    browserModel: STORAGE_KEY_BROWSER_MODEL,
    cloudLlm: STORAGE_KEY_CLOUD_LLM,
    mapNewsFlash: STORAGE_KEY_MAP_NEWS_FLASH,
    headlineMemory: STORAGE_KEY_HEADLINE_MEMORY,
    badgeAnimation: STORAGE_KEY_BADGE_ANIMATION,
};
const DEFAULTS = {
    browserModel: false,
    cloudLlm: true,
    mapNewsFlash: true,
    headlineMemory: false,
    badgeAnimation: false,
};
export function getAiFlowSettings() {
    return {
        browserModel: readBool(STORAGE_KEY_BROWSER_MODEL, DEFAULTS.browserModel),
        cloudLlm: readBool(STORAGE_KEY_CLOUD_LLM, DEFAULTS.cloudLlm),
        mapNewsFlash: readBool(STORAGE_KEY_MAP_NEWS_FLASH, DEFAULTS.mapNewsFlash),
        headlineMemory: readBool(STORAGE_KEY_HEADLINE_MEMORY, DEFAULTS.headlineMemory),
        badgeAnimation: readBool(STORAGE_KEY_BADGE_ANIMATION, DEFAULTS.badgeAnimation),
    };
}
export function isHeadlineMemoryEnabled() {
    return readBool(STORAGE_KEY_HEADLINE_MEMORY, DEFAULTS.headlineMemory);
}
export function setAiFlowSetting(key, value) {
    writeBool(STORAGE_KEY_MAP[key], value);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
}
export function isAnyAiProviderEnabled() {
    const s = getAiFlowSettings();
    return s.cloudLlm || s.browserModel;
}
export function subscribeAiFlowChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.key);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}
export const STREAM_QUALITY_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 'small', label: 'Low (360p)' },
    { value: 'medium', label: 'Medium (480p)' },
    { value: 'large', label: 'High (480p+)' },
    { value: 'hd720', label: 'HD (720p)' },
];
export function getStreamQuality() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_STREAM_QUALITY);
        if (raw && ['auto', 'small', 'medium', 'large', 'hd720'].includes(raw))
            return raw;
    }
    catch { /* ignore */ }
    return 'auto';
}
export function setStreamQuality(quality) {
    try {
        localStorage.setItem(STORAGE_KEY_STREAM_QUALITY, quality);
    }
    catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(STREAM_QUALITY_EVENT, { detail: { quality } }));
}
export function subscribeStreamQualityChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail.quality);
    };
    window.addEventListener(STREAM_QUALITY_EVENT, handler);
    return () => window.removeEventListener(STREAM_QUALITY_EVENT, handler);
}
