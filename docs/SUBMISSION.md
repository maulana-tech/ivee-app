# IVEE — AVE Claw Hackathon Submission

## Project Description

**IVEE** is a real-time crypto trading intelligence dashboard with a full-featured trading terminal, built entirely on the **AVE Skills API** ecosystem. It combines live market monitoring, AI-powered analysis, automated trading, and Telegram bot integration into a single professional-grade web application.

**Live Demo:** [https://ivee-apps.vercel.app](https://ivee-apps.vercel.app)  
**Repository:** [https://github.com/maulana-tech/ivee-app](https://github.com/maulana-tech/ivee-app)  
**Telegram Bot:** Live — sends trading signals, executes orders, monitors wallet  
**Track:** Complete Application

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      IVEE Frontend                       │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │  Watch     │  │  Trade     │  │  AI Agent        │   │
│  │  28 Panels │  │  Terminal  │  │  Auto-Trading    │   │
│  └─────┬──────┘  └─────┬──────┘  └────────┬─────────┘   │
│        │               │                  │              │
│  ┌─────▼───────────────▼──────────────────▼───────────┐  │
│  │              AVE Service Layer                      │  │
│  │  client.ts │ trading.ts │ ai-agent.ts │ websocket  │  │
│  └─────┬──────────────┬───────────────────────────────┘  │
│        │              │                                   │
└────────┼──────────────┼───────────────────────────────────┘
         │              │
    ┌────▼──────┐  ┌────▼──────────────────────────────┐
    │  Vercel   │  │  AVE Bot API (Direct from Client)  │
    │  Edge     │  │  • Chain Wallet (unsigned)         │
    │  Proxy    │  │  • Proxy Wallet (HMAC-SHA256)      │
    │  /api/ave │  │  • WebSocket (wss://)              │
    └────┬──────┘  └────────────────────────────────────┘
         │
    ┌────▼────────────────┐  ┌────────────────────────────┐
    │  AVE Data API v2    │  │  Vercel Edge Functions      │
    │  (Server-side key)  │  │  • /api/telegram/webhook    │
    └─────────────────────┘  │  • /api/chart/crypto        │
                             │  • /api/ave/* (CORS proxy)  │
                             └────────────────────────────┘
```

---

## AVE Skills Used

### 1. AVE Data API v2 (Token Intelligence)

All Data API calls are proxied through a Vercel Edge Function (`/api/ave/*`) to handle CORS and protect the API key server-side.

| # | Skill | Endpoint | IVEE Feature | File |
|---|-------|----------|-------------|------|
| 1 | **Token Search** | `GET /tokens?keyword=&chain=&limit=` | Search tokens by name/symbol across any chain | `client.ts:187` |
| 2 | **Token Price** | `GET /tokens/{address}-{chain}` | Live price display on Trade page, 30s auto-refresh with flash animation | `client.ts:194` |
| 3 | **Trending Tokens** | `GET /tokens/trending?chain=&page_size=` | Trending panel with hot/gainers/losers, click-to-trade to Trade page | `client.ts:201` |
| 4 | **Token Risk** | `GET /tokens/risk?address=&chain=` | Risk Scanner — honeypot detection, buy/sell tax, owner analysis | `client.ts:208` |
| 5 | **Token Klines** | `GET /klines/token/{id}?interval=&limit=` | OHLCV candlestick data for chart, backtesting, technical analysis | `client.ts:266` |
| 6 | **Pair Klines** | `GET /klines/pair/{id}?interval=&limit=` | Pair-level candlestick data | `client.ts:277` |
| 7 | **Swap Transactions** | `GET /txs/{pairId}?limit=` | Whale alert detection from large swap transactions | `client.ts:295` |
| 8 | **Chain Main Tokens** | `GET /tokens/main?chain=` | Multi-chain token discovery for AI agent | `client.ts:321` |
| 9 | **Token Detail** | `GET /tokens/{id}` | Full token metadata, pairs, audit status | `client.ts:261` |

**Total: 9 Data API endpoints**

### 2. AVE Bot API — Chain Wallet (MetaMask Integration)

Unsigned calls using `AVE-ACCESS-KEY` header for user-owned wallet trading.

| # | Skill | Endpoint | IVEE Feature | File |
|---|-------|----------|-------------|------|
| 10 | **Quote / Estimate** | `POST /v1/thirdParty/chainWallet/getAmountOut` | Real-time swap estimation shown in Order Entry as user types | `trading.ts:169` |
| 11 | **Create Transaction** | `POST /v1/thirdParty/chainWallet/createEvmTx` | Build unsigned EVM swap tx for MetaMask signing | `trading.ts:230` |
| 12 | **Send Transaction** | `POST /v1/thirdParty/chainWallet/sendSignedEvmTx` | Track locally-signed transaction on AVE | `trading.ts:276` |
| 13 | **Auto Slippage** | `POST /v1/thirdParty/chainWallet/getAutoSlippage` | Intelligent slippage recommendation per token | `trading.ts:401` |
| 14 | **Gas Tips** | `GET /v1/thirdParty/chainWallet/getGasTip` | Current gas prices (high/average/low) per chain | `trading.ts:418` |

**Total: 5 Chain Wallet endpoints**

### 3. AVE Bot API — Proxy Wallet (Automated Trading)

HMAC-SHA256 signed calls (`AVE-ACCESS-KEY` + `AVE-ACCESS-TIMESTAMP` + `AVE-ACCESS-SIGN`) for AVE-hosted proxy wallet. Enables **agent-driven trading without MetaMask**.

| # | Skill | Endpoint | IVEE Feature | File |
|---|-------|----------|-------------|------|
| 15 | **List Wallets** | `GET /v1/thirdParty/user/getUserByAssetsId` | Display proxy wallet addresses across all chains | `trading.ts:484` |
| 16 | **Create Wallet** | `POST /v1/thirdParty/user/generateWallet` | Auto-create proxy wallet for AI agent | `trading.ts:487` |
| 17 | **Market Order** | `POST /v1/thirdParty/tx/sendSwapOrder` | Execute instant swap with auto-sell protection (SL/TP/Trailing) | `trading.ts:503` |
| 18 | **Limit Order** | `POST /v1/thirdParty/tx/sendLimitOrder` | Place limit order at target price | `trading.ts:520` |
| 19 | **Cancel Order** | `POST /v1/thirdParty/tx/cancelLimitOrder` | Cancel open limit orders | `trading.ts:538` |
| 20 | **Order Status** | `GET /v1/thirdParty/tx/getSwapOrder?chain=&ids=` | Check market order execution status | `trading.ts:553` |
| 21 | **List Limit Orders** | `GET /v1/thirdParty/tx/getLimitOrder?chain=&assetsId=&status=&pageNo=` | Open Orders panel with 30s auto-refresh | `trading.ts:575` |
| 22 | **Approve Token** | `POST /v1/thirdParty/tx/approve` | Approve token spending for proxy wallet | `trading.ts:593` |
| 23 | **Transfer** | `POST /v1/thirdParty/tx/transfer` | Send tokens from proxy wallet | `trading.ts:600` |
| 24 | **Transfer Status** | `GET /v1/thirdParty/tx/getTransfer?chain=&ids=` | Track transfer progress | `trading.ts:612` |

**Total: 10 Proxy Wallet endpoints**

### 4. AVE WebSocket (Real-time Order Push)

| # | Skill | Connection | IVEE Feature | File |
|---|-------|-----------|-------------|------|
| 25 | **Order Push** | `wss://bot-api.ave.ai/thirdws?ave_access_key={KEY}` | Subscribe to `botswap` topic for real-time order updates (confirmed/failed/cancelled). Auto-reconnects on disconnect. Shows toast notifications on Trade page. | `websocket.ts:24` |

**Total: 1 WebSocket with 1 subscription topic**

### 5. Server-side AVE API (Telegram Bot)

The Telegram webhook (`/api/telegram/webhook`) replicates HMAC-SHA256 signing server-side for bot commands.

| # | Skill | Endpoint | IVEE Feature | File |
|---|-------|----------|-------------|------|
| 26 | **Trending** | `GET /v2/tokens/trending` | `/trending` — show top 10 tokens on Base chain | `webhook.ts:92` |
| 27 | **Signals** | `GET /v2/tokens/trending` (analysis) | `/signals` — AI-generated buy/sell signals with confidence % | `webhook.ts:113` |
| 28 | **Wallet Info** | `GET /v1/thirdParty/user/getUserByAssetsId` | `/status` — show proxy wallet addresses | `webhook.ts:146` |
| 29 | **Buy** | `POST /v1/thirdParty/tx/sendSwapOrder` | `/buy TOKEN AMOUNT` — execute market buy via proxy wallet | `webhook.ts:163` |
| 30 | **Sell** | `POST /v1/thirdParty/tx/sendSwapOrder` | `/sell TOKEN AMOUNT` — execute market sell via proxy wallet | `webhook.ts:195` |
| 31 | **List Orders** | `GET /v1/thirdParty/tx/getLimitOrder` | `/orders` — list open limit orders | `webhook.ts:227` |
| 32 | **Cancel Order** | `POST /v1/thirdParty/tx/cancelLimitOrder` | `/cancel ID` — cancel a limit order | `webhook.ts:241` |

**Total: 7 server-side endpoint usages**

---

## Grand Total: 32 AVE Skills API Endpoints

| Category | Count | Auth Method |
|----------|------:|-------------|
| AVE Data API v2 | 9 | `X-API-KEY` (server-side proxy) |
| AVE Bot API — Chain Wallet | 5 | `AVE-ACCESS-KEY` header |
| AVE Bot API — Proxy Wallet (client) | 10 | HMAC-SHA256 signed |
| AVE WebSocket | 1 | `ave_access_key` query param |
| AVE Bot API — Proxy Wallet (server/Telegram) | 7 | HMAC-SHA256 signed (server-side) |
| **TOTAL** | **32** | — |

---

## Feature Details

### Watch Page (28 Panels)

| Panel | AVE Skill Used | Description |
|-------|---------------|-------------|
| **Trade Chart** | Token Klines | Interactive SVG chart with 4 intervals, hover crosshair, tooltip, volume bars |
| **Trending Tokens** | Trending API | Hot/gainers/losers tokens. Click any token → navigate to Trade page |
| **Trading Signals** | Trending → Analysis | AI-generated buy/sell signals with confidence %, target/stop-loss. Click to trade |
| **Whale Alerts** | Swap Transactions | Large transaction monitoring ($10K+). Click to trade |
| **Portfolio** | Token Price | Holdings tracking with live P&L calculation |
| **Risk Scanner** | Token Risk | Honeypot detection, buy/sell tax, owner status, liquidity analysis |
| **AI Trading** | Full Pipeline | Multi-analyst AI (fundamental + technical + sentiment) with debate system |
| **Backtest** | Token Klines | 5 strategies: momentum, mean reversion, breakout, volume profile, whale following |
| **Limit Orders** | Proxy Wallet API | View/cancel open limit orders |
| **Price Alerts** | Token Price + Telegram | Set price targets, get notified on Telegram |
| **Heatmap** | Token Price | Crypto market heatmap by sector/chain |
| **Fear & Greed** | Market data | Market sentiment indicator |
| **ETF Flows** | Market data | BTC/ETH ETF inflow/outflow tracking |
| **Stablecoin** | Market data | Stablecoin supply and depeg monitoring |
| **Live News** | RSS feeds | Crypto news aggregation |
| **Insights** | Analysis | AI-powered market insights |

### Trade Page (Full Terminal)

| Component | AVE Skill Used | Description |
|-----------|---------------|-------------|
| **Interactive Chart** | Klines + external data | SVG chart with crosshair, tooltip, volume bars, 4 time intervals |
| **Chain Selector** | Multi-chain support | Switch between Base, Ethereum, BSC, Solana with chain-specific tokens |
| **Token Selector** | Token Search + dynamic | Preset tokens + dynamic tokens from Watch page click-to-trade |
| **Market/Limit Toggle** | Chain Wallet + Proxy Wallet | Switch between market and limit order modes |
| **Order Entry** | getAmountOut + sendSwapOrder | Buy/sell with real-time quote estimation, quick amount buttons (25/50/75/MAX) |
| **Auto-Sell Config** | autoSellConfig in sendSwapOrder | Stop-loss, take-profit, trailing stop attached to every buy order |
| **Open Orders** | getLimitOrder + WebSocket | Auto-refresh 30s + real-time WebSocket push + status badges + cancel |
| **Trade History** | Order Status | P&L tracking, win/loss rate, running total, auto-refresh 10s |
| **AI Agent** | Full analysis pipeline | Start/stop agent, configure interval (1/5/15 min) & confidence (60-90%), cycle log |
| **Positions** | Proxy Wallet addresses | Multi-chain wallet display with explorer links, copy address, auto-refresh 60s |
| **Divider Resize** | — | Drag to resize chart vs bottom panel |
| **Price Flash** | Token Price (30s poll) | Green/red flash animation on price change |

### AI Trading Agent Pipeline

```
┌──────────────┐    ┌───────────────────┐    ┌──────────────────┐
│ 1. Token     │───▶│ 2. Fundamental    │───▶│ 3. Technical     │
│   Selection  │    │   Analysis        │    │   Analysis       │
│ (AVE         │    │ (AVE Token Data)  │    │ (AVE Klines:     │
│  Trending)   │    │ • 24h change      │    │  RSI, MACD,      │
│              │    │ • Volume          │    │  Bollinger, SMA) │
│              │    │ • Market cap      │    │                  │
└──────────────┘    └───────────────────┘    └──────────────────┘
                                                      │
┌──────────────┐    ┌───────────────────┐    ┌────────▼─────────┐
│ 6. Risk      │◀───│ 5. Decision       │◀───│ 4. Sentiment     │
│   Check      │    │   (BUY/SELL/HOLD) │    │   Analysis       │
│ • Position   │    │ • Entry price     │    │ (AVE Trending +  │
│   sizing     │    │ • Target price    │    │  News + Fear/    │
│ • Confidence │    │ • Stop loss       │    │  Greed Index)    │
│   threshold  │    │ • Position size   │    │                  │
└──────┬───────┘    └───────────────────┘    └──────────────────┘
       │
┌──────▼───────┐
│ 7. Execute   │
│ (AVE Proxy   │
│  Wallet:     │
│ sendSwapOrder│
│ + autoSell)  │
└──────────────┘
```

### Telegram Bot Commands (Live)

| Command | AVE Skill | Action |
|---------|----------|--------|
| `/start` | — | Show help menu |
| `/trending` | Data API v2 | Top 10 trending tokens on Base with price + 24h change |
| `/signals` | Data API v2 (analysis) | AI trading signals with action (BUY/SELL), confidence %, volume |
| `/status` | Bot API (signed) | Show proxy wallet address and status |
| `/buy TOKEN AMOUNT` | Bot API (signed) | Execute market buy via proxy wallet (e.g. `/buy WETH 0.01`) |
| `/sell TOKEN AMOUNT` | Bot API (signed) | Execute market sell via proxy wallet |
| `/orders` | Bot API (signed) | List open limit orders |
| `/cancel ORDER_ID` | Bot API (signed) | Cancel a limit order |

---

## Auto-Sell Protection (Key Feature)

Every buy order executed through IVEE automatically attaches **autoSellConfig** rules via AVE's native auto-sell feature:

| Rule | Config | Meaning |
|------|--------|---------|
| **Stop-Loss** | `{ priceChange: "-5000", sellRatio: "10000", type: "default" }` | If price drops 50%, sell 100% |
| **Take-Profit** | `{ priceChange: "5000", sellRatio: "5000", type: "default" }` | If price rises 50%, sell 50% |
| **Trailing Stop** | `{ priceChange: "1000", sellRatio: "10000", type: "trailing" }` | If price pulls back 10% from peak, sell 100% |

- `priceChange` is in basis points (-5000 = -50%)
- Up to 10 `default` rules + 1 `trailing` rule per order
- Configurable by user in Order Entry panel

---

## Environment Variables

| Variable | Used In | Purpose |
|----------|---------|---------|
| `AVE_API_KEY` | Vercel Edge proxy | Server-side AVE Data API key (never exposed to client) |
| `AVE_API_SECRET` | Telegram webhook | Server-side HMAC signing secret |
| `VITE_AVE_BOT_KEY` | Client-side trading | AVE Bot API access key |
| `VITE_AVE_BOT_SECRET` | Client-side trading | HMAC-SHA256 signing secret for proxy wallet |
| `TELEGRAM_BOT_TOKEN` | Telegram webhook | Bot token (server-side) |
| `TELEGRAM_CHAT_ID` | Telegram alerts | Chat ID for push notifications |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | TypeScript, Vite, Vanilla DOM (no framework) |
| **AVE APIs** | Data API v2, Bot API (Chain + Proxy Wallet), WebSocket |
| **Authentication** | HMAC-SHA256 via Web Crypto API |
| **Backend** | Vercel Edge Functions (TypeScript) |
| **Real-time** | WebSocket (botswap topic) with auto-reconnect |
| **Integration** | Telegram Bot API (webhook + push alerts) |
| **Deploy** | Vercel (production, auto-deploy from GitHub) |

---

## Project Structure

```
src/
├── pages/
│   └── TradePage.ts              # Full trading terminal
├── components/
│   ├── trade/                    # Trade page components
│   │   ├── OrderEntry.ts         # Market/Limit order form
│   │   ├── OpenOrders.ts         # Limit order management
│   │   ├── TradeHistory.ts       # P&L tracking
│   │   ├── AiAgent.ts            # AI auto-trading agent
│   │   └── Positions.ts          # Proxy wallet display
│   └── ave/                      # Watch page panels
│       ├── TrendingPanel.ts      # Trending tokens (click-to-trade)
│       ├── SignalsPanel.ts       # Trading signals (click-to-trade)
│       ├── WhaleAlertPanel.ts    # Whale alerts (click-to-trade)
│       ├── TradingPanel.ts       # Trade from watch page
│       ├── RiskScannerPanel.ts   # Token risk analysis
│       ├── PortfolioPanel.ts     # Portfolio tracking
│       ├── BacktestPanel.ts      # Strategy backtesting
│       ├── TradeChartPanel.ts    # Price chart
│       ├── LimitOrderPanel.ts    # Limit order panel
│       └── PriceAlertPanel.ts    # Price alerts
├── services/ave/                 # AVE API integration
│   ├── client.ts                 # Data API v2 client
│   ├── trading.ts                # Bot API (Chain + Proxy Wallet)
│   ├── websocket.ts              # Real-time order push
│   ├── ai-agent.ts               # Multi-analyst AI pipeline
│   ├── auto-agent.ts             # Auto-trading loop
│   ├── signals.ts                # Signal generation
│   ├── monitor.ts                # Whale alerts + price monitoring
│   ├── portfolio.ts              # Portfolio tracking
│   ├── monitoring.ts             # Anomaly detection + risk scan
│   ├── trading-skill.ts          # 5 strategies + backtesting
│   └── telegram.ts               # Telegram alert service
├── app/
│   ├── page-router.ts            # Watch/Trade page routing
│   └── panel-layout.ts           # Panel grid layout
└── config/
    └── variant.ts                # IVEE branding config

api/                              # Vercel Edge Functions
├── ave/index.ts                  # Data API CORS proxy
├── telegram/webhook.ts           # Telegram bot webhook
└── chart/[...path].ts            # Chart data proxy
```

---

## Key Innovations

1. **autoSellConfig** — Every buy order automatically attaches stop-loss, take-profit, and trailing stop rules via AVE's native auto-sell feature. No manual monitoring needed.

2. **Multi-Analyst AI Pipeline** — Combines fundamental (volume/market cap), technical (RSI/MACD/Bollinger/SMA), and sentiment (trending/news/fear-greed) analysis into a weighted debate before executing trades.

3. **Click-to-Trade** — Click any token on Watch page panels (Trending, Signals, Whale Alerts) to instantly navigate to Trade page with the token pre-loaded and chart displayed.

4. **Real-time WebSocket** — Live order status push notifications on the Trade page with auto-refresh of the Open Orders panel. Toast notifications on confirmed/failed/cancelled orders.

5. **Multi-chain Trading** — Full support for Base, Ethereum, BSC, and Solana with chain-specific token lists and trading.

6. **Server-side Telegram Bot** — Complete trading via Telegram commands with server-side HMAC-SHA256 signing. No secrets exposed to client. Supports `/trending`, `/signals`, `/buy`, `/sell`, `/orders`, `/cancel`.

7. **Interactive Chart** — SVG chart with hover crosshair, tooltip (price + date + % change), volume bars, and 4 time intervals (24H/7D/30D/90D).

8. **5 Backtesting Strategies** — Momentum, mean reversion, breakout, volume profile, and whale following strategies with Sharpe ratio calculation.

---

## Hackathon Info

- **Track:** Complete Application
- **Framework:** AVE Skills API (32 endpoints)
- **Submission Deadline:** April 15, 2026
- **License:** MIT
