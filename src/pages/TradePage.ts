import { OrderEntry } from '@/components/trade/OrderEntry';
import { OpenOrders } from '@/components/trade/OpenOrders';
import { TradeHistory } from '@/components/trade/TradeHistory';
import { AiAgent } from '@/components/trade/AiAgent';
import { Positions } from '@/components/trade/Positions';
import { getPendingToken } from '@/app/page-router';

type Tab = 'orders' | 'history' | 'agent' | 'positions';

export class TradePage {
  private el: HTMLElement;
  private orderEntry!: OrderEntry;
  private activeTab: Tab = 'orders';
  private tabContent: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trade-page';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  init(): void {
    const pendingToken = getPendingToken();
    this.render();
    this.orderEntry = new OrderEntry(this.el.querySelector('.tp-sidebar')!);
    this.showTab(this.activeTab);
    if (pendingToken) this.orderEntry.setToken(pendingToken);
  }

  navigateToken(symbol: string): void {
    if (this.orderEntry) this.orderEntry.setToken(symbol);
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="tp-main">
        <div class="tp-chart-area">
          <div class="tp-chart-placeholder">
            <div class="tp-chart-title">Price Chart</div>
            <div class="tp-chart-note">Select token in Order Entry to view chart</div>
          </div>
        </div>
        <div class="tp-sidebar"></div>
      </div>
      <div class="tp-bottom">
        <div class="tp-tabs">
          <button class="tp-tab ${this.activeTab === 'orders' ? 'active' : ''}" data-tab="orders">Open Orders</button>
          <button class="tp-tab ${this.activeTab === 'history' ? 'active' : ''}" data-tab="history">Trade History</button>
          <button class="tp-tab ${this.activeTab === 'agent' ? 'active' : ''}" data-tab="agent">AI Agent</button>
          <button class="tp-tab ${this.activeTab === 'positions' ? 'active' : ''}" data-tab="positions">Positions</button>
        </div>
        <div class="tp-tab-content"></div>
      </div>
      <style>
        .trade-page{display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;background:#0a0a0a;color:#e5e5e5}
        .tp-main{display:flex;flex:1;min-height:0;overflow:hidden}
        .tp-chart-area{flex:1;display:flex;align-items:center;justify-content:center;background:#0d0d0d;border-right:1px solid #1a1a1a;min-width:0}
        .tp-chart-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;color:#444}
        .tp-chart-title{font-size:16px;font-weight:600}
        .tp-chart-note{font-size:12px}
        .tp-sidebar{width:320px;flex-shrink:0;overflow-y:auto;border-left:1px solid #1a1a1a;background:#0a0a0a}
        .tp-bottom{height:280px;flex-shrink:0;border-top:1px solid #222;display:flex;flex-direction:column;overflow:hidden}
        .tp-tabs{display:flex;border-bottom:1px solid #1a1a1a;flex-shrink:0}
        .tp-tab{padding:10px 20px;background:none;border:none;color:#666;font-size:12px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
        .tp-tab.active{color:#e5e5e5;border-bottom-color:#3b82f6}
        .tp-tab:hover{color:#aaa}
        .tp-tab-content{flex:1;overflow-y:auto;padding:12px}
      </style>
    `;

    this.el.querySelectorAll('.tp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showTab((btn as HTMLElement).dataset.tab as Tab);
      });
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
