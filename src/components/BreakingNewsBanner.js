import { getAlertSettings } from '@/services/breaking-news-alerts';
import { getSourcePanelId } from '@/config/feeds';
import { t } from '@/services/i18n';
const MAX_ALERTS = 3;
const CRITICAL_DISMISS_MS = 60000;
const HIGH_DISMISS_MS = 30000;
const SOUND_COOLDOWN_MS = 5 * 60 * 1000;
export class BreakingNewsBanner {
    constructor() {
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeAlerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "audio", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastSoundMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "mutationObserver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "resizeObserver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "observedPostureBanner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "boundOnAlert", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boundOnVisibility", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boundOnResize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dismissed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "highlightTimers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        this.container = document.createElement('div');
        this.container.className = 'breaking-news-container';
        document.body.appendChild(this.container);
        this.initAudio();
        this.updatePosition();
        this.setupObservers();
        this.boundOnAlert = (e) => this.handleAlert(e.detail);
        this.boundOnVisibility = () => this.handleVisibility();
        this.boundOnResize = () => this.updatePosition();
        document.addEventListener('wm:breaking-news', this.boundOnAlert);
        document.addEventListener('visibilitychange', this.boundOnVisibility);
        window.addEventListener('resize', this.boundOnResize);
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            const alertEl = target.closest('.breaking-alert');
            if (!alertEl)
                return;
            if (target.closest('.breaking-alert-dismiss')) {
                const id = alertEl.getAttribute('data-alert-id');
                if (id)
                    this.dismissAlert(id);
                return;
            }
            const panelId = alertEl.getAttribute('data-target-panel');
            if (panelId)
                this.scrollToPanel(panelId);
        });
    }
    initAudio() {
        this.audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYjfKapmWswEjCJvuPQfSoXZZ+3qqBJESSP0unGaxMJVYiytrFeLhR6p8znrFUXRW+bs7V3Qx1hn8Xjp1cYPnegprhkMCFmoLi1k0sZTYGlqqlUIA==');
        this.audio.volume = 0.3;
    }
    playSound() {
        const settings = getAlertSettings();
        if (!settings.soundEnabled || !this.audio)
            return;
        if (Date.now() - this.lastSoundMs < SOUND_COOLDOWN_MS)
            return;
        this.audio.currentTime = 0;
        this.audio.play()?.catch(() => { });
        this.lastSoundMs = Date.now();
    }
    setupObservers() {
        this.mutationObserver = new MutationObserver(() => this.updatePosition());
        this.mutationObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }
    attachResizeObserverIfNeeded() {
        const postureBanner = document.querySelector('.critical-posture-banner');
        if (!postureBanner)
            return;
        if (postureBanner === this.observedPostureBanner)
            return;
        if (this.resizeObserver)
            this.resizeObserver.disconnect();
        this.resizeObserver = new ResizeObserver(() => this.updatePosition());
        this.resizeObserver.observe(postureBanner);
        this.observedPostureBanner = postureBanner;
    }
    updatePosition() {
        let top = 50;
        if (document.body?.classList.contains('has-critical-banner')) {
            this.attachResizeObserverIfNeeded();
            const postureBanner = document.querySelector('.critical-posture-banner');
            if (postureBanner) {
                top += postureBanner.getBoundingClientRect().height;
            }
        }
        this.container.style.top = `${top}px`;
        this.updateOffset();
    }
    updateOffset() {
        const height = this.container.offsetHeight;
        document.documentElement.style.setProperty('--breaking-alert-offset', height > 0 ? `${height}px` : '0px');
        document.body?.classList.toggle('has-breaking-alert', this.activeAlerts.length > 0);
    }
    isDismissedRecently(id) {
        const ts = this.dismissed.get(id);
        if (ts === undefined)
            return false;
        if (Date.now() - ts >= 30 * 60 * 1000) {
            this.dismissed.delete(id);
            return false;
        }
        return true;
    }
    handleAlert(alert) {
        if (this.isDismissedRecently(alert.id))
            return;
        const existing = this.activeAlerts.find(a => a.alert.id === alert.id);
        if (existing)
            return;
        if (alert.threatLevel === 'critical') {
            const highAlerts = this.activeAlerts.filter(a => a.alert.threatLevel === 'high');
            for (const h of highAlerts) {
                this.removeAlert(h);
                const idx = this.activeAlerts.indexOf(h);
                if (idx !== -1)
                    this.activeAlerts.splice(idx, 1);
            }
        }
        while (this.activeAlerts.length >= MAX_ALERTS) {
            const oldest = this.activeAlerts.shift();
            if (oldest)
                this.removeAlert(oldest);
        }
        const el = this.createAlertElement(alert);
        this.container.appendChild(el);
        const dismissMs = alert.threatLevel === 'critical' ? CRITICAL_DISMISS_MS : HIGH_DISMISS_MS;
        const now = Date.now();
        const active = {
            alert,
            element: el,
            timer: null,
            remainingMs: dismissMs,
            timerStartedAt: now,
        };
        if (!document.hidden) {
            active.timer = setTimeout(() => this.dismissAlert(alert.id), dismissMs);
        }
        this.activeAlerts.push(active);
        this.playSound();
        this.updateOffset();
    }
    resolveTargetPanel(alert) {
        if (alert.origin === 'oref_siren')
            return 'oref-sirens';
        if (alert.origin === 'rss_alert')
            return getSourcePanelId(alert.source);
        return 'politics';
    }
    scrollToPanel(panelId) {
        const panel = document.querySelector(`[data-panel="${panelId}"]`);
        if (!panel)
            return;
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const prev = this.highlightTimers.get(panel);
        if (prev)
            clearTimeout(prev);
        panel.classList.remove('search-highlight');
        void panel.offsetWidth;
        panel.classList.add('search-highlight');
        this.highlightTimers.set(panel, setTimeout(() => {
            panel.classList.remove('search-highlight');
            this.highlightTimers.delete(panel);
        }, 3100));
    }
    createAlertElement(alert) {
        const el = document.createElement('div');
        el.className = `breaking-alert severity-${alert.threatLevel}`;
        el.setAttribute('data-alert-id', alert.id);
        el.setAttribute('data-target-panel', this.resolveTargetPanel(alert));
        el.style.cursor = 'pointer';
        const icon = alert.threatLevel === 'critical' ? '🚨' : '⚠️';
        const levelText = alert.threatLevel === 'critical'
            ? t('components.breakingNews.critical')
            : t('components.breakingNews.high');
        const timeAgo = this.formatTimeAgo(alert.timestamp);
        const iconSpan = document.createElement('span');
        iconSpan.className = 'breaking-alert-icon';
        iconSpan.textContent = icon;
        const content = document.createElement('div');
        content.className = 'breaking-alert-content';
        const levelSpan = document.createElement('span');
        levelSpan.className = 'breaking-alert-level';
        levelSpan.textContent = levelText;
        const headlineSpan = document.createElement('span');
        headlineSpan.className = 'breaking-alert-headline';
        headlineSpan.textContent = alert.headline;
        const metaSpan = document.createElement('span');
        metaSpan.className = 'breaking-alert-meta';
        metaSpan.textContent = `${alert.source} · ${timeAgo}`;
        content.appendChild(levelSpan);
        content.appendChild(headlineSpan);
        content.appendChild(metaSpan);
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'breaking-alert-dismiss';
        dismissBtn.textContent = '×';
        dismissBtn.title = t('components.breakingNews.dismiss');
        el.appendChild(iconSpan);
        el.appendChild(content);
        el.appendChild(dismissBtn);
        return el;
    }
    formatTimeAgo(date) {
        const ms = Date.now() - date.getTime();
        if (ms < 60000)
            return t('components.intelligenceFindings.time.justNow');
        if (ms < 3600000)
            return t('components.intelligenceFindings.time.minutesAgo', { count: String(Math.floor(ms / 60000)) });
        return t('components.intelligenceFindings.time.hoursAgo', { count: String(Math.floor(ms / 3600000)) });
    }
    dismissAlert(id) {
        this.dismissed.set(id, Date.now());
        const idx = this.activeAlerts.findIndex(a => a.alert.id === id);
        if (idx === -1)
            return;
        const active = this.activeAlerts[idx];
        this.removeAlert(active);
        this.activeAlerts.splice(idx, 1);
        this.updateOffset();
    }
    removeAlert(active) {
        if (active.timer)
            clearTimeout(active.timer);
        active.element.remove();
    }
    handleVisibility() {
        const now = Date.now();
        if (document.hidden) {
            for (const active of this.activeAlerts) {
                if (active.timer) {
                    clearTimeout(active.timer);
                    active.timer = null;
                    const elapsed = now - active.timerStartedAt;
                    active.remainingMs = Math.max(0, active.remainingMs - elapsed);
                }
            }
        }
        else {
            const expired = [];
            for (const active of this.activeAlerts) {
                if (!active.timer && active.remainingMs > 0) {
                    active.timerStartedAt = now;
                    active.timer = setTimeout(() => this.dismissAlert(active.alert.id), active.remainingMs);
                }
                else if (active.remainingMs <= 0) {
                    expired.push(active.alert.id);
                }
            }
            for (const id of expired)
                this.dismissAlert(id);
        }
    }
    destroy() {
        document.removeEventListener('wm:breaking-news', this.boundOnAlert);
        document.removeEventListener('visibilitychange', this.boundOnVisibility);
        window.removeEventListener('resize', this.boundOnResize);
        this.mutationObserver?.disconnect();
        this.resizeObserver?.disconnect();
        for (const active of this.activeAlerts) {
            if (active.timer)
                clearTimeout(active.timer);
        }
        this.activeAlerts = [];
        this.container.remove();
        document.body.classList.remove('has-breaking-alert');
        document.documentElement.style.removeProperty('--breaking-alert-offset');
    }
}
