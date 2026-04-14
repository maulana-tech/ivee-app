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
  estimateOut?: string;
  priceUSD?: string;
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

const BOT_API = 'https://bot-api.ave.ai';
const AVE_API_KEY = import.meta.env.VITE_AVE_BOT_KEY || '';
const AVE_API_SECRET = import.meta.env.VITE_AVE_BOT_SECRET || '';

const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const BASE_TOKENS: Record<string, string> = {
  ETH: NATIVE_ETH,
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
};

function getTokenAddress(symbol: string): string {
  return BASE_TOKENS[symbol.toUpperCase()] || symbol;
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
}

export async function getQuote(
  tokenAddress: string,
  amount: string,
  swapType: 'buy' | 'sell',
  chain = 'base',
): Promise<{ estimateOut: string; spender: string[]; decimals: number }> {
  const inToken = swapType === 'buy' ? NATIVE_ETH : tokenAddress;
  const outToken = swapType === 'buy' ? tokenAddress : NATIVE_ETH;

  const resp = await fetch(`${BOT_API}/v1/thirdParty/chainWallet/getAmountOut`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AVE-ACCESS-KEY': AVE_API_KEY,
    },
    body: JSON.stringify({
      chain,
      inAmount: amount,
      inTokenAddress: inToken,
      outTokenAddress: outToken,
      swapType,
    }),
  });

  const data = await resp.json();
  if (data.status !== 200 && data.status !== 0) {
    throw new Error(data.msg || 'Quote failed');
  }
  return {
    estimateOut: data.data?.estimateOut || '0',
    spender: data.data?.spender || [],
    decimals: data.data?.decimals || 18,
  };
}

async function approveToken(tokenAddress: string, spender: string): Promise<void> {
  if (!window.ethereum) throw new Error('No wallet');
  const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
  if (!accounts[0]) throw new Error('Wallet not connected');

  const approveData = '0x095ea7b3' +
    spender.toLowerCase().replace('0x', '').padStart(64, '0') +
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: tokenAddress,
      data: approveData,
    }],
  });
}

async function createEvmTx(
  creatorAddress: string,
  tokenAddress: string,
  amountWei: string,
  swapType: 'buy' | 'sell',
  slippageBps: string,
  chain = 'base',
): Promise<{
  txContent: { data: string; to: string; value: string };
  requestTxId: string;
  estimateOut: string;
  createPrice: string;
}> {
  const inToken = swapType === 'buy' ? NATIVE_ETH : tokenAddress;
  const outToken = swapType === 'buy' ? tokenAddress : NATIVE_ETH;

  const resp = await fetch(`${BOT_API}/v1/thirdParty/chainWallet/createEvmTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AVE-ACCESS-KEY': AVE_API_KEY,
    },
    body: JSON.stringify({
      chain,
      creatorAddress,
      inAmount: amountWei,
      inTokenAddress: inToken,
      outTokenAddress: outToken,
      swapType,
      slippage: slippageBps,
      autoSlippage: true,
    }),
  });

  const data = await resp.json();
  if (data.status !== 200 && data.status !== 0) {
    throw new Error(data.msg || 'Create tx failed');
  }
  return {
    txContent: data.data.txContent,
    requestTxId: data.data.requestTxId,
    estimateOut: data.data.estimateOut || '0',
    createPrice: data.data.createPrice || '0',
  };
}

async function signAndSendTx(txContent: { data: string; to: string; value: string }, requestTxId: string, chain = 'base'): Promise<string> {
  if (!window.ethereum) throw new Error('No wallet');
  const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
  if (!accounts[0]) throw new Error('Wallet not connected');

  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: txContent.to,
      data: txContent.data,
      value: txContent.value || '0x0',
    }],
  }) as string;

  try {
    await fetch(`${BOT_API}/v1/thirdParty/chainWallet/sendSignedEvmTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AVE-ACCESS-KEY': AVE_API_KEY,
      },
      body: JSON.stringify({
        chain,
        requestTxId,
        signedTx: '',
        useMev: false,
      }),
    });
  } catch {
    // tx was already sent via eth_sendTransaction, just tracking
  }

  return txHash;
}

