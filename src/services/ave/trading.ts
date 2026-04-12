export interface TradeRequest {
  token: string;
  amount: number;
  type: 'buy' | 'sell';
  chain: string;
  slippage: number;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;
}

export interface WalletStatus {
  connected: boolean;
  address?: string;
  chainId?: number;
  balance?: number;
  isAgent?: boolean;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (args: unknown) => void) => void;
  removeListener: (event: string, callback: (args: unknown) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const TRADE_HISTORY_KEY = 'ivee-agent-trades';

export interface AgentTrade {
  id: string;
  token: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
  txHash: string;
  pnl?: number;
  status: 'filled' | 'pending' | 'failed';
}

function getTrades(): AgentTrade[] {
  try {
    return JSON.parse(localStorage.getItem(TRADE_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveTrades(trades: AgentTrade[]): void {
  localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(trades.slice(-50)));
}

export function getTradeHistory(): AgentTrade[] {
  return getTrades();
}

export function getTotalPnL(): number {
  return getTrades().reduce((sum, t) => sum + (t.pnl || 0), 0);
}

export function getWinRate(): number {
  const trades = getTrades().filter(t => t.pnl !== undefined);
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => (t.pnl || 0) > 0).length;
  return Math.round((wins / trades.length) * 100);
}

export async function getWalletStatus(): Promise<WalletStatus> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return { connected: false, isAgent: false };
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
    const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [accounts[0] || '0x0', 'latest'],
    }) as string;
    const balanceWei = parseInt(balanceHex || '0x0', 16);
    const balanceEth = balanceWei / 1e18;

    return {
      connected: accounts.length > 0,
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      balance: balanceEth,
      isAgent: false,
    };
  } catch {
    return { connected: false, isAgent: false };
  }
}

export async function connectWallet(): Promise<WalletStatus> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Web3 wallet detected. Install MetaMask or use Coinbase Wallet.');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];
    const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;

    let parsedChainId = parseInt(chainId, 16);

    if (parsedChainId !== 8453) {
      await switchToBaseNetwork();
      const newChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      parsedChainId = parseInt(newChainId, 16);
    }

    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest'],
    }) as string;
    const balanceWei = parseInt(balanceHex || '0x0', 16);
    const balanceEth = balanceWei / 1e18;

    return {
      connected: true,
      address: accounts[0],
      chainId: parsedChainId,
      balance: balanceEth,
      isAgent: false,
    };
  } catch {
    throw new Error('Wallet connection rejected');
  }
}

export function disconnectWallet(): void {
  // MetaMask doesn't support programmatic disconnect
  // User must disconnect from the wallet extension
}

export async function executeTrade(request: TradeRequest): Promise<TradeResult> {
  const status = await getWalletStatus();

  if (!status.connected || !window.ethereum) {
    return {
      success: false,
      error: 'Wallet not connected',
    };
  }

  if (status.chainId !== 8453) {
    return {
      success: false,
      error: 'Please switch to Base network',
    };
  }

  try {
    // Simulate tx for hackathon demo — real implementation would call DEX contract
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const trades = getTrades();
    trades.push({
      id: `trade-${Date.now()}`,
      token: request.token,
      symbol: request.token.toUpperCase(),
      type: request.type,
      amount: request.amount,
      price: request.type === 'buy' ? 2000 + Math.random() * 500 : 2000 - Math.random() * 200,
      timestamp: Date.now(),
      txHash,
      pnl: request.type === 'buy' ? Math.random() * 500 - 100 : -(Math.random() * 300),
      status: 'filled',
    });
    saveTrades(trades);

    return {
      success: true,
      txHash,
      message: `Trade ${request.type} ${request.amount} ${request.token} on Base`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed',
    };
  }
}

export async function switchToBaseNetwork(): Promise<boolean> {
  if (!window.ethereum) return false;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
        return true;
      } catch { return false; }
    }
    return false;
  }
}

export function onWalletChange(callback: (accounts: string[]) => void): () => void {
  if (!window.ethereum) return () => {};

  const handler = (accounts: unknown) => {
    callback(accounts as string[]);
  };

  window.ethereum.on('accountsChanged', handler);
  window.ethereum.on('chainChanged', () => window.location.reload());

  return () => {
    window.ethereum?.removeListener('accountsChanged', handler);
  };
}