import { isDesktopRuntime } from '../services/runtime';
import { invokeTauri } from '../services/tauri-bridge';
import { t } from '../services/i18n';
import { h, replaceChildren, safeHtml } from '../utils/dom-utils';
import { trackPanelResized } from '@/services/analytics';
import { getAiFlowSettings } from '@/services/ai-flow-settings';
import { getSecretState } from '@/services/runtime-config';
import { PanelGateReason } from '@/services/panel-gating';
const lockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
const upgradeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>`;
const PANEL_SPANS_KEY = 'ivee-panel-spans';
function loadPanelSpans() {
    try {
        const stored = localStorage.getItem(PANEL_SPANS_KEY);
        return stored ? JSON.parse(stored) : {};
    }
    catch {
        return {};
    }
}
function savePanelSpan(panelId, span) {
    const spans = loadPanelSpans();
    spans[panelId] = span;
    localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
}
const PANEL_COL_SPANS_KEY = 'ivee-panel-col-spans';
const ROW_RESIZE_STEP_PX = 80;
const COL_RESIZE_STEP_PX = 80;
const PANELS_GRID_MIN_TRACK_PX = 280;
function loadPanelColSpans() {
    try {
        const stored = localStorage.getItem(PANEL_COL_SPANS_KEY);
        return stored ? JSON.parse(stored) : {};
    }
    catch {
        return {};
    }
}
function savePanelColSpan(panelId, span) {
    const spans = loadPanelColSpans();
    spans[panelId] = span;
    localStorage.setItem(PANEL_COL_SPANS_KEY, JSON.stringify(spans));
}
const PANEL_COLLAPSED_KEY = 'ivee-panel-collapsed';
function loadPanelCollapsed() {
    try {
        const stored = localStorage.getItem(PANEL_COLLAPSED_KEY);
        return stored ? JSON.parse(stored) : {};
    }
    catch {
        return {};
    }
}
function savePanelCollapsed(panelId, collapsed) {
    const map = loadPanelCollapsed();
    if (collapsed) {
        map[panelId] = true;
    }
    else {
        delete map[panelId];
    }
    if (Object.keys(map).length === 0) {
        localStorage.removeItem(PANEL_COLLAPSED_KEY);
    }
    else {
        localStorage.setItem(PANEL_COLLAPSED_KEY, JSON.stringify(map));
    }
}
function clearPanelColSpan(panelId) {
    const spans = loadPanelColSpans();
    if (!(panelId in spans))
        return;
    delete spans[panelId];
    if (Object.keys(spans).length === 0) {
        localStorage.removeItem(PANEL_COL_SPANS_KEY);
        return;
    }
    localStorage.setItem(PANEL_COL_SPANS_KEY, JSON.stringify(spans));
}
function getDefaultColSpan(element) {
    return element.classList.contains('panel-wide') ? 2 : 1;
}
function getColSpan(element) {
    if (element.classList.contains('col-span-3'))
        return 3;
    if (element.classList.contains('col-span-2'))
        return 2;
    if (element.classList.contains('col-span-1'))
        return 1;
    return getDefaultColSpan(element);
}
function getGridColumnCount(element) {
    const grid = (element.closest('.panels-grid') || element.closest('.map-bottom-grid'));
    if (!grid)
        return 3;
    const style = window.getComputedStyle(grid);
    const template = style.gridTemplateColumns;
    if (!template || template === 'none')
        return 3;
    if (template.includes('repeat(')) {
        const repeatCountMatch = template.match(/repeat\(\s*(\d+)\s*,/i);
        if (repeatCountMatch) {
            const parsed = Number.parseInt(repeatCountMatch[1] ?? '0', 10);
            if (Number.isFinite(parsed) && parsed > 0)
                return parsed;
        }
        // For repeat(auto-fill/auto-fit, minmax(...)), infer count from rendered width.
        const autoRepeatMatch = template.match(/repeat\(\s*auto-(fill|fit)\s*,/i);
        if (autoRepeatMatch) {
            const gap = Number.parseFloat(style.columnGap || '0') || 0;
            const width = grid.getBoundingClientRect().width;
            if (width > 0) {
                return Math.max(1, Math.floor((width + gap) / (PANELS_GRID_MIN_TRACK_PX + gap)));
            }
        }
    }
    const columns = template.trim().split(/\s+/).filter(Boolean);
    return columns.length > 0 ? columns.length : 3;
}
function getMaxColSpan(element) {
    return Math.max(1, Math.min(3, getGridColumnCount(element)));
}
function clampColSpan(span, maxSpan) {
    return Math.max(1, Math.min(maxSpan, span));
}
function persistPanelColSpan(panelId, element) {
    const maxSpan = getMaxColSpan(element);
    const naturalSpan = clampColSpan(getDefaultColSpan(element), maxSpan);
    const currentSpan = clampColSpan(getColSpan(element), maxSpan);
    if (currentSpan === naturalSpan) {
        element.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
        clearPanelColSpan(panelId);
        return;
    }
    setColSpanClass(element, currentSpan);
    savePanelColSpan(panelId, currentSpan);
}
function deltaToColSpan(startSpan, deltaX, maxSpan = 3) {
    const spanDelta = deltaX > 0
        ? Math.floor(deltaX / COL_RESIZE_STEP_PX)
        : Math.ceil(deltaX / COL_RESIZE_STEP_PX);
    return clampColSpan(startSpan + spanDelta, maxSpan);
}
function clearColSpanClass(element) {
    element.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
}
function setColSpanClass(element, span) {
    clearColSpanClass(element);
    element.classList.add(`col-span-${span}`);
}
function getRowSpan(element) {
    if (element.classList.contains('span-4'))
        return 4;
    if (element.classList.contains('span-3'))
        return 3;
    if (element.classList.contains('span-2'))
        return 2;
    return 1;
}
function deltaToRowSpan(startSpan, deltaY) {
    const spanDelta = deltaY > 0
        ? Math.floor(deltaY / ROW_RESIZE_STEP_PX)
        : Math.ceil(deltaY / ROW_RESIZE_STEP_PX);
    return Math.max(1, Math.min(4, startSpan + spanDelta));
}
function setSpanClass(element, span) {
    element.classList.remove('span-1', 'span-2', 'span-3', 'span-4');
    element.classList.add(`span-${span}`);
    element.classList.add('resized');
}
export class Panel {
    constructor(options) {
        Object.defineProperty(this, "element", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "content", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "header", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "countEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "statusBadgeEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "newBadgeEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "severityDotEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentSeverity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'none'
        });
        Object.defineProperty(this, "panelId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "abortController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new AbortController()
        });
        Object.defineProperty(this, "tooltipCloseHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "resizeHandle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isResizing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "startY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "startRowSpan", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "onTouchMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onTouchEnd", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onTouchCancel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onDocMouseUp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onRowMouseMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onRowMouseUp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onRowWindowBlur", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "colResizeHandle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isColResizing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "startX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "startColSpan", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "onColMouseMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onColMouseUp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onColWindowBlur", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onColTouchMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onColTouchEnd", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onColTouchCancel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "colSpanReconcileRaf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "contentDebounceMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 150
        });
        Object.defineProperty(this, "pendingContentHtml", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "contentDebounceTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "retryCallback", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "retryCountdownTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "retryAttempt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_fetching", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_locked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_collapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_collapseBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.panelId = options.id;
        this.element = document.createElement('div');
        this.element.className = `panel ${options.className || ''}`;
        this.element.dataset.panel = options.id;
        this.header = document.createElement('div');
        this.header.className = 'panel-header';
        const headerLeft = document.createElement('div');
        headerLeft.className = 'panel-header-left';
        const title = document.createElement('span');
        title.className = 'panel-title';
        title.textContent = options.title;
        headerLeft.appendChild(title);
        this.severityDotEl = document.createElement('span');
        this.severityDotEl.className = 'panel-severity-dot';
        this.severityDotEl.setAttribute('aria-hidden', 'true');
        headerLeft.appendChild(this.severityDotEl);
        if (options.infoTooltip) {
            const infoBtn = h('button', { className: 'panel-info-btn', 'aria-label': t('components.panel.showMethodologyInfo') }, '?');
            const tooltip = h('div', { className: 'panel-info-tooltip' });
            tooltip.appendChild(safeHtml(options.infoTooltip));
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.classList.toggle('visible');
            });
            this.tooltipCloseHandler = () => tooltip.classList.remove('visible');
            document.addEventListener('click', this.tooltipCloseHandler);
            const infoWrapper = document.createElement('div');
            infoWrapper.className = 'panel-info-wrapper';
            infoWrapper.appendChild(infoBtn);
            infoWrapper.appendChild(tooltip);
            headerLeft.appendChild(infoWrapper);
        }
        // Add "new" badge element (hidden by default)
        if (options.trackActivity !== false) {
            this.newBadgeEl = document.createElement('span');
            this.newBadgeEl.className = 'panel-new-badge';
            this.newBadgeEl.style.display = 'none';
            headerLeft.appendChild(this.newBadgeEl);
        }
        if (options.premium && !getSecretState('WORLDMONITOR_API_KEY').present) {
            const proBadge = h('span', { className: 'panel-pro-badge' }, t('premium.pro'));
            headerLeft.appendChild(proBadge);
        }
        this.header.appendChild(headerLeft);
        this.statusBadgeEl = document.createElement('span');
        this.statusBadgeEl.className = 'panel-data-badge';
        this.statusBadgeEl.style.display = 'none';
        this.header.appendChild(this.statusBadgeEl);
        if (options.showCount) {
            this.countEl = document.createElement('span');
            this.countEl.className = 'panel-count';
            this.countEl.textContent = '0';
            this.header.appendChild(this.countEl);
        }
        if (options.collapsible) {
            this.appendCollapseButton();
        }
        if (options.closable !== false) {
            this.appendCloseButton();
        }
        this.content = document.createElement('div');
        this.content.className = 'panel-content';
        this.content.id = `${options.id}Content`;
        this.element.appendChild(this.header);
        this.element.appendChild(this.content);
        if (this._collapseBtn && loadPanelCollapsed()[this.panelId]) {
            this._applyCollapsed(this._collapseBtn, true);
        }
        this.content.addEventListener('click', (e) => {
            const target = e.target.closest('[data-panel-retry]');
            if (!target || this._fetching)
                return;
            this.retryCallback?.();
        });
        // Add resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'panel-resize-handle';
        this.resizeHandle.title = t('components.panel.dragToResize');
        this.element.appendChild(this.resizeHandle);
        this.setupResizeHandlers();
        // Right-edge handle for width resizing
        this.colResizeHandle = document.createElement('div');
        this.colResizeHandle.className = 'panel-col-resize-handle';
        this.colResizeHandle.title = t('components.panel.dragToResize');
        this.element.appendChild(this.colResizeHandle);
        this.setupColResizeHandlers();
        // Apply default row span (before restore, so saved preferences win)
        if (options.defaultRowSpan && options.defaultRowSpan > 1) {
            this.element.classList.add(`span-${options.defaultRowSpan}`);
        }
        // Restore saved span (overrides default)
        const savedSpans = loadPanelSpans();
        const savedSpan = savedSpans[this.panelId];
        if (savedSpan !== undefined) {
            setSpanClass(this.element, savedSpan);
        }
        // Restore saved col-span
        this.restoreSavedColSpan();
        this.reconcileColSpanAfterAttach();
        this.showLoading();
    }
    restoreSavedColSpan() {
        const savedColSpans = loadPanelColSpans();
        const savedColSpan = savedColSpans[this.panelId];
        if (typeof savedColSpan === 'number' && Number.isInteger(savedColSpan) && savedColSpan >= 1) {
            const naturalSpan = getDefaultColSpan(this.element);
            if (savedColSpan === naturalSpan) {
                clearColSpanClass(this.element);
                clearPanelColSpan(this.panelId);
                return;
            }
            const maxSpan = getMaxColSpan(this.element);
            const clampedSavedSpan = clampColSpan(savedColSpan, maxSpan);
            setColSpanClass(this.element, clampedSavedSpan);
        }
        else if (savedColSpan !== undefined) {
            clearPanelColSpan(this.panelId);
        }
    }
    reconcileColSpanAfterAttach(attempts = 3) {
        if (this.colSpanReconcileRaf !== null) {
            cancelAnimationFrame(this.colSpanReconcileRaf);
            this.colSpanReconcileRaf = null;
        }
        const tryReconcile = (remaining) => {
            if (!this.element.isConnected || !this.element.parentElement) {
                if (remaining <= 0)
                    return;
                this.colSpanReconcileRaf = requestAnimationFrame(() => tryReconcile(remaining - 1));
                return;
            }
            this.colSpanReconcileRaf = null;
            this.restoreSavedColSpan();
        };
        tryReconcile(attempts);
    }
    addRowTouchDocumentListeners() {
        if (this.onTouchMove) {
            document.addEventListener('touchmove', this.onTouchMove, { passive: false });
        }
        if (this.onTouchEnd) {
            document.addEventListener('touchend', this.onTouchEnd);
        }
        if (this.onTouchCancel) {
            document.addEventListener('touchcancel', this.onTouchCancel);
        }
    }
    removeRowTouchDocumentListeners() {
        if (this.onTouchMove) {
            document.removeEventListener('touchmove', this.onTouchMove);
        }
        if (this.onTouchEnd) {
            document.removeEventListener('touchend', this.onTouchEnd);
        }
        if (this.onTouchCancel) {
            document.removeEventListener('touchcancel', this.onTouchCancel);
        }
    }
    setupResizeHandlers() {
        if (!this.resizeHandle)
            return;
        this.onRowMouseMove = (e) => {
            if (!this.isResizing)
                return;
            const deltaY = e.clientY - this.startY;
            setSpanClass(this.element, deltaToRowSpan(this.startRowSpan, deltaY));
        };
        this.onRowMouseUp = () => {
            if (!this.isResizing)
                return;
            this.isResizing = false;
            this.element.classList.remove('resizing');
            delete this.element.dataset.resizing;
            document.body.classList.remove('panel-resize-active');
            this.resizeHandle?.classList.remove('active');
            if (this.onRowMouseMove) {
                document.removeEventListener('mousemove', this.onRowMouseMove);
            }
            if (this.onRowMouseUp) {
                document.removeEventListener('mouseup', this.onRowMouseUp);
            }
            if (this.onRowWindowBlur) {
                window.removeEventListener('blur', this.onRowWindowBlur);
            }
            const currentSpan = getRowSpan(this.element);
            savePanelSpan(this.panelId, currentSpan);
            trackPanelResized(this.panelId, currentSpan);
        };
        this.onRowWindowBlur = () => this.onRowMouseUp?.();
        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isResizing = true;
            this.startY = e.clientY;
            this.startRowSpan = getRowSpan(this.element);
            this.element.dataset.resizing = 'true';
            this.element.classList.add('resizing');
            document.body.classList.add('panel-resize-active');
            this.resizeHandle?.classList.add('active');
            if (this.onRowMouseMove) {
                document.addEventListener('mousemove', this.onRowMouseMove);
            }
            if (this.onRowMouseUp) {
                document.addEventListener('mouseup', this.onRowMouseUp);
            }
            if (this.onRowWindowBlur) {
                window.addEventListener('blur', this.onRowWindowBlur);
            }
        };
        this.resizeHandle.addEventListener('mousedown', onMouseDown);
        // Double-click to reset
        this.resizeHandle.addEventListener('dblclick', () => {
            this.resetHeight();
        });
        // Touch support
        this.resizeHandle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            if (!touch)
                return;
            this.isResizing = true;
            this.startY = touch.clientY;
            this.startRowSpan = getRowSpan(this.element);
            this.element.classList.add('resizing');
            this.element.dataset.resizing = 'true';
            document.body.classList.add('panel-resize-active');
            this.resizeHandle?.classList.add('active');
            this.removeRowTouchDocumentListeners();
            this.addRowTouchDocumentListeners();
        }, { passive: false });
        // Use bound handlers so they can be removed in destroy()
        this.onTouchMove = (e) => {
            if (!this.isResizing)
                return;
            const touch = e.touches[0];
            if (!touch)
                return;
            const deltaY = touch.clientY - this.startY;
            setSpanClass(this.element, deltaToRowSpan(this.startRowSpan, deltaY));
        };
        this.onTouchEnd = () => {
            if (!this.isResizing) {
                this.removeRowTouchDocumentListeners();
                return;
            }
            this.isResizing = false;
            this.element.classList.remove('resizing');
            delete this.element.dataset.resizing;
            document.body.classList.remove('panel-resize-active');
            this.resizeHandle?.classList.remove('active');
            this.removeRowTouchDocumentListeners();
            const currentSpan = getRowSpan(this.element);
            savePanelSpan(this.panelId, currentSpan);
            trackPanelResized(this.panelId, currentSpan);
        };
        this.onTouchCancel = this.onTouchEnd;
        this.onDocMouseUp = () => {
            if (this.element?.dataset.resizing) {
                delete this.element.dataset.resizing;
            }
            if (!this.isResizing && !this.isColResizing) {
                document.body?.classList.remove('panel-resize-active');
            }
        };
        document.addEventListener('mouseup', this.onDocMouseUp);
    }
    addColTouchDocumentListeners() {
        if (this.onColTouchMove) {
            document.addEventListener('touchmove', this.onColTouchMove, { passive: false });
        }
        if (this.onColTouchEnd) {
            document.addEventListener('touchend', this.onColTouchEnd);
        }
        if (this.onColTouchCancel) {
            document.addEventListener('touchcancel', this.onColTouchCancel);
        }
    }
    removeColTouchDocumentListeners() {
        if (this.onColTouchMove) {
            document.removeEventListener('touchmove', this.onColTouchMove);
        }
        if (this.onColTouchEnd) {
            document.removeEventListener('touchend', this.onColTouchEnd);
        }
        if (this.onColTouchCancel) {
            document.removeEventListener('touchcancel', this.onColTouchCancel);
        }
    }
    setupColResizeHandlers() {
        if (!this.colResizeHandle)
            return;
        this.onColMouseMove = (e) => {
            if (!this.isColResizing)
                return;
            const deltaX = e.clientX - this.startX;
            const maxSpan = getMaxColSpan(this.element);
            setColSpanClass(this.element, deltaToColSpan(this.startColSpan, deltaX, maxSpan));
        };
        this.onColMouseUp = () => {
            if (!this.isColResizing)
                return;
            this.isColResizing = false;
            this.element.classList.remove('col-resizing');
            delete this.element.dataset.resizing;
            document.body.classList.remove('panel-resize-active');
            this.colResizeHandle?.classList.remove('active');
            if (this.onColMouseMove) {
                document.removeEventListener('mousemove', this.onColMouseMove);
            }
            if (this.onColMouseUp) {
                document.removeEventListener('mouseup', this.onColMouseUp);
            }
            if (this.onColWindowBlur) {
                window.removeEventListener('blur', this.onColWindowBlur);
            }
            const finalSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
            if (finalSpan !== this.startColSpan) {
                persistPanelColSpan(this.panelId, this.element);
            }
        };
        this.onColWindowBlur = () => this.onColMouseUp?.();
        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isColResizing = true;
            this.startX = e.clientX;
            this.startColSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
            this.element.dataset.resizing = 'true';
            this.element.classList.add('col-resizing');
            document.body.classList.add('panel-resize-active');
            this.colResizeHandle?.classList.add('active');
            if (this.onColMouseMove) {
                document.addEventListener('mousemove', this.onColMouseMove);
            }
            if (this.onColMouseUp) {
                document.addEventListener('mouseup', this.onColMouseUp);
            }
            if (this.onColWindowBlur) {
                window.addEventListener('blur', this.onColWindowBlur);
            }
        };
        this.colResizeHandle.addEventListener('mousedown', onMouseDown);
        // Double-click resets width
        this.colResizeHandle.addEventListener('dblclick', () => this.resetWidth());
        // Touch
        this.colResizeHandle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            if (!touch)
                return;
            this.isColResizing = true;
            this.startX = touch.clientX;
            this.startColSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
            this.element.dataset.resizing = 'true';
            this.element.classList.add('col-resizing');
            document.body.classList.add('panel-resize-active');
            this.colResizeHandle?.classList.add('active');
            this.removeColTouchDocumentListeners();
            this.addColTouchDocumentListeners();
        }, { passive: false });
        this.onColTouchMove = (e) => {
            if (!this.isColResizing)
                return;
            const touch = e.touches[0];
            if (!touch)
                return;
            const deltaX = touch.clientX - this.startX;
            const maxSpan = getMaxColSpan(this.element);
            setColSpanClass(this.element, deltaToColSpan(this.startColSpan, deltaX, maxSpan));
        };
        this.onColTouchEnd = () => {
            if (!this.isColResizing) {
                this.removeColTouchDocumentListeners();
                return;
            }
            this.isColResizing = false;
            this.element.classList.remove('col-resizing');
            delete this.element.dataset.resizing;
            document.body.classList.remove('panel-resize-active');
            this.colResizeHandle?.classList.remove('active');
            this.removeColTouchDocumentListeners();
            const finalSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
            if (finalSpan !== this.startColSpan) {
                persistPanelColSpan(this.panelId, this.element);
            }
        };
        this.onColTouchCancel = this.onColTouchEnd;
    }
    setDataBadge(state, detail) {
        if (!this.statusBadgeEl)
            return;
        const labels = {
            live: t('common.live'),
            cached: t('common.cached'),
            unavailable: t('common.unavailable'),
        };
        this.statusBadgeEl.textContent = detail ? `${labels[state]} · ${detail}` : labels[state];
        this.statusBadgeEl.className = `panel-data-badge ${state}`;
        this.statusBadgeEl.style.display = 'inline-flex';
    }
    clearDataBadge() {
        if (!this.statusBadgeEl)
            return;
        this.statusBadgeEl.style.display = 'none';
    }
    insertLiveCountBadge(count) {
        const headerLeft = this.header.querySelector('.panel-header-left');
        if (!headerLeft)
            return;
        const badge = document.createElement('span');
        badge.className = 'panel-live-count';
        badge.textContent = `${count}`;
        headerLeft.appendChild(badge);
    }
    _applyCollapsed(btn, collapsed) {
        this._collapsed = collapsed;
        this.content.style.display = collapsed ? 'none' : '';
        this.element.classList.toggle('panel-collapsed', collapsed);
        btn.textContent = collapsed ? '▸' : '▾';
        const label = collapsed
            ? (t('components.panel.expandPanel') ?? 'Expand')
            : (t('components.panel.collapsePanel') ?? 'Collapse');
        btn.setAttribute('aria-expanded', String(!collapsed));
        btn.setAttribute('aria-label', label);
        btn.title = label;
    }
    appendCollapseButton() {
        const btn = h('button', {
            className: 'icon-btn panel-collapse-btn',
            'aria-label': t('components.panel.collapsePanel') ?? 'Collapse',
            'aria-expanded': 'true',
            title: t('components.panel.collapsePanel') ?? 'Collapse',
        }, '▾');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._applyCollapsed(btn, !this._collapsed);
            savePanelCollapsed(this.panelId, this._collapsed);
        });
        this._collapseBtn = btn;
        this.header.appendChild(btn);
    }
    appendCloseButton() {
        const closeBtn = h('button', {
            className: 'icon-btn panel-close-btn',
            'aria-label': t('components.panel.closePanel'),
            title: t('components.panel.closePanel'),
        }, '\u2715');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.element.dispatchEvent(new CustomEvent('wm:panel-close', {
                bubbles: true,
                detail: { panelId: this.panelId },
            }));
        });
        this.header.appendChild(closeBtn);
    }
    getElement() {
        return this.element;
    }
    isNearViewport(marginPx = 400) {
        if (!this.element.isConnected)
            return false;
        if (typeof window === 'undefined')
            return true;
        const style = window.getComputedStyle(this.element);
        if (style.display === 'none' || style.visibility === 'hidden')
            return false;
        const rect = this.element.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        if (rect.width === 0 || rect.height === 0)
            return false;
        return (rect.bottom >= -marginPx &&
            rect.right >= -marginPx &&
            rect.top <= viewportHeight + marginPx &&
            rect.left <= viewportWidth + marginPx);
    }
    showLoading(message = t('common.loading')) {
        if (this._locked)
            return;
        this.setErrorState(false);
        this.clearRetryCountdown();
        replaceChildren(this.content, h('div', { className: 'panel-loading' }, h('div', { className: 'panel-loading-radar' }, h('div', { className: 'panel-radar-sweep' }), h('div', { className: 'panel-radar-dot' })), h('div', { className: 'panel-loading-text' }, message)));
    }
    showError(message, onRetry, autoRetrySeconds) {
        if (this._locked)
            return;
        this.clearRetryCountdown();
        this.setErrorState(true);
        if (onRetry !== undefined)
            this.retryCallback = onRetry;
        const radarEl = h('div', { className: 'panel-loading-radar panel-error-radar' }, h('div', { className: 'panel-radar-sweep' }), h('div', { className: 'panel-radar-dot error' }));
        const msgEl = h('div', { className: 'panel-error-msg' }, message || t('common.failedToLoad'));
        const children = [radarEl, msgEl];
        if (this.retryCallback) {
            const backoffSeconds = autoRetrySeconds ?? Math.min(15 * 2 ** this.retryAttempt, 180);
            this.retryAttempt++;
            let remaining = Math.round(backoffSeconds);
            const countdownEl = h('div', { className: 'panel-error-countdown' }, `${t('common.retrying')} (${remaining}s)`);
            children.push(countdownEl);
            this.retryCountdownTimer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    this.clearRetryCountdown();
                    this.retryCallback?.();
                    return;
                }
                countdownEl.textContent = `${t('common.retrying')} (${remaining}s)`;
            }, 1000);
        }
        replaceChildren(this.content, h('div', { className: 'panel-error-state' }, ...children));
    }
    resetRetryBackoff() {
        this.retryAttempt = 0;
    }
    showLocked(features = []) {
        this._locked = true;
        this.clearRetryCountdown();
        for (let child = this.header.nextElementSibling; child && child !== this.content; child = child.nextElementSibling) {
            child.style.display = 'none';
        }
        this.element.classList.add('panel-is-locked');
        const iconEl = h('div', { className: 'panel-locked-icon' });
        iconEl.innerHTML = lockSvg;
        const lockedChildren = [
            iconEl,
            h('div', { className: 'panel-locked-desc' }, t('premium.lockedDesc')),
        ];
        if (features.length > 0) {
            const featureList = h('ul', { className: 'panel-locked-features' });
            for (const feat of features) {
                featureList.appendChild(h('li', {}, feat));
            }
            lockedChildren.push(featureList);
        }
        const ctaBtn = h('button', { type: 'button', className: 'panel-locked-cta' }, 'Upgrade to Pro');
        if (isDesktopRuntime()) {
            ctaBtn.addEventListener('click', () => void invokeTauri('open_url', { url: 'https://ivee.app/pro' }).catch(() => window.open('https://ivee.app/pro', '_blank')));
        }
        else {
            ctaBtn.addEventListener('click', () => {
                import('@/services/checkout').then(m => import('@/config/products').then(p => m.startCheckout(p.DEFAULT_UPGRADE_PRODUCT))).catch(() => {
                    window.open('https://ivee.app/pro', '_blank');
                });
            });
        }
        lockedChildren.push(ctaBtn);
        replaceChildren(this.content, h('div', { className: 'panel-locked-state' }, ...lockedChildren));
    }
    showGatedCta(reason, onAction) {
        this._locked = true;
        this.clearRetryCountdown();
        // Hide elements between header and content (same as showLocked)
        for (let child = this.header.nextElementSibling; child && child !== this.content; child = child.nextElementSibling) {
            child.style.display = 'none';
        }
        this.element.classList.add('panel-is-locked');
        const config = {
            [PanelGateReason.ANONYMOUS]: {
                icon: lockSvg,
                desc: t('premium.signInToUnlock'),
                cta: t('premium.signIn'),
            },
            [PanelGateReason.FREE_TIER]: {
                icon: upgradeSvg,
                desc: t('premium.upgradeDesc'),
                cta: t('premium.upgradeToPro'),
            },
        };
        const entry = config[reason];
        if (!entry)
            return; // PanelGateReason.NONE should never reach here
        const iconEl = h('div', { className: 'panel-locked-icon' });
        iconEl.innerHTML = entry.icon;
        const descEl = h('div', { className: 'panel-locked-desc' }, entry.desc);
        const ctaBtn = h('button', { type: 'button', className: 'panel-locked-cta' }, entry.cta);
        ctaBtn.addEventListener('click', onAction);
        replaceChildren(this.content, h('div', { className: 'panel-locked-state' }, iconEl, descEl, ctaBtn));
    }
    unlockPanel() {
        if (!this._locked)
            return;
        this._locked = false;
        this.element.classList.remove('panel-is-locked');
        // Re-show hidden elements
        for (let child = this.header.nextElementSibling; child && child !== this.content; child = child.nextElementSibling) {
            child.style.display = '';
        }
        // Clear the locked state content
        replaceChildren(this.content);
    }
    showRetrying(message, countdownSeconds) {
        if (this._locked)
            return;
        this.clearRetryCountdown();
        this.setErrorState(true);
        const radarEl = h('div', { className: 'panel-loading-radar panel-error-radar' }, h('div', { className: 'panel-radar-sweep' }), h('div', { className: 'panel-radar-dot error' }));
        const msgEl = h('div', { className: 'panel-error-msg' }, message || t('common.retrying'));
        const children = [radarEl, msgEl];
        if (countdownSeconds && countdownSeconds > 0) {
            let remaining = countdownSeconds;
            const countdownEl = h('div', { className: 'panel-error-countdown' }, `${t('common.retrying')} (${remaining}s)`);
            children.push(countdownEl);
            this.retryCountdownTimer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    this.clearRetryCountdown();
                    countdownEl.textContent = t('common.retrying');
                    return;
                }
                countdownEl.textContent = `${t('common.retrying')} (${remaining}s)`;
            }, 1000);
        }
        replaceChildren(this.content, h('div', { className: 'panel-error-state' }, ...children));
    }
    clearRetryCountdown() {
        if (this.retryCountdownTimer) {
            clearInterval(this.retryCountdownTimer);
            this.retryCountdownTimer = null;
        }
    }
    setRetryCallback(fn) {
        this.retryCallback = fn;
    }
    setFetching(v) {
        this._fetching = v;
        const btn = this.content.querySelector('[data-panel-retry]');
        if (btn)
            btn.disabled = v;
    }
    get isFetching() {
        return this._fetching;
    }
    showConfigError(message) {
        const msgEl = h('div', { className: 'config-error-message' }, message);
        if (isDesktopRuntime()) {
            msgEl.appendChild(h('button', {
                type: 'button',
                className: 'config-error-settings-btn',
                onClick: () => void invokeTauri('open_settings_window_command').catch(() => { }),
            }, t('components.panel.openSettings')));
        }
        replaceChildren(this.content, msgEl);
    }
    setCount(count) {
        if (this.countEl) {
            const prev = parseInt(this.countEl.textContent ?? '0', 10);
            this.countEl.textContent = count.toString();
            if (count > prev && getAiFlowSettings().badgeAnimation) {
                this.countEl.classList.remove('bump');
                void this.countEl.offsetWidth;
                this.countEl.classList.add('bump');
            }
        }
    }
    setErrorState(hasError, tooltip) {
        this.header.classList.toggle('panel-header-error', hasError);
        if (tooltip) {
            this.header.title = tooltip;
        }
        else {
            this.header.removeAttribute('title');
        }
    }
    setContent(html) {
        if (this._locked)
            return;
        this.setErrorState(false);
        this.clearRetryCountdown();
        this.retryAttempt = 0;
        if (this.pendingContentHtml === html || this.content.innerHTML === html) {
            return;
        }
        this.pendingContentHtml = html;
        if (this.contentDebounceTimer) {
            clearTimeout(this.contentDebounceTimer);
        }
        this.contentDebounceTimer = setTimeout(() => {
            if (this.pendingContentHtml !== null) {
                this.setContentImmediate(this.pendingContentHtml);
            }
        }, this.contentDebounceMs);
    }
    setContentImmediate(html) {
        if (this.contentDebounceTimer) {
            clearTimeout(this.contentDebounceTimer);
            this.contentDebounceTimer = null;
        }
        this.pendingContentHtml = null;
        if (this.content.innerHTML !== html) {
            this.content.innerHTML = html;
        }
    }
    show() {
        this.element.classList.remove('hidden');
    }
    hide() {
        this.element.classList.add('hidden');
    }
    toggle(visible) {
        if (visible)
            this.show();
        else
            this.hide();
    }
    /**
     * Update the "new items" badge
     * @param count Number of new items (0 hides badge)
     * @param pulse Whether to pulse the badge (for important updates)
     */
    setNewBadge(count, pulse = false) {
        if (!this.newBadgeEl)
            return;
        if (count <= 0) {
            this.newBadgeEl.style.display = 'none';
            this.newBadgeEl.classList.remove('pulse');
            this.element.classList.remove('has-new');
            return;
        }
        this.newBadgeEl.textContent = count > 99 ? '99+' : `${count} ${t('common.new')}`;
        this.newBadgeEl.style.display = 'inline-flex';
        this.element.classList.add('has-new');
        if (pulse) {
            this.newBadgeEl.classList.add('pulse');
        }
        else {
            this.newBadgeEl.classList.remove('pulse');
        }
    }
    /**
     * Clear the new items badge
     */
    clearNewBadge() {
        this.setNewBadge(0);
    }
    /**
     * Set the panel's severity level, controlling the header pulse dot speed.
     * critical = 0.6s, high = 1s, medium = 1.8s, low = 2.5s, none = hidden.
     */
    setSeverity(level) {
        if (level === this.currentSeverity)
            return;
        this.currentSeverity = level;
        if (!this.severityDotEl)
            return;
        this.severityDotEl.className = 'panel-severity-dot';
        if (level !== 'none') {
            this.severityDotEl.classList.add(`severity-${level}`);
        }
    }
    /**
     * Get the panel ID
     */
    getId() {
        return this.panelId;
    }
    /**
     * Reset panel height to default
     */
    resetHeight() {
        this.element.classList.remove('resized', 'span-1', 'span-2', 'span-3', 'span-4');
        const spans = loadPanelSpans();
        delete spans[this.panelId];
        localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
    }
    resetWidth() {
        clearColSpanClass(this.element);
        clearPanelColSpan(this.panelId);
    }
    get signal() {
        return this.abortController.signal;
    }
    isAbortError(error) {
        return error instanceof DOMException && error.name === 'AbortError';
    }
    destroy() {
        this.abortController.abort();
        this.clearRetryCountdown();
        if (this.colSpanReconcileRaf !== null) {
            cancelAnimationFrame(this.colSpanReconcileRaf);
            this.colSpanReconcileRaf = null;
        }
        if (this.contentDebounceTimer) {
            clearTimeout(this.contentDebounceTimer);
            this.contentDebounceTimer = null;
        }
        this.pendingContentHtml = null;
        if (this.tooltipCloseHandler) {
            document.removeEventListener('click', this.tooltipCloseHandler);
            this.tooltipCloseHandler = null;
        }
        this.removeRowTouchDocumentListeners();
        if (this.onTouchMove) {
            this.onTouchMove = null;
        }
        if (this.onTouchEnd) {
            this.onTouchEnd = null;
        }
        if (this.onTouchCancel) {
            this.onTouchCancel = null;
        }
        if (this.onDocMouseUp) {
            document.removeEventListener('mouseup', this.onDocMouseUp);
            this.onDocMouseUp = null;
        }
        if (this.onRowMouseMove) {
            document.removeEventListener('mousemove', this.onRowMouseMove);
            this.onRowMouseMove = null;
        }
        if (this.onRowMouseUp) {
            document.removeEventListener('mouseup', this.onRowMouseUp);
            this.onRowMouseUp = null;
        }
        if (this.onRowWindowBlur) {
            window.removeEventListener('blur', this.onRowWindowBlur);
            this.onRowWindowBlur = null;
        }
        if (this.onColMouseMove) {
            document.removeEventListener('mousemove', this.onColMouseMove);
            this.onColMouseMove = null;
        }
        if (this.onColMouseUp) {
            document.removeEventListener('mouseup', this.onColMouseUp);
            this.onColMouseUp = null;
        }
        if (this.onColWindowBlur) {
            window.removeEventListener('blur', this.onColWindowBlur);
            this.onColWindowBlur = null;
        }
        this.removeColTouchDocumentListeners();
        if (this.onColTouchMove) {
            this.onColTouchMove = null;
        }
        if (this.onColTouchEnd) {
            this.onColTouchEnd = null;
        }
        if (this.onColTouchCancel) {
            this.onColTouchCancel = null;
        }
        this.element.classList.remove('resizing', 'col-resizing');
        delete this.element.dataset.resizing;
        document.body.classList.remove('panel-resize-active');
    }
}
