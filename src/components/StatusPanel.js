import { SITE_VARIANT } from '@/config';
import { h } from '@/utils/dom-utils'; // kept for Panel base class compat
// Allowlists for each variant
const TECH_FEEDS = new Set([
    'Tech', 'Ai', 'Startups', 'Vcblogs', 'RegionalStartups',
    'Unicorns', 'Accelerators', 'Security', 'Policy', 'Layoffs',
    'Finance', 'Hardware', 'Cloud', 'Dev', 'Tech Events', 'Crypto',
    'Markets', 'Events', 'Producthunt', 'Funding', 'Polymarket',
    'Cyber Threats'
]);
const TECH_APIS = new Set([
    'RSS Proxy', 'Finnhub', 'CoinGecko', 'Tech Events API', 'Service Status', 'Polymarket',
    'Cyber Threats API'
]);
const WORLD_FEEDS = new Set([
    'Politics', 'Middleeast', 'Tech', 'Ai', 'Finance',
    'Gov', 'Intel', 'Layoffs', 'Thinktanks', 'Energy',
    'Polymarket', 'Weather', 'NetBlocks', 'Shipping', 'Military',
    'Cyber Threats', 'GPS Jam'
]);
const WORLD_APIS = new Set([
    'RSS2JSON', 'Finnhub', 'CoinGecko', 'Polymarket', 'USGS', 'FRED',
    'AISStream', 'GDELT Doc', 'EIA', 'USASpending', 'PizzINT', 'FIRMS',
    'Cyber Threats API', 'BIS', 'WTO', 'SupplyChain', 'OFAC'
]);
import { t } from '../services/i18n';
import { Panel } from './Panel';
export class StatusPanel extends Panel {
    constructor() {
        super({ id: 'status', title: t('panels.status') });
        Object.defineProperty(this, "feeds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "apis", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "allowedFeeds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "allowedApis", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onUpdate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.init();
    }
    init() {
        this.allowedFeeds = SITE_VARIANT === 'tech' ? TECH_FEEDS : WORLD_FEEDS;
        this.allowedApis = SITE_VARIANT === 'tech' ? TECH_APIS : WORLD_APIS;
        this.element = h('div', { className: 'status-panel-container' });
        this.initDefaultStatuses();
    }
    initDefaultStatuses() {
        this.allowedFeeds.forEach(name => {
            this.feeds.set(name, { name, lastUpdate: null, status: 'disabled', itemCount: 0 });
        });
        this.allowedApis.forEach(name => {
            this.apis.set(name, { name, status: 'disabled' });
        });
    }
    getFeeds() { return this.feeds; }
    getApis() { return this.apis; }
    updateFeed(name, status) {
        if (!this.allowedFeeds.has(name))
            return;
        const existing = this.feeds.get(name) || { name, lastUpdate: null, status: 'ok', itemCount: 0 };
        this.feeds.set(name, { ...existing, ...status, lastUpdate: new Date() });
        this.onUpdate?.();
    }
    updateApi(name, status) {
        if (!this.allowedApis.has(name))
            return;
        const existing = this.apis.get(name) || { name, status: 'ok' };
        this.apis.set(name, { ...existing, ...status });
        this.onUpdate?.();
    }
    setFeedDisabled(name) {
        const existing = this.feeds.get(name);
        if (existing) {
            this.feeds.set(name, { ...existing, status: 'disabled', itemCount: 0, lastUpdate: null });
            this.onUpdate?.();
        }
    }
    setApiDisabled(name) {
        const existing = this.apis.get(name);
        if (existing) {
            this.apis.set(name, { ...existing, status: 'disabled' });
            this.onUpdate?.();
        }
    }
    formatTime(date) {
        const now = Date.now();
        const diff = now - date.getTime();
        if (diff < 60000)
            return 'just now';
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)}m ago`;
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    getElement() {
        return this.element;
    }
}
