import { invalidateColorCache } from './theme-colors';
const STORAGE_KEY = 'ivee-theme';
const DEFAULT_THEME = 'dark';
function resolveThemeColor(theme, variant) {
    if (theme === 'dark')
        return variant === 'happy' ? '#1A2332' : '#0a0f0a';
    return variant === 'happy' ? '#FAFAF5' : '#f8f9fa';
}
function updateThemeMetaColor(theme, variant = document.documentElement.dataset.variant) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
        meta.content = resolveThemeColor(theme, variant);
}
/**
 * Read the stored theme preference from localStorage.
 * Returns 'dark' or 'light' if valid, otherwise DEFAULT_THEME.
 */
export function getStoredTheme() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light')
            return stored;
    }
    catch {
        // localStorage unavailable (e.g., sandboxed iframe, private browsing)
    }
    return DEFAULT_THEME;
}
export function getThemePreference() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'auto' || stored === 'dark' || stored === 'light')
            return stored;
    }
    catch { /* noop */ }
    return 'auto';
}
function resolveAutoTheme() {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}
let autoMediaQuery = null;
let autoMediaHandler = null;
function teardownAutoListener() {
    if (autoMediaQuery && autoMediaHandler) {
        autoMediaQuery.removeEventListener('change', autoMediaHandler);
        autoMediaQuery = null;
        autoMediaHandler = null;
    }
}
export function setThemePreference(pref) {
    try {
        localStorage.setItem(STORAGE_KEY, pref);
    }
    catch { /* noop */ }
    teardownAutoListener();
    const effective = pref === 'auto' ? resolveAutoTheme() : pref;
    setTheme(effective);
    if (pref === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
        autoMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        autoMediaHandler = () => setTheme(resolveAutoTheme());
        autoMediaQuery.addEventListener('change', autoMediaHandler);
    }
}
/**
 * Read the current theme from the document root's data-theme attribute.
 */
export function getCurrentTheme() {
    const value = document.documentElement.dataset.theme;
    if (value === 'dark' || value === 'light')
        return value;
    return DEFAULT_THEME;
}
/**
 * Set the active theme: update DOM attribute, invalidate color cache,
 * persist to localStorage, update meta theme-color, and dispatch event.
 */
export function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    invalidateColorCache();
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    }
    catch {
        // localStorage unavailable
    }
    updateThemeMetaColor(theme);
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}
/**
 * Apply the stored theme preference to the document before components mount.
 * Only sets the data-theme attribute and meta theme-color — does NOT dispatch
 * events or invalidate the color cache (components aren't mounted yet).
 *
 * The inline script in index.html already handles the fast FOUC-free path.
 * This is a safety net for cases where the inline script didn't run.
 */
export function applyStoredTheme() {
    const variant = document.documentElement.dataset.variant;
    // Check raw localStorage to distinguish "no preference" from "explicitly chose dark"
    let raw = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    }
    catch { /* noop */ }
    const hasExplicitPreference = raw === 'dark' || raw === 'light' || raw === 'auto';
    let effective;
    if (raw === 'auto') {
        effective = resolveAutoTheme();
    }
    else if (hasExplicitPreference) {
        effective = raw;
    }
    else {
        // No stored preference: happy defaults to light, others to dark
        effective = variant === 'happy' ? 'light' : DEFAULT_THEME;
    }
    document.documentElement.dataset.theme = effective;
    updateThemeMetaColor(effective, variant);
}
