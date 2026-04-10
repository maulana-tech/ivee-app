import { DEFAULT_UPGRADE_PRODUCT } from '@/config/products';
import { getAuthState, subscribeAuthState } from '@/services/auth-state';
import { openSignIn } from '@/services/clerk';
import { PanelGateReason, getPanelGateReason } from '@/services/panel-gating';
import { getResilienceScore } from '@/services/resilience';
import { isDesktopRuntime } from '@/services/runtime';
import { invokeTauri } from '@/services/tauri-bridge';
import { h, replaceChildren } from '@/utils/dom-utils';
import { RESILIENCE_VISUAL_LEVEL_COLORS, formatBaselineStress, formatResilienceChange30d, formatResilienceConfidence, getResilienceDomainLabel, getResilienceTrendArrow, getResilienceVisualLevel, } from './resilience-widget-utils';
const LOCKED_PREVIEW = {
    countryCode: 'US',
    overallScore: 73,
    baselineScore: 82,
    stressScore: 58,
    stressFactor: 0.21,
    level: 'high',
    domains: [
        { id: 'economic', score: 82, weight: 0.22, dimensions: [] },
        { id: 'infrastructure', score: 68, weight: 0.2, dimensions: [] },
        { id: 'energy', score: 88, weight: 0.15, dimensions: [] },
        { id: 'social-governance', score: 71, weight: 0.25, dimensions: [] },
        { id: 'health-food', score: 54, weight: 0.18, dimensions: [] },
    ],
    trend: 'rising',
    change30d: 2.4,
    lowConfidence: false,
    imputationShare: 0,
    dataVersion: '',
};
function normalizeCountryCode(countryCode) {
    const normalized = String(countryCode || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}
function clampScore(score) {
    if (!Number.isFinite(score))
        return 0;
    return Math.min(100, Math.max(0, score));
}
export class ResilienceWidget {
    constructor(countryCode) {
        Object.defineProperty(this, "element", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "authState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: getAuthState()
        });
        Object.defineProperty(this, "unsubscribeAuth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentCountryCode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "loading", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "errorMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "requestVersion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "energyMixData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.element = document.createElement('section');
        this.element.className = 'cdp-card resilience-widget';
        this.unsubscribeAuth = subscribeAuthState((state) => {
            this.authState = state;
            const gateReason = this.getGateReason();
            if (gateReason === PanelGateReason.NONE && this.currentCountryCode && !this.loading && this.currentData?.countryCode !== this.currentCountryCode) {
                void this.refresh();
                return;
            }
            this.render();
        });
        this.setCountryCode(countryCode ?? null);
    }
    getElement() {
        return this.element;
    }
    setCountryCode(countryCode) {
        const normalized = normalizeCountryCode(countryCode);
        if (normalized === this.currentCountryCode)
            return;
        this.currentCountryCode = normalized;
        this.currentData = null;
        this.energyMixData = null;
        this.errorMessage = null;
        this.loading = false;
        this.requestVersion += 1;
        if (!normalized) {
            this.render();
            return;
        }
        void this.refresh();
    }
    async refresh() {
        if (!this.currentCountryCode) {
            this.render();
            return;
        }
        if (this.authState.isPending || this.getGateReason() !== PanelGateReason.NONE) {
            this.render();
            return;
        }
        const requestVersion = ++this.requestVersion;
        this.loading = true;
        this.errorMessage = null;
        this.render();
        try {
            const response = await getResilienceScore(this.currentCountryCode);
            if (requestVersion !== this.requestVersion)
                return;
            this.currentData = response;
            this.loading = false;
            this.errorMessage = null;
            this.render();
        }
        catch (error) {
            if (requestVersion !== this.requestVersion)
                return;
            this.loading = false;
            this.currentData = null;
            this.errorMessage = error instanceof Error ? error.message : 'Unable to load resilience score.';
            this.render();
        }
    }
    setEnergyMix(data) {
        this.energyMixData = data;
        this.render();
    }
    destroy() {
        this.requestVersion += 1;
        this.unsubscribeAuth?.();
        this.unsubscribeAuth = null;
    }
    getGateReason() {
        return getPanelGateReason(this.authState, true);
    }
    render() {
        const gateReason = this.getGateReason();
        const body = this.renderBody(gateReason);
        replaceChildren(this.element, h('div', { className: 'resilience-widget__header' }, h('h3', { className: 'cdp-card-title resilience-widget__title' }, 'Resilience Score'), h('span', {
            className: 'resilience-widget__help',
            title: 'Composite resilience score derived from economic, infrastructure, energy, social/governance, and health/food domains.',
            'aria-label': 'Resilience score methodology',
        }, '?')), body);
    }
    renderBody(gateReason) {
        if (!this.currentCountryCode) {
            return h('div', { className: 'cdp-card-body' }, this.makeEmpty('Resilience data loads when a country is selected.'));
        }
        if (this.authState.isPending) {
            return h('div', { className: 'cdp-card-body' }, this.makeLoading('Checking access…'));
        }
        if (gateReason !== PanelGateReason.NONE) {
            return this.renderLocked(gateReason);
        }
        if (this.loading) {
            return h('div', { className: 'cdp-card-body' }, this.makeLoading('Loading resilience score…'));
        }
        if (this.errorMessage) {
            return this.renderError(this.errorMessage);
        }
        if (!this.currentData) {
            return h('div', { className: 'cdp-card-body' }, this.makeEmpty('Resilience score unavailable.'));
        }
        return this.renderScoreCard(this.currentData);
    }
    renderLocked(gateReason) {
        const description = gateReason === PanelGateReason.ANONYMOUS
            ? 'Sign in to unlock premium resilience scores.'
            : 'Upgrade to Pro to unlock resilience scores.';
        const cta = gateReason === PanelGateReason.ANONYMOUS ? 'Sign In' : 'Upgrade to Pro';
        const preview = this.renderScoreCard(LOCKED_PREVIEW, true);
        preview.classList.add('resilience-widget__preview');
        const button = h('button', {
            type: 'button',
            className: 'panel-locked-cta resilience-widget__cta',
            onclick: () => {
                if (gateReason === PanelGateReason.ANONYMOUS) {
                    openSignIn();
                    return;
                }
                this.openUpgradeFlow();
            },
        }, cta);
        return h('div', { className: 'cdp-card-body resilience-widget__locked' }, preview, h('div', { className: 'panel-locked-desc resilience-widget__gate-desc' }, description), button);
    }
    renderError(message) {
        return h('div', { className: 'cdp-card-body resilience-widget__error' }, h('div', { className: 'cdp-empty' }, message), h('button', {
            type: 'button',
            className: 'cdp-action-btn resilience-widget__retry',
            onclick: () => void this.refresh(),
        }, 'Retry'));
    }
    renderScoreCard(data, preview = false) {
        const visualLevel = getResilienceVisualLevel(data.overallScore);
        const levelLabel = visualLevel.replace('_', ' ').toUpperCase();
        const levelColor = RESILIENCE_VISUAL_LEVEL_COLORS[visualLevel];
        return h('div', { className: 'cdp-card-body resilience-widget__body' }, h('div', { className: 'resilience-widget__overall' }, this.renderBarBlock(clampScore(data.overallScore), levelColor, h('div', { className: 'resilience-widget__overall-meta' }, h('span', { className: 'resilience-widget__overall-score' }, String(Math.round(clampScore(data.overallScore)))), h('span', { className: 'resilience-widget__overall-level', style: { color: levelColor } }, levelLabel), h('span', { className: 'resilience-widget__overall-trend' }, `${getResilienceTrendArrow(data.trend)} ${data.trend}`)))), ...(data.baselineScore != null && data.stressScore != null
            ? [h('div', { className: 'resilience-widget__baseline-stress' }, h('span', { className: 'resilience-widget__baseline-stress-text' }, formatBaselineStress(data.baselineScore, data.stressScore)))]
            : []), h('div', { className: 'resilience-widget__domains' }, ...data.domains.map((domain) => this.renderDomainRow(domain, preview))), h('div', { className: 'resilience-widget__footer' }, h('span', {
            className: `resilience-widget__confidence${data.lowConfidence ? ' resilience-widget__confidence--low' : ''}`,
            title: preview ? 'Preview only' : 'Coverage and imputation-based confidence signal.',
        }, formatResilienceConfidence(data)), h('span', { className: 'resilience-widget__delta' }, formatResilienceChange30d(data.change30d))));
    }
    renderDomainRow(domain, preview = false) {
        const score = clampScore(domain.score);
        const levelColor = RESILIENCE_VISUAL_LEVEL_COLORS[getResilienceVisualLevel(score)];
        const attrs = { className: 'resilience-widget__domain-row' };
        if (!preview && domain.id === 'energy' && this.energyMixData?.mixAvailable) {
            const d = this.energyMixData;
            const parts = [
                `Import dep: ${d.importShare.toFixed(1)}%`,
                `Gas: ${d.gasShare.toFixed(1)}%`,
                `Coal: ${d.coalShare.toFixed(1)}%`,
                `Renew: ${d.renewShare.toFixed(1)}%`,
            ];
            if (d.gasStorageAvailable)
                parts.push(`EU storage: ${d.gasStorageFillPct.toFixed(1)}%`);
            attrs['title'] = parts.join(' | ');
        }
        return h('div', attrs, h('span', { className: 'resilience-widget__domain-label' }, getResilienceDomainLabel(domain.id)), this.renderBarBlock(score, levelColor), h('span', { className: 'resilience-widget__domain-score' }, String(Math.round(score))));
    }
    renderBarBlock(score, color, trailing) {
        return h('div', { className: 'resilience-widget__bar-block' }, h('div', { className: 'resilience-widget__bar-track' }, h('div', {
            className: 'resilience-widget__bar-fill',
            style: {
                width: `${score}%`,
                background: color,
            },
        })), trailing ?? null);
    }
    makeLoading(text) {
        return h('div', { className: 'cdp-loading-inline' }, h('div', { className: 'cdp-loading-line' }), h('div', { className: 'cdp-loading-line cdp-loading-line-short' }), h('span', { className: 'cdp-loading-text' }, text));
    }
    makeEmpty(text) {
        return h('div', { className: 'cdp-empty' }, text);
    }
    openUpgradeFlow() {
        if (isDesktopRuntime()) {
            void invokeTauri('open_url', { url: 'https://ivee.app/pro' })
                .catch(() => window.open('https://ivee.app/pro', '_blank'));
            return;
        }
        import('@/services/checkout')
            .then((module) => module.startCheckout(DEFAULT_UPGRADE_PRODUCT))
            .catch(() => {
            window.open('https://ivee.app/pro', '_blank');
        });
    }
}
