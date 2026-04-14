export const config = { runtime: 'edge' };

const TELEGRAM_BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const AVE_API_KEY = process.env.AVE_API_KEY || '';
const AVE_API_SECRET = process.env.AVE_API_SECRET || '';
const PROXY_ASSETS_ID = process.env.PROXY_ASSETS_ID || '98ca754913164d7ca9085a163799632e';
const BOT_API = 'https://bot-api.ave.ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function escapeMd(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

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

async function signedFetch<T>(method: string, path: string, body?: any): Promise<T> {
  const timestamp = new Date().toISOString();
  const msg = timestamp + method.toUpperCase() + path + (body ? JSON.stringify(sortObjectKeys(body)) : '');
  const sign = await hmacSha256(AVE_API_SECRET, msg);
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
  return data.data;
}

async function sendTelegramReply(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  });
}

async function handleCommand(text: string, chatId: string): Promise<string> {
  const cmd = text.toLowerCase().trim();

  if (cmd === '/start' || cmd === '/help') {
    return [
      '*IVEE Trading Bot*',
      '',
      '/trending \\- Top trending tokens',
      '/signals \\- Active trading signals',
      '/status \\- Proxy wallet status',
      '/buy \\[TOKEN\\] \\[ETH AMOUNT\\] \\- Buy token',
      '/sell \\[TOKEN\\] \\[TOKEN AMOUNT\\] \\- Sell token',
      '/orders \\- Open limit orders',
      '/cancel \\[ORDER ID\\] \\- Cancel order',
    ].join('\n');
  }

  if (cmd === '/trending') {
    try {
      const resp = await fetch(`https://prod.ave-api.com/v2/tokens/trending?chain=base&page_size=10`, {
        headers: { 'X-API-KEY': AVE_API_KEY },
      });
      const data = await resp.json();
      const tokens = data.data?.tokens || [];
      if (tokens.length === 0) return 'No trending tokens found';
      const lines = tokens.map((t: any, i: number) => {
        const change = parseFloat(t.price_change_24h || '0');
        const arrow = change >= 0 ? '↑' : '↓';
        return `${i + 1}\\. ${escapeMd(t.symbol)} $${parseFloat(t.current_price_usd || '0').toFixed(4)} ${arrow}${change.toFixed(1)}%`;
      });
      return `*🔥 Trending on Base:*\n\n${lines.join('\n')}`;
    } catch {
      return 'Failed to fetch trending tokens';
    }
  }

  if (cmd === '/status') {
    try {
      const wallets: any[] = await signedFetch('GET', '/v1/thirdParty/user/getUserByAssetsId');
      const wallet = wallets?.find((w: any) => w.assetsId === PROXY_ASSETS_ID);
      if (!wallet) return 'No proxy wallet found';
      const baseAddr = wallet.addressList?.find((a: any) => a.chain === 'base');
      return [
        `*💰 Proxy Wallet*`,
        `Address: \`${baseAddr?.address || 'N/A'}\``,
        `Status: ${wallet.status}`,
        `Type: ${wallet.type}`,
      ].join('\n');
    } catch (e: any) {
      return `Failed to get wallet: ${e.message}`;
    }
  }

  const buyMatch = cmd.match(/^\/buy\s+(\S+)\s+([\d.]+)/);
  if (buyMatch) {
    const token = buyMatch[1]!.toUpperCase();
    const amount = parseFloat(buyMatch[2]!);
    const tokenMap: Record<string, string> = {
      WETH: '0x4200000000000000000000000000000000000006',
      AERO: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      OP: '0x4200000000000000000000000000000000000042',
    };
    const tokenAddr = tokenMap[token];
    if (!tokenAddr) return `Unknown token: ${escapeMd(token)}`;
    const inAmount = BigInt(Math.floor(amount * 1e18)).toString();
    try {
      const result: any = await signedFetch('POST', '/v1/thirdParty/tx/sendSwapOrder', {
        chain: 'base',
        assetsId: PROXY_ASSETS_ID,
        inTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        outTokenAddress: tokenAddr,
        inAmount,
        swapType: 'buy',
        slippage: '500',
        useMev: false,
        autoSlippage: true,
        autoGas: 'average',
      });
      return `*🟢 Buy Order Placed*\nToken: ${escapeMd(token)}\nAmount: ${amount} ETH\nOrder ID: \`${result.id}\``;
    } catch (e: any) {
      return `Buy failed: ${escapeMd(e.message)}`;
    }
  }

  const sellMatch = cmd.match(/^\/sell\s+(\S+)\s+([\d.]+)/);
  if (sellMatch) {
    const token = sellMatch[1]!.toUpperCase();
    const amount = parseFloat(sellMatch[2]!);
    const tokenMap: Record<string, string> = {
      WETH: '0x4200000000000000000000000000000000000006',
      AERO: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      OP: '0x4200000000000000000000000000000000000042',
    };
    const tokenAddr = tokenMap[token];
    if (!tokenAddr) return `Unknown token: ${escapeMd(token)}`;
    const inAmount = BigInt(Math.floor(amount * 1e18)).toString();
    try {
      const result: any = await signedFetch('POST', '/v1/thirdParty/tx/sendSwapOrder', {
        chain: 'base',
        assetsId: PROXY_ASSETS_ID,
        inTokenAddress: tokenAddr,
        outTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        inAmount,
        swapType: 'sell',
        slippage: '500',
        useMev: false,
        autoSlippage: true,
        autoGas: 'average',
      });
      return `*🔴 Sell Order Placed*\nToken: ${escapeMd(token)}\nAmount: ${amount}\nOrder ID: \`${result.id}\``;
    } catch (e: any) {
      return `Sell failed: ${escapeMd(e.message)}`;
    }
  }

  if (cmd === '/orders') {
    try {
      const orders: any[] = await signedFetch('GET', `/v1/thirdParty/tx/getLimitOrder?chain=base&assetsId=${PROXY_ASSETS_ID}&status=waiting&pageSize=10&pageNo=0`);
      if (!orders || orders.length === 0) return 'No open orders';
      const lines = orders.map((o: any) => {
        const type = o.swapType === 'buy' ? 'BUY' : 'SELL';
        return `${type} ${escapeMd(o.swapType)} @ $${o.limitPrice} - \`${o.id.slice(0, 8)}\``;
      });
      return `*Open Orders:*\n\n${lines.join('\n')}`;
    } catch {
      return 'Failed to fetch orders';
    }
  }

  const cancelMatch = cmd.match(/^\/cancel\s+(\S+)/);
  if (cancelMatch) {
    const orderId = cancelMatch[1]!;
    try {
      await signedFetch('POST', '/v1/thirdParty/tx/cancelLimitOrder', { chain: 'base', ids: [orderId] });
      return `Order \`${escapeMd(orderId.slice(0, 8))}\` cancelled`;
    } catch (e: any) {
      return `Cancel failed: ${escapeMd(e.message)}`;
    }
  }

  return 'Unknown command\\. Type /help for available commands\\.';
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('setup') === '1' && TELEGRAM_BOT_TOKEN) {
      const webhookUrl = `${url.origin}/api/telegram/webhook`;
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await resp.json();
      return new Response(JSON.stringify({ ok: data.ok, webhookUrl, description: data.description }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ status: 'ok', bot: !!TELEGRAM_BOT_TOKEN }), { headers: corsHeaders });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const message = body?.message;
      if (!message?.text || !message?.chat?.id) {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const text = message.text as string;
      const chatId = String(message.chat.id);

      const reply = await handleCommand(text, chatId);
      await sendTelegramReply(chatId, reply);

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}
