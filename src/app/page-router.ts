import { SITE_VARIANT } from '@/config';

export type PageId = 'watch' | 'trade';

let currentPage: PageId = 'watch';
let watchContainer: HTMLElement | null = null;
let tradeContainer: HTMLElement | null = null;
let onPageChangeFn: ((page: PageId) => void) | null = null;
let pendingToken: string | null = null;

export function initPageRouter(): void {
  if (SITE_VARIANT !== 'crypto') return;

  const hash = window.location.hash.replace('#/', '');
  if (hash.startsWith('trade')) {
    currentPage = 'trade';
    const params = new URLSearchParams(hash.split('?')[1] || '');
    pendingToken = params.get('token');
  }

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#/', '');
    if (h.startsWith('trade')) {
      const params = new URLSearchParams(h.split('?')[1] || '');
      pendingToken = params.get('token');
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

export function navigateTo(page: PageId, token?: string): void {
  if (SITE_VARIANT !== 'crypto') return;
  currentPage = page;
  if (page === 'trade' && token) {
    pendingToken = token;
    window.location.hash = `#/trade?token=${encodeURIComponent(token)}`;
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
  if (SITE_VARIANT !== 'crypto') return;

  document.querySelectorAll('.page-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = (btn as HTMLElement).dataset.page as PageId;
      if (page) navigateTo(page);
    });
  });
  updateTabButtons();
}