export async function executeTrade(request: TradeRequest): Promise<TradeResult> {
  const status = await getWalletStatus();

  if (!status.connected || !window.ethereum) {
    return { success: false, error: 'Wallet not connected' };
  }

  if (status.chainId !== 8453) {
    return { success: false, error: 'Please switch to Base network' };
  }

  const address = status.address!;
  const tokenAddress = getTokenAddress(request.token);
  const amountWei = BigInt(Math.floor(request.amount * 1e18)).toString();
  const slippageBps = String(Math.round((request.slippage || 0.5) * 100));

  try {
    const quote = await getQuote(tokenAddress, amountWei, request.type);

    if (request.type === 'sell' && quote.spender?.length > 0) {
      try {
        await approveToken(tokenAddress, quote.spender[0]);
      } catch {
        // approval may already exist
      }
    }

    const tx = await createEvmTx(address, tokenAddress, amountWei, request.type, slippageBps);

    const txHash = await signAndSendTx(tx.txContent, tx.requestTxId);

    const trades = getTrades();
    trades.push({
      id: `trade-${Date.now()}`,
      token: request.token,
      symbol: request.token.toUpperCase(),
      type: request.type,
      amount: request.amount,
      price: parseFloat(tx.createPrice) || 0,
      timestamp: Date.now(),
      txHash,
      status: 'filled',
    });
    saveTrades(trades);

    return {
      success: true,
      txHash,
      estimateOut: tx.estimateOut,
      priceUSD: tx.createPrice,
      message: `${request.type === 'buy' ? 'Bought' : 'Sold'} ~${(parseFloat(tx.estimateOut) / 1e18).toFixed(6)} ${request.type === 'buy' ? request.token : 'ETH'}`,
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

export async function getAutoSlippage(tokenAddress: string, chain = 'base'): Promise<number> {
  try {
    const resp = await fetch(`${BOT_API}/v1/thirdParty/chainWallet/getAutoSlippage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AVE-ACCESS-KEY': AVE_API_KEY,
      },
      body: JSON.stringify({ chain, tokenAddress, useMev: false }),
    });
    const data = await resp.json();
    if (data.status === 200 || data.status === 0) {
      return parseInt(data.data?.slippage || '500') / 100;
    }
  } catch {}
  return 5;
}

export async function getGasTip(): Promise<{ high: string; average: string; low: string }> {
  try {
    const resp = await fetch(`${BOT_API}/v1/thirdParty/chainWallet/getGasTip`, {
      headers: { 'AVE-ACCESS-KEY': AVE_API_KEY },
    });
    const data = await resp.json();
    const base = (data.data || []).find((g: any) => g.chain === 'base');
    return { high: base?.high || '0', average: base?.average || '0', low: base?.low || '0' };
  } catch {
    return { high: '0', average: '0', low: '0' };
  }
}

// --- HMAC-SHA256 Signing for Proxy Wallet API ---

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: any = {};
  Object.keys(obj).sort().forEach(k => { sorted[k] = sortObjectKeys(obj[k]); });
  return sorted;
}

async function generateSignature(method: string, path: string, body?: any): Promise<{ timestamp: string; sign: string }> {
  const timestamp = new Date().toISOString();
  const msg = timestamp + method.toUpperCase() + path + (body ? JSON.stringify(sortObjectKeys(body)) : '');
  const sign = await hmacSha256(AVE_API_SECRET, msg);
  return { timestamp, sign };
}

async function signedFetch<T>(method: string, path: string, body?: any): Promise<T> {
  const { timestamp, sign } = await generateSignature(method, path, body);
  const resp = await fetch(`${BOT_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'AVE-ACCESS-KEY': AVE_API_KEY,
      'AVE-ACCESS-TIMESTAMP': timestamp,
      'AVE-ACCESS-SIGN': sign,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (data.status !== 200 && data.status !== 0) throw new Error(data.msg || 'API error');
  return data.data;
}

// --- Proxy Wallet (Bot Wallet) API ---

export interface ProxyWallet {
  assetsId: string;
  status: string;
  type: string;
  assetsName: string;
  addressList: { chain: string; address: string }[];
}

export const getProxyWallets = (): Promise<ProxyWallet[]> =>
  signedFetch<ProxyWallet[]>('GET', '/v1/thirdParty/user/getUserByAssetsId');

export const createProxyWallet = (name: string): Promise<{ assetsId: string; addressList: { chain: string; address: string }[] }> =>
  signedFetch('POST', '/v1/thirdParty/user/generateWallet', { assetsName: name, returnMnemonic: false });

export const deleteProxyWallet = (assetsIds: string[]): Promise<{ assetsIds: string[] }> =>
  signedFetch('POST', '/v1/thirdParty/user/deleteWallet', { assetsIds });

export interface MarketOrder {
  id: string;
}

export interface AutoSellConfig {
  priceChange: string;
  sellRatio: string;
  type: 'default' | 'trailing';
}

export const sendMarketOrder = (params: {
  chain: string;
  assetsId: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: 'buy' | 'sell';
  slippage: string;
  useMev: boolean;
  gas?: string;
  extraGas?: string;
  autoSlippage?: boolean;
  autoGas?: string;
  autoSellConfig?: AutoSellConfig[];
}): Promise<MarketOrder> =>
  signedFetch('POST', '/v1/thirdParty/tx/sendSwapOrder', params);

export const sendLimitOrder = (params: {
  chain: string;
  assetsId: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: 'buy' | 'sell';
  slippage: string;
  useMev: boolean;
  limitPrice: string;
  gas?: string;
  extraGas?: string;
  expireTime?: string;
  autoSlippage?: boolean;
  autoGas?: string;
}): Promise<MarketOrder> =>
  signedFetch('POST', '/v1/thirdParty/tx/sendLimitOrder', params);

export const cancelLimitOrder = (chain: string, ids: string[]): Promise<string[]> =>
  signedFetch('POST', '/v1/thirdParty/tx/cancelLimitOrder', { chain, ids });

export interface SwapOrderRecord {
  id: string;
  status: string;
  chain: string;
  swapType: string;
  txPriceUsd: string;
  txHash: string;
  inAmount: string;
  outAmount: string;
  errorMessage: string;
}

export const getSwapOrder = (chain: string, ids: string[]): Promise<SwapOrderRecord[]> =>
  signedFetch('GET', `/v1/thirdParty/tx/getSwapOrder?chain=${chain}&ids=${ids.join(',')}`);

export interface LimitOrderRecord {
  id: string;
  status: string;
  chain: string;
  swapType: string;
  inTokenAddress: string;
  outTokenAddress: string;
  txPriceUsd: string;
  txHash: string;
  errorMessage: string;
  limitPrice: string;
  createPrice: string;
  expireAt: string;
  inAmount: string;
  outAmount: string;
  trailingPriceChange: string;
  autoSellTriggerHash: string;
}

export const getLimitOrders = (params: {
  chain: string;
  assetsId: string;
  status?: string;
  token?: string;
  pageSize?: number;
  pageNo?: number;
}): Promise<LimitOrderRecord[]> => {
  const q = new URLSearchParams();
  q.set('chain', params.chain);
  q.set('assetsId', params.assetsId);
  if (params.status) q.set('status', params.status);
  if (params.token) q.set('token', params.token);
  q.set('pageSize', String(params.pageSize || 20));
  q.set('pageNo', String(params.pageNo ?? 0));
  return signedFetch('GET', `/v1/thirdParty/tx/getLimitOrder?${q.toString()}`);
};

export const approveTokenForProxy = (params: {
  chain: string;
  assetsId: string;
  tokenAddress: string;
}): Promise<{ id: string; spender: string; amm: string }> =>
  signedFetch('POST', '/v1/thirdParty/tx/approve', params);

export const transferToken = (params: {
  chain: string;
  assetsId: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  amount: string;
  gas?: string;
  extraGas?: string;
}): Promise<{ id: string }> =>
  signedFetch('POST', '/v1/thirdParty/tx/transfer', params);

export const getTransferStatus = (chain: string, ids: string[]): Promise<any[]> =>
  signedFetch('GET', `/v1/thirdParty/tx/getTransfer?chain=${chain}&ids=${ids.join(',')}`);
