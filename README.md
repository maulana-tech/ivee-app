# IVEE — AVE Claw Hackathon

**Real-time crypto trading intelligence dashboard** with full trading terminal, AI-powered auto-trading, and Telegram bot — built on 32 AVE Skills API endpoints.

Built for the [AVE Claw Hackathon](https://clawhackathon.aveai.trade/) — Complete Application Track.

[![Live Demo](https://img.shields.io/badge/Live-Demo-22c55e?style=flat)](https://ivee-apps.vercel.app)
[![Telegram Bot](https://img.shields.io/badge/Telegram-@ivee__team__bot-26A5E4?style=flat&logo=telegram)](https://t.me/ivee_team_bot)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live Demo:** [https://ivee-apps.vercel.app](https://ivee-apps.vercel.app)  
**Telegram Bot:** [@ivee_team_bot](https://t.me/ivee_team_bot)  
**Full Documentation:** [docs/SUBMISSION.md](docs/SUBMISSION.md)

---

## Features

### Watch Page — 28 Intelligence Panels
- **Interactive Trade Chart** — SVG chart with hover crosshair, tooltip, volume bars, 4 intervals
- **Trending Tokens** — Hot/gainers/losers with click-to-trade
- **Trading Signals** — AI buy/sell signals with confidence scores
- **Whale Alerts** — Large transaction monitoring ($10K+), click to trade
- **Risk Scanner** — Honeypot detection, buy/sell tax, owner analysis
- **Portfolio** — Holdings tracking with live P&L
- **Backtest** — 5 strategies with Sharpe ratio
- **AI Trading** — Multi-analyst AI (fundamental + technical + sentiment)
- **Heatmap, Fear & Greed, ETF Flows, Stablecoin Monitor, Live News** + more

### Trade Page — Full Terminal
- **Market & Limit Orders** — Buy/sell with real-time quote estimation
- **Multi-chain** — Base, Ethereum, BSC, Solana
- **Auto-Sell Protection** — Stop-loss, take-profit, trailing stop on every buy
- **Real-time WebSocket** — Live order status push with toast notifications
- **AI Agent** — Auto-trading with configurable interval and confidence
- **Click-to-Trade** — Click any token from Watch page → instant trade

### Telegram Bot — [@ivee_team_bot](https://t.me/ivee_team_bot)
- `/trending` — Top trending tokens on Base
- `/signals` — AI trading signals with confidence %
- `/status` — Proxy wallet info
- `/buy TOKEN AMOUNT` — Execute market buy
- `/sell TOKEN AMOUNT` — Execute market sell
- `/orders` — List open orders
- `/cancel ID` — Cancel order

---

## AVE Skills API — 32 Endpoints

| Category | Count | Auth |
|----------|------:|------|
| AVE Data API v2 | 9 | `X-API-KEY` (server-side proxy) |
| Bot API — Chain Wallet | 5 | `AVE-ACCESS-KEY` header |
| Bot API — Proxy Wallet (client) | 10 | HMAC-SHA256 signed |
| AVE WebSocket | 1 | `ave_access_key` query param |
| Bot API — Proxy Wallet (Telegram) | 7 | HMAC-SHA256 signed (server) |
| **Total** | **32** | |

See [docs/SUBMISSION.md](docs/SUBMISSION.md) for full endpoint inventory with file:line references.

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | TypeScript, Vite, Vanilla DOM |
| **AVE APIs** | Data API v2, Bot API (Chain + Proxy), WebSocket |
| **Auth** | HMAC-SHA256 via Web Crypto API |
| **Backend** | Vercel Edge Functions |
| **Real-time** | WebSocket (botswap topic) |
| **Integration** | Telegram Bot API |
| **Deploy** | Vercel (production) |

---

## Getting Started

### 1. Get AVE API Keys

Register at [AVE Cloud](https://cloud.ave.ai/register) for free tier access.  
Activate Trading API at [cloud.ave.ai](https://cloud.ave.ai).

### 2. Configure Environment

```bash
cp .env.example .env.local
# Add your keys:
# VITE_AVE_API_KEY=       — Data API key
# VITE_AVE_BOT_KEY=       — Bot API access key
# VITE_AVE_BOT_SECRET=    — Bot API HMAC secret
```

### 3. Run Development Server

```bash
npm install
npm run dev
```

---

## Project Structure

```
src/
├── pages/TradePage.ts           # Full trading terminal
├── components/
│   ├── trade/                   # Order Entry, Open Orders, AI Agent, etc.
│   └── ave/                     # Watch panels (Trending, Signals, Whale, etc.)
├── services/ave/                # AVE API integration
│   ├── client.ts                # Data API v2 (9 endpoints)
│   ├── trading.ts               # Bot API (15 endpoints)
│   ├── websocket.ts             # Real-time order push
│   ├── ai-agent.ts              # Multi-analyst AI pipeline
│   ├── auto-agent.ts            # Auto-trading loop
│   └── ...                      # signals, monitor, portfolio, telegram
└── config/                      # IVEE branding + panel config

api/                             # Vercel Edge Functions
├── ave/index.ts                 # Data API CORS proxy
├── telegram/webhook.ts          # Telegram bot webhook
└── chart/[...path].ts           # Chart data proxy
```

---

## Hackathon Submission

- **Track:** Complete Application
- **Live Demo:** [https://ivee-apps.vercel.app](https://ivee-apps.vercel.app)
- **Telegram Bot:** [@ivee_team_bot](https://t.me/ivee_team_bot)
- **Full Docs:** [docs/SUBMISSION.md](docs/SUBMISSION.md)
- **Deadline:** April 15, 2026

---

## License

**MIT License** — Free for personal and commercial use.

---

<p align="center">
  <a href="https://cloud.ave.ai"><strong>AVE Cloud</strong></a> &nbsp;·&nbsp;
  <a href="https://docs-bot-api.ave.ai/en"><strong>Bot API Docs</strong></a> &nbsp;·&nbsp;
  <a href="https://clawhackathon.aveai.trade"><strong>Hackathon</strong></a>
</p>
