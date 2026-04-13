import { Panel } from '../Panel';

const TOKENS = [
  { symbol: 'BTC', name: 'Bitcoin', id: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', id: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', id: 'solana' },
  { symbol: 'BNB', name: 'BNB', id: 'binancecoin' },
  { symbol: 'XRP', name: 'XRP', id: 'ripple' },
  { symbol: 'DOGE', name: 'Dogecoin', id: 'dogecoin' },
  { symbol: 'ADA', name: 'Cardano', id: 'cardano' },
  { symbol: 'AVAX', name: 'Avalanche', id: 'avalanche-2' },
  { symbol: 'LINK', name: 'Chainlink', id: 'chainlink' },
  { symbol: 'DOT', name: 'Polkadot', id: 'polkadot' },
  { symbol: 'MATIC', name: 'Polygon', id: 'polygon' },
  { symbol: 'LTC', name: 'Litecoin', id: 'litecoin' },
  { symbol: 'UNI', name: 'Uniswap', id: 'uniswap' },
  { symbol: 'NEAR', name: 'NEAR', id: 'near' },
  { symbol: 'APT', name: 'Aptos', id: 'aptos' },
  { symbol: 'ARB', name: 'Arbitrum', id: 'arbitrum' },
  { symbol: 'OP', name: 'Optimism', id: 'optimism' },
  { symbol: 'ATOM', name: 'Cosmos', id: 'cosmos' },
  { symbol: 'FIL', name: 'Filecoin', id: 'filecoin' },
  { symbol: 'XLM', name: 'Stellar', id: 'stellar' },
];

interface PricePoint {
  time: number;
  price: number;
}

interface VolumePoint {
  time: number;
  volume: number;
}

type Interval = '1' | '7' | '30' | '90';

const INTERVAL_LABELS: Record<Interval, string> = {
  '1': '24H', '7': '7D', '30': '30D', '90': '90D',
};

export class TradeChartPanel extends Panel {
  private selectedToken = TOKENS[0];
  private interval: Interval = '1';
  private prices: PricePoint[] = [];
  private volumes: VolumePoint[] = [];
  private hoverIdx = -1;
  private loading = false;

  constructor() {
    super({ id: 'trade-chart', title: 'Trade Chart' });
    this.element.classList.add('trade-chart-panel', 'panel-wide');
  }

  protected renderContent(): void {
    this.renderShell();
    this.loadData();
  }

