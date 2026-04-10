import { getRecentSignals } from '@/services/correlation';
import { getRecentAlerts } from '@/services/cross-module-integration';
import { getAlertSettings, updateAlertSettings } from '@/services/breaking-news-alerts';
import { t } from '@/services/i18n';
import { getSignalContext } from '@/utils/analysis-constants';
import { escapeHtml } from '@/utils/sanitize';
import { trackFindingClicked } from '@/services/analytics';
const LOW_COUNT_THRESHOLD = 3;
const MAX_VISIBLE_FINDINGS = 10;
const SORT_TIME_TOLERANCE_MS = 60000;
const REFRESH_INTERVAL_MS = 180000;
const ALERT_HOURS = 6;
const STORAGE_KEY = 'ivee-intel-findings';
const POPUP_STORAGE_KEY = 'wm-alert-popup-enabled';
export class IntelligenceFindingsBadge {
    constructor() {
        Object.defineProperty(this, "badge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dropdown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isOpen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "refreshInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastFindingCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "onSignalClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onAlertClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "findings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "boundCloseDropdown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.closeDropdown()
        });
        Object.defineProperty(this, "pendingUpdateFrame", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "boundUpdate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (this.pendingUpdateFrame)
                    return;
                this.pendingUpdateFrame = requestAnimationFrame(() => {
                    this.pendingUpdateFrame = 0;
                    this.update();
                });
            }
        });
        Object.defineProperty(this, "audio", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "audioEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "popupEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contextMenu", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.enabled = IntelligenceFindingsBadge.getStoredEnabledState();
        this.popupEnabled = localStorage.getItem(POPUP_STORAGE_KEY) === '1';
        this.badge = document.createElement('button');
        this.badge.className = 'intel-findings-badge';
        this.badge.title = t('components.intelligenceFindings.badgeTitle');
        this.badge.innerHTML = '<span class="findings-icon">🎯</span><span class="findings-count">0</span>';
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'intel-findings-dropdown';
        this.badge.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        this.badge.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e.clientX, e.clientY);
        });
        // Event delegation for finding items, toggle, and "more" link
        this.dropdown.addEventListener('click', (e) => {
            const target = e.target;
            const toggleAttr = target.closest('[data-toggle]')?.getAttribute('data-toggle');
            if (toggleAttr === 'popup') {
                e.stopPropagation();
                this.popupEnabled = !this.popupEnabled;
                if (this.popupEnabled) {
                    localStorage.setItem(POPUP_STORAGE_KEY, '1');
                }
                else {
                    localStorage.removeItem(POPUP_STORAGE_KEY);
                }
                this.renderDropdown();
                return;
            }
            if (toggleAttr === 'breaking-alerts') {
                e.stopPropagation();
                const settings = getAlertSettings();
                updateAlertSettings({ enabled: !settings.enabled });
                this.renderDropdown();
                return;
            }
            // Handle "more findings" click - show all in modal
            if (target.closest('.findings-more')) {
                e.stopPropagation();
                this.showAllFindings();
                this.closeDropdown();
                return;
            }
            // Handle individual finding click
            const item = target.closest('.finding-item');
            if (!item)
                return;
            e.stopPropagation();
            const id = item.getAttribute('data-finding-id');
            const finding = this.findings.find(f => f.id === id);
            if (!finding)
                return;
            trackFindingClicked(finding.id, finding.source, finding.type, finding.priority);
            if (finding.source === 'signal' && this.onSignalClick) {
                this.onSignalClick(finding.original);
            }
            else if (finding.source === 'alert' && this.onAlertClick) {
                this.onAlertClick(finding.original);
            }
            this.closeDropdown();
        });
        if (this.enabled) {
            document.addEventListener('click', this.boundCloseDropdown);
            this.mount();
            this.initAudio();
            this.update();
            this.startRefresh();
        }
    }
    initAudio() {
        this.audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYjfKapmWswEjCJvuPQfSoXZZ+3qqBJESSP0unGaxMJVYiytrFeLhR6p8znrFUXRW+bs7V3Qx1hn8Xjp1cYPnegprhkMCFmoLi1k0sZTYGlqqlUIA==');
        this.audio.volume = 0.3;
    }
    playSound() {
        if (this.audioEnabled && this.audio) {
            this.audio.currentTime = 0;
            this.audio.play()?.catch(() => { });
        }
    }
    setOnSignalClick(handler) {
        this.onSignalClick = handler;
    }
    setOnAlertClick(handler) {
        this.onAlertClick = handler;
    }
    static getStoredEnabledState() {
        return localStorage.getItem(STORAGE_KEY) !== 'hidden';
    }
    isEnabled() {
        return this.enabled;
    }
    isPopupEnabled() {
        return this.popupEnabled;
    }
    setEnabled(enabled) {
        if (this.enabled === enabled)
            return;
        this.enabled = enabled;
        if (enabled) {
            localStorage.removeItem(STORAGE_KEY);
            document.addEventListener('click', this.boundCloseDropdown);
            this.mount();
            this.initAudio();
            this.update();
            this.startRefresh();
        }
        else {
            localStorage.setItem(STORAGE_KEY, 'hidden');
            document.removeEventListener('click', this.boundCloseDropdown);
            document.removeEventListener('wm:intelligence-updated', this.boundUpdate);
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            this.closeDropdown();
            this.dismissContextMenu();
            this.badge.remove();
        }
    }
    showContextMenu(x, y) {
        this.dismissContextMenu();
        const menu = document.createElement('div');
        menu.className = 'intel-findings-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.innerHTML = `<div class="context-menu-item">${t('components.intelligenceFindings.hideFindings')}</div>`;
        menu.querySelector('.context-menu-item').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setEnabled(false);
            this.dismissContextMenu();
        });
        const dismiss = () => this.dismissContextMenu();
        document.addEventListener('click', dismiss, { once: true });
        this.contextMenu = menu;
        document.body.appendChild(menu);
    }
    dismissContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }
    mount() {
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            this.badge.appendChild(this.dropdown);
            headerRight.insertBefore(this.badge, headerRight.firstChild);
        }
    }
    startRefresh() {
        document.addEventListener('wm:intelligence-updated', this.boundUpdate);
        this.refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible')
                this.boundUpdate();
        }, REFRESH_INTERVAL_MS);
    }
    update() {
        this.findings = this.mergeFindings();
        const count = this.findings.length;
        const countEl = this.badge.querySelector('.findings-count');
        if (countEl) {
            countEl.textContent = String(count);
        }
        // Pulse animation and sound when new findings arrive
        if (count > this.lastFindingCount && this.lastFindingCount > 0) {
            this.badge.classList.add('pulse');
            setTimeout(() => this.badge.classList.remove('pulse'), 1000);
            if (this.popupEnabled)
                this.playSound();
        }
        this.lastFindingCount = count;
        // Update badge status based on priority
        const hasCritical = this.findings.some(f => f.priority === 'critical');
        const hasHigh = this.findings.some(f => f.priority === 'high' || f.confidence >= 0.7);
        this.badge.classList.remove('status-none', 'status-low', 'status-high');
        if (count === 0) {
            this.badge.classList.add('status-none');
            this.badge.title = t('components.intelligenceFindings.none');
        }
        else if (hasCritical || hasHigh) {
            this.badge.classList.add('status-high');
            this.badge.title = t('components.intelligenceFindings.reviewRecommended', { count: String(count) });
        }
        else if (count <= LOW_COUNT_THRESHOLD) {
            this.badge.classList.add('status-low');
            this.badge.title = t('components.intelligenceFindings.count', { count: String(count) });
        }
        else {
            this.badge.classList.add('status-high');
            this.badge.title = t('components.intelligenceFindings.reviewRecommended', { count: String(count) });
        }
        this.renderDropdown();
    }
    mergeFindings() {
        const signals = getRecentSignals();
        const alerts = getRecentAlerts(ALERT_HOURS);
        const signalFindings = signals.map(s => ({
            id: `signal-${s.id}`,
            source: 'signal',
            type: s.type,
            title: s.title,
            description: s.description,
            confidence: s.confidence,
            priority: s.confidence >= 0.7 ? 'high' : s.confidence >= 0.5 ? 'medium' : 'low',
            timestamp: s.timestamp,
            original: s,
        }));
        const alertFindings = alerts.map(a => ({
            id: `alert-${a.id}`,
            source: 'alert',
            type: a.type,
            title: a.title,
            description: a.summary,
            confidence: this.priorityToConfidence(a.priority),
            priority: a.priority,
            timestamp: a.timestamp,
            original: a,
        }));
        // Merge and sort by timestamp (newest first), then by priority
        return [...signalFindings, ...alertFindings].sort((a, b) => {
            const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();
            if (Math.abs(timeDiff) < SORT_TIME_TOLERANCE_MS) {
                return this.priorityScore(b.priority) - this.priorityScore(a.priority);
            }
            return timeDiff;
        });
    }
    priorityToConfidence(priority) {
        const map = { critical: 95, high: 80, medium: 60, low: 40 };
        return map[priority] ?? 50;
    }
    priorityScore(priority) {
        const map = { critical: 4, high: 3, medium: 2, low: 1 };
        return map[priority] ?? 0;
    }
    renderPopupToggle() {
        const label = t('components.intelligenceFindings.popupAlerts');
        const checked = this.popupEnabled;
        const breakingSettings = getAlertSettings();
        const breakingLabel = t('components.intelligenceFindings.breakingAlerts');
        return `<div class="popup-toggle-row" data-toggle="popup">
        <span class="popup-toggle-label">🔔 ${escapeHtml(label)}</span>
        <span class="popup-toggle-switch${checked ? ' on' : ''}"><span class="popup-toggle-knob"></span></span>
      </div>
      <div class="popup-toggle-row" data-toggle="breaking-alerts">
        <span class="popup-toggle-label">🚨 ${escapeHtml(breakingLabel)}</span>
        <span class="popup-toggle-switch${breakingSettings.enabled ? ' on' : ''}"><span class="popup-toggle-knob"></span></span>
      </div>`;
    }
    renderDropdown() {
        const toggleHtml = this.renderPopupToggle();
        if (this.findings.length === 0) {
            this.dropdown.innerHTML = `
        <div class="findings-header">
          <span class="header-title">${t('components.intelligenceFindings.title')}</span>
          <span class="findings-badge none">${t('components.intelligenceFindings.monitoring')}</span>
        </div>
        ${toggleHtml}
        <div class="findings-content">
          <div class="findings-empty">
            <span class="empty-icon">📡</span>
            <span class="empty-text">${t('components.intelligenceFindings.scanning')}</span>
          </div>
        </div>
      `;
            return;
        }
        const criticalCount = this.findings.filter(f => f.priority === 'critical').length;
        const highCount = this.findings.filter(f => f.priority === 'high' || f.confidence >= 70).length;
        let statusClass = 'moderate';
        let statusText = t('components.intelligenceFindings.detected', { count: String(this.findings.length) });
        if (criticalCount > 0) {
            statusClass = 'critical';
            statusText = t('components.intelligenceFindings.critical', { count: String(criticalCount) });
        }
        else if (highCount > 0) {
            statusClass = 'high';
            statusText = t('components.intelligenceFindings.highPriority', { count: String(highCount) });
        }
        const findingsHtml = this.findings.slice(0, MAX_VISIBLE_FINDINGS).map(finding => {
            const timeAgo = this.formatTimeAgo(finding.timestamp);
            const icon = this.getTypeIcon(finding.type);
            const priorityClass = finding.priority;
            const insight = this.getInsight(finding);
            return `
        <div class="finding-item ${priorityClass}" data-finding-id="${escapeHtml(finding.id)}">
          <div class="finding-header">
            <span class="finding-type">${icon} ${escapeHtml(finding.title)}</span>
            <span class="finding-confidence ${priorityClass}">${t(`components.intelligenceFindings.priority.${finding.priority}`)}</span>
          </div>
          <div class="finding-description">${escapeHtml(finding.description)}</div>
          <div class="finding-meta">
            <span class="finding-insight">${escapeHtml(insight)}</span>
            <span class="finding-time">${timeAgo}</span>
          </div>
        </div>
      `;
        }).join('');
        const moreCount = this.findings.length - MAX_VISIBLE_FINDINGS;
        this.dropdown.innerHTML = `
      <div class="findings-header">
        <span class="header-title">${t('components.intelligenceFindings.title')}</span>
        <span class="findings-badge ${statusClass}">${statusText}</span>
      </div>
      ${toggleHtml}
      <div class="findings-content">
        <div class="findings-list">
          ${findingsHtml}
        </div>
        ${moreCount > 0 ? `<div class="findings-more">${t('components.intelligenceFindings.more', { count: String(moreCount) })}</div>` : ''}
      </div>
    `;
    }
    getInsight(finding) {
        if (finding.source === 'signal') {
            const context = getSignalContext(finding.original.type);
            return (context.actionableInsight ?? '').split('.')[0] || '';
        }
        // For alerts, provide actionable insight based on type and severity
        const alert = finding.original;
        if (alert.type === 'cii_spike') {
            const cii = alert.components.ciiChange;
            if (cii && cii.change >= 30)
                return t('components.intelligenceFindings.insights.criticalDestabilization');
            if (cii && cii.change >= 20)
                return t('components.intelligenceFindings.insights.significantShift');
            return t('components.intelligenceFindings.insights.developingSituation');
        }
        if (alert.type === 'convergence')
            return t('components.intelligenceFindings.insights.convergence');
        if (alert.type === 'cascade')
            return t('components.intelligenceFindings.insights.cascade');
        if (alert.type === 'radiation')
            return 'Elevated radiation readings warrant validation against recent baseline and nearby industrial or environmental activity';
        return t('components.intelligenceFindings.insights.review');
    }
    getTypeIcon(type) {
        const icons = {
            // Correlation signals
            breaking_surge: '🔥',
            silent_divergence: '🔇',
            flow_price_divergence: '📊',
            explained_market_move: '💡',
            prediction_leads_news: '🔮',
            geo_convergence: '🌍',
            hotspot_escalation: '⚠️',
            news_leads_markets: '📰',
            velocity_spike: '📈',
            keyword_spike: '📊',
            convergence: '🔀',
            triangulation: '🔺',
            flow_drop: '⬇️',
            sector_cascade: '🌊',
            // Unified alerts
            cii_spike: '🔴',
            cascade: '⚡',
            radiation: '☢️',
            composite: '🔗',
        };
        return icons[type] || '📌';
    }
    formatTimeAgo(date) {
        const ms = Date.now() - date.getTime();
        if (ms < 60000)
            return t('components.intelligenceFindings.time.justNow');
        if (ms < 3600000)
            return t('components.intelligenceFindings.time.minutesAgo', { count: String(Math.floor(ms / 60000)) });
        if (ms < 86400000)
            return t('components.intelligenceFindings.time.hoursAgo', { count: String(Math.floor(ms / 3600000)) });
        return t('components.intelligenceFindings.time.daysAgo', { count: String(Math.floor(ms / 86400000)) });
    }
    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.classList.toggle('open', this.isOpen);
        this.badge.classList.toggle('active', this.isOpen);
        if (this.isOpen) {
            this.update();
        }
    }
    closeDropdown() {
        this.isOpen = false;
        this.dropdown.classList.remove('open');
        this.badge.classList.remove('active');
    }
    showAllFindings() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'findings-modal-overlay';
        const findingsHtml = this.findings.map(finding => {
            const timeAgo = this.formatTimeAgo(finding.timestamp);
            const icon = this.getTypeIcon(finding.type);
            const insight = this.getInsight(finding);
            return `
        <div class="findings-modal-item ${finding.priority}" data-finding-id="${escapeHtml(finding.id)}">
          <div class="findings-modal-item-header">
            <span class="findings-modal-item-type">${icon} ${escapeHtml(finding.title)}</span>
            <span class="findings-modal-item-priority ${finding.priority}">${t(`components.intelligenceFindings.priority.${finding.priority}`)}</span>
          </div>
          <div class="findings-modal-item-desc">${escapeHtml(finding.description)}</div>
          <div class="findings-modal-item-meta">
            <span class="findings-modal-item-insight">${escapeHtml(insight)}</span>
            <span class="findings-modal-item-time">${timeAgo}</span>
          </div>
        </div>
      `;
        }).join('');
        overlay.innerHTML = `
      <div class="findings-modal">
        <div class="findings-modal-header">
          <span class="findings-modal-title">🎯 ${t('components.intelligenceFindings.all', { count: String(this.findings.length) })}</span>
          <button class="findings-modal-close" aria-label="Close">×</button>
        </div>
        <div class="findings-modal-content">
          ${findingsHtml}
        </div>
      </div>
    `;
        const closeOverlay = () => {
            overlay.remove();
            document.removeEventListener('keydown', onEsc);
        };
        const onEsc = (e) => {
            if (e.key === 'Escape')
                closeOverlay();
        };
        overlay.querySelector('.findings-modal-close')?.addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('findings-modal-overlay')) {
                closeOverlay();
            }
        });
        document.addEventListener('keydown', onEsc);
        // Handle clicking individual items
        overlay.querySelectorAll('.findings-modal-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-finding-id');
                const finding = this.findings.find(f => f.id === id);
                if (!finding)
                    return;
                trackFindingClicked(finding.id, finding.source, finding.type, finding.priority);
                if (finding.source === 'signal' && this.onSignalClick) {
                    this.onSignalClick(finding.original);
                    closeOverlay();
                }
                else if (finding.source === 'alert' && this.onAlertClick) {
                    this.onAlertClick(finding.original);
                    closeOverlay();
                }
            });
        });
        document.body.appendChild(overlay);
    }
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.pendingUpdateFrame) {
            cancelAnimationFrame(this.pendingUpdateFrame);
        }
        document.removeEventListener('wm:intelligence-updated', this.boundUpdate);
        document.removeEventListener('click', this.boundCloseDropdown);
        this.badge.remove();
    }
}
// Re-export with old name for backwards compatibility
export { IntelligenceFindingsBadge as IntelligenceGapBadge };
