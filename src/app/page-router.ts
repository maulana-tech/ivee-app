import { SITE_VARIANT } from '@/config';

export type PageId = 'watch' | 'trade';

let currentPage: PageId = 'watch';
let watchContainer: HTMLElement | null = null;
let tradeContainer: HTMLElement | null = null;
let onPageChangeFn: ((page: PageId) => void) | null = null;
let pendingToken: string | null = null;
let pendingAddress: string | null = null;
let pendingChain: string | null = null;

export function initPageRouter(): void {
  if (SITE_VARIANT !== 'crypto' && SITE_VARIANT !== 'nba') return;

  const hash = window.location.hash.replace('#/', '');
  if (hash.startsWith('trade')) {
    currentPage = 'trade';
    const params = new URLSearchParams(hash.split('?')[1] || '');
    pendingToken = params.get('token');
    pendingAddress = params.get('address');
    pendingChain = params.get('chain');
  }

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#/', '');
    if (h.startsWith('trade')) {
      const params = new URLSearchParams(h.split('?')[1] || '');
      pendingToken = params.get('token');
      pendingAddress = params.get('address');
      pendingChain = params.get('chain');
      if (currentPage !== 'trade') {
        currentPage = 'trade';
        renderCurrentPage();
      }
    } else if (h.startsWith('watch') || h === '') {
      if (currentPage !== 'watch') {
        currentPage = 'watch';
        renderCurrentPage();
      }
    }
  });
}

export function getCurrentPage(): PageId {
  return currentPage;
}

export function navigateTo(page: PageId, token?: string, address?: string, chain?: string): void {
  if (SITE_VARIANT !== 'crypto' && SITE_VARIANT !== 'nba') return;
  currentPage = page;
  if (page === 'trade' && token) {
    pendingToken = token;
    pendingAddress = address || null;
    pendingChain = chain || null;
    const params = new URLSearchParams();
    params.set('token', token);
    if (address) params.set('address', address);
    if (chain) params.set('chain', chain);
    window.location.hash = `#/trade?${params.toString()}`;
  } else if (page === 'trade') {
    window.location.hash = '#/trade';
  } else {
    window.location.hash = '#/watch';
  }
  renderCurrentPage();
}

export function getPendingToken(): string | null {
  const t = pendingToken;
  pendingToken = null;
  return t;
}

export function getPendingAddress(): string | null {
  const a = pendingAddress;
  pendingAddress = null;
  return a;
}

export function getPendingChain(): string | null {
  const c = pendingChain;
  pendingChain = null;
  return c;
}

export function registerContainers(watch: HTMLElement, trade: HTMLElement): void {
  watchContainer = watch;
  tradeContainer = trade;
  renderCurrentPage();
}

export function onPageChange(fn: (page: PageId) => void): void {
  onPageChangeFn = fn;
}

function renderCurrentPage(): void {
  if (!watchContainer || !tradeContainer) return;

  if (currentPage === 'trade') {
    watchContainer.style.display = 'none';
    tradeContainer.style.display = 'flex';
  } else {
    watchContainer.style.display = '';
    tradeContainer.style.display = 'none';
  }

  onPageChangeFn?.(currentPage);
  updateTabButtons();
}

function updateTabButtons(): void {
  document.querySelectorAll<HTMLElement>('.page-tab').forEach(btn => {
    const target = btn.dataset.page as PageId;
    btn.classList.toggle('active', target === currentPage);
  });
}

export function setupPageTabs(): void {
  if (SITE_VARIANT !== 'crypto' && SITE_VARIANT !== 'nba') return;

  document.querySelectorAll('.page-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = (btn as HTMLElement).dataset.page as PageId;
      if (page) navigateTo(page);
    });
  });
  updateTabButtons();
}
