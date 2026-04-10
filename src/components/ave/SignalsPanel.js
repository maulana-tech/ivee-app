import { Panel } from '../Panel';
import { isEnabled } from '@/services/ave/client';
import { generateSignals, formatSignalBadge } from '@/services/ave/signals';
export class SignalsPanel extends Panel {
    constructor(options) {
        super(options);
        Object.defineProperty(this, "signals", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "chain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'base'
        });
        this.element.classList.add('signals-panel');
        this.element.classList.add('panel-wide');
    }
    renderContent() {
        if (!isEnabled()) {
            this.showSetupRequired();
            return;
        }
        this.renderSignals();
    }
    showSetupRequired() {
        this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">📊</div>
        <h3>Trading Signals Setup Required</h3>
        <p>Configure AVE Cloud API to enable trading signals:</p>
        <ol>
          <li>Register at <a href="https://cloud.ave.ai/register" target="_blank">cloud.ave.ai</a></li>
          <li>Get your free API key</li>
          <li>Add to .env.local:
            <code>VITE_AVE_API_KEY=your_key<br>VITE_AVE_ENABLED=true</code>
          </li>
        </ol>
      </div>
    `);
    }
    renderSignals() {
        if (this.signals.length === 0) {
            this.showLoading('Analyzing market signals...');
            this.loadSignals();
            return;
        }
        const html = `
      <div class="signals-header">
        <span class="signal-count">${this.signals.length} signals</span>
        <button class="refresh-btn" title="Refresh">↻</button>
      </div>
      <div class="signals-list">
        ${this.signals.map(signal => this.renderSignal(signal)).join('')}
      </div>
    `;
        this.setContent(html);
        this.attachEventListeners();
    }
    renderSignal(signal) {
        const { emoji, color } = formatSignalBadge(signal.signal);
        const isBuy = signal.signal.includes('buy');
        return `
      <div class="signal-item ${isBuy ? 'buy-signal' : 'sell-signal'}" data-id="${signal.id}">
        <div class="signal-badge" style="background: ${color}">${emoji} ${signal.signal.replace('_', ' ').toUpperCase()}</div>
        <div class="signal-details">
          <div class="signal-token">${signal.symbol}</div>
          <div class="signal-reason">${signal.reason.replace('_', ' ')}</div>
        </div>
        <div class="signal-metrics">
          <div class="signal-confidence">
            <div class="confidence-bar" style="width: ${signal.confidence}%"></div>
            <span>${signal.confidence}%</span>
          </div>
          ${signal.targetPrice ? `
            <div class="signal-target">
              <span class="label">Target:</span>
              <span class="value">$${signal.targetPrice.toFixed(6)}</span>
            </div>
          ` : ''}
        </div>
        <div class="signal-time">${signal.timeAgo}</div>
      </div>
    `;
    }
    attachEventListeners() {
        const refreshBtn = this.element.querySelector('.refresh-btn');
        refreshBtn?.addEventListener('click', () => {
            this.loadSignals();
        });
    }
    async loadSignals() {
        this.showLoading('Analyzing market signals...');
        try {
            this.signals = await generateSignals(this.chain, ['hot', 'gainers'], 15);
            this.renderSignals();
        }
        catch (error) {
            this.showError('Failed to generate signals');
        }
    }
    async refresh() {
        await this.loadSignals();
    }
}
