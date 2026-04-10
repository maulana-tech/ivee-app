import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { getCSSColor } from '@/utils';
import { buildDependencyGraph, calculateCascade, getGraphStats, clearGraphCache, } from '@/services/infrastructure-cascade';
export class CascadePanel extends Panel {
    constructor() {
        super({
            id: 'cascade',
            title: t('panels.cascade'),
            showCount: true,
            trackActivity: true,
            infoTooltip: t('components.cascade.infoTooltip'),
        });
        Object.defineProperty(this, "graph", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "selectedNode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cascadeResult", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'cable'
        });
        Object.defineProperty(this, "onSelectCallback", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.setupDelegatedListeners();
        this.init();
    }
    async init() {
        this.showLoading();
        try {
            this.graph = buildDependencyGraph();
            const stats = getGraphStats();
            this.setCount(stats.nodes);
            this.render();
        }
        catch (error) {
            console.error('[CascadePanel] Init error:', error);
            this.showError(t('common.failedDependencyGraph'));
        }
    }
    getImpactColor(level) {
        switch (level) {
            case 'critical': return getCSSColor('--semantic-critical');
            case 'high': return getCSSColor('--semantic-high');
            case 'medium': return getCSSColor('--semantic-elevated');
            case 'low': return getCSSColor('--semantic-normal');
        }
    }
    getImpactEmoji(level) {
        switch (level) {
            case 'critical': return '🔴';
            case 'high': return '🟠';
            case 'medium': return '🟡';
            case 'low': return '🟢';
        }
    }
    getNodeTypeEmoji(type) {
        switch (type) {
            case 'cable': return '🔌';
            case 'pipeline': return '🛢️';
            case 'port': return '⚓';
            case 'chokepoint': return '🚢';
            case 'country': return '🏳️';
            default: return '📍';
        }
    }
    getFilterLabel(filter) {
        const labels = {
            cable: t('components.cascade.filters.cables'),
            pipeline: t('components.cascade.filters.pipelines'),
            port: t('components.cascade.filters.ports'),
            chokepoint: t('components.cascade.filters.chokepoints'),
        };
        return labels[filter];
    }
    getFilteredNodes() {
        if (!this.graph)
            return [];
        const nodes = [];
        for (const node of this.graph.nodes.values()) {
            if (this.filter === 'all' || node.type === this.filter) {
                if (node.type !== 'country') {
                    nodes.push(node);
                }
            }
        }
        return nodes.sort((a, b) => a.name.localeCompare(b.name));
    }
    renderSelector() {
        const nodes = this.getFilteredNodes();
        const filterButtons = ['cable', 'pipeline', 'port', 'chokepoint'].map((f) => `<button class="panel-tab ${this.filter === f ? 'active' : ''}" data-filter="${f}" role="radio" aria-checked="${this.filter === f}" aria-label="${this.getFilterLabel(f)}">
        ${this.getNodeTypeEmoji(f)} ${this.getFilterLabel(f)}
      </button>`).join('');
        const nodeOptions = nodes.map(n => `<option value="${escapeHtml(n.id)}" ${this.selectedNode === n.id ? 'selected' : ''}>
        ${escapeHtml(n.name)}
      </option>`).join('');
        const selectedType = t(`components.cascade.filterType.${this.filter}`);
        return `
      <div class="cascade-selector">
        <div class="panel-tabs" role="radiogroup" aria-label="Infrastructure type filter">${filterButtons}</div>
        <select class="cascade-select" ${nodes.length === 0 ? 'disabled' : ''}>
          <option value="">${t('components.cascade.selectPrompt', { type: selectedType })}</option>
          ${nodeOptions}
        </select>
        <button class="cascade-analyze-btn" ${!this.selectedNode ? 'disabled' : ''}>
          ${t('components.cascade.analyzeImpact')}
        </button>
      </div>
    `;
    }
    renderCascadeResult() {
        if (!this.cascadeResult)
            return '';
        const { source, countriesAffected, redundancies } = this.cascadeResult;
        const countriesHtml = countriesAffected.length > 0
            ? countriesAffected.map(c => `
          <div class="cascade-country" style="border-left: 3px solid ${this.getImpactColor(c.impactLevel)}">
            <span class="cascade-emoji">${this.getImpactEmoji(c.impactLevel)}</span>
            <span class="cascade-country-name">${escapeHtml(c.countryName)}</span>
            <span class="cascade-impact">${t(`components.cascade.impactLevels.${c.impactLevel}`)}</span>
            ${c.affectedCapacity > 0 ? `<span class="cascade-capacity">${t('components.cascade.capacityPercent', { percent: String(Math.round(c.affectedCapacity * 100)) })}</span>` : ''}
          </div>
        `).join('')
            : `<div class="empty-state">${t('components.cascade.noCountryImpacts')}</div>`;
        const redundanciesHtml = redundancies && redundancies.length > 0
            ? `
        <div class="cascade-section">
          <div class="cascade-section-title">${t('components.cascade.alternativeRoutes')}</div>
          ${redundancies.map(r => `
            <div class="cascade-redundancy">
              <span class="cascade-redundancy-name">${escapeHtml(r.name)}</span>
              <span class="cascade-redundancy-capacity">${Math.round(r.capacityShare * 100)}%</span>
            </div>
          `).join('')}
        </div>
      `
            : '';
        return `
      <div class="cascade-result">
        <div class="cascade-source">
          <span class="cascade-emoji">${this.getNodeTypeEmoji(source.type)}</span>
          <span class="cascade-source-name">${escapeHtml(source.name)}</span>
          <span class="cascade-source-type">${t(`components.cascade.filterType.${source.type}`)}</span>
        </div>
        <div class="cascade-section">
          <div class="cascade-section-title">${t('components.cascade.countriesAffected', { count: String(countriesAffected.length) })}</div>
          <div class="cascade-countries">${countriesHtml}</div>
        </div>
        ${redundanciesHtml}
      </div>
    `;
    }
    render() {
        if (!this.graph) {
            this.showLoading();
            return;
        }
        const stats = getGraphStats();
        const statsHtml = `
      <div class="cascade-stats">
        <span>🔌 ${stats.cables}</span>
        <span>🛢️ ${stats.pipelines}</span>
        <span>⚓ ${stats.ports}</span>
        <span>🌊 ${stats.chokepoints}</span>
        <span>🏳️ ${stats.countries}</span>
        <span>📊 ${stats.edges} ${t('components.cascade.links')}</span>
      </div>
    `;
        this.content.innerHTML = `
      <div class="cascade-panel">
        ${statsHtml}
        ${this.renderSelector()}
        ${this.cascadeResult ? this.renderCascadeResult() : `<div class="cascade-hint">${t('components.cascade.selectInfrastructureHint')}</div>`}
      </div>
    `;
    }
    /**
     * Attach delegated event listeners once on the container so that
     * re-renders (which replace innerHTML) never accumulate listeners.
     */
    setupDelegatedListeners() {
        this.content.addEventListener('click', (e) => {
            const target = e.target;
            const filterBtn = target.closest('.panel-tab');
            if (filterBtn) {
                this.filter = filterBtn.getAttribute('data-filter');
                this.selectedNode = null;
                this.cascadeResult = null;
                this.render();
                return;
            }
            if (target.closest('.cascade-analyze-btn')) {
                this.runAnalysis();
            }
        });
        this.content.addEventListener('change', (e) => {
            const target = e.target;
            if (target.closest('.cascade-select')) {
                const select = target;
                this.selectedNode = select.value || null;
                this.cascadeResult = null;
                if (this.onSelectCallback) {
                    this.onSelectCallback(this.selectedNode);
                }
                this.render();
            }
        });
    }
    runAnalysis() {
        if (!this.selectedNode)
            return;
        this.cascadeResult = calculateCascade(this.selectedNode);
        this.render();
        if (this.onSelectCallback) {
            this.onSelectCallback(this.selectedNode);
        }
    }
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        const nodeType = nodeId.split(':')[0];
        if (['cable', 'pipeline', 'port', 'chokepoint'].includes(nodeType)) {
            this.filter = nodeType;
        }
        this.runAnalysis();
    }
    onSelect(callback) {
        this.onSelectCallback = callback;
    }
    getSelectedNode() {
        return this.selectedNode;
    }
    getCascadeResult() {
        return this.cascadeResult;
    }
    refresh() {
        clearGraphCache();
        this.graph = null;
        this.cascadeResult = null;
        this.init();
    }
}
