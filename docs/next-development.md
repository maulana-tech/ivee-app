# IVEE - Next Development Roadmap

## Current Status (April 2026)

### Completed
- [x] 27 crypto panels rendering with live data
- [x] Trade Chart with interactive token selector + intervals (CoinGecko)
- [x] AVE Trade API integration (quote → create tx → MetaMask sign → send)
- [x] AVE API Secret + HMAC-SHA256 signing for proxy wallet (market orders, limit orders)
- [x] Proxy wallet created: `98ca754913164d7ca9085a163799632e`
- [x] Single CoinGecko fetch with 90s cache + fallback data
- [x] Panel dragging disabled for crypto variant
- [x] CSP headers fixed in vercel.json
- [x] Bootstrap endpoint stub
- [x] All API endpoints returning real data
- [x] Deployed at https://ivee-apps.vercel.app
- [x] **Phase 1**: TypeScript variant narrowing fixed
- [x] **Phase 1**: SignalsPanel 3-arg bug fixed
- [x] **Phase 1**: Vercel CDN cache headers (s-maxage=90)
- [x] **Phase 2.1**: Real technical analysis (RSI, MACD, Bollinger Bands) from AVE kline data
- [x] **Phase 2.2**: Real sentiment analysis (news, fear/greed, AVE trending)
- [x] **Phase 2.3**: Auto-trading agent loop (analyze → decide → execute via proxy wallet)
- [x] **Phase 2.3**: Start/Stop agent UI in TradingPanel with live stats
- [x] **Phase 3.2**: Mobile responsive (single column, touch-friendly chart, no drag)
- [x] **Phase 3.3**: Panel fullscreen mode (F key, ESC to exit)
- [x] **Phase 3.4**: Keyboard shortcuts (R refresh, F fullscreen, ESC exit)

### Known Issues
- [ ] CoinGecko rate limiting (429) — mitigated with fallback data but real data sometimes empty
- [ ] `toApiUrl()` returns relative path — only works when served from same origin
- [ ] TypeScript errors from hardcoded `SITE_VARIANT = 'crypto'` (variant narrowing)
- [ ] SignalsPanel calls `getTrendingTokens()` with 3 args (expects 0-2)
- [ ] Wallet disconnect only shows message (MetaMask limitation)

---

## Phase 1: Polish & Fix (Priority: HIGH)

### 1.1 CoinGecko Pro API Key
CoinGecko free tier has aggressive rate limits. For production:
- Add CoinGecko Pro API key (`x-cg-pro-api-key` header)
- Or use proxy with request deduplication
- File: `server/ivee/market/v1/handler.ts`

### 1.2 Fix TypeScript Errors
The `SITE_VARIANT = 'crypto'` causes type narrowing errors across ~20 files.
- Change `variant.ts` to use a union type that includes 'crypto'
- Or cast `SITE_VARIANT as SiteVariant` where needed
- Files: `variant.ts`, `variant-meta.ts`, `panels.ts`

### 1.3 Signals Panel Fix
`src/components/ave/SignalsPanel.ts:98` calls `getTrendingTokens()` with 3 args.
- Fix to match the function signature (0-2 args)
- File: `src/components/ave/SignalsPanel.ts`

### 1.4 Panel Loading States
Some panels show "Loading..." text without a spinner or skeleton.
- Add consistent loading skeleton to all panels
- Files: All `*Panel.ts` in `src/components/ave/` and `src/components/`

---

## Phase 2: AI Trading Agent Enhancement (Priority: HIGH)

### 2.1 Real Technical Analysis
Current AI agent uses local math. Enhance with real indicators:
- **RSI** (Relative Strength Index) from kline data
- **MACD** (Moving Average Convergence Divergence)
- **Bollinger Bands** for volatility
- **Volume Profile** for support/resistance
- Use AVE kline API: `/v2/klines/token/{id}?interval=1h&limit=100`
- File: `src/services/ave/ai-agent.ts`

### 2.2 Real Sentiment Analysis
Current sentiment is stubbed. Connect to real sources:
- AVE trending tokens (volume spikes = sentiment signal)
- News sentiment from `/api/news/v1/list-news`
- Fear & Greed index correlation
- Whale wallet activity as sentiment proxy
- File: `src/services/ave/ai-agent.ts`

### 2.3 Auto-Trading Agent Loop
Create a continuous agent that runs on a timer:
```
Every 5 minutes:
1. Pick top trending token from AVE
2. Run full analysis (fundamental + technical + sentiment)
3. If confidence > 70% and risk approved → execute trade
4. Log results, track PnL
5. Display in Trading Panel with live updates
```
- File: `src/services/ave/auto-agent.ts`
- New panel or integrate into TradingPanel

### 2.4 Multi-Chain Support
Currently hardcoded to Base. Add:
- Ethereum mainnet (chain: 'eth')
- BSC (chain: 'bsc')  
- Solana (chain: 'solana') — different tx flow
- Chain selector in TradingPanel
- File: `src/services/ave/trading.ts`, `TradingPanel.ts`

---

## Phase 3: UX & Design (Priority: MEDIUM)

### 3.1 Dark/Light Theme Toggle
Currently dark only. Add light theme:
- CSS variables for all colors
- Toggle in settings or header
- Persist preference in localStorage
- Files: `src/styles/`, `UnifiedSettings.ts`

