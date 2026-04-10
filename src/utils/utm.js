const UTM_SOURCE = 'ivee';
const UTM_MEDIUM = 'referral';
function isExternalUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin !== window.location.origin;
    }
    catch {
        return false;
    }
}
function detectCampaign(anchor) {
    const panel = anchor.closest('[data-panel]');
    if (panel)
        return panel.dataset.panel || 'unknown';
    const popup = anchor.closest('.maplibregl-popup, .mapboxgl-popup');
    if (popup)
        return 'map-popup';
    const modal = anchor.closest('.modal, [role="dialog"]');
    if (modal)
        return 'modal';
    return 'general';
}
function appendUtmParams(url, campaign) {
    try {
        const parsed = new URL(url);
        if (parsed.searchParams.has('utm_source'))
            return url;
        parsed.searchParams.set('utm_source', UTM_SOURCE);
        parsed.searchParams.set('utm_medium', UTM_MEDIUM);
        parsed.searchParams.set('utm_campaign', campaign);
        return parsed.toString();
    }
    catch {
        return url;
    }
}
export function installUtmInterceptor() {
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[target="_blank"]');
        if (!anchor)
            return;
        const href = anchor.href;
        if (!href || !isExternalUrl(href))
            return;
        const campaign = detectCampaign(anchor);
        anchor.href = appendUtmParams(href, campaign);
    }, true);
}
