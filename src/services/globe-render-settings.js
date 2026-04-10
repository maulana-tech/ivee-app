const STORAGE_KEY = 'wm-globe-render-scale';
const EVENT_NAME = 'wm-globe-render-scale-changed';
const TEXTURE_STORAGE_KEY = 'wm-globe-texture';
const TEXTURE_EVENT_NAME = 'wm-globe-texture-changed';
export const GLOBE_RENDER_SCALE_OPTIONS = [
    { value: 'auto', labelKey: 'components.insights.globeRenderScaleOptions.auto', fallbackLabel: 'Auto (device)' },
    { value: '1', labelKey: 'components.insights.globeRenderScaleOptions.1', fallbackLabel: 'Eco (1x)' },
    { value: '1.5', labelKey: 'components.insights.globeRenderScaleOptions.1_5', fallbackLabel: 'Sharp (1.5x)' },
    { value: '2', labelKey: 'components.insights.globeRenderScaleOptions.2', fallbackLabel: '4K (2x)', disabled: true },
    { value: '3', labelKey: 'components.insights.globeRenderScaleOptions.3', fallbackLabel: 'Insane (3x)', disabled: true },
];
const ALLOWED_SCALES = GLOBE_RENDER_SCALE_OPTIONS.filter(o => !o.disabled).map(o => o.value);
export function getGlobeRenderScale() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && ALLOWED_SCALES.includes(raw))
            return raw;
    }
    catch {
        // ignore
    }
    return 'auto';
}
export function setGlobeRenderScale(scale) {
    const safeScale = ALLOWED_SCALES.includes(scale) ? scale : 'auto';
    try {
        localStorage.setItem(STORAGE_KEY, safeScale);
    }
    catch {
        // ignore
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { scale: safeScale } }));
}
export function subscribeGlobeRenderScaleChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.scale ?? getGlobeRenderScale());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}
export function resolveGlobePixelRatio(scale) {
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    if (scale === 'auto')
        return Math.min(1.5, Math.max(1, dpr));
    const num = Number(scale);
    if (!Number.isFinite(num) || num <= 0)
        return 1;
    return Math.min(1.5, Math.max(1, num));
}
export function resolvePerformanceProfile(scale) {
    const isEco = scale === '1';
    return {
        disablePulseAnimations: isEco,
        disableDashAnimations: isEco,
        disableAtmosphere: isEco,
    };
}
export const GLOBE_TEXTURE_OPTIONS = [
    { value: 'topographic', label: 'Topographic' },
    { value: 'blue-marble', label: 'Blue Marble (NASA)' },
];
export const GLOBE_TEXTURE_URLS = {
    'topographic': '/textures/earth-topo-bathy.jpg',
    'blue-marble': '/textures/earth-blue-marble.jpg',
};
export function getGlobeTexture() {
    try {
        const raw = localStorage.getItem(TEXTURE_STORAGE_KEY);
        if (raw === 'topographic' || raw === 'blue-marble')
            return raw;
    }
    catch { /* ignore */ }
    return 'topographic';
}
export function setGlobeTexture(texture) {
    try {
        localStorage.setItem(TEXTURE_STORAGE_KEY, texture);
    }
    catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(TEXTURE_EVENT_NAME, { detail: { texture } }));
}
export function subscribeGlobeTextureChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.texture ?? getGlobeTexture());
    };
    window.addEventListener(TEXTURE_EVENT_NAME, handler);
    return () => window.removeEventListener(TEXTURE_EVENT_NAME, handler);
}
const PRESET_STORAGE_KEY = 'wm-globe-visual-preset';
const PRESET_EVENT_NAME = 'wm-globe-visual-preset-changed';
export const GLOBE_VISUAL_PRESET_OPTIONS = [
    { value: 'classic', label: 'Earth' },
    { value: 'enhanced', label: 'Cosmos' },
];
export function getGlobeVisualPreset() {
    try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (raw === 'classic' || raw === 'enhanced')
            return raw;
    }
    catch { /* ignore */ }
    return 'classic';
}
export function setGlobeVisualPreset(preset) {
    try {
        localStorage.setItem(PRESET_STORAGE_KEY, preset);
    }
    catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(PRESET_EVENT_NAME, { detail: { preset } }));
}
export function subscribeGlobeVisualPresetChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.preset ?? getGlobeVisualPreset());
    };
    window.addEventListener(PRESET_EVENT_NAME, handler);
    return () => window.removeEventListener(PRESET_EVENT_NAME, handler);
}
