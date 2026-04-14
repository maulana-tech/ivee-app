import { SITE_VARIANT } from '@/config';

export const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';
export const TELEGRAM_ENABLED = SITE_VARIANT === 'crypto' && !!TELEGRAM_BOT_TOKEN;

export interface TelegramTradeAlert {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string;
  txHash?: string;
}

export interface TelegramPriceAlert {
  symbol: string;
  price: number;
  change24h: number;
  direction: 'above' | 'below';
  threshold: number;
}

export interface TelegramRiskAlert {
  symbol: string;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  ownerRenounced: boolean;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export function formatTradeAlert(alert: TelegramTradeAlert): string {
  const emoji = alert.action === 'BUY' ? '🟢' : alert.action === 'SELL' ? '🔴' : '⏸️';
  const lines = [
    `${emoji} *${alert.action} ${escapeMarkdown(alert.symbol)}*`,
    `Confidence: ${alert.confidence}%`,
    `Entry: $${alert.entryPrice.toFixed(2)}`,
    `Target: $${alert.targetPrice.toFixed(2)} \\(+${((alert.targetPrice / alert.entryPrice - 1) * 100).toFixed(1)}%\\)`,
    `Stop: $${alert.stopLoss.toFixed(2)} \\(-${((1 - alert.stopLoss / alert.entryPrice) * 100).toFixed(1)}%\\)`,
    '',
    escapeMarkdown(alert.reasoning.slice(0, 200)),
  ];
  if (alert.txHash) {
    lines.push('', `[View TX](https://basescan.org/tx/${alert.txHash})`);
  }
  return lines.join('\n');
}

export function formatPriceAlert(alert: TelegramPriceAlert): string {
  const arrow = alert.direction === 'above' ? '📈' : '📉';
  return [
    `${arrow} *${escapeMarkdown(alert.symbol)}* Price Alert`,
    `Price: $${alert.price.toFixed(2)}`,
    `24h Change: ${alert.change24h >= 0 ? '+' : ''}${alert.change24h.toFixed(1)}%`,
    `${alert.direction === 'above' ? 'Above' : 'Below'} threshold: $${alert.threshold.toFixed(2)}`,
  ].join('\n');
}

export function formatRiskAlert(alert: TelegramRiskAlert): string {
  const danger = alert.isHoneypot ? '🚨' : '⚠️';
  return [
    `${danger} *Risk Alert: ${escapeMarkdown(alert.symbol)}*`,
    `Honeypot: ${alert.isHoneypot ? '⚠ YES' : '✓ No'}`,
    `Buy Tax: ${(alert.buyTax * 100).toFixed(1)}%`,
    `Sell Tax: ${(alert.sellTax * 100).toFixed(1)}%`,
    `Owner Renounced: ${alert.ownerRenounced ? '✓ Yes' : '✗ No'}`,
  ].join('\n');
}

export async function sendTelegramMessage(text: string, parseMode: 'MarkdownV2' | 'HTML' = 'MarkdownV2'): Promise<boolean> {
  if (!TELEGRAM_ENABLED || !TELEGRAM_CHAT_ID) return false;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    const data = await resp.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function sendTradeAlert(alert: TelegramTradeAlert): Promise<boolean> {
  return sendTelegramMessage(formatTradeAlert(alert));
}

export async function sendPriceAlert(alert: TelegramPriceAlert): Promise<boolean> {
  return sendTelegramMessage(formatPriceAlert(alert));
}

export async function sendRiskAlert(alert: TelegramRiskAlert): Promise<boolean> {
  return sendTelegramMessage(formatRiskAlert(alert));
}

export async function setTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await resp.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function getTelegramBotInfo(): Promise<{ username: string; name: string } | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await resp.json();
    if (data.ok) return { username: data.result.username, name: data.result.first_name };
    return null;
  } catch {
    return null;
  }
}

export async function processTelegramCommand(text: string, chatId: string): Promise<string> {
  const cmd = text.toLowerCase().trim();

  if (cmd === '/start' || cmd === '/help') {
    return [
      '*IVEE Trading Bot Commands:*',
      '',
      '/status \\- Portfolio & P&L summary',
      '/trending \\- Top trending tokens',
      '/signals \\- Active trading signals',
      '/price \\[TOKEN\\] \\- Get token price',
      '/risk \\[TOKEN\\] \\- Risk analysis',
      '/buy \\[TOKEN\\] \\[AMOUNT\\] \\- Buy via proxy wallet',
      '/sell \\[TOKEN\\] \\[AMOUNT\\] \\- Sell via proxy wallet',
      '/orders \\- Open limit orders',
      '/cancel \\[ID\\] \\- Cancel limit order',
      '/help \\- Show this message',
    ].join('\n');
  }

  if (cmd === '/trending') {
    try {
      const { getTrendingTokens } = await import('./client');
      const tokens = await getTrendingTokens('base', 10);
      if (tokens.length === 0) return 'No trending tokens found';
      const lines = tokens.map((t, i) => {
        const change = parseFloat(t.price_change_24h || '0');
        const arrow = change >= 0 ? '↑' : '↓';
        return `${i + 1}\\. ${escapeMarkdown(t.symbol)} $${parseFloat(t.current_price_usd || '0').toFixed(4)} ${arrow}${change.toFixed(1)}%`;
      });
      return `*🔥 Trending on Base:*\n\n${lines.join('\n')}`;
    } catch {
      return 'Failed to fetch trending tokens';
    }
  }

  if (cmd === '/status') {
    try {
      const { getTotalPnL, getWinRate, getTradeHistory } = await import('./trading');
      const pnl = getTotalPnL();
      const winRate = getWinRate();
      const trades = getTradeHistory().slice(-5);
      const lines = [
        `*📊 IVEE Agent Status*`,
        `P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        `Win Rate: ${winRate}%`,
        `Recent Trades: ${trades.length}`,
      ];
      return lines.join('\n');
    } catch {
      return 'Failed to get status';
    }
  }

  if (cmd === '/signals') {
    try {
      const { generateTradeSignals } = await import('./trading-skill');
      const signals = await generateTradeSignals('base');
      const top = signals.slice(0, 5);
      if (top.length === 0) return 'No active signals';
      const lines = top.map(s => {
        const emoji = s.action === 'BUY' ? '🟢' : s.action === 'SELL' ? '🔴' : '⏸';
        return `${emoji} ${escapeMarkdown(s.symbol)} ${s.action} @ $${s.entryPrice.toFixed(4)} (${s.confidence}%)`;
      });
      return `*📡 Top Signals:*\n\n${lines.join('\n')}`;
    } catch {
      return 'Failed to fetch signals';
    }
  }

  const priceMatch = cmd.match(/^\/price\s+(\w+)/);
  if (priceMatch) {
    const symbol = priceMatch[1]!.toUpperCase();
    try {
      const { getTokenPrice } = await import('./client');
      const tokenMap: Record<string, string> = {
        WETH: '0x4200000000000000000000000000000000000006',
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        AERO: '0xd4d42F0b6DEF4CE0383636770eF773790D1A0f17',
        OP: '0x4200000000000000000000000000000000000042',
      };
      const addr = tokenMap[symbol] || symbol;
      const data = await getTokenPrice(addr);
      if (!data) return `Token ${symbol} not found`;
      const price = parseFloat(data.current_price_usd || '0');
      const change = parseFloat(data.price_change_24h || '0');
      return `*${escapeMarkdown(symbol)}: $${price.toFixed(4)}* (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;
    } catch {
      return `Failed to get price for ${symbol}`;
    }
  }

  return 'Unknown command. Type /help for available commands.';
}
