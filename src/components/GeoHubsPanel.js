import { Panel } from './Panel';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { getCSSColor } from '@/utils';
const COUNTRY_FLAGS = {
    'USA': '🇺🇸', 'Russia': '🇷🇺', 'China': '🇨🇳', 'UK': '🇬🇧', 'Belgium': '🇧🇪',
    'Israel': '🇮🇱', 'Iran': '🇮🇷', 'Ukraine': '🇺🇦', 'Taiwan': '🇹🇼', 'Japan': '🇯🇵',
    'South Korea': '🇰🇷', 'North Korea': '🇰🇵', 'India': '🇮🇳', 'Saudi Arabia': '🇸🇦',
    'Turkey': '🇹🇷', 'France': '🇫🇷', 'Germany': '🇩🇪', 'Egypt': '🇪🇬', 'Pakistan': '🇵🇰',
    'Palestine': '🇵🇸', 'Yemen': '🇾🇪', 'Syria': '🇸🇾', 'Lebanon': '🇱🇧',
    'Sudan': '🇸🇩', 'Ethiopia': '🇪🇹', 'Myanmar': '🇲🇲', 'Austria': '🇦🇹',
    'International': '🌐',
};
const TYPE_ICONS = {
    capital: '🏛️',
    conflict: '⚔️',
    strategic: '⚓',
    organization: '🏢',
};
const TYPE_LABELS = {
    capital: 'Capital',
    conflict: 'Conflict Zone',
    strategic: 'Strategic',
    organization: 'Organization',
};
export class GeoHubsPanel extends Panel {
    constructor() {
        super({
            id: 'geo-hubs',
            title: t('panels.geoHubs'),
            showCount: true,
            infoTooltip: t('components.geoHubs.infoTooltip', {
                highColor: getCSSColor('--semantic-critical'),
                elevatedColor: getCSSColor('--semantic-high'),
                lowColor: getCSSColor('--text-dim'),
            }),
        });
        Object.defineProperty(this, "activities", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "onHubClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.setupDelegatedListeners();
    }
    setOnHubClick(handler) {
        this.onHubClick = handler;
    }
    setActivities(activities) {
        this.activities = activities.slice(0, 10);
        this.setCount(this.activities.length);
        this.render();
    }
    getFlag(country) {
        return COUNTRY_FLAGS[country] || '🌐';
    }
    getTypeIcon(type) {
        return TYPE_ICONS[type] || '📍';
    }
    getTypeLabel(type) {
        return TYPE_LABELS[type] || type;
    }
    render() {
        if (this.activities.length === 0) {
            this.showError(t('common.noActiveGeoHubs'));
            return;
        }
        const html = this.activities.map((hub, index) => {
            const trendIcon = hub.trend === 'rising' ? '↑' : hub.trend === 'falling' ? '↓' : '';
            const breakingTag = hub.hasBreaking ? '<span class="hub-breaking geo">ALERT</span>' : '';
            const topStory = hub.topStories[0];
            return `
        <div class="geo-hub-item ${hub.activityLevel}" data-hub-id="${escapeHtml(hub.hubId)}" data-index="${index}">
          <div class="hub-rank">${index + 1}</div>
          <span class="geo-hub-indicator ${hub.activityLevel}"></span>
          <div class="hub-info">
            <div class="hub-header">
              <span class="hub-name">${escapeHtml(hub.name)}</span>
              <span class="hub-flag">${this.getFlag(hub.country)}</span>
              ${breakingTag}
            </div>
            <div class="hub-meta">
              <span class="hub-news-count">${hub.newsCount} ${hub.newsCount === 1 ? t('components.geoHubs.story') : t('components.geoHubs.stories')}</span>
              ${trendIcon ? `<span class="hub-trend ${hub.trend}">${trendIcon}</span>` : ''}
              <span class="geo-hub-type">${this.getTypeIcon(hub.type)} ${this.getTypeLabel(hub.type)}</span>
            </div>
          </div>
          <div class="hub-score geo">${Math.round(hub.score)}</div>
        </div>
        ${topStory ? `
          <a class="hub-top-story geo" href="${sanitizeUrl(topStory.link)}" target="_blank" rel="noopener" data-hub-id="${escapeHtml(hub.hubId)}">
            ${escapeHtml(topStory.title.length > 80 ? topStory.title.slice(0, 77) + '...' : topStory.title)}
          </a>
        ` : ''}
      `;
        }).join('');
        this.setContent(html);
    }
    /**
     * Attach a single delegated click listener on the container so that
     * re-renders (which replace innerHTML) never accumulate listeners.
     */
    setupDelegatedListeners() {
        this.content.addEventListener('click', (e) => {
            const target = e.target;
            const item = target.closest('.geo-hub-item');
            if (!item)
                return;
            const hubId = item.dataset.hubId;
            const hub = this.activities.find(a => a.hubId === hubId);
            if (hub && this.onHubClick) {
                this.onHubClick(hub);
            }
        });
    }
}
