import { loadFromStorage, saveToStorage } from '@/utils';
import { sanitizeWidgetHtml } from '@/utils/widget-sanitizer';
import { getAuthState } from '@/services/auth-state';
const STORAGE_KEY = 'wm-custom-widgets';
const PANEL_SPANS_KEY = 'ivee-panel-spans';
const PANEL_COL_SPANS_KEY = 'ivee-panel-col-spans';
const MAX_WIDGETS = 10;
const MAX_HISTORY = 10;
const MAX_HTML_CHARS = 50000;
const MAX_HTML_CHARS_PRO = 80000;
function proHtmlKey(id) {
    return `wm-pro-html-${id}`;
}
export function loadWidgets() {
    const raw = loadFromStorage(STORAGE_KEY, []);
    const result = [];
    for (const w of raw) {
        const tier = w.tier === 'pro' ? 'pro' : 'basic';
        if (tier === 'pro') {
            const proHtml = localStorage.getItem(proHtmlKey(w.id));
            if (!proHtml) {
                // HTML missing — drop widget and clean up spans
                cleanSpanEntry(PANEL_SPANS_KEY, w.id);
                cleanSpanEntry(PANEL_COL_SPANS_KEY, w.id);
                continue;
            }
            result.push({ ...w, tier, html: proHtml });
        }
        else {
            result.push({ ...w, tier: 'basic' });
        }
    }
    return result;
}
export function saveWidget(spec) {
    if (spec.tier === 'pro') {
        const proHtml = spec.html.slice(0, MAX_HTML_CHARS_PRO);
        // Write HTML first (raw localStorage — must be catchable for rollback)
        try {
            localStorage.setItem(proHtmlKey(spec.id), proHtml);
        }
        catch {
            throw new Error('Storage quota exceeded saving PRO widget HTML');
        }
        // Build metadata entry (no html field)
        const meta = {
            ...spec,
            html: '',
            conversationHistory: spec.conversationHistory.slice(-MAX_HISTORY),
        };
        const existing = loadFromStorage(STORAGE_KEY, []).filter(w => w.id !== spec.id);
        const updated = [...existing, meta].slice(-MAX_WIDGETS);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        catch {
            // Rollback HTML write
            localStorage.removeItem(proHtmlKey(spec.id));
            throw new Error('Storage quota exceeded saving PRO widget metadata');
        }
    }
    else {
        const trimmed = {
            ...spec,
            tier: 'basic',
            html: sanitizeWidgetHtml(spec.html.slice(0, MAX_HTML_CHARS)),
            conversationHistory: spec.conversationHistory.slice(-MAX_HISTORY),
        };
        const existing = loadWidgets().filter(w => w.id !== trimmed.id);
        const updated = [...existing, trimmed].slice(-MAX_WIDGETS);
        saveToStorage(STORAGE_KEY, updated);
    }
}
export function deleteWidget(id) {
    const updated = loadFromStorage(STORAGE_KEY, []).filter(w => w.id !== id);
    saveToStorage(STORAGE_KEY, updated);
    try {
        localStorage.removeItem(proHtmlKey(id));
    }
    catch { /* ignore */ }
    cleanSpanEntry(PANEL_SPANS_KEY, id);
    cleanSpanEntry(PANEL_COL_SPANS_KEY, id);
}
export function getWidget(id) {
    return loadWidgets().find(w => w.id === id) ?? null;
}
// ── Cross-domain key helpers ──────────────────────────────────────────────
// Cookies with domain=.ivee.app are shared across all subdomains
// (ivee.app, tech., finance., commodity., happy., etc.).
// We read cookie first and fall back to localStorage for migration compat.
const COOKIE_DOMAIN = '.ivee.app';
const KEY_MAX_AGE = 365 * 24 * 60 * 60;
function usesCookies() {
    return location.hostname.endsWith('ivee.app');
}
function getCookieValue(name) {
    try {
        const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
        return match ? match.slice(name.length + 1) : '';
    }
    catch {
        return '';
    }
}
function setDomainCookie(name, value) {
    if (!usesCookies())
        return;
    document.cookie = `${name}=${encodeURIComponent(value)}; domain=${COOKIE_DOMAIN}; path=/; max-age=${KEY_MAX_AGE}; SameSite=Lax; Secure`;
}
function getKey(name) {
    const cookieVal = getCookieValue(name);
    if (cookieVal)
        return decodeURIComponent(cookieVal);
    try {
        return localStorage.getItem(name) ?? '';
    }
    catch {
        return '';
    }
}
export function setWidgetKey(key) {
    setDomainCookie('wm-widget-key', key);
    try {
        localStorage.setItem('wm-widget-key', key);
    }
    catch { /* ignore */ }
}
export function setProKey(key) {
    setDomainCookie('wm-pro-key', key);
    try {
        localStorage.setItem('wm-pro-key', key);
    }
    catch { /* ignore */ }
}
export function isWidgetFeatureEnabled() {
    return !!getKey('wm-widget-key');
}
export function getWidgetAgentKey() {
    return getKey('wm-widget-key');
}
export function getBrowserTesterKeys() {
    const keys = [getProWidgetKey(), getWidgetAgentKey()];
    const seen = new Set();
    const result = [];
    for (const raw of keys) {
        const key = raw.trim();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        result.push(key);
    }
    return result;
}
export function getBrowserTesterKey() {
    return getBrowserTesterKeys()[0] ?? '';
}
export function isProWidgetEnabled() {
    return !!getKey('wm-pro-key');
}
export function isProUser() {
    return isWidgetFeatureEnabled() || isProWidgetEnabled() || getAuthState().user?.role === 'pro';
}
export function getProWidgetKey() {
    return getKey('wm-pro-key');
}
function cleanSpanEntry(storageKey, panelId) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw)
            return;
        const spans = JSON.parse(raw);
        if (!(panelId in spans))
            return;
        delete spans[panelId];
        if (Object.keys(spans).length === 0) {
            localStorage.removeItem(storageKey);
        }
        else {
            localStorage.setItem(storageKey, JSON.stringify(spans));
        }
    }
    catch {
        // ignore
    }
}
