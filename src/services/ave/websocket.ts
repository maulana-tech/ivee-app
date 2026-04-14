import { AVE_API_KEY } from './trading';

const WS_URL = `wss://bot-api.ave.ai/thirdws?ave_access_key=${AVE_API_KEY}`;

export interface OrderUpdate {
  id: string;
  status: 'confirmed' | 'error' | 'auto_cancelled';
  chain: string;
  assetsId: string;
  orderType: 'swap' | 'limit';
  swapType: 'buy' | 'sell' | 'stoploss' | 'takeprofit' | 'trailing';
  errorMessage: string;
  txHash: string;
  autoSellTriggerHash?: string;
}

type OrderCallback = (update: OrderUpdate) => void;

let ws: WebSocket | null = null;
let listeners: OrderCallback[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionId = 0;

export function startOrderWebSocket(): void {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      subscriptionId++;
      ws?.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: ['botswap'],
        id: subscriptionId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.result?.topic === 'botswap' && msg.result?.msg) {
          const update: OrderUpdate = msg.result.msg;
          listeners.forEach(fn => { try { fn(update); } catch {} });
        }
      } catch {}
    };

    ws.onclose = () => {
      ws = null;
      reconnectTimer = setTimeout(() => startOrderWebSocket(), 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    reconnectTimer = setTimeout(() => startOrderWebSocket(), 10000);
  }
}

export function stopOrderWebSocket(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    subscriptionId++;
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'unsubscribe',
      params: ['botswap'],
      id: subscriptionId,
    }));
    ws.close();
    ws = null;
  }
}

export function onOrderUpdate(fn: OrderCallback): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
