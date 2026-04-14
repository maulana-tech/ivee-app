import { getProxyWallets, type ProxyWallet } from '@/services/ave/trading';

const PROXY_ASSETS_ID = '98ca754913164d7ca9085a163799632e';

const CHAIN_ICONS: Record<string, string> = {
  base: '🔵',
  eth: '⟠',
  bsc: '🟡',
  solana: '🟣',
  arbitrum: '🔷',
  optimism: '🔴',
  polygon: '🟣',
  avalanche: '🔴',
};

const EXPLORERS: Record<string, string> = {
  base: 'https://basescan.org',
  eth: 'https://etherscan.io',
  bsc: 'https://bscscan.com',
  solana: 'https://solscan.io',
};

export class Positions {
  private el: HTMLElement;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'positions';
    parent.appendChild(this.el);
    this.renderLoading();
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 60000);
  }

  private async load(): Promise<void> {
    try {
      const wallets: ProxyWallet[] = await getProxyWallets();
      const wallet = wallets?.find(w => w.assetsId === PROXY_ASSETS_ID);
      if (wallet) {
        this.render(wallet);
      } else {
        this.renderEmpty();
      }
    } catch {
      this.renderError();
    }
  }

  private renderLoading(): void {
    this.el.innerHTML = `
      <div class="pos-empty-state"><span class="pos-pulse"></span> Loading wallet...</div>
      ${this.css()}`;
  }

  private renderEmpty(): void {
    this.el.innerHTML = `
      <div class="pos-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>
        <div>No proxy wallet found</div>
      </div>
      ${this.css()}`;
  }

  private renderError(): void {
    this.el.innerHTML = `
      <div class="pos-empty-state" style="color:#ef4444">
        Failed to load wallet info
        <button class="pos-retry" data-action="refresh">Retry</button>
      </div>
      ${this.css()}`;
    this.el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load());
  }

  private render(wallet: ProxyWallet): void {
    const allChains = wallet.addressList || [];
    const primaryChain = allChains[0];
    const primaryAddr = primaryChain?.address || '';
    const explorerBase = EXPLORERS[primaryChain?.chain || 'base'] || 'https://basescan.org';

    const chainCards = allChains.map(c => {
      const icon = CHAIN_ICONS[c.chain] || '🔗';
      const explorer = EXPLORERS[c.chain] || '';
      const addrLink = explorer ? `<a href="${explorer}/address/${c.address}" target="_blank" class="pos-addr-link">${c.address?.slice(0, 6)}...${c.address?.slice(-4)}</a>` : `<code>${c.address?.slice(0, 6)}...${c.address?.slice(-4)}</code>`;
      return `
        <div class="pos-chain-card">
          <span class="pos-chain-icon">${icon}</span>
          <div class="pos-chain-info">
            <span class="pos-chain-name">${c.chain.toUpperCase()}</span>
            <span class="pos-chain-addr">${addrLink}</span>
          </div>
          <button class="pos-copy-btn" data-addr="${c.address}" title="Copy address">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="pos-header">
        <span class="pos-title">Proxy Wallet</span>
        <div class="pos-header-actions">
          <span class="pos-assets-id">${PROXY_ASSETS_ID.slice(0, 8)}...</span>
          <button class="pos-refresh-btn" data-action="refresh" title="Refresh">↻</button>
        </div>
      </div>
      <div class="pos-primary">
        <div class="pos-primary-label">Primary Address</div>
        <div class="pos-primary-addr">
          <a href="${explorerBase}/address/${primaryAddr}" target="_blank" class="pos-addr-link">${primaryAddr || '—'}</a>
        </div>
        <button class="pos-copy-main" data-addr="${primaryAddr}">Copy</button>
      </div>
      <div class="pos-chains-grid">
        ${chainCards}
      </div>
      <div class="pos-info">
        <div class="pos-info-row">
          <span class="pos-info-label">Wallet ID</span>
          <code class="pos-info-value">${wallet.assetsId}</code>
        </div>
        <div class="pos-info-row">
          <span class="pos-info-label">Status</span>
          <span class="pos-info-value" style="color:#22c55e">${wallet.status || 'Active'}</span>
        </div>
        <div class="pos-info-row">
          <span class="pos-info-label">Chains</span>
          <span class="pos-info-value">${allChains.length} supported</span>
        </div>
      </div>
      <div class="pos-note">Balances are managed by AVE Bot Wallet. Use Order Entry to trade tokens.</div>
      ${this.css()}`;

    this.el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load());
    this.el.querySelectorAll('[data-addr]').forEach(btn => {
      btn.addEventListener('click', () => {
        const addr = (btn as HTMLElement).dataset.addr;
        if (addr) {
          navigator.clipboard.writeText(addr).then(() => {
            const orig = (btn as HTMLElement).textContent;
            (btn as HTMLElement).textContent = 'Copied!';
            setTimeout(() => { (btn as HTMLElement).textContent = orig; }, 1500);
          });
        }
      });
    });
  }

  private css(): string {
    return `<style>
      .positions{font-family:system-ui,monospace;font-size:12px;color:#ccc;display:flex;flex-direction:column;gap:8px}
      .pos-header{display:flex;justify-content:space-between;align-items:center}
      .pos-title{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.05em;font-weight:600}
      .pos-header-actions{display:flex;align-items:center;gap:8px}
      .pos-assets-id{font-size:10px;color:#3b82f6;font-family:monospace}
      .pos-refresh-btn{background:#1a1a1a;border:1px solid #333;color:#888;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;transition:all .15s}
      .pos-refresh-btn:hover{color:#fff;border-color:#555}
      .pos-primary{background:#0a0a0a;padding:10px 12px;border-radius:6px;border:1px solid #1e1e1e;display:flex;align-items:center;gap:8px}
      .pos-primary-label{font-size:9px;color:#555;text-transform:uppercase;min-width:80px}
      .pos-primary-addr{flex:1;overflow:hidden}
      .pos-addr-link{color:#3b82f6;text-decoration:none;font-size:11px;font-family:monospace;word-break:break-all}
      .pos-addr-link:hover{text-decoration:underline}
      .pos-copy-main{background:#1a1a1a;border:1px solid #333;color:#888;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:10px;flex-shrink:0;transition:all .15s}
      .pos-copy-main:hover{color:#fff}
      .pos-chains-grid{display:flex;flex-direction:column;gap:4px}
      .pos-chain-card{display:flex;align-items:center;gap:8px;background:#0a0a0a;padding:8px 10px;border-radius:6px;border:1px solid #181818;transition:border-color .15s}
      .pos-chain-card:hover{border-color:#2a2a2a}
      .pos-chain-icon{font-size:14px}
      .pos-chain-info{flex:1;display:flex;flex-direction:column;gap:2px}
      .pos-chain-name{font-size:10px;color:#888;font-weight:600;letter-spacing:.03em}
      .pos-chain-addr{font-size:11px;color:#3b82f6;font-family:monospace}
      .pos-copy-btn{background:transparent;border:none;color:#555;cursor:pointer;padding:4px;transition:color .15s}
      .pos-copy-btn:hover{color:#fff}
      .pos-info{background:#0a0a0a;padding:8px 12px;border-radius:6px;border:1px solid #181818;display:flex;flex-direction:column;gap:4px}
      .pos-info-row{display:flex;justify-content:space-between;align-items:center}
      .pos-info-label{font-size:10px;color:#555}
      .pos-info-value{font-size:11px;color:#aaa;font-family:monospace}
      .pos-note{font-size:10px;color:#444;padding-top:4px}
      .pos-empty-state{text-align:center;padding:24px;color:#555;display:flex;flex-direction:column;align-items:center;gap:8px}
      .pos-pulse{display:inline-block;width:12px;height:12px;border:2px solid rgba(59,130,246,.3);border-top-color:#3b82f6;border-radius:50%;animation:pos-spin .6s linear infinite}
      @keyframes pos-spin{to{transform:rotate(360deg)}}
      .pos-retry{background:#1a1a1a;border:1px solid #333;color:#888;padding:6px 16px;border-radius:4px;cursor:pointer;margin-top:8px;font-size:11px}
      .pos-retry:hover{color:#fff}
    </style>`;
  }

  destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }
}
