import { Panel } from '../Panel';
import { isEnabled, getRiskReport, searchTokens } from '@/services/ave/client';
export class RiskScannerPanel extends Panel {
    constructor(options) {
        super(options);
        Object.defineProperty(this, "scanResult", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "scannedToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        this.element.classList.add('risk-scanner-panel');
    }
    renderContent() {
        if (!isEnabled()) {
            this.showSetupRequired();
            return;
        }
        this.renderScanner();
    }
    showSetupRequired() {
        this.setContent(`
      <div class="ave-setup-required">
        <div class="ave-icon">🔍</div>
        <h3>Risk Scanner Setup Required</h3>
        <p>Configure AVE Cloud API to enable token risk scanning:</p>
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
    renderScanner() {
        const html = `
      <div class="scanner-form">
        <input type="text" class="token-input" placeholder="Enter token address or symbol...">
        <select class="chain-select">
          <option value="base">Base</option>
          <option value="ethereum">Ethereum</option>
          <option value="bsc">BSC</option>
          <option value="solana">Solana</option>
        </select>
        <button class="scan-btn">Scan</button>
      </div>
      <div class="scan-result">
        ${this.scanResult ? this.renderResult() : '<div class="empty-state">Enter a token address to scan for risks</div>'}
      </div>
    `;
        this.setContent(html);
        this.attachEventListeners();
    }
    renderResult() {
        if (!this.scanResult)
            return '';
        const r = this.scanResult;
        const isRisky = r.is_honeypot || r.buy_tax > 10 || r.sell_tax > 10;
        const riskLevel = isRisky ? 'HIGH' : r.owner_renounced && r.liquidity_locked ? 'LOW' : 'MEDIUM';
        const riskColor = riskLevel === 'HIGH' ? '#ff4444' : riskLevel === 'MEDIUM' ? '#ffaa00' : '#00ff00';
        const riskIcon = riskLevel === 'HIGH' ? '⚠️' : riskLevel === 'MEDIUM' ? '⚡' : '✅';
        return `
      <div class="risk-result ${riskLevel.toLowerCase()}">
        <div class="risk-header">
          <span class="risk-badge" style="background: ${riskColor}">
            ${riskIcon} ${riskLevel} RISK
          </span>
          <span class="scanned-token">${this.scannedToken}</span>
        </div>
        <div class="risk-details">
          <div class="risk-item ${r.is_honeypot ? 'danger' : ''}">
            <span class="label">Honeypot</span>
            <span class="value">${r.is_honeypot ? 'YES ⚠️' : 'No'}</span>
          </div>
          <div class="risk-item ${r.buy_tax > 5 ? 'warning' : ''}">
            <span class="label">Buy Tax</span>
            <span class="value">${r.buy_tax.toFixed(1)}%</span>
          </div>
          <div class="risk-item ${r.sell_tax > 5 ? 'warning' : ''}">
            <span class="label">Sell Tax</span>
            <span class="value">${r.sell_tax.toFixed(1)}%</span>
          </div>
          <div class="risk-item">
            <span class="label">Owner Renounced</span>
            <span class="value">${r.owner_renounced ? 'Yes ✅' : 'No ⚠️'}</span>
          </div>
          <div class="risk-item">
            <span class="label">Liquidity Locked</span>
            <span class="value">${r.liquidity_locked ? 'Yes ✅' : 'No ⚠️'}</span>
          </div>
          <div class="risk-item">
            <span class="label">Holders</span>
            <span class="value">${r.holders.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `;
    }
    attachEventListeners() {
        const scanBtn = this.element.querySelector('.scan-btn');
        const tokenInput = this.element.querySelector('.token-input');
        scanBtn?.addEventListener('click', () => this.performScan());
        tokenInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter')
                this.performScan();
        });
    }
    async performScan() {
        const tokenInput = this.element.querySelector('.token-input');
        const resultDiv = this.element.querySelector('.scan-result');
        const input = tokenInput?.value?.trim();
        const chain = this.element.querySelector('.chain-select')?.value || 'base';
        if (!input)
            return;
        this.scannedToken = input;
        resultDiv.innerHTML = '<div class="loading">Scanning...</div>';
        try {
            // First try to search for the token
            let address = input;
            if (!address.startsWith('0x')) {
                const results = await searchTokens(input, chain);
                if (results.length > 0) {
                    const firstResult = results[0];
                    const parts = firstResult.id.split('-');
                    address = parts[0] || firstResult.id;
                    this.scannedToken = firstResult.symbol;
                }
                else {
                    resultDiv.innerHTML = '<div class="error">Token not found</div>';
                    return;
                }
            }
            this.scanResult = await getRiskReport(address, chain);
            this.renderScanner();
        }
        catch {
            resultDiv.innerHTML = '<div class="error">Scan failed. Please try again.</div>';
        }
    }
    async refresh() {
        if (this.scannedToken) {
            await this.performScan();
        }
    }
}
