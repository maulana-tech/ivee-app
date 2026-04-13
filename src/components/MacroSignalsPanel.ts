import { Panel } from './Panel';
import { toApiUrl } from '@/services/runtime';

interface MacroSignal {
  name: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
  impact: string;
}

interface MacroEvent {
  event: string;
  date: string;
  country: string;
  impact: string;
}

export class MacroSignalsPanel extends Panel {
  private signals: MacroSignal[] = [];
  private events: MacroEvent[] = [];
  private loaded = false;

  constructor() {
    super({ id: 'macro-signals', title: 'Macro Signals' });
    this.element.classList.add('macro-signals-panel');
  }

  protected renderContent(): void {
    if (this.loaded) {
      this.renderPanel();
      return;
    }
    this.showLoading('Loading macro signals...');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [cryptoResp, fearResp, calResp] = await Promise.all([
        fetch(toApiUrl('/api/market/v1/list-crypto-quotes')).then(r => r.json()).catch(() => null),
        fetch(toApiUrl('/api/market/v1/get-fear-greed-index')).then(r => r.json()).catch(() => null),
        fetch(toApiUrl('/api/economic/v1/get-economic-calendar?fromDate=2026-04-13&toDate=2026-05-13')).then(r => r.json()).catch(() => null),
      ]);

      this.signals = [];

      const fearValue = fearResp?.value ?? 50;
      const fearLabel = fearResp?.valueClassification ?? 'Neutral';
      this.signals.push({
        name: 'Fear & Greed',
        value: `${fearValue}`,
        change: fearLabel,
        direction: fearValue >= 60 ? 'up' : fearValue <= 40 ? 'down' : 'flat',
        impact: fearValue >= 75 ? 'Extreme Greed' : fearValue >= 60 ? 'Greed' : fearValue <= 25 ? 'Extreme Fear' : fearValue <= 40 ? 'Fear' : 'Neutral',
      });

      const quotes: any[] = cryptoResp?.quotes || [];
      if (quotes.length > 0) {
        const btc = quotes.find((q: any) => q.symbol === 'BTC');
        const totalMcap = quotes.reduce((s: number, q: any) => s + (q.marketCap || 0), 0);
        const totalVol = quotes.reduce((s: number, q: any) => s + (q.volume || 0), 0);
        const avgChange = quotes.reduce((s: number, q: any) => s + (q.change || 0), 0) / quotes.length;

        this.signals.push({
          name: 'BTC Dominance',
          value: btc?.marketCap && totalMcap ? `${((btc.marketCap / totalMcap) * 100).toFixed(1)}%` : '—',
          change: 'Market Share',
          direction: 'flat',
          impact: 'Neutral',
        });

        this.signals.push({
          name: 'Market Cap',
          value: `$${(totalMcap / 1e12).toFixed(2)}T`,
          change: `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}% avg`,
          direction: avgChange > 0.5 ? 'up' : avgChange < -0.5 ? 'down' : 'flat',
          impact: avgChange > 2 ? 'Bullish' : avgChange < -2 ? 'Bearish' : 'Neutral',
        });

        this.signals.push({
          name: '24h Volume',
          value: `$${(totalVol / 1e9).toFixed(1)}B`,
          change: 'Total',
          direction: 'flat',
          impact: 'Neutral',
        });

        const bullishPct = quotes.filter((q: any) => q.change > 0).length / quotes.length * 100;
        this.signals.push({
          name: 'Breadth',
          value: `${bullishPct.toFixed(0)}% bullish`,
          change: `${quotes.filter((q: any) => q.change > 0).length}/${quotes.length} coins`,
          direction: bullishPct > 60 ? 'up' : bullishPct < 40 ? 'down' : 'flat',
          impact: bullishPct > 70 ? 'Bullish' : bullishPct < 30 ? 'Bearish' : 'Neutral',
        });
      }

      this.signals.push({
        name: 'DXY (Dollar)',
        value: '~104.2',
        change: 'Est.',
        direction: 'flat',
        impact: 'Neutral',
      });

      this.signals.push({
        name: 'US 10Y Yield',
        value: '~4.28%',
        change: 'Est.',
        direction: 'flat',
        impact: 'Neutral',
      });

      const calEvents: any[] = calResp?.events || [];
      this.events = calEvents.slice(0, 5).map((ev: any) => ({
        event: ev.event || '',
        date: ev.date || '',
        country: ev.country || '',
        impact: ev.impact || 'low',
      }));
    } catch {
      this.signals = [
        { name: 'Data unavailable', value: '—', change: '', direction: 'flat', impact: 'Neutral' },
      ];
    }

    this.loaded = true;
    this.renderPanel();
  }

  private renderPanel(): void {
    const dirColors = { up: 'var(--green)', down: 'var(--red)', flat: 'var(--text-muted)' };
    const impactColors: Record<string, string> = {
      Bullish: '#2ecc71', Bearish: '#e74c3c', Neutral: 'var(--text-muted)',
      'Extreme Greed': '#e67e22', Greed: '#f39c12', Fear: '#3498db', 'Extreme Fear': '#2ecc71',
      Opportunity: '#2ecc71', Caution: '#e67e22',
    };
    const flags: Record<string, string> = { US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳' };
    const impactDot: Record<string, string> = { high: '#e74c3c', medium: '#f39c12', low: 'rgba(255,255,255,0.2)' };

    const signalsHtml = this.signals.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600">${s.name}</div>
          <div style="font-size:10px;color:var(--text-muted)">${s.change}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;font-weight:600;font-variant-numeric:tabular-nums">${s.value}</div>
          <div style="font-size:10px;color:${impactColors[s.impact] || 'var(--text-muted)'};font-weight:600">${s.impact}</div>
        </div>
      </div>
    `).join('');

    const eventsHtml = this.events.length > 0 ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">
        <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Upcoming Events</div>
        ${this.events.map(e => `
          <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px">
            <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${impactDot[e.impact] || impactDot.low};flex-shrink:0"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${flags[e.country] || ''} ${e.event}</span>
            <span style="color:var(--text-muted);font-size:10px;white-space:nowrap">${e.date}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    this.setContent(`
      <div style="padding:4px 14px 12px">
        ${signalsHtml}
        ${eventsHtml}
      </div>
    `);
  }
}
