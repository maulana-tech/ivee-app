import { Panel } from '../Panel';
import { browserExecutionLog, type BrowserLogEntry, type ExecutionLogEntryType } from '@/services/nba/browser-execution-log';

const TYPE_LABELS: Record<ExecutionLogEntryType, string> = {
  signal: 'Signal',
  risk_check: 'Risk Check',
  order_submit: 'Order Submitted',
  order_fill: 'Order Filled',
  order_cancel: 'Order Cancelled',
  error: 'Error',
};

const TYPE_COLORS: Record<ExecutionLogEntryType, string> = {
  signal: '#4488ff',
  risk_check: '#ffaa00',
  order_submit: '#00ccff',
  order_fill: '#00ff88',
  order_cancel: '#ff8800',
  error: '#ff4444',
};

const AUTOMATION_LABELS: Record<string, string> = {
  'arbitrage-scanner': 'Arbitrage Scanner',
  'momentum-trader': 'Momentum Trader',
  'cross-market-correlation': 'Cross-Market Correlation',
  'speed-based-opportunity': 'Speed-Based Opportunity',
};

export class NbaExecutionLogsPanel extends Panel {
  private filterType: ExecutionLogEntryType | 'all' = 'all';
  private filterAutomation = 'all';
  private refreshInterval: number | null = null;

  constructor(options: { id: string; title: string }) {
    super(options);
    this.element.classList.add('nba-exec-logs-panel');
  }

  protected renderContent(): void {
    this.render();
    this.refreshInterval = window.setInterval(() => this.refreshList(), 5000);
  }

  private getFiltered(): BrowserLogEntry[] {
    let entries = browserExecutionLog.getEntries().slice().reverse();
    if (this.filterType !== 'all') entries = entries.filter(e => e.type === this.filterType);
    if (this.filterAutomation !== 'all') entries = entries.filter(e => e.automation_id === this.filterAutomation);
    return entries;
  }

  private getAutomations(): string[] {
    const ids = new Set(browserExecutionLog.getEntries().map(e => e.automation_id));
    return Array.from(ids);
  }

  private render(): void {
    const entries = this.getFiltered();
    const automations = this.getAutomations();
    const total = browserExecutionLog.getEntries().length;

    const html = `
      <div class="nba-exec-layout">
        <div class="nba-exec-toolbar">
          <div class="nba-exec-filters">
            <select class="nba-exec-select" id="execTypeFilter">
              <option value="all">All Types</option>
              ${(Object.keys(TYPE_LABELS) as ExecutionLogEntryType[]).map(t =>
                `<option value="${t}" ${this.filterType === t ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`
              ).join('')}
            </select>
            <select class="nba-exec-select" id="execAutoFilter">
              <option value="all">All Strategies</option>
              ${automations.map(a =>
                `<option value="${a}" ${this.filterAutomation === a ? 'selected' : ''}>${AUTOMATION_LABELS[a] ?? a}</option>`
              ).join('')}
            </select>
          </div>
          <div class="nba-exec-actions">
            <span class="nba-exec-count">${total} total entries</span>
            <button class="nba-exec-btn export" id="execExportBtn" ${total === 0 ? 'disabled' : ''}>
              &#8659; Export JSONL
            </button>
            <button class="nba-exec-btn clear" id="execClearBtn" ${total === 0 ? 'disabled' : ''}>
              &#128465; Clear
            </button>
          </div>
        </div>

        ${total === 0 ? this.renderEmptyState() : `
          <div class="nba-exec-summary">
            ${this.renderSummaryBadges()}
          </div>
          <div class="nba-exec-list" id="execList">
            ${entries.length > 0 ? entries.map(e => this.renderEntry(e)).join('') : '<div class="nba-exec-empty">No entries match filters</div>'}
          </div>
        `}
      </div>
    `;

    this.setContent(html);
    this.attachEvents();
  }

  private renderEmptyState(): string {
    return `
      <div class="nba-exec-empty-state">
        <div class="nba-exec-empty-icon">&#128196;</div>
        <h3>No Execution Logs Yet</h3>
        <p>Run a strategy from the Automation Engine panel to generate execution logs.</p>
        <p class="nba-exec-empty-sub">Logs are written per pipeline step: signals, risk checks, order submissions, and fills.</p>
      </div>
    `;
  }

  private renderSummaryBadges(): string {
    const all = browserExecutionLog.getEntries();
    const counts: Partial<Record<ExecutionLogEntryType, number>> = {};
    for (const e of all) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }

    return (Object.entries(counts) as [ExecutionLogEntryType, number][])
      .map(([type, count]) => `
        <span class="nba-exec-badge" style="border-color:${TYPE_COLORS[type]}; color:${TYPE_COLORS[type]}">
          ${TYPE_LABELS[type]}: ${count}
        </span>
      `).join('');
  }

