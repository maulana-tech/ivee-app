const STORAGE_KEY = 'wm-font-family';
const EVENT_NAME = 'wm-font-changed';
const ALLOWED = ['mono', 'system'];
export function getFontFamily() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && ALLOWED.includes(raw))
            return raw;
    }
    catch {
        // ignore
    }
    return 'mono';
}
export function setFontFamily(font) {
    const safe = ALLOWED.includes(font) ? font : 'mono';
    try {
        localStorage.setItem(STORAGE_KEY, safe);
    }
    catch {
        // ignore
    }
    applyFont(safe);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { font: safe } }));
}
export function applyFont(font) {
    const resolved = font ?? getFontFamily();
    if (resolved === 'system') {
        document.documentElement.dataset.font = 'system';
    }
    else {
        delete document.documentElement.dataset.font;
    }
}
export function subscribeFontChange(cb) {
    const handler = (e) => {
        const detail = e.detail;
        cb(detail?.font ?? getFontFamily());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}