  private renderShell(): void {
    const html = `
      <div class="tc-header" style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap">
        <select class="tc-token-sel" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer">
          ${TOKENS.map(t => `<option value="${t.symbol}" ${t.symbol === this.selectedToken.symbol ? 'selected' : ''}>${t.symbol}</option>`).join('')}
        </select>
        <div class="tc-price-area" style="display:flex;align-items:baseline;gap:8px">
          <span class="tc-price" style="font-size:20px;font-weight:700;font-variant-numeric:tabular-nums">—</span>
          <span class="tc-change" style="font-size:13px;font-weight:600;font-variant-numeric:tabular-nums"></span>
        </div>
        <div class="tc-stats" style="display:flex;gap:14px;margin-left:auto;font-size:10px;color:var(--text-muted)">
          <span>H: <b class="tc-high" style="color:var(--text)">—</b></span>
          <span>L: <b class="tc-low" style="color:var(--text)">—</b></span>
          <span>Vol: <b class="tc-vol" style="color:var(--text)">—</b></span>
        </div>
        <div class="tc-intervals" style="display:flex;gap:3px">
          ${(Object.entries(INTERVAL_LABELS) as [Interval, string][]).map(([k, label]) =>
            `<button class="tc-int-btn" data-int="${k}" style="padding:3px 8px;font-size:10px;font-weight:600;border-radius:3px;border:none;cursor:pointer;background:${this.interval === k ? 'rgba(255,255,255,0.15)' : 'transparent'};color:${this.interval === k ? 'var(--text)' : 'var(--text-muted)'}">${label}</button>`
          ).join('')}
        </div>
      </div>
      <div class="tc-body" style="position:relative;flex:1;min-height:200px;overflow:hidden">
        <div class="tc-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Loading...</div>
        <svg class="tc-svg" style="width:100%;height:100%;display:block"></svg>
        <div class="tc-tooltip" style="display:none;position:absolute;pointer-events:none;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:6px 10px;font-size:11px;z-index:10;white-space:nowrap"></div>
      </div>
      <div class="tc-footer" style="display:flex;justify-content:space-between;padding:4px 14px;font-size:10px;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.06)">
        <span class="tc-pair">${this.selectedToken.symbol}/USD</span>
        <span class="tc-updated">—</span>
      </div>
    `;
    (this as any).content.innerHTML = html;
    this.bindEvents();
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    try {
      const resp = await fetch(`/api/chart/crypto?symbol=${this.selectedToken.symbol}&days=${this.interval}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      this.prices = data.prices || [];
      this.volumes = data.volumes || [];
    } catch {
      this.prices = [];
      this.volumes = [];
    }
    this.loading = false;
    this.drawChart();
    this.updateStats();
  }

  private updateStats(): void {
    const priceEl = this.element.querySelector('.tc-price') as HTMLElement;
    const changeEl = this.element.querySelector('.tc-change') as HTMLElement;
    const highEl = this.element.querySelector('.tc-high') as HTMLElement;
    const lowEl = this.element.querySelector('.tc-low') as HTMLElement;
    const volEl = this.element.querySelector('.tc-vol') as HTMLElement;
    const updatedEl = this.element.querySelector('.tc-updated') as HTMLElement;

    if (this.prices.length < 2) {
      priceEl.textContent = '—';
      changeEl.textContent = '';
      highEl.textContent = '—';
      lowEl.textContent = '—';
      volEl.textContent = '—';
      updatedEl.textContent = '';
      return;
    }

    const current = this.prices[this.prices.length - 1].price;
    const first = this.prices[0].price;
    const change = ((current - first) / first) * 100;
    const allPrices = this.prices.map(p => p.price);
    const high = Math.max(...allPrices);
    const low = Math.min(...allPrices);
    const totalVol = this.volumes.reduce((s, v) => s + v.volume, 0);
    const color = change >= 0 ? 'var(--green)' : 'var(--red)';

    priceEl.textContent = this.fmtPrice(current);
    priceEl.style.color = color;
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.style.color = color;
    highEl.textContent = this.fmtPrice(high);
    lowEl.textContent = this.fmtPrice(low);
    volEl.textContent = this.fmtVol(totalVol);
    updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  }

  private fmtPrice(p: number): string {
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  }

  private fmtVol(v: number): string {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toFixed(0);
  }

  private drawChart(): void {
    const loadingEl = this.element.querySelector('.tc-loading') as HTMLElement;
    const svgEl = this.element.querySelector('.tc-svg') as SVGSVGElement;
    if (!svgEl) return;

    loadingEl.style.display = this.loading ? 'flex' : 'none';

    if (this.prices.length < 2) {
      svgEl.innerHTML = this.loading ? '' : '<text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)" font-size="13">No chart data</text>';
      return;
    }

    const rect = svgEl.getBoundingClientRect();
    const W = rect.width || 800;
    const H = rect.height || 300;
    const pad = { t: 8, r: 50, b: 24, l: 8 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    const current = this.prices[this.prices.length - 1].price;
    const first = this.prices[0].price;
    const change = ((current - first) / first) * 100;
    const color = change >= 0 ? '#00ff88' : '#ff4455';

    const prices = this.prices.map(p => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const rangeP = maxP - minP || 1;

    const pts = this.prices.map((p, i) => ({
      x: pad.l + (i / (this.prices.length - 1)) * cW,
      y: pad.t + cH - ((p.price - minP) / rangeP) * cH,
    }));

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)},${pad.t + cH} L${pts[0].x.toFixed(1)},${pad.t + cH} Z`;

    const gridLines: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * cH;
      const price = maxP - (i / 4) * rangeP;
      gridLines.push(`<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`);
      gridLines.push(`<text x="${W - pad.r + 4}" y="${y + 3}" fill="rgba(255,255,255,0.3)" font-size="9" font-family="monospace">${this.fmtPrice(price)}</text>`);
    }

    const timeLabels: string[] = [];
    const labelCount = Math.min(6, this.prices.length);
    for (let i = 0; i <= labelCount; i++) {
      const idx = Math.floor((i / labelCount) * (this.prices.length - 1));
      const x = pad.l + (idx / (this.prices.length - 1)) * cW;
      const d = new Date(this.prices[idx].time);
      const label = this.interval === '1' ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()}`;
      timeLabels.push(`<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="9">${label}</text>`);
    }

    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML = `
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      ${gridLines.join('')}
      <path d="${areaD}" fill="url(#cg)"/>
      <path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length - 1].x}" cy="${pts[pts.length - 1].y}" r="3" fill="${color}"/>
      ${timeLabels.join('')}
      <line class="tc-hover-line" x1="0" y1="0" x2="0" y2="${cH}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3" style="display:none"/>
    `;
  }

  private bindEvents(): void {
    const sel = this.element.querySelector('.tc-token-sel') as HTMLSelectElement;
    sel?.addEventListener('change', (e) => {
      const sym = (e.target as HTMLSelectElement).value;
      this.selectedToken = TOKENS.find(t => t.symbol === sym) || TOKENS[0];
      this.element.querySelector('.tc-pair')!.textContent = `${this.selectedToken.symbol}/USD`;
      this.loadData();
    });

    this.element.querySelectorAll('.tc-int-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.interval = ((btn as HTMLElement).dataset.int || '1') as Interval;
        this.element.querySelectorAll('.tc-int-btn').forEach(b => {
          const isActive = (b as HTMLElement).dataset.int === this.interval;
          (b as HTMLElement).style.background = isActive ? 'rgba(255,255,255,0.15)' : 'transparent';
          (b as HTMLElement).style.color = isActive ? 'var(--text)' : 'var(--text-muted)';
        });
        this.loadData();
      });
    });

    const svgEl = this.element.querySelector('.tc-svg') as SVGSVGElement;
    const tooltip = this.element.querySelector('.tc-tooltip') as HTMLElement;
    const hoverLine = this.element.querySelector('.tc-hover-line') as SVGLineElement | null;

    if (svgEl) {
      svgEl.addEventListener('mousemove', (e) => {
        if (this.prices.length < 2) return;
        const rect = svgEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const W = rect.width;
        const pad = { l: 8, r: 50 };
        const cW = W - pad.l - pad.r;
        const ratio = Math.max(0, Math.min(1, (x - pad.l) / cW));
        const idx = Math.round(ratio * (this.prices.length - 1));
        if (idx < 0 || idx >= this.prices.length) return;

        const p = this.prices[idx];
        const first = this.prices[0].price;
        const changeP = ((p.price - first) / first) * 100;
        const color = changeP >= 0 ? 'var(--green)' : 'var(--red)';
        const d = new Date(p.time);
        const timeStr = this.interval === '1'
          ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div style="color:var(--text-muted);margin-bottom:2px">${timeStr}</div>
          <div style="font-weight:600;color:${color}">${this.fmtPrice(p.price)}</div>
          <div style="font-size:10px;color:${color}">${changeP >= 0 ? '+' : ''}${changeP.toFixed(2)}%</div>
        `;

        let tx = x + 12;
        let ty = (e.clientY - rect.top) - 20;
        if (tx + 120 > rect.width) tx = x - 130;
        if (ty < 0) ty = 10;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';

        if (hoverLine) {
          const lineX = pad.l + (idx / (this.prices.length - 1)) * cW;
          hoverLine.setAttribute('x1', String(lineX));
          hoverLine.setAttribute('x2', String(lineX));
          hoverLine.style.display = '';
        }
      });

      svgEl.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        if (hoverLine) hoverLine.style.display = 'none';
      });
    }

    const resizeObs = new ResizeObserver(() => {
      if (this.prices.length >= 2) this.drawChart();
    });
    resizeObs.observe(this.element.querySelector('.tc-body') || this.element);
  }

  public async refresh(): Promise<void> {
    await this.loadData();
  }
}