### 3.2 Mobile Responsive
Dashboard is desktop-only. Add responsive layout:
- Stack panels vertically on mobile
- Collapsible sidebar
- Touch-friendly chart interactions
- File: `src/app/panel-layout.ts`, CSS

### 3.3 Panel Fullscreen Mode
TradeChart has fullscreen button but it's not implemented:
- ESC to close fullscreen
- Expanded chart with more detail
- Volume bars below chart
- Order book overlay
- Files: `TradeChartPanel.ts`, `panel-layout.ts`

### 3.4 Keyboard Shortcuts
- `1-4` switch intervals on Trade Chart
- `↑↓` cycle through tokens
- `F` fullscreen active panel
- `R` refresh data
- File: `src/app/keyboard.ts` (new)

---

## Phase 4: Real-Time Data (Priority: MEDIUM)

### 4.1 WebSocket Price Feed
Currently polling CoinGecko every 90s. Add real-time:
- Use CoinGecko WebSocket or AVE WebSocket
- Live price ticker in header
- Auto-update chart without full reload
- Flash green/red on price change
- File: `src/services/realtime.ts` (new)

### 4.2 Live Whale Alerts
Current whale alerts are simulated from AVE trending:
- Use AVE swap transaction API for real whale tracking
- Filter for transactions > $100K
- Show in real-time with WebSocket push
- Audio alert for mega whales (> $1M)
- File: `src/components/ave/WhaleAlertPanel.ts`

### 4.3 Live Portfolio Tracking
Portfolio shows static demo positions:
- Auto-import wallet holdings via `eth_getBalance` + ERC-20 balances
- Track PnL in real-time
- Show entry price from first trade
- File: `src/components/ave/PortfolioPanel.ts`

---

## Phase 5: Advanced Features (Priority: LOW)

### 5.1 Limit Orders via AVE Bot Wallet ✅ DONE
AVE supports limit orders via proxy wallet:
- [x] `POST /v1/thirdParty/tx/sendLimitOrder` — `sendLimitOrder()`
- [x] `POST /v1/thirdParty/tx/cancelLimitOrder` — `cancelLimitOrder()`
- [x] `sendMarketOrder()` for auto-trading without MetaMask
- [x] `createProxyWallet()` / `getProxyWallets()` / `deleteProxyWallet()`
- [x] HMAC-SHA256 signing via Web Crypto API
- [ ] Stop-loss / take-profit automation (autoSellConfig)
- [ ] Trailing stop orders

### 5.2 Multi-Agent Debate Visualization
Current AI agent runs locally. Visualize the debate:
- Animated panel showing bull vs bear arguments
- Confidence meter with real-time updates
- Historical debate results chart
- File: `src/components/ave/TradingPanel.ts`

### 5.3 Backtesting Engine
BacktestPanel exists but uses simulated data:
- Use real AVE kline data for historical backtesting
- Show equity curve
- Calculate Sharpe ratio, max drawdown
- Compare strategies (RSI, MACD, momentum)
- File: `src/components/ave/BacktestPanel.ts`

### 5.4 Social Features
- Share trade ideas via URL
- Community leaderboard
- Copy trading (follow top traders)
- File: new `src/services/social.ts`

### 5.5 AVE Deep Integration
More AVE API endpoints to use:
- Token risk scoring (`/tokens/risk`)
- Top holders analysis
- Holder PnL tracking
- New token launch alerts
- Pair analysis with AMM info

---

## Architecture Notes

### File Structure
```
src/
├── components/ave/        # Crypto panels (keep)
├── components/            # Generic panels (keep)
├── services/ave/          # AVE API (keep, enhance)
│   ├── client.ts          # Data API client
│   ├── trading.ts         # Trade API (quote/create/sign/send)
│   ├── ai-agent.ts        # Multi-analyst AI
│   └── signals.ts         # Signal generation
├── services/realtime.ts   # WebSocket feeds (NEW)
├── services/ave/auto-agent.ts  # Auto trading loop (NEW)
├── app/panel-layout.ts    # Layout engine
└── config/                # Variant configs

api/
├── chart/[...path].ts     # CoinGecko chart proxy
├── market/v1/[rpc].ts     # Market data RPC
├── news/v1/[rpc].ts       # News API
├── economic/v1/[rpc].ts   # Economic calendar
└── bootstrap.ts           # Bootstrap stub

server/ivee/market/v1/
└── handler.ts             # Single CoinGecko fetch + cache
```

### Key APIs
| API | Base URL | Auth | Use |
|-----|----------|------|-----|
| AVE Data | `https://prod.ave-api.com/v2` | `X-API-KEY` header | Token data, trending, klines |
| AVE Trade | `https://bot-api.ave.ai` | `AVE-ACCESS-KEY` header | Quote, create tx, send tx |
| AVE Bot Wallet | `https://bot-api.ave.ai` | `AVE-ACCESS-KEY` + HMAC `AVE-ACCESS-SIGN` | Proxy wallet, market/limit orders |
| CoinGecko | `https://api.coingecko.com/api/v3` | None (free) | Market data, charts |
| Fear & Greed | `https://alternative.me/crypto/api/` | None | Sentiment index |

### AVE Trade Flow (EVM - Base)
```
1. Quote:    POST /v1/thirdParty/chainWallet/getAmountOut
2. Create:   POST /v1/thirdParty/chainWallet/createEvmTx  
3. Sign:     MetaMask eth_sendTransaction (client-side)
4. Send:     POST /v1/thirdParty/chainWallet/sendSignedEvmTx
```
