import { Panel } from '../Panel';
import { isEnabled, getTrendingTokens } from '@/services/ave/client';
export class TrendingPanel extends Panel {
    constructor(options) {
        super(options);
        Object.defineProperty(this, "trending", {
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
        Object.defineProperty(this, "topic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'hot'
        });
        this.element.classList.add('trending-panel');
    }
    renderContent() {
        if (!isEnabled()) {
            this.showSetupRequired();
            return;
        }
        this.renderTrending();
    }
    showSetupRequired() {
        this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">📈</div>
        <h3>Trending Tokens Setup Required</h3>
        <p>Configure AVE Cloud API to enable trending tokens:</p>
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
    renderTrending() {
        if (this.trending.length === 0) {
            this.showLoading('Loading trending tokens...');
            this.loadTrending();
            return;
        }
        const html = `
      <div class="trending-controls">
        <select class="topic-select">
          <option value="hot" ${this.topic === 'hot' ? 'selected' : ''}>🔥 Hot</option>
          <option value="gainers" ${this.topic === 'gainers' ? 'selected' : ''}>📈 Gainers</option>
          <option value="losers" ${this.topic === 'losers' ? 'selected' : ''}>📉 Losers</option>
          <option value="new" ${this.topic === 'new' ? 'selected' : ''}>✨ New</option>
        </select>
        <button class="refresh-btn" title="Refresh">↻</button>
      </div>
      <div class="trending-list">
        ${this.trending.map((t, i) => this.renderToken(t, i)).join('')}
      </div>
    `;
        this.setContent(html);
        this.attachEventListeners();
    }
    renderToken(token, rank) {
        const change = parseFloat(token.change24h || '0');
        const changeColor = change >= 0 ? '#00ff00' : '#ff4444';
        return `
      <div class="trending-item" data-token="${token.id}">
        <div class="trending-rank">${rank + 1}</div>
        <div class="trending-token">
          <span class="token-symbol">${token.symbol}</span>
          <span class="token-chain">${token.chain}</span>
        </div>
        <div class="trending-price">$${parseFloat(token.price || '0').toFixed(6)}</div>
        <div class="trending-change" style="color: ${changeColor}">
          ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
        </div>
        <button class="add-watchlist-btn" title="Add to watchlist">⭐</button>
      </div>
    `;
    }
    attachEventListeners() {
        const topicSelect = this.element.querySelector('.topic-select');
        const refreshBtn = this.element.querySelector('.refresh-btn');
        topicSelect?.addEventListener('change', (e) => {
            this.topic = e.target.value;
            this.loadTrending();
        });
        refreshBtn?.addEventListener('click', () => {
            this.loadTrending();
        });
        // Add to watchlist buttons
        this.element.querySelectorAll('.add-watchlist-btn').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                const token = this.trending[i];
                if (token) {
                    // Could dispatch event or save to localStorage
                    btn.textContent = '✓';
                    btn.style.color = '#00ff00';
                }
            });
        });
    }
    async loadTrending() {
        this.showLoading('Loading trending tokens...');
        try {
            this.trending = await getTrendingTokens(this.chain, this.topic);
            this.renderTrending();
        }
        catch (error) {
            this.showError('Failed to load trending tokens');
        }
    }
    async refresh() {
        await this.loadTrending();
    }
}
