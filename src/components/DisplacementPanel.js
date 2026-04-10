import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { formatPopulation } from '@/services/displacement';
import { t } from '@/services/i18n';
export class DisplacementPanel extends Panel {
    constructor() {
        super({
            id: 'displacement',
            title: t('panels.displacement'),
            showCount: true,
            trackActivity: true,
            infoTooltip: t('components.displacement.infoTooltip'),
            defaultRowSpan: 2,
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activeTab", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'origins'
        });
        Object.defineProperty(this, "onCountryClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.showLoading(t('common.loadingDisplacement'));
        this.content.addEventListener('click', (e) => {
            const tab = e.target.closest('.panel-tab');
            if (tab?.dataset.tab) {
                this.activeTab = tab.dataset.tab;
                this.renderContent();
                return;
            }
            const row = e.target.closest('.disp-row');
            if (row) {
                const lat = Number(row.dataset.lat);
                const lon = Number(row.dataset.lon);
                if (Number.isFinite(lat) && Number.isFinite(lon))
                    this.onCountryClick?.(lat, lon);
            }
        });
    }
    setCountryClickHandler(handler) {
        this.onCountryClick = handler;
    }
    setData(data) {
        this.data = data;
        this.setCount(data.countries?.length ?? 0);
        this.renderContent();
    }
    renderContent() {
        if (!this.data)
            return;
        const g = this.data.globalTotals;
        const stats = [
            { label: t('components.displacement.refugees'), value: formatPopulation(g.refugees), cls: 'disp-stat-refugees' },
            { label: t('components.displacement.asylumSeekers'), value: formatPopulation(g.asylumSeekers), cls: 'disp-stat-asylum' },
            { label: t('components.displacement.idps'), value: formatPopulation(g.idps), cls: 'disp-stat-idps' },
            { label: t('components.displacement.total'), value: formatPopulation(g.total), cls: 'disp-stat-total' },
        ];
        const statsHtml = stats.map(s => `<div class="disp-stat-box ${s.cls}">
        <span class="disp-stat-value">${s.value}</span>
        <span class="disp-stat-label">${s.label}</span>
      </div>`).join('');
        const tabsHtml = `
      <div class="panel-tabs" role="tablist" aria-label="Displacement data view">
        <button class="panel-tab ${this.activeTab === 'origins' ? 'active' : ''}" data-tab="origins" role="tab" aria-selected="${this.activeTab === 'origins'}" id="disp-tab-origins" aria-controls="disp-tab-panel">${t('components.displacement.origins')}</button>
        <button class="panel-tab ${this.activeTab === 'hosts' ? 'active' : ''}" data-tab="hosts" role="tab" aria-selected="${this.activeTab === 'hosts'}" id="disp-tab-hosts" aria-controls="disp-tab-panel">${t('components.displacement.hosts')}</button>
      </div>
    `;
        let countries;
        if (this.activeTab === 'origins') {
            countries = [...this.data.countries]
                .filter(c => c.refugees + c.asylumSeekers > 0)
                .sort((a, b) => (b.refugees + b.asylumSeekers) - (a.refugees + a.asylumSeekers));
        }
        else {
            countries = [...this.data.countries]
                .filter(c => (c.hostTotal || 0) > 0)
                .sort((a, b) => (b.hostTotal || 0) - (a.hostTotal || 0));
        }
        const displayed = countries.slice(0, 30);
        let tableHtml;
        if (displayed.length === 0) {
            tableHtml = `<div class="panel-empty">${t('common.noDataShort')}</div>`;
        }
        else {
            const rows = displayed.map(c => {
                const hostTotal = c.hostTotal || 0;
                const count = this.activeTab === 'origins' ? c.refugees + c.asylumSeekers : hostTotal;
                const total = this.activeTab === 'origins' ? c.totalDisplaced : hostTotal;
                const badgeCls = total >= 1000000 ? 'disp-crisis'
                    : total >= 500000 ? 'disp-high'
                        : total >= 100000 ? 'disp-elevated'
                            : '';
                const badgeLabel = total >= 1000000 ? t('components.displacement.badges.crisis')
                    : total >= 500000 ? t('components.displacement.badges.high')
                        : total >= 100000 ? t('components.displacement.badges.elevated')
                            : '';
                const badgeHtml = badgeLabel
                    ? `<span class="disp-badge ${badgeCls}">${badgeLabel}</span>`
                    : '';
                return `<tr class="disp-row" data-lat="${c.lat || ''}" data-lon="${c.lon || ''}">
          <td class="disp-name">${escapeHtml(c.name)}</td>
          <td class="disp-status">${badgeHtml}</td>
          <td class="disp-count">${formatPopulation(count)}</td>
        </tr>`;
            }).join('');
            tableHtml = `
        <table class="disp-table">
          <thead>
            <tr>
              <th>${t('components.displacement.country')}</th>
              <th>${t('components.displacement.status')}</th>
              <th>${t('components.displacement.count')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
        }
        this.setContent(`
      <div class="disp-panel-content">
        <div class="disp-stats-grid">${statsHtml}</div>
        ${tabsHtml}
        <div id="disp-tab-panel" role="tabpanel" aria-labelledby="disp-tab-${this.activeTab}">
          ${tableHtml}
        </div>
      </div>
    `);
    }
}
