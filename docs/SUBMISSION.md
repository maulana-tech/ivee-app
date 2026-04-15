# IVEE — AVE Claw Hackathon Submission

## Project Description

**IVEE** is a real-time crypto trading intelligence dashboard with a full-featured trading terminal, built entirely on the **AVE Skills API** ecosystem. It combines live market monitoring, AI-powered analysis, automated trading, and Telegram bot integration into a single professional-grade web application.

**Live Demo:** [https://ivee-apps.vercel.app](https://ivee-apps.vercel.app)  
**Repository:** [https://github.com/maulana-tech/ivee-app](https://github.com/maulana-tech/ivee-app)  
**Track:** Complete Application

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    IVEE Frontend                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Watch    │  │ Trade    │  │ AI Agent          │  │
│  │ 28 Panels│  │ Terminal │  │ Auto-Trading Loop │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │             │                 │              │
│  ┌────▼─────────────▼─────────────────▼───────────┐  │
│  │            AVE Service Layer                    │  │
│  │  client.ts │ trading.ts │ ai-agent.ts │ ws.ts  │  │
│  └────┬────────────┬──────────────────────────────┘  │
│       │            │                                  │
└───────┼────────────┼──────────────────────────────────┘
        │            │
   ┌────▼────┐  ┌────▼────────────────────────────┐
   │ Vercel  │  │ AVE Bot API (Direct from Client) │
   │ Proxy   │  │ • Chain Wallet (unsigned)        │
   │ /api/ave│  │ • Proxy Wallet (HMAC-SHA256)     │
   └────┬────┘  │ • WebSocket (wss://)             │
        │       └──────────────────────────────────┘
   ┌────▼──────┐
   │ AVE Data  │  ┌──────────────────────────────────┐
   │ API v2    │  │ Vercel Edge Functions             │
   │           │  │ • /api/telegram/webhook           │
   └───────────┘  │ • /api/chart/crypto              │
                  └──────────────────────────────────┘
```

---

## AVE Skills Used

### 1. AVE Data API v2 (Token Intelligence)

All Data API calls are proxied through a Vercel Edge Function (`/api/ave/*`) to handle CORS and protect the API key server-side.

| Skill | Endpoint | IVEE Feature | File |
|-------|----------|-------------|------|
| **Token Search** | `GET /tokens?keyword=&chain=&limit=` | Search tokens by name/symbol across any chain | `client.ts:187` |
| **Token Price** | `GET /tokens/{address}-{chain}` | Live price display on Trade page, 30s auto-refresh with flash animation | `client.ts:194` |
| **Trending Tokens** | `GET /tokens/trending?chain=&page_size=` | Trending panel with hot/gainers/losers tokens, click-to-trade | `client.ts:201` |
| **Token Risk** | `GET /tokens/risk?address=&chain=` | Risk Scanner panel — honeypot detection, buy/sell tax, owner analysis | `client.ts:208` |
| **Token Klines** | `GET /klines/token/{id}?interval=&limit=` | OHLCV candlestick data for chart, backtesting, and technical analysis | `client.ts:266` |
| **Pair Klines** | `GET /klines/pair/{id}?interval=&limit=` | Pair-level candlestick data | `client.ts:277` |
| **Swap Transactions** | `GET /txs/{pairId}?limit=` | Whale alert detection from large swap transactions | `client.ts:295` |
| **Chain Main Tokens** | `GET /tokens/main?chain=` | Multi-chain token discovery for AI agent analysis | `client.ts:321` |
| **Token Detail** | `GET /tokens/{id}` | Full token metadata, pairs, audit status | `client.ts:261` |

**Total: 9 distinct Data API endpoints**

### 2. AVE Bot API — Chain Wallet (MetaMask Integration)

Unsigned calls using `AVE-ACCESS-KEY` header for user-owned wallet trading.

| Skill | Endpoint | IVEE Feature | File |
|-------|----------|-------------|------|
| **Quote / Estimate** | `POST /v1/thirdParty/chainWallet/getAmountOut` | Real-time swap estimation shown in Order Entry as user types | `trading.ts:169` |
| **Create Transaction** | `POST /v1/thirdParty/chainWallet/createEvmTx` | Build unsigned EVM swap tx for MetaMask signing | `trading.ts:230` |
| **Send Transaction** | `POST /v1/thirdParty/chainWallet/sendSignedEvmTx` | Track locally-signed transaction on AVE | `trading.ts:276` |
| **Auto Slippage** | `POST /v1/thirdParty/chainWallet/getAutoSlippage` | Intelligent slippage recommendation per token | `trading.ts:401` |
| **Gas Tips** | `GET /v1/thirdParty/chainWallet/getGasTip` | Current gas prices (high/average/low) per chain | `trading.ts:418` |

**Total: 5 Chain Wallet endpoints**

### 3. AVE Bot API — Proxy Wallet (Automated Trading)

HMAC-SHA256 signed calls (`AVE-ACCESS-KEY` + `AVE-ACCESS-TIMESTAMP` + `AVE-ACCESS-SIGN`) for AVE-hosted proxy wallet. This enables **agent-driven trading without MetaMask**.

| Skill | Endpoint | IVEE Feature | File |
|-------|----------|-------------|------|
| **List Wallets** | `GET /v1/thirdParty/user/getUserByAssetsId` | Display proxy wallet addresses across all chains | `trading.ts:484` |
| **Create Wallet** | `POST /v1/thirdParty/user/generateWallet` | Auto-create proxy wallet for AI agent if none exists | `trading.ts:487` |
| **Market Order** | `POST /v1/thirdParty/tx/sendSwapOrder` | Execute instant swap via proxy wallet with auto-sell protection | `trading.ts:503` |
| **Limit Order** | `POST /v1/thirdParty/tx/sendLimitOrder` | Place limit order at target price via proxy wallet | `trading.ts:520` |
| **Cancel Order** | `POST /v1/thirdParty/tx/cancelLimitOrder` | Cancel open limit orders | `trading.ts:538` |
| **Order Status** | `GET /v1/thirdParty/tx/getSwapOrder?chain=&ids=` | Check market order execution status | `trading.ts:553` |
| **List Limit Orders** | `GET /v1/thirdParty/tx/getLimitOrder?chain=&assetsId=&status=&pageNo=` | Open Orders panel with auto-refresh | `trading.ts:575` |
| **Approve Token** | `POST /v1/thirdParty/tx/approve` | Approve token spending for proxy wallet | `trading.ts:593` |
| **Transfer** | `POST /v1/thirdParty/tx/transfer` | Send tokens from proxy wallet to external address | `trading.ts:600` |
| **Transfer Status** | `GET /v1/thirdParty/tx/getTransfer?chain=&ids=` | Track transfer progress | `trading.ts:612` |

**Total: 10 Proxy Wallet endpoints**

### 4. AVE WebSocket (Real-time Updates)

| Skill | Connection | IVEE Feature | File |
|-------|-----------|-------------|------|
| **Order Push** | `wss://bot-api.ave.ai/thirdws?ave_access_key={KEY}` | Subscribe to `botswap` topic for real-time order status updates. Auto-reconnects on disconnect. Shows toast notifications on Trade page when orders are confirmed/failed/cancelled. | `websocket.ts:24` |

**Total: 1 WebSocket connection with 1 subscription topic**

### 5. Server-side AVE API (Telegram Bot)

The Telegram webhook (`/api/telegram/webhook`) replicates HMAC-SHA256 signing server-side for bot commands.

| Skill | Endpoint | IVEE Feature | File |
|-------|----------|-------------|------|
| **Trending** | `GET /v2/tokens/trending` (direct) | `/trending` Telegram command — show top tokens | `webhook.ts:88` |
| **Wallet Info** | `GET /v1/thirdParty/user/getUserByAssetsId` | `/status` command — show wallet addresses | `webhook.ts:107` |
| **Buy** | `POST /v1/thirdParty/tx/sendSwapOrder` | `/buy [TOKEN] [AMOUNT]` — buy via Telegram | `webhook.ts:136` |
| **Sell** | `POST /v1/thirdParty/tx/sendSwapOrder` | `/sell [TOKEN] [AMOUNT]` — sell via Telegram | `webhook.ts:168` |
| **List Orders** | `GET /v1/thirdParty/tx/getLimitOrder` | `/orders` — list open limit orders | `webhook.ts:188` |
| **Cancel Order** | `POST /v1/thirdParty/tx/cancelLimitOrder` | `/cancel [ID]` — cancel a limit order | `webhook.ts:204` |

**Total: 6 server-side endpoint usages**

---

## Feature Details

### Watch Page (28 Panels)

| Panel | AVE Skill Used | Description |
|-------|---------------|-------------|
| **Trade Chart** | Token Klines | Interactive SVG chart with 4 intervals, hover crosshair + tooltip + volume bars |
| **Trending Tokens** | Trending API | Hot/gainers/losers tokens. Click any token to navigate to Trade page |
| **Trading Signals** | Trending → Analysis | AI-generated buy/sell signals with confidence % and target price |
| **Whale Alerts** | Swap Transactions | Large transaction monitoring ($10K+), click to trade |
| **Portfolio** | Token Price | Holdings tracking with live P&L calculation |
| **Risk Scanner** | Token Risk | Honeypot detection, buy/sell tax, owner status, liquidity analysis |
| **AI Trading** | Full Pipeline | Multi-analyst AI with fundamental + technical + sentiment analysis |
| **Backtest** | Token Klines | 5 strategies (momentum, mean reversion, breakout, volume profile, whale following) with Sharpe ratio |
| **Limit Orders** | Proxy Wallet API | View/cancel open limit orders |
| **Price Alerts** | Token Price | Set price targets, get notified on Telegram |

### Trade Page (Full Terminal)

| Component | AVE Skill Used | Description |
|-----------|---------------|-------------|
| **Interactive Chart** | Klines + CoinGecko proxy | SVG chart with crosshair, tooltip, volume bars, 4 time intervals |
| **Chain Selector** | Multi-chain tokens | Switch between Base, Ethereum, BSC, Solana with chain-specific tokens |
| **Order Entry** | Chain Wallet + Proxy Wallet | Market & limit orders, buy/sell toggle, quick amount buttons (25/50/75/MAX) |
| **Auto-Sell Config** | autoSellConfig in sendSwapOrder | Stop-loss (-50%), take-profit (+50%), trailing stop (10%) on every buy |
| **Open Orders** | getLimitOrder + WebSocket | Auto-refresh 30s + real-time WebSocket updates with status badges |
| **Trade History** | Local storage | P&L tracking, win rate, status badges, auto-refresh 10s |
| **AI Agent** | Full analysis pipeline | Start/stop agent, configure interval & confidence, cycle log display |
| **Positions** | Proxy Wallet addresses | Multi-chain wallet display with explorer links, copy address |

### AI Trading Agent Pipeline

```
1. Token Selection → AVE Trending API → Pick top trending token
2. Fundamental Analysis → AVE Token Data → Score on change/volume/market cap
3. Technical Analysis → AVE Klines (100 candles) → RSI, MACD, Bollinger Bands, SMA
4. Sentiment Analysis → AVE Trending + News + Fear/Greed → Combined sentiment score
5. Debate → Weighted consensus from all analysts
6. Risk Check → Position sizing, confidence threshold
7. Decision → BUY/SELL/HOLD with entry, target, stop-loss
8. Execution → AVE Proxy Wallet sendSwapOrder with autoSellConfig
```

### Telegram Bot

| Command | AVE Skill | Action |
|---------|----------|--------|
| `/trending` | Data API | Show top 5 trending tokens on Base |
| `/status` | Bot API | Show proxy wallet info + trade stats |
| `/buy TOKEN AMT` | Bot API (signed) | Execute market buy via proxy wallet |
| `/sell TOKEN AMT` | Bot API (signed) | Execute market sell via proxy wallet |
| `/orders` | Bot API (signed) | List open limit orders |
| `/cancel ID` | Bot API (signed) | Cancel a limit order |

---

## Environment Variables

| Variable | Used In | Purpose |
|----------|---------|---------|
| `AVE_API_KEY` | Vercel Edge proxy | Server-side AVE Data API key (never exposed to client) |
| `VITE_AVE_BOT_KEY` | Client-side trading | AVE Bot API access key |
| `VITE_AVE_BOT_SECRET` | Client-side trading | HMAC-SHA256 signing secret for proxy wallet |
| `AVE_API_SECRET` | Telegram webhook | Server-side HMAC signing |
| `VITE_TELEGRAM_BOT_TOKEN` | Telegram integration | Bot token |
| `VITE_TELEGRAM_CHAT_ID` | Telegram alerts | Chat ID for push notifications |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | TypeScript, Vite, Vanilla DOM (no framework) |
| **AVE APIs** | Data API v2, Bot API (Chain + Proxy), WebSocket |
| **Auth** | HMAC-SHA256 via Web Crypto API |
| **Backend** | Vercel Edge Functions |
| **Real-time** | WebSocket (botswap topic) |
| **Integration** | Telegram Bot API |
| **Deploy** | Vercel (production) |

---

## AVE Skills API Summary

| Category | Endpoints Used | Auth Method |
|----------|---------------|-------------|
| AVE Data API v2 | 9 | `X-API-KEY` (server-side proxy) |
| AVE Bot API — Chain Wallet | 5 | `AVE-ACCESS-KEY` header |
| AVE Bot API — Proxy Wallet | 10 (client) + 6 (server) | HMAC-SHA256 signed |
| AVE WebSocket | 1 | `ave_access_key` query param |
| **Total AVE API Endpoints** | **31** | — |

---

## Key Innovations

1. **autoSellConfig** — Every buy order automatically attaches stop-loss, take-profit, and trailing stop rules via AVE's native auto-sell feature. No manual monitoring needed.

2. **Multi-Analyst AI Pipeline** — Combines fundamental, technical (RSI/MACD/Bollinger), and sentiment analysis from AVE data into a weighted debate before executing trades.

3. **Click-to-Trade** — Click any token on Watch page panels (trending, signals, whale alerts) to instantly navigate to Trade page with the token pre-loaded.

4. **Real-time WebSocket** — Live order status push notifications on the Trade page with auto-refresh of the Open Orders panel.

5. **Multi-chain** — Full support for Base, Ethereum, BSC, and Solana with chain-specific token lists and trading.

6. **Server-side Telegram Bot** — Complete trading via Telegram commands with server-side HMAC signing (no secrets exposed to client).

---

## Hackathon Info

- **Track:** Complete Application
- **Framework:** AVE Skills API
- **Submission Deadline:** April 15, 2026
- **License:** MIT