  private renderEntry(entry: BrowserLogEntry): string {
    const color = TYPE_COLORS[entry.type];
    const label = TYPE_LABELS[entry.type];
    const autoLabel = AUTOMATION_LABELS[entry.automation_id] ?? entry.automation_id;
    const time = new Date(entry.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    const payloadHtml = this.renderPayload(entry);

    return `
      <div class="nba-exec-entry">
        <div class="nba-exec-entry-header">
          <span class="nba-exec-type-badge" style="background:${color}22; color:${color}; border-color:${color}44">
            ${label}
          </span>
          <span class="nba-exec-automation">${autoLabel}</span>
          <span class="nba-exec-market">${entry.market_id || '—'}</span>
          <span class="nba-exec-time">${time}</span>
        </div>
        <div class="nba-exec-payload">${payloadHtml}</div>
      </div>
    `;
  }

  private renderPayload(entry: BrowserLogEntry): string {
    const p = entry.payload;

    if (entry.type === 'signal') {
      const approved = p['action'] !== 'hold' && p['action'] !== 'skip';
      return `
        <div class="nba-exec-payload-row">
          <span class="nba-exec-pill ${approved ? 'green' : 'gray'}">${String(p['action']).replace('_', ' ').toUpperCase()}</span>
          <span class="nba-exec-pill blue">${String(p['side']).toUpperCase()}</span>
          <span>Confidence: <strong>${p['confidence']}%</strong></span>
          <span>Edge: <strong>${p['edge']}%</strong></span>
          <span>Expected P&L: <strong>$${p['expected_pnl']}</strong></span>
        </div>
        ${Array.isArray(p['reasoning']) && p['reasoning'].length > 0
          ? `<div class="nba-exec-reasoning">${(p['reasoning'] as string[]).map(r => `<span>&#8226; ${r}</span>`).join('')}</div>`
          : ''}
      `;
    }

    if (entry.type === 'risk_check') {
      const approved = Boolean(p['approved']);
      return `
        <div class="nba-exec-payload-row">
          <span class="nba-exec-pill ${approved ? 'green' : 'red'}">${approved ? 'APPROVED' : 'REJECTED'}</span>
          <span>Size: <strong>$${p['position_size']}</strong></span>
          <span>Limit: <strong>$${p['risk_limit']}</strong></span>
          ${!approved ? `<span class="nba-exec-reject-reason">&#9888; ${p['rejection_reason']}</span>` : ''}
        </div>
      `;
    }

    if (entry.type === 'order_submit' || entry.type === 'order_fill') {
      return `
        <div class="nba-exec-payload-row">
          <span class="nba-exec-pill ${entry.type === 'order_fill' ? 'green' : 'blue'}">${entry.type === 'order_fill' ? 'FILLED' : 'SUBMITTED'}</span>
          <span>Order: <strong>${String(p['order_id'])}</strong></span>
          ${p['size'] !== undefined ? `<span>Size: <strong>$${p['size']}</strong></span>` : ''}
          ${p['fill_price'] !== undefined ? `<span>Fill: <strong>$${p['fill_price']}</strong></span>` : ''}
          ${p['dry_run'] ? `<span class="nba-exec-pill gray">DRY RUN</span>` : ''}
        </div>
      `;
    }

    if (entry.type === 'error') {
      return `
        <div class="nba-exec-payload-row">
          <span class="nba-exec-pill red">ERROR</span>
          <span>Step: <strong>${p['step']}</strong></span>
          <span class="nba-exec-reject-reason">${p['error']}</span>
        </div>
      `;
    }

    return `<pre class="nba-exec-raw">${JSON.stringify(p, null, 2)}</pre>`;
  }

  private refreshList(): void {
    const listEl = this.element.querySelector('#execList');
    const countEl = this.element.querySelector('.nba-exec-count');
    const summaryEl = this.element.querySelector('.nba-exec-summary');
    const exportBtn = this.element.querySelector('#execExportBtn');
    const clearBtn = this.element.querySelector('#execClearBtn');

    const total = browserExecutionLog.getEntries().length;
    if (countEl) countEl.textContent = `${total} total entries`;
    if (exportBtn) (exportBtn as HTMLButtonElement).disabled = total === 0;
    if (clearBtn) (clearBtn as HTMLButtonElement).disabled = total === 0;

    if (summaryEl) summaryEl.innerHTML = this.renderSummaryBadges();

    if (!listEl) return;
    const entries = this.getFiltered();
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="nba-exec-empty">No entries match filters</div>';
      return;
    }
    listEl.innerHTML = entries.map(e => this.renderEntry(e)).join('');
  }

  private attachEvents(): void {
    const typeFilter = this.element.querySelector('#execTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.filterType = (e.target as HTMLSelectElement).value as ExecutionLogEntryType | 'all';
        this.refreshList();
      });
    }

    const autoFilter = this.element.querySelector('#execAutoFilter');
    if (autoFilter) {
      autoFilter.addEventListener('change', (e) => {
        this.filterAutomation = (e.target as HTMLSelectElement).value;
        this.refreshList();
      });
    }

    const exportBtn = this.element.querySelector('#execExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.downloadJsonl());
    }

    const clearBtn = this.element.querySelector('#execClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all execution logs?')) {
          browserExecutionLog.clearEntries();
          this.render();
        }
      });
    }
  }

  private downloadJsonl(): void {
    const content = browserExecutionLog.exportAsJsonl();
    if (!content) return;
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([content], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canon-execution-${date}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public async refresh(): Promise<void> {
    this.render();
  }

  public dispose(): void {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
