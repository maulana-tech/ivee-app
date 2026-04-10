import { CLOUD_SYNC_KEYS } from './sync-keys';
const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;
const SETTINGS_KEY_PREFIXES = [
    ...CLOUD_SYNC_KEYS,
    // device-local / export-only (excluded from cloud sync)
    'ivee-live-channels',
    'ivee-active-channel',
    'ivee-runtime-feature-toggles',
    'wm-globe-render-scale',
    'wm-live-streams-always-on',
    'ivee-webcam-prefs',
    'wm-map-theme:',
    'map-height',
    'map-pinned',
    'mobile-map-collapsed',
    'positive-threshold',
];
function isSettingsKey(key) {
    return SETTINGS_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
}
export function exportSettings() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !isSettingsKey(key))
            continue;
        const value = localStorage.getItem(key);
        if (value !== null)
            data[key] = value;
    }
    const exportData = {
        version: 1,
        timestamp: new Date().toISOString(),
        variant: localStorage.getItem('ivee-variant') || 'full',
        data,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `ivee-settings-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
export function importSettings(file) {
    return new Promise((resolve, reject) => {
        if (file.size > MAX_IMPORT_SIZE_BYTES) {
            reject(new Error('File is too large. Maximum size is 5MB.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                const parsed = JSON.parse(result);
                if (!parsed || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
                    throw new Error('Invalid format: expected an object with a data property.');
                }
                if (parsed.version !== 1) {
                    throw new Error(`Unsupported settings version: ${parsed.version}`);
                }
                let keysImported = 0;
                for (const [key, value] of Object.entries(parsed.data)) {
                    if (isSettingsKey(key) && typeof value === 'string') {
                        localStorage.setItem(key, value);
                        keysImported++;
                    }
                }
                resolve({ success: true, keysImported });
            }
            catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
