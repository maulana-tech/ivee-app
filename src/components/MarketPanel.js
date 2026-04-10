import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { formatPrice, formatChange, getChangeClass, getHeatmapClass } from '@/utils';
import { escapeHtml } from '@/utils/sanitize';
import { miniSparkline } from '@/utils/sparkline';
import { SITE_VARIANT } from '@/config';
import { getMarketWatchlistEntries, parseMarketWatchlistInput, resetMarketWatchlist, setMarketWatchlistEntries, } from '@/services/market-watchlist';
export class MarketPanel extends Panel {
    constructor() {
        super({ id: 'markets', title: t('panels.markets'), infoTooltip: t('components.markets.infoTooltip') });
        Object.defineProperty(this, "settingsBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.createSettingsButton();
    }
    createSettingsButton() {
        this.settingsBtn = document.createElement('button');
        this.settingsBtn.className = 'live-news-settings-btn';
        this.settingsBtn.title = 'Customize market watchlist';
        this.settingsBtn.textContent = 'Watchlist';
        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openWatchlistModal();
        });
        this.header.appendChild(this.settingsBtn);
    }
    openWatchlistModal() {
        if (this.overlay)
            return;
        const current = getMarketWatchlistEntries();
        const currentText = current.length
            ? current.map((e) => (e.name ? `${e.symbol}|${e.name}` : e.symbol)).join('\n')
            : '';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'marketWatchlistModal';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay)
                this.closeWatchlistModal();
        });
        const modal = document.createElement('div');
        modal.className = 'modal unified-settings-modal';
        modal.style.maxWidth = '680px';
        modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Market watchlist</span>
        <button class="modal-close" aria-label="Close">×</button>
      </div>
      <div style="padding:14px 16px 16px 16px">
        <div style="color:var(--text-dim);font-size:12px;line-height:1.4;margin-bottom:10px">
          Add extra tickers (comma or newline separated). Friendly labels supported: SYMBOL|Label.
          Example: TSLA|Tesla, AAPL|Apple, ^GSPC|S&P 500
          <br/>
          Tip: keep it under ~30 unless you enjoy scrolling.
        </div>
        <textarea id="wmMarketWatchlistInput"
          style="width:100%;min-height:120px;resize:vertical;background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:10px;font-family:inherit;font-size:12px;outline:none"
          spellcheck="false"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button type="button" class="panels-reset-layout" id="wmMarketResetBtn">Reset</button>
          <button type="button" class="panels-reset-layout" id="wmMarketCancelBtn">Cancel</button>
          <button type="button" class="panels-reset-layout" id="wmMarketSaveBtn" style="border-color:var(--text-dim);color:var(--text)">Save</button>
        </div>
      </div>
    `;
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.closeWatchlistModal());
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        this.overlay = overlay;
        const input = modal.querySelector('#wmMarketWatchlistInput');
        if (input)
            input.value = currentText;
        modal.querySelector('#wmMarketCancelBtn')?.addEventListener('click', () => this.closeWatchlistModal());
        modal.querySelector('#wmMarketResetBtn')?.addEventListener('click', () => {
            resetMarketWatchlist();
            if (input)
                input.value = ''; // defaults are always included automatically
            this.closeWatchlistModal();
        });
        modal.querySelector('#wmMarketSaveBtn')?.addEventListener('click', () => {
            const raw = input?.value || '';
            const parsed = parseMarketWatchlistInput(raw);
            if (parsed.length === 0)
                resetMarketWatchlist();
            else
                setMarketWatchlistEntries(parsed);
            this.closeWatchlistModal();
        });
    }
    closeWatchlistModal() {
        if (!this.overlay)
            return;
        this.overlay.remove();
        this.overlay = null;
    }
    renderMarkets(data, rateLimited) {
        if (data.length === 0) {
            this.showRetrying(rateLimited ? t('common.rateLimitedMarket') : t('common.failedMarketData'));
            return;
        }
        const html = data
            .map((stock) => `
      <div class="market-item">
        <div class="market-info">
          <span class="market-name">${escapeHtml(stock.name)}</span>
          <span class="market-symbol">${escapeHtml(stock.display)}</span>
        </div>
        <div class="market-data">
          ${miniSparkline(stock.sparkline, stock.change)}
          <span class="market-price">${formatPrice(stock.price)}</span>
          <span class="market-change ${getChangeClass(stock.change)}">${formatChange(stock.change)}</span>
        </div>
      </div>
    `)
            .join('');
        this.setContent(html);
    }
}
export class HeatmapPanel extends Panel {
    constructor() {
        super({ id: 'heatmap', title: t('panels.heatmap'), infoTooltip: t('components.heatmap.infoTooltip') });
    }
    renderHeatmap(data, sectorBars) {
        if (data.length === 0) {
            this.showRetrying(t('common.failedSectorData'));
            return;
        }
        const tileHtml = '<div class="heatmap">' +
            data
                .map((sector) => {
                const change = sector.change ?? 0;
                const tickerHtml = sector.symbol
                    ? `<div class="sector-ticker">${escapeHtml(sector.symbol)}</div>`
                    : '';
                return `
        <div class="heatmap-cell ${getHeatmapClass(change)}">
          ${tickerHtml}
          <div class="sector-change ${getChangeClass(change)}">${formatChange(change)}</div>
          <div class="sector-name">${escapeHtml(sector.name)}</div>
        </div>
      `;
            })
                .join('') +
            '</div>';
        let barChartHtml = '';
        if (sectorBars && sectorBars.length > 0) {
            const sorted = [...sectorBars]
                .filter((s) => Number.isFinite(s.change1d))
                .sort((a, b) => b.change1d - a.change1d);
            if (sorted.length === 0) {
                this.setContent(tileHtml);
                return;
            }
            const maxAbs = Math.max(...sorted.map((s) => Math.abs(s.change1d)), 3);
            barChartHtml =
                '<div class="heatmap-bar-chart">' +
                    sorted
                        .map((s) => {
                        const pct = Math.min((Math.abs(s.change1d) / maxAbs) * 100, 100).toFixed(1);
                        const isPos = s.change1d >= 0;
                        const color = isPos ? 'var(--green)' : 'var(--red)';
                        const sign = isPos ? '+' : '';
                        return `<div class="heatmap-bar-row">
  <span class="heatmap-bar-label">${escapeHtml(s.symbol)}</span>
  <div class="heatmap-bar-track"><div class="heatmap-bar-fill" style="width:${pct}%;background:${color}"></div></div>
  <span class="heatmap-bar-value ${isPos ? 'positive' : 'negative'}">${sign}${s.change1d.toFixed(2)}%</span>
