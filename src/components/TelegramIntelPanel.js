import { Panel } from './Panel';
import { sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { h, replaceChildren, safeHtml } from '@/utils/dom-utils';
import { TELEGRAM_TOPICS, formatTelegramTime, } from '@/services/telegram-intel';
const LIVE_THRESHOLD_MS = 600000;
export class TelegramIntelPanel extends Panel {
    constructor() {
        super({
            id: 'telegram-intel',
            title: t('panels.telegramIntel'),
            showCount: true,
            trackActivity: true,
            infoTooltip: t('components.telegramIntel.infoTooltip'),
            defaultRowSpan: 2,
        });
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "activeTopic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'all'
        });
        Object.defineProperty(this, "tabsEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "relayEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        this.createTabs();
        this.showLoading(t('components.telegramIntel.loading'));
    }
    createTabs() {
        this.tabsEl = h('div', { className: 'panel-tabs' }, ...TELEGRAM_TOPICS.map(topic => h('button', {
            className: `panel-tab ${topic.id === this.activeTopic ? 'active' : ''}`,
            dataset: { topicId: topic.id },
            onClick: () => this.selectTopic(topic.id),
        }, t(topic.labelKey))));
        this.element.insertBefore(this.tabsEl, this.content);
    }
    selectTopic(topicId) {
        if (topicId === this.activeTopic)
            return;
        this.activeTopic = topicId;
        this.tabsEl?.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.topicId === topicId);
        });
        this.renderItems();
    }
    setData(response) {
        this.relayEnabled = response.enabled !== false;
        this.items = response.items || [];
        if (!this.relayEnabled || response.error) {
            this.setCount(0);
            replaceChildren(this.content, h('div', { className: 'empty-state error' }, response.error || t('components.telegramIntel.disabled')));
            return;
        }
        this.renderItems();
    }
    renderItems() {
        const filtered = this.activeTopic === 'all'
            ? this.items
            : this.items.filter(item => item.topic === this.activeTopic);
        this.setCount(filtered.length);
        if (filtered.length === 0) {
            replaceChildren(this.content, h('div', { className: 'empty-state' }, t('components.telegramIntel.empty')));
            return;
        }
        replaceChildren(this.content, h('div', { className: 'telegram-intel-items' }, ...filtered.map(item => this.buildItem(item))));
    }
    buildItem(item) {
        const timeAgo = formatTelegramTime(item.ts);
        const itemDate = new Date(item.ts).getTime();
        const isLive = !Number.isNaN(itemDate) && (Date.now() - itemDate) < LIVE_THRESHOLD_MS;
        const raw = item.text || '';
        const escaped = raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const textHtml = escaped.replace(/\n/g, '<br>');
        return h('div', { className: `telegram-intel-item ${isLive ? 'is-live' : ''}` }, h('div', { className: 'telegram-intel-item-header' }, h('div', { className: 'telegram-intel-channel-wrapper' }, h('span', { className: 'telegram-intel-channel' }, item.channelTitle || item.channel), isLive ? h('span', { className: 'live-indicator' }, t('components.telegramIntel.live')) : null), h('div', { className: 'telegram-intel-meta' }, h('span', { className: 'telegram-intel-topic' }, item.topic), h('span', { className: 'telegram-intel-time' }, timeAgo))), h('div', { className: 'telegram-intel-text' }, safeHtml(textHtml)), item.mediaUrls && item.mediaUrls.length > 0 ? h('div', { className: 'telegram-intel-media-grid' }, ...item.mediaUrls.map(url => {
            const isVideo = url.match(/\.(mp4|webm|mov)(\?.*)?$/i);
            if (isVideo) {
                return h('video', {
                    className: 'telegram-intel-video',
                    src: sanitizeUrl(url),
                    controls: true,
                    preload: 'metadata',
                    playsinline: true,
                });
            }
            return h('img', {
                className: 'telegram-intel-image',
                src: sanitizeUrl(url),
                loading: 'lazy',
                onClick: () => window.open(sanitizeUrl(url), '_blank', 'noopener,noreferrer'),
            });
        })) : null, h('div', { className: 'telegram-intel-item-actions' }, h('a', {
            href: sanitizeUrl(item.url),
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'telegram-follow-btn',
        }, t('components.telegramIntel.viewSource'))));
    }
    async refresh() {
        // Handled by DataLoader + RefreshScheduler
    }
    destroy() {
        if (this.tabsEl) {
            this.tabsEl.remove();
            this.tabsEl = null;
        }
        super.destroy();
    }
}
