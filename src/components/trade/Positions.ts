import { getProxyWallets, type ProxyWallet } from '@/services/ave/trading';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';

export class Positions {
  private el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'positions';
    parent.appendChild(this.el);
    this.render();
    this.load();
  }

  private async load(): Promise<void> {
    try {
      const wallets: ProxyWallet[] = await getProxyWallets();
      const wallet = wallets?.find(w => w.assetsId === PROXY_ASSETS_ID);
      if (wallet) {
        this.render(wallet);
      }
    } catch {}
  }

  private render(wallet?: ProxyWallet): void {
    const baseAddr = wallet?.addressList?.find(a => a.chain === 'base');
    const allChains = wallet?.addressList || [];

    this.el.innerHTML = `
      <div class="pos-header">
        <span class="pos-title">Proxy Wallet</span>
        <button class="pos-refresh" data-action="refresh">↻</button>
      </div>
      <div class="pos-address">
        <span class="pos-chain">Base</span>
        <code class="pos-addr">${baseAddr?.address || 'Loading...'}</code>
        <button class="pos-copy" data-action="copy" data-addr="${baseAddr?.address || ''}">Copy</button>
      </div>
      <div class="pos-chains">
        ${allChains.map(c => `<span class="pos-chain-badge">${c.chain}: ${c.address?.slice(0, 6)}...${c.address?.slice(-4)}</span>`).join('')}
      </div>
      <div class="pos-note">Token balances are managed by AVE Bot Wallet. Use Order Entry to trade.</div>
      <style>
        .positions{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column;gap:8px}
        .pos-header{display:flex;justify-content:space-between;align-items:center}
        .pos-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
        .pos-refresh{background:#1a1a1a;border:1px solid #333;color:#888;padding:4px 10px;border-radius:4px;cursor:pointer}
        .pos-refresh:hover{color:#fff}
        .pos-address{display:flex;align-items:center;gap:8px;background:#0a0a0a;padding:8px 12px;border-radius:6px;border:1px solid #1a1a1a}
        .pos-chain{font-size:11px;color:#3b82f6;font-weight:600;min-width:40px}
        .pos-addr{font-size:11px;color:#aaa;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pos-copy{background:#1a1a1a;border:1px solid #333;color:#888;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px}
        .pos-copy:hover{color:#fff}
        .pos-chains{display:flex;gap:6px;flex-wrap:wrap}
        .pos-chain-badge{font-size:10px;background:#1a1a1a;padding:3px 8px;border-radius:4px;color:#666;border:1px solid #222}
        .pos-note{font-size:10px;color:#555;padding-top:4px}
      </style>
    `;

    this.el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load());
    this.el.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      const addr = (this.el.querySelector('[data-action="copy"]') as HTMLElement)?.dataset.addr;
      if (addr) navigator.clipboard.writeText(addr);
    });
  }
}
