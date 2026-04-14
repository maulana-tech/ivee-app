import { OrderEntry } from '@/components/trade/OrderEntry';
import { OpenOrders } from '@/components/trade/OpenOrders';
import { TradeHistory } from '@/components/trade/TradeHistory';
import { AiAgent } from '@/components/trade/AiAgent';
import { Positions } from '@/components/trade/Positions';
import { getPendingToken, getPendingAddress, getPendingChain } from '@/app/page-router';
import { startOrderWebSocket, stopOrderWebSocket, onOrderUpdate, type OrderUpdate } from '@/services/ave/websocket';

type Tab = 'orders' | 'history' | 'agent' | 'positions';

interface TokenInfo {
  symbol: string;
  address: string;
  chain: string;
}

const CHAINS = [
  { id: 'base', name: 'Base', chainId: 8453, explorer: 'https://basescan.org' },
  { id: 'eth', name: 'Ethereum', chainId: 1, explorer: 'https://etherscan.io' },
  { id: 'bsc', name: 'BSC', chainId: 56, explorer: 'https://bscscan.com' },
  { id: 'solana', name: 'Solana', chainId: 0, explorer: 'https://solscan.io' },
];

const DEFAULT_TOKENS: Record<string, TokenInfo[]> = {
  base: [
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', chain: 'base' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' },
    { symbol: 'AERO', address: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', chain: 'base' },
    { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', chain: 'base' },
    { symbol: 'cbETH', address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', chain: 'base' },
    { symbol: 'WEWE', address: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', chain: 'base' },
  ],
  eth: [
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chain: 'eth' },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'eth' },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chain: 'eth' },
    { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chain: 'eth' },
    { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', chain: 'eth' },
  ],
  bsc: [
    { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', chain: 'bsc' },
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', chain: 'bsc' },
    { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', chain: 'bsc' },
  ],
  solana: [
    { symbol: 'SOL', address: 'So11111111111111111111111111111111111111112', chain: 'solana' },
    { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', chain: 'solana' },
  ],
};

function getTokensForChain(chain: string): TokenInfo[] {
  return DEFAULT_TOKENS[chain] || DEFAULT_TOKENS['base'];
}

export class TradePage {
  private el: HTMLElement;
  private orderEntry!: OrderEntry;
  private activeTab: Tab = 'orders';
  private initialized = false;
  private selectedToken = 'WETH';
  private selectedChain = 'base';
  private tokenPrice = 0;
  private tokenChange = 0;
  private chartInterval = '1';
  private chartPrices: { time: number; price: number }[] = [];
  private chartVolumes: { time: number; volume: number }[] = [];
  private tokens: TokenInfo[] = getTokensForChain('base');
  private wsUnsubscribe: (() => void) | null = null;
  private wsToastTimeout: ReturnType<typeof setTimeout> | null = null;
  private crosshairHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;
  private priceRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trade-page';
    container.appendChild(this.el);
  }

  init(): void {
    const pendingToken = getPendingToken();
    const pendingAddress = getPendingAddress();
    const pendingChain = getPendingChain();

    if (pendingChain && CHAINS.find(c => c.id === pendingChain)) {
      this.selectedChain = pendingChain;
      this.tokens = getTokensForChain(pendingChain);
    }

    if (pendingToken) {
      this.selectedToken = pendingToken;
      if (pendingAddress && !this.tokens.find(t => t.symbol === pendingToken)) {
        this.tokens.unshift({ symbol: pendingToken, address: pendingAddress, chain: this.selectedChain });
      }
    }

    if (this.initialized) {
      if (pendingToken) {
        this.orderEntry.setToken(pendingToken, pendingAddress);
        this.updateTokenSelector();
        this.loadTokenPrice();
        this.loadChartData();
      }
      return;
    }
    this.initialized = true;
    this.render();
    this.orderEntry = new OrderEntry(this.el.querySelector('.tp-sidebar')!, this.selectedChain);
    this.showTab(this.activeTab);
    if (pendingToken) this.orderEntry.setToken(pendingToken, pendingAddress);
    this.loadTokenPrice();
    this.loadChartData();
    this.initWebSocket();
    this.startPriceRefresh();
  }

  private startPriceRefresh(): void {
    this.priceRefreshTimer = setInterval(() => this.loadTokenPrice(), 30000);
  }

  private initWebSocket(): void {
    startOrderWebSocket();
    this.wsUnsubscribe = onOrderUpdate((update: OrderUpdate) => {
      this.showWsToast(update);
      if (this.activeTab === 'orders') {
        const content = this.el.querySelector('.tp-tab-content') as HTMLElement;
        if (content) {
          content.innerHTML = '';
          new OpenOrders(content, this.selectedChain);
        }
      }
    });
  }

  private showWsToast(update: OrderUpdate): void {
    let toast = this.el.querySelector('.tp-ws-toast') as HTMLElement;
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'tp-ws-toast';
      this.el.appendChild(toast);
    }

    const statusColor = update.status === 'confirmed' ? '#22c55e' : update.status === 'error' ? '#ef4444' : '#f59e0b';
    const statusText = update.status === 'confirmed' ? 'Confirmed' : update.status === 'error' ? 'Failed' : 'Cancelled';
    toast.innerHTML = `<span style="color:${statusColor};font-weight:700">${statusText}</span> order ${update.id?.slice(0, 8) || ''}...`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    if (this.wsToastTimeout) clearTimeout(this.wsToastTimeout);
    this.wsToastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 4000);
  }

  navigateToken(symbol: string, address?: string): void {
    this.selectedToken = symbol;
    if (address && !this.tokens.find(t => t.symbol === symbol)) {
      this.tokens.unshift({ symbol, address, chain: this.selectedChain });
      this.updateTokenSelector();
    }
    this.orderEntry?.setToken(symbol, address);
    this.loadTokenPrice();
  }

  private updateTokenSelector(): void {
    const sel = this.el.querySelector('[data-field="chart-token"]') as HTMLSelectElement;
    if (!sel) return;
    sel.innerHTML = this.tokens.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');
  }

  private async loadTokenPrice(): Promise<void> {
    try {
      const tokenInfo = this.tokens.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) return;
      const { getTokenPrice } = await import('@/services/ave/client');
      const id = tokenInfo.address.includes('-') ? tokenInfo.address : `${tokenInfo.address}-${tokenInfo.chain}`;
      const data = await getTokenPrice(id);
      if (data) {
        const newPrice = parseFloat(data.current_price_usd || '0');
        const oldPrice = this.tokenPrice;
        this.tokenPrice = newPrice;
        this.tokenChange = parseFloat(data.price_change_24h || '0');
        this.updatePriceDisplay();
        if (oldPrice > 0 && newPrice !== oldPrice) {
          this.flashPrice(newPrice > oldPrice);
        }
      }
    } catch {}
  }

  private flashPrice(up: boolean): void {
    const el = this.el.querySelector('.tp-price-value') as HTMLElement;
    if (!el) return;
    el.style.transition = 'color .15s';
    el.style.color = up ? '#22c55e' : '#ef4444';
    setTimeout(() => { el.style.color = '#fff'; }, 800);
  }

  private updatePriceDisplay(): void {
    const priceEl = this.el.querySelector('.tp-price-value');
    const changeEl = this.el.querySelector('.tp-price-change') as HTMLElement | null;
    if (priceEl) {
      priceEl.textContent = this.tokenPrice >= 1
        ? `$${this.tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `$${this.tokenPrice.toFixed(6)}`;
    }
    if (changeEl) {
      const sign = this.tokenChange >= 0 ? '+' : '';
      const color = this.tokenChange >= 0 ? '#22c55e' : '#ef4444';
      changeEl.textContent = `${sign}${this.tokenChange.toFixed(2)}%`;
      changeEl.style.color = color;
    }
  }

  private async loadChartData(): Promise<void> {
    const body = this.el.querySelector('.tp-chart-body') as HTMLElement;
    if (!body) return;

    this.cleanupChartListeners();
    body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">Loading chart...</span></div>';

    try {
      const resp = await fetch(`/api/chart/crypto?symbol=${this.selectedToken}&days=${this.chartInterval}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      this.chartPrices = data.prices || [];
      this.chartVolumes = data.volumes || [];
      if (this.chartPrices.length < 2) {
        body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">No chart data available</span></div>';
        return;
      }
      this.drawChart(body);
      this.attachChartInteraction(body);
    } catch {
      body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">Failed to load chart</span></div>';
    }
  }

  private cleanupChartListeners(): void {
    if (this.crosshairHandler) {
      const svg = this.el.querySelector('.tp-chart-svg');
      if (svg) {
        svg.removeEventListener('mousemove', this.crosshairHandler);
      }
      this.crosshairHandler = null;
    }
    if (this.mouseLeaveHandler) {
      const svg = this.el.querySelector('.tp-chart-svg');
      if (svg) {
        svg.removeEventListener('mouseleave', this.mouseLeaveHandler);
      }
      this.mouseLeaveHandler = null;
    }
  }

  private attachChartInteraction(body: HTMLElement): void {
    const svg = body.querySelector('.tp-chart-svg') as SVGSVGElement | null;
    const tooltip = body.querySelector('.tp-chart-tooltip') as HTMLElement | null;
    const crossV = body.querySelector('.tp-cross-v') as HTMLElement | null;
    const crossH = body.querySelector('.tp-cross-h') as HTMLElement | null;
    const dot = body.querySelector('.tp-cross-dot') as HTMLElement | null;
    if (!svg || !tooltip) return;

    const prices = this.chartPrices;
    const vals = prices.map(p => p.price);
    const minP = Math.min(...vals);
    const maxP = Math.max(...vals);
    const rangeP = maxP - minP || 1;
    const len = Math.max(prices.length, 2);

    const pad = { t: 10, r: 55, b: 50, l: 10 };
    const cW = 800 - pad.l - pad.r;
    const cH = 340 - pad.t - pad.b;

    const priceToY = (price: number) => pad.t + cH - ((price - minP) / rangeP) * cH;
    const idxToX = (i: number) => pad.l + (i / (len - 1)) * cW;

    this.crosshairHandler = (e: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 400 / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      if (mx < pad.l || mx > 800 - pad.r || my < pad.t || my > 340 + pad.t) {
        tooltip.style.display = 'none';
        if (crossV) crossV.setAttribute('visibility', 'hidden');
        if (crossH) crossH.setAttribute('visibility', 'hidden');
        if (dot) dot.setAttribute('visibility', 'hidden');
        return;
      }

      const ratio = (mx - pad.l) / cW;
      const idx = Math.round(ratio * (len - 1));
      const clampedIdx = Math.max(0, Math.min(idx, prices.length - 1));
      const pt = prices[clampedIdx];
      if (!pt) return;

      const px = idxToX(clampedIdx);
      const py = priceToY(pt.price);

      if (crossV) { crossV.setAttribute('x1', String(px)); crossV.setAttribute('x2', String(px)); crossV.setAttribute('visibility', 'visible'); }
      if (crossH) { crossH.setAttribute('y1', String(py)); crossH.setAttribute('y2', String(py)); crossH.setAttribute('visibility', 'visible'); }
      if (dot) { dot.setAttribute('cx', String(px)); dot.setAttribute('cy', String(py)); dot.setAttribute('visibility', 'visible'); }

      const d = new Date(pt.time);
      const dateStr = this.chartInterval === '1'
        ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
      const priceStr = pt.price >= 1 ? pt.price.toFixed(2) : pt.price.toFixed(6);
      const changeFromFirst = ((pt.price - vals[0]) / vals[0] * 100);
      const changeColor = changeFromFirst >= 0 ? '#22c55e' : '#ef4444';

      tooltip.style.display = 'block';
      tooltip.innerHTML = `<div class="tp-tt-date">${dateStr}</div><div class="tp-tt-price">$${priceStr}</div><div class="tp-tt-change" style="color:${changeColor}">${changeFromFirst >= 0 ? '+' : ''}${changeFromFirst.toFixed(2)}%</div>`;

      const ttW = 140;
      const leftPx = (px / 800) * rect.width;
      const topPx = (py / 400) * rect.height;
      tooltip.style.left = (leftPx + 12 > rect.width - ttW ? leftPx - ttW - 12 : leftPx + 12) + 'px';
      tooltip.style.top = Math.max(0, topPx - 40) + 'px';
    };

    this.mouseLeaveHandler = () => {
      tooltip.style.display = 'none';
      if (crossV) crossV.setAttribute('visibility', 'hidden');
      if (crossH) crossH.setAttribute('visibility', 'hidden');
      if (dot) dot.setAttribute('visibility', 'hidden');
    };

    svg.addEventListener('mousemove', this.crosshairHandler);
    svg.addEventListener('mouseleave', this.mouseLeaveHandler);
  }

  private drawChart(container: HTMLElement): void {
    const prices = this.chartPrices;
    const vals = prices.map(p => p.price);
    const minP = Math.min(...vals);
    const maxP = Math.max(...vals);
    const rangeP = maxP - minP || 1;
    const current = vals[vals.length - 1];
    const first = vals[0];
    const change = ((current - first) / first) * 100;
    const color = change >= 0 ? '#22c55e' : '#ef4444';

    const W = 800, H = 400;
    const chartH = 340;
    const volH = 50;
    const pad = { t: 10, r: 55, b: 0, l: 10 };
    const cW = W - pad.l - pad.r;
    const cH = chartH - pad.t;
    const len = Math.max(prices.length, 2);

    const pts = prices.map((p, i) => ({
      x: pad.l + (i / (len - 1)) * cW,
      y: pad.t + cH - ((p.price - minP) / rangeP) * cH,
    }));

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)},${pad.t + cH} L${pts[0].x.toFixed(1)},${pad.t + cH} Z`;

    const gridLines: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * cH;
      const price = maxP - (i / 4) * rangeP;
      const label = price >= 1000 ? price.toFixed(0) : price >= 1 ? price.toFixed(2) : price.toFixed(6);
      gridLines.push(`<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`);
      gridLines.push(`<text x="${W - pad.r + 4}" y="${y + 3}" fill="rgba(255,255,255,0.3)" font-size="9" font-family="monospace">${label}</text>`);
    }

    const timeLabels: string[] = [];
    const labelCount = Math.min(6, prices.length);
    for (let i = 0; i <= labelCount; i++) {
      const idx = Math.floor((i / labelCount) * (len - 1));
      const x = pad.l + (idx / (len - 1)) * cW;
      const d = new Date(prices[Math.min(idx, prices.length - 1)].time);
      const label = this.chartInterval === '1' ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()}`;
      timeLabels.push(`<text x="${x.toFixed(1)}" y="${chartH + volH + 14}" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="9">${label}</text>`);
    }

    let volBars = '';
    if (this.chartVolumes.length > 0) {
      const maxVol = Math.max(...this.chartVolumes.map(v => v.volume), 1);
      const step = Math.max(1, Math.floor(this.chartVolumes.length / 80));
      for (let i = 0; i < this.chartVolumes.length; i += step) {
        const v = this.chartVolumes[i];
        const x = pad.l + (i / (len - 1)) * cW;
        const barH = (v.volume / maxVol) * volH;
        const yBase = chartH + volH;
        const priceChange = i > 0 && prices[i] ? prices[i].price >= (prices[i - 1]?.price || 0) : true;
        const barColor = priceChange ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
        volBars += `<rect x="${x - 1}" y="${yBase - barH}" width="3" height="${barH}" fill="${barColor}" rx="0.5"/>`;
      }
    }

    container.innerHTML = `
      <svg class="tp-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${gridLines.join('')}
        <line x1="${pad.l}" y1="${chartH}" x2="${W - pad.r}" y2="${chartH}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
        ${volBars}
        <path d="${areaD}" fill="url(#tg)"/>
        <path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${pts[pts.length - 1].x.toFixed(1)}" cy="${pts[pts.length - 1].y.toFixed(1)}" r="3" fill="${color}"/>
        ${timeLabels.join('')}
        <line class="tp-cross-v" x1="0" y1="${pad.t}" x2="0" y2="${chartH}" stroke="rgba(255,255,255,0.15)" stroke-width="0.5" stroke-dasharray="3,3" visibility="hidden"/>
        <line class="tp-cross-h" x1="${pad.l}" y1="0" x2="${W - pad.r}" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="0.5" stroke-dasharray="3,3" visibility="hidden"/>
        <circle class="tp-cross-dot" cx="0" cy="0" r="4" fill="${color}" stroke="#fff" stroke-width="1.5" visibility="hidden"/>
      </svg>
      <div class="tp-chart-tooltip" style="display:none"></div>`;
  }

  private render(): void {
    const tokenOptions = this.tokens.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');

    const chainOptions = CHAINS.map(c =>
      `<option value="${c.id}" ${this.selectedChain === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    this.el.innerHTML = `
      <div class="tp-top">
        <div class="tp-chart-section">
          <div class="tp-chart-header">
            <div class="tp-chart-pair">
              <select class="tp-chain-select" data-field="chain">${chainOptions}</select>
              <select class="tp-token-select" data-field="chart-token">${tokenOptions}</select>
              <div class="tp-chart-price">
                <span class="tp-price-value">--</span>
                <span class="tp-price-change">--</span>
              </div>
            </div>
            <div class="tp-chart-intervals">
              <button class="tp-interval active" data-interval="24h">24H</button>
              <button class="tp-interval" data-interval="7d">7D</button>
              <button class="tp-interval" data-interval="30d">30D</button>
              <button class="tp-interval" data-interval="90d">90D</button>
            </div>
          </div>
          <div class="tp-chart-body" id="tradeChartBody"></div>
        </div>
        <div class="tp-sidebar"></div>
      </div>
      <div class="tp-divider" id="tpDivider"></div>
      <div class="tp-bottom">
        <div class="tp-tabs">
          <button class="tp-tab ${this.activeTab === 'orders' ? 'active' : ''}" data-tab="orders">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            Open Orders
          </button>
          <button class="tp-tab ${this.activeTab === 'history' ? 'active' : ''}" data-tab="history">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Trade History
          </button>
          <button class="tp-tab ${this.activeTab === 'agent' ? 'active' : ''}" data-tab="agent">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a6 6 0 0 0-6 6v1h20v-1a6 6 0 0 0-6-6z"/></svg>
            AI Agent
          </button>
          <button class="tp-tab ${this.activeTab === 'positions' ? 'active' : ''}" data-tab="positions">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>
            Positions
          </button>
        </div>
        <div class="tp-tab-content"></div>
      </div>
      <style>
        .trade-page {
          display: flex; flex-direction: column; height: 100%; width: 100%;
          overflow: hidden; background: #080808; color: #e5e5e5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          position: relative;
        }

        .tp-top { display: flex; flex: 1; min-height: 0; }

        .tp-chart-section {
          flex: 1; display: flex; flex-direction: column; min-width: 0;
          border-right: 1px solid #181818;
        }

        .tp-chart-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px; border-bottom: 1px solid #181818;
          background: #0c0c0c; flex-shrink: 0;
        }

        .tp-chart-pair { display: flex; align-items: center; gap: 12px; }

        .tp-chain-select {
          background: #111; border: 1px solid #2a2a2a; color: #aaa;
          padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
          cursor: pointer;
        }
        .tp-chain-select:focus { outline: none; border-color: #3b82f6; }

        .tp-token-select {
          background: #111; border: 1px solid #2a2a2a; color: #fff;
          padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 700;
          cursor: pointer;
        }
        .tp-token-select:focus { outline: none; border-color: #3b82f6; }

        .tp-chart-price { display: flex; align-items: baseline; gap: 10px; }
        .tp-price-value { font-size: 20px; font-weight: 700; color: #fff; transition: color .15s; }
        .tp-price-change { font-size: 13px; font-weight: 600; }

        .tp-chart-intervals { display: flex; gap: 2px; }
        .tp-interval {
          background: transparent; border: 1px solid transparent; color: #555;
          padding: 4px 12px; border-radius: 4px; cursor: pointer;
          font-size: 11px; font-weight: 600; transition: all .15s;
        }
        .tp-interval.active { background: #1a1a1a; color: #aaa; border-color: #333; }
        .tp-interval:hover { color: #ccc; }

        .tp-chart-body {
          flex: 1; display: flex; align-items: center; justify-content: center;
          background: #0a0a0a; position: relative; overflow: hidden;
        }

        .tp-chart-watermark {
          display: flex; flex-direction: column; align-items: center; gap: 12px; color: #333;
          font-size: 13px;
        }

        .tp-chart-tooltip {
          position: absolute; background: #1a1a1a; border: 1px solid #333;
          border-radius: 6px; padding: 8px 12px; pointer-events: none; z-index: 10;
          font-size: 11px; min-width: 120px; box-shadow: 0 4px 12px rgba(0,0,0,.4);
        }
        .tp-tt-date { color: #888; margin-bottom: 4px; }
        .tp-tt-price { color: #fff; font-weight: 700; font-size: 13px; }
        .tp-tt-change { font-weight: 600; margin-top: 2px; }

        .tp-sidebar {
          width: 340px; flex-shrink: 0; overflow-y: auto;
          background: #0c0c0c;
        }

        .tp-divider {
          height: 4px; background: #181818; cursor: row-resize;
          transition: background .15s; flex-shrink: 0;
        }
        .tp-divider:hover { background: #3b82f6; }

        .tp-bottom {
          height: 300px; flex-shrink: 0;
          border-top: none; display: flex; flex-direction: column;
          overflow: hidden; background: #0a0a0a;
        }

        .tp-tabs {
          display: flex; border-bottom: 1px solid #181818;
          flex-shrink: 0; background: #0c0c0c; padding: 0 8px;
        }
        .tp-tab {
          padding: 10px 16px; background: none; border: none;
          color: #555; font-size: 12px; font-weight: 600;
          cursor: pointer; border-bottom: 2px solid transparent;
          transition: all .15s; display: flex; align-items: center; gap: 6px;
        }
        .tp-tab.active { color: #e5e5e5; border-bottom-color: #3b82f6; }
        .tp-tab:not(.active):hover { color: #999; }

        .tp-tab-content {
          flex: 1; overflow-y: auto; padding: 12px;
        }

        .tp-tab-content::-webkit-scrollbar { width: 6px; }
        .tp-tab-content::-webkit-scrollbar-track { background: transparent; }
        .tp-tab-content::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .tp-sidebar::-webkit-scrollbar { width: 6px; }
        .tp-sidebar::-webkit-scrollbar-track { background: transparent; }
        .tp-sidebar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

        .tp-ws-toast {
          position: absolute; bottom: 12px; right: 12px;
          background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;
          padding: 10px 16px; font-size: 12px; color: #ccc; z-index: 100;
          transition: opacity .3s, transform .3s;
          font-family: monospace;
        }
      </style>
    `;

    this.el.querySelectorAll('.tp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showTab((btn as HTMLElement).dataset.tab as Tab);
      });
    });

    this.el.querySelector('[data-field="chart-token"]')?.addEventListener('change', (e) => {
      this.selectedToken = (e.target as HTMLSelectElement).value;
      const tokenInfo = this.tokens.find(t => t.symbol === this.selectedToken);
      this.orderEntry.setToken(this.selectedToken, tokenInfo?.address);
      this.loadTokenPrice();
      this.loadChartData();
    });

    this.el.querySelector('[data-field="chain"]')?.addEventListener('change', (e) => {
      this.selectedChain = (e.target as HTMLSelectElement).value;
      this.tokens = getTokensForChain(this.selectedChain);
      this.selectedToken = this.tokens[0]?.symbol || 'WETH';
      this.updateTokenSelector();
      this.orderEntry.setToken(this.selectedToken, this.tokens[0]?.address);
      this.loadTokenPrice();
      this.loadChartData();
    });

    const intervalDays: Record<string, string> = { '24h': '1', '7d': '7', '30d': '30', '90d': '90' };
    this.el.querySelectorAll('.tp-interval').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.tp-interval').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const int = (btn as HTMLElement).dataset.interval || '24h';
        this.chartInterval = intervalDays[int] || '1';
        this.loadChartData();
      });
    });

    this.setupDividerResize();
  }

  private setupDividerResize(): void {
    const divider = this.el.querySelector('#tpDivider') as HTMLElement;
    const bottom = this.el.querySelector('.tp-bottom') as HTMLElement;
    if (!divider || !bottom) return;

    let startY = 0;
    let startH = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newH = Math.max(150, Math.min(window.innerHeight - 200, startH + delta));
      bottom.style.height = newH + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    divider.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startH = bottom.offsetHeight;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }

  private showTab(tab: Tab): void {
    this.activeTab = tab;
    this.el.querySelectorAll('.tp-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab);
    });

    const content = this.el.querySelector('.tp-tab-content') as HTMLElement;
    if (!content) return;
    content.innerHTML = '';

    switch (tab) {
      case 'orders': new OpenOrders(content, this.selectedChain); break;
      case 'history': new TradeHistory(content); break;
      case 'agent': new AiAgent(content); break;
      case 'positions': new Positions(content); break;
    }
  }

  destroy(): void {
    this.cleanupChartListeners();
    this.wsUnsubscribe?.();
    stopOrderWebSocket();
    if (this.priceRefreshTimer) clearInterval(this.priceRefreshTimer);
  }
}