</div>`;
                    })
                        .join('') +
                    '</div>';
        }
        this.setContent(tileHtml + barChartHtml);
    }
}
// CCYUSD=X (e.g. EURUSD): USD is quote, rate = USD/FC → XAU_FC = XAU_USD / rate
// USDCCY=X (e.g. USDJPY, USDCHF): USD is base, rate = FC/USD → XAU_FC = XAU_USD * rate
const XAU_CURRENCY_CONFIG = [
    { symbol: 'EURUSD=X', label: 'EUR', flag: '🇪🇺', multiply: false },
    { symbol: 'GBPUSD=X', label: 'GBP', flag: '🇬🇧', multiply: false },
    { symbol: 'USDJPY=X', label: 'JPY', flag: '🇯🇵', multiply: true },
    { symbol: 'USDCNY=X', label: 'CNY', flag: '🇨🇳', multiply: true },
    { symbol: 'USDINR=X', label: 'INR', flag: '🇮🇳', multiply: true },
    { symbol: 'AUDUSD=X', label: 'AUD', flag: '🇦🇺', multiply: false },
    { symbol: 'USDCHF=X', label: 'CHF', flag: '🇨🇭', multiply: true },
    { symbol: 'USDCAD=X', label: 'CAD', flag: '🇨🇦', multiply: true },
    { symbol: 'USDTRY=X', label: 'TRY', flag: '🇹🇷', multiply: true },
];
export class CommoditiesPanel extends Panel {
    constructor() {
        super({ id: 'commodities', title: t('panels.commodities'), infoTooltip: t('components.commodities.infoTooltip') });
        Object.defineProperty(this, "_tab", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'commodities'
        });
        Object.defineProperty(this, "_commodityData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_fxRates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.content.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            const tab = btn?.dataset.tab;
            if (tab === 'commodities' || tab === 'fx' || (tab === 'xau' && SITE_VARIANT === 'commodity')) {
                this._tab = tab;
                this._render();
            }
        });
    }
    renderCommodities(data) {
        this._commodityData = data;
        this._render();
    }
    updateFxRates(rates) {
        this._fxRates = rates;
        this._render();
    }
    _buildTabBar(hasFx, hasXau) {
        const firstTabLabel = 'Commodities';
        const tabs = [
            `<button class="panel-tab${this._tab === 'commodities' ? ' active' : ''}" data-tab="commodities" style="font-size:11px;padding:3px 10px">${firstTabLabel}</button>`,
        ];
        if (hasFx)
            tabs.push(`<button class="panel-tab${this._tab === 'fx' ? ' active' : ''}" data-tab="fx" style="font-size:11px;padding:3px 10px">EUR FX</button>`);
        if (hasXau)
            tabs.push(`<button class="panel-tab${this._tab === 'xau' ? ' active' : ''}" data-tab="xau" style="font-size:11px;padding:3px 10px">XAU/FX</button>`);
        return tabs.length > 1 ? `<div style="display:flex;gap:4px;margin-bottom:8px">${tabs.join('')}</div>` : '';
    }
    _renderXau() {
        const gcf = this._commodityData.find(d => d.symbol === 'GC=F' && d.price !== null);
        if (!gcf?.price)
            return `<div style="padding:8px;color:var(--text-dim);font-size:12px">Gold price unavailable</div>`;
        const goldUsd = gcf.price;
        const fxMap = new Map(this._commodityData.filter(d => d.symbol?.endsWith('=X')).map(d => [d.symbol, d]));
        const rows = XAU_CURRENCY_CONFIG.map(cfg => {
            const fx = fxMap.get(cfg.symbol);
            if (!fx?.price || !Number.isFinite(fx.price))
                return null;
            const xauPrice = cfg.multiply ? goldUsd * fx.price : goldUsd / fx.price;
            if (!Number.isFinite(xauPrice) || xauPrice <= 0)
                return null;
            const formatted = Math.round(xauPrice).toLocaleString();
            return `<div class="commodity-item">
        <div class="commodity-name">${escapeHtml(cfg.flag)} XAU/${escapeHtml(cfg.label)}</div>
        <div class="commodity-price" style="font-size:11px">${escapeHtml(formatted)}</div>
      </div>`;
        }).filter(Boolean);
        if (rows.length === 0) {
            const placeholders = XAU_CURRENCY_CONFIG.map(cfg => `<div class="commodity-item">
          <div class="commodity-name">${escapeHtml(cfg.flag)} XAU/${escapeHtml(cfg.label)}</div>
          <div class="commodity-price" style="font-size:11px">--</div>
        </div>`).join('');
            return `<div class="commodities-grid">${placeholders}</div><div style="margin-top:6px;font-size:9px;color:var(--text-dim)">FX rates unavailable</div>`;
        }
        return `<div class="commodities-grid">${rows.join('')}</div><div style="margin-top:6px;font-size:9px;color:var(--text-dim)">Computed from GC=F + Yahoo FX</div>`;
    }
    _render() {
        const hasFx = this._fxRates.length > 0;
        const hasXau = SITE_VARIANT === 'commodity' && this._commodityData.some(d => d.symbol === 'GC=F' && d.price !== null);
        if (this._tab === 'xau' && !hasXau)
            this._tab = 'commodities';
        const tabBar = this._buildTabBar(hasFx, hasXau);
        if (this._tab === 'fx' && hasFx) {
            const items = this._fxRates.map(r => {
                const change = r.change1d ?? null;
                const changeStr = change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(4)}` : '';
                const changeClass = change === null ? '' : change >= 0 ? 'change-positive' : 'change-negative';
                return `<div class="commodity-item">
          <div class="commodity-name">EUR/${escapeHtml(r.currency)}</div>
          <div class="commodity-price">${escapeHtml(r.rate.toFixed(4))}</div>
          ${changeStr ? `<div class="commodity-change ${escapeHtml(changeClass)}">${escapeHtml(changeStr)}</div>` : ''}
        </div>`;
            }).join('');
            this.setContent(tabBar + `<div class="commodities-grid">${items}</div><div style="margin-top:6px;font-size:9px;color:var(--text-dim)">Source: ECB</div>`);
            return;
        }
        if (this._tab === 'xau' && hasXau) {
            this.setContent(tabBar + this._renderXau());
            return;
        }
        // Metals/Commodities tab — exclude FX and spot gold symbols from the display grid
        const validData = this._commodityData.filter((d) => d.price !== null && !d.symbol?.endsWith('=X'));
        if (validData.length === 0) {
            if (!hasFx) {
                this.showRetrying(t('common.failedCommodities'));
                return;
            }
            this.setContent(tabBar + `<div style="padding:8px;color:var(--text-dim);font-size:12px">${t('common.failedCommodities')}</div>`);
            return;
        }
        const grid = '<div class="commodities-grid">' +
            validData.map(c => `
        <div class="commodity-item">
          <div class="commodity-name">${escapeHtml(c.display)}</div>
          ${miniSparkline(c.sparkline, c.change, 60, 18)}
          <div class="commodity-price">${formatPrice(c.price)}</div>
          <div class="commodity-change ${getChangeClass(c.change)}">${formatChange(c.change)}</div>
        </div>
      `).join('') + '</div>';
        this.setContent(tabBar + grid);
    }
}
export class CryptoPanel extends Panel {
    constructor() {
        super({ id: 'crypto', title: t('panels.crypto'), infoTooltip: t('components.crypto.infoTooltip') });
    }
    renderCrypto(data) {
        if (data.length === 0) {
            this.showRetrying(t('common.failedCryptoData'));
            return;
        }
        const html = data
            .map((coin) => `
      <div class="market-item">
        <div class="market-info">
          <span class="market-name">${escapeHtml(coin.name)}</span>
          <span class="market-symbol">${escapeHtml(coin.symbol)}</span>
        </div>
        <div class="market-data">
          ${miniSparkline(coin.sparkline, coin.change)}
          <span class="market-price">$${coin.price.toLocaleString()}</span>
          <span class="market-change ${getChangeClass(coin.change)}">${formatChange(coin.change)}</span>
        </div>
      </div>
    `)
            .join('');
        this.setContent(html);
    }
}
export class CryptoHeatmapPanel extends Panel {
    constructor() {
        super({ id: 'crypto-heatmap', title: 'Crypto Sectors' });
    }
    renderSectors(data) {
        if (data.length === 0) {
            this.showRetrying(t('common.failedSectorData'));
            return;
        }
        const html = '<div class="heatmap">' +
            data
                .map((sector) => {
                const change = sector.change ?? 0;
                return `
        <div class="heatmap-cell ${getHeatmapClass(change)}">
          <div class="sector-name">${escapeHtml(sector.name)}</div>
          <div class="sector-change ${getChangeClass(change)}">${formatChange(change)}</div>
        </div>
      `;
            })
                .join('') +
            '</div>';
        this.setContent(html);
    }
}
export class TokenListPanel extends Panel {
    renderTokens(data) {
        if (data.length === 0) {
            this.showRetrying(t('common.failedCryptoData'));
            return;
        }
        const rows = data
            .map((tok) => `
      <div class="market-item">
        <div class="market-info">
          <span class="market-name">${escapeHtml(tok.name)}</span>
          <span class="market-symbol">${escapeHtml(tok.symbol)}</span>
        </div>
        <div class="market-data">
          <span class="market-price">$${tok.price.toLocaleString(undefined, { maximumFractionDigits: tok.price < 1 ? 6 : 2 })}</span>
          <span class="market-change ${getChangeClass(tok.change24h)}">${formatChange(tok.change24h)}</span>
          <span class="market-change market-change--7d ${getChangeClass(tok.change7d)}">${formatChange(tok.change7d)}W</span>
        </div>
      </div>
    `)
            .join('');
        this.setContent(rows);
    }
}
export class DefiTokensPanel extends TokenListPanel {
    constructor() {
        super({ id: 'defi-tokens', title: 'DeFi Tokens', infoTooltip: t('components.defiTokens.infoTooltip') });
    }
}
export class AiTokensPanel extends TokenListPanel {
    constructor() {
        super({ id: 'ai-tokens', title: 'AI Tokens', infoTooltip: t('components.aiTokens.infoTooltip') });
    }
}
export class OtherTokensPanel extends TokenListPanel {
    constructor() {
        super({ id: 'other-tokens', title: 'Alt Tokens', infoTooltip: t('components.altTokens.infoTooltip') });
    }
}
