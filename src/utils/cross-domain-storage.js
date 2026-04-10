const COOKIE_DOMAIN = '.ivee.app';
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
function usesCookies() {
    return location.hostname.endsWith('ivee.app');
}
export function getDismissed(key) {
    if (usesCookies()) {
        return document.cookie.split('; ').some((c) => c === `${key}=1`);
    }
    return localStorage.getItem(key) === '1' || localStorage.getItem(key) === 'true';
}
export function setDismissed(key) {
    if (usesCookies()) {
        document.cookie = `${key}=1; domain=${COOKIE_DOMAIN}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
    }
    localStorage.setItem(key, '1');
}
