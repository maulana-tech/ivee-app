export interface WalletStatus {
  connected: boolean;
  address?: string;
  chainId?: number;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export async function checkWalletStatus(): Promise<WalletStatus> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return { connected: false };
  }
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_accounts' 
    }) as string[];
    
    if (accounts && accounts.length > 0) {
      return {
        connected: true,
        address: accounts[0],
      };
    }
  } catch {
    // Silently fail
  }
  
  return { connected: false };
}

export async function connectWallet(): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not installed');
  }
  
  const accounts = await window.ethereum.request({ 
    method: 'eth_requestAccounts' 
  }) as string[];
  
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found');
  }
}

export async function executeTrade(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.5
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // This would integrate with AVE Trading API
  // For now, return mock response
  return {
    success: true,
    txHash: '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
  };
}
