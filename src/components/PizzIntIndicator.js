import { t } from '@/services/i18n';
import { h, replaceChildren } from '@/utils/dom-utils';
const DEFCON_COLORS = {
    1: '#ff0040',
    2: '#ff4400',
    3: '#ffaa00',
    4: '#00aaff',
    5: '#2d8a6e',
};
export class PizzIntIndicator {
    constructor() {
        Object.defineProperty(this, "element", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isExpanded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "tensions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        const panel = h('div', { className: 'pizzint-panel hidden' }, h('div', { className: 'pizzint-header' }, h('span', { className: 'pizzint-title' }, t('components.pizzint.title')), h('button', {
            className: 'pizzint-close',
            onClick: () => { this.isExpanded = false; panel.classList.add('hidden'); },
        }, '×')), h('div', { className: 'pizzint-status-bar' }, h('div', { className: 'pizzint-defcon-label' })), h('div', { className: 'pizzint-locations' }), h('div', { className: 'pizzint-tensions' }, h('div', { className: 'pizzint-tensions-title' }, t('components.pizzint.tensionsTitle')), h('div', { className: 'pizzint-tensions-list' })), h('div', { className: 'pizzint-footer' }, h('span', { className: 'pizzint-source' }, t('components.pizzint.source'), ' ', h('a', { href: 'https://pizzint.watch', target: '_blank', rel: 'noopener' }, 'PizzINT')), h('span', { className: 'pizzint-updated' })));
        this.element = h('div', { className: 'pizzint-indicator' }, h('button', {
            className: 'pizzint-toggle',
            title: t('components.pizzint.title'),
            onClick: () => { this.isExpanded = !this.isExpanded; panel.classList.toggle('hidden', !this.isExpanded); },
        }, h('span', { className: 'pizzint-icon' }, '🍕'), h('span', { className: 'pizzint-defcon' }, '--'), h('span', { className: 'pizzint-score' }, '--%')), panel);
    }
    updateStatus(status) {
        this.status = status;
        this.render();
    }
    updateTensions(tensions) {
        this.tensions = tensions;
        this.renderTensions();
    }
    render() {
        if (!this.status)
            return;
        const defconEl = this.element.querySelector('.pizzint-defcon');
        const scoreEl = this.element.querySelector('.pizzint-score');
        const labelEl = this.element.querySelector('.pizzint-defcon-label');
        const locationsEl = this.element.querySelector('.pizzint-locations');
        const updatedEl = this.element.querySelector('.pizzint-updated');
        const color = DEFCON_COLORS[this.status.defconLevel] || '#888';
        defconEl.textContent = t('components.pizzint.defcon', { level: String(this.status.defconLevel) });
        defconEl.style.background = color;
        defconEl.style.color = this.status.defconLevel <= 3 ? '#000' : '#fff';
        scoreEl.textContent = `${this.status.aggregateActivity}%`;
        labelEl.textContent = this.getDefconLabel(this.status.defconLevel);
        labelEl.style.color = color;
        replaceChildren(locationsEl, ...this.status.locations.map(loc => h('div', { className: 'pizzint-location' }, h('span', { className: 'pizzint-location-name' }, loc.name), h('span', { className: `pizzint-location-status ${this.getStatusClass(loc)}` }, this.getStatusLabel(loc)))));
        const timeAgo = this.formatTimeAgo(this.status.lastUpdate);
        updatedEl.textContent = t('components.pizzint.updated', { timeAgo });
    }
    renderTensions() {
        const listEl = this.element.querySelector('.pizzint-tensions-list');
        if (!listEl)
            return;
        replaceChildren(listEl, ...this.tensions.map(tp => {
            const trendIcon = tp.trend === 'rising' ? '↑' : tp.trend === 'falling' ? '↓' : '→';
            const changeText = tp.changePercent > 0 ? `+${tp.changePercent}%` : `${tp.changePercent}%`;
            return h('div', { className: 'pizzint-tension-row' }, h('span', { className: 'pizzint-tension-label' }, tp.label), h('span', { className: 'pizzint-tension-score' }, h('span', { className: 'pizzint-tension-value' }, tp.score.toFixed(1)), h('span', { className: `pizzint-tension-trend ${tp.trend}` }, `${trendIcon} ${changeText}`)));
        }));
    }
    getStatusClass(loc) {
        if (loc.is_closed_now)
            return 'closed';
        if (loc.is_spike)
            return 'spike';
        if (loc.current_popularity >= 70)
            return 'high';
        if (loc.current_popularity >= 40)
            return 'elevated';
        if (loc.current_popularity >= 15)
            return 'nominal';
        return 'quiet';
    }
    getStatusLabel(loc) {
        if (loc.is_closed_now)
            return t('components.pizzint.statusClosed');
        if (loc.is_spike)
            return `${t('components.pizzint.statusSpike')} ${loc.current_popularity}%`;
        if (loc.current_popularity >= 70)
            return `${t('components.pizzint.statusHigh')} ${loc.current_popularity}%`;
        if (loc.current_popularity >= 40)
            return `${t('components.pizzint.statusElevated')} ${loc.current_popularity}%`;
        if (loc.current_popularity >= 15)
            return `${t('components.pizzint.statusNominal')} ${loc.current_popularity}%`;
        return `${t('components.pizzint.statusQuiet')} ${loc.current_popularity}%`;
    }
    formatTimeAgo(date) {
        const diff = Date.now() - date.getTime();
        if (diff < 60000)
            return t('components.pizzint.justNow');
        if (diff < 3600000)
            return t('components.pizzint.minutesAgo', { m: String(Math.floor(diff / 60000)) });
        return t('components.pizzint.hoursAgo', { h: String(Math.floor(diff / 3600000)) });
    }
    getDefconLabel(level) {
        const key = `components.pizzint.defconLabels.${level}`;
        const localized = t(key);
        return localized === key ? this.status?.defconLabel || '' : localized;
    }
    getElement() {
        return this.element;
    }
    hide() {
        this.element.style.display = 'none';
    }
    show() {
        this.element.style.display = '';
    }
}
