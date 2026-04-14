import { OrderEntry } from '@/components/trade/OrderEntry';
import { OpenOrders } from '@/components/trade/OpenOrders';
import { TradeHistory } from '@/components/trade/TradeHistory';
import { AiAgent } from '@/components/trade/AiAgent';
import { Positions } from '@/components/trade/Positions';
import { getPendingToken } from '@/app/page-router';
import { getTrendingTokens, type AveToken } from '@/services/ave/client';

type Tab = 'orders' | 'history' | 'agent' | 'positions';

const TOKENS = [
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', chain: 'base' },
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' },
  { symbol: 'AERO', address: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17', chain: 'base' },
  { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', chain: 'base' },
  { symbol: 'cbETH', address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0deC22', chain: 'base' },
  { symbol: 'WEWE', address: '0x8453FC6A7d35F8FcE659E6f80fAb5e0Bb8dA43f1', chain: 'base' },
];

export class TradePage {
  private el: HTMLElement;
  private orderEntry!: OrderEntry;
  private activeTab: Tab = 'orders';
  private initialized = false;
  private selectedToken = 'WETH';
  private tokenPrice = 0;
  private tokenChange = 0;
  private chartInterval = '1';
  private chartPrices: { time: number; price: number }[] = [];

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trade-page';
    container.appendChild(this.el);
  }

  init(): void {
    if (this.initialized) {
      const pendingToken = getPendingToken();
      if (pendingToken) this.orderEntry.setToken(pendingToken);
      return;
    }
    this.initialized = true;
    const pendingToken = getPendingToken();
    if (pendingToken) this.selectedToken = pendingToken;
    this.render();
    this.orderEntry = new OrderEntry(this.el.querySelector('.tp-sidebar')!);
    this.showTab(this.activeTab);
    if (pendingToken) this.orderEntry.setToken(pendingToken);
    this.loadTokenPrice();
    this.loadChartData();
  }

  navigateToken(symbol: string): void {
    this.selectedToken = symbol;
    this.orderEntry?.setToken(symbol);
    this.loadTokenPrice();
  }

  private async loadTokenPrice(): Promise<void> {
    try {
      const tokenInfo = TOKENS.find(t => t.symbol === this.selectedToken);
      if (!tokenInfo) return;
      const { getTokenPrice } = await import('@/services/ave/client');
      const data = await getTokenPrice(`${tokenInfo.address}-${tokenInfo.chain}`);
      if (data) {
        this.tokenPrice = parseFloat(data.current_price_usd || '0');
        this.tokenChange = parseFloat(data.price_change_24h || '0');
        this.updatePriceDisplay();
      }
    } catch {}
  }

  private async loadChartData(): Promise<void> {
    const body = this.el.querySelector('.tp-chart-body') as HTMLElement;
    if (!body) return;

    body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">Loading chart...</span></div>';

    try {
      const resp = await fetch(`/api/chart/crypto?symbol=${this.selectedToken}&days=${this.chartInterval}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      this.chartPrices = data.prices || [];
      if (this.chartPrices.length < 2) {
        body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">No chart data available</span></div>';
        return;
      }
      this.drawChart(body);
    } catch {
      body.innerHTML = '<div class="tp-chart-watermark"><span style="color:#444">Failed to load chart</span></div>';
    }
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
    const pad = { t: 10, r: 55, b: 30, l: 10 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
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
      timeLabels.push(`<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="9">${label}</text>`);
    }

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${gridLines.join('')}
        <path d="${areaD}" fill="url(#tg)"/>
        <path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${pts[pts.length - 1].x.toFixed(1)}" cy="${pts[pts.length - 1].y.toFixed(1)}" r="3" fill="${color}"/>
        ${timeLabels.join('')}
      </svg>`;
  }

  private render(): void {
    const tokenOptions = TOKENS.map(t =>
      `<option value="${t.symbol}" ${this.selectedToken === t.symbol ? 'selected' : ''}>${t.symbol}</option>`
    ).join('');

    this.el.innerHTML = `
      <div class="tp-top">
        <div class="tp-chart-section">
          <div class="tp-chart-header">
            <div class="tp-chart-pair">
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
          <div class="tp-chart-body" id="tradeChartBody">
            <div class="tp-chart-watermark">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
              <span>Trading chart loads when you select a token</span>
            </div>
          </div>
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
        }

        .tp-top { display: flex; flex: 1; min-height: 0; }

        .tp-chart-section {
          flex: 1; display: flex; flex-direction: column; min-width: 0;
          border-right: 1px solid #181818;
        }

        .tp-chart-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px; border-bottom: 1px solid #181818;
          background: #0c0c0c;
        }

        .tp-chart-pair { display: flex; align-items: center; gap: 16px; }

        .tp-token-select {
          background: #111; border: 1px solid #2a2a2a; color: #fff;
          padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 700;
          cursor: pointer;
        }
        .tp-token-select:focus { outline: none; border-color: #3b82f6; }

        .tp-chart-price { display: flex; align-items: baseline; gap: 10px; }
        .tp-price-value { font-size: 20px; font-weight: 700; color: #fff; }
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
          background: #0a0a0a; position: relative;
        }

        .tp-chart-watermark {
          display: flex; flex-direction: column; align-items: center; gap: 12px; color: #333;
          font-size: 13px;
        }

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
      </style>
    `;

    this.el.querySelectorAll('.tp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showTab((btn as HTMLElement).dataset.tab as Tab);
      });
    });

    this.el.querySelector('[data-field="chart-token"]')?.addEventListener('change', (e) => {
      this.selectedToken = (e.target as HTMLSelectElement).value;
      this.orderEntry.setToken(this.selectedToken);
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
      case 'orders': new OpenOrders(content); break;
      case 'history': new TradeHistory(content); break;
      case 'agent': new AiAgent(content); break;
      case 'positions': new Positions(content); break;
    }
  }
}
