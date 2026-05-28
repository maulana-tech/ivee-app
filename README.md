# IVEE NBA — AI Prediction Market Automation

**AI-powered NBA playoffs prediction market automation dashboard** — built on Canon CLI for the DEGA NBA Playoffs Prediction Market Hackathon.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live Demo:** [https://ivee-apps.vercel.app](https://ivee-apps.vercel.app)  
**Demo Script:** [DEMO.md](DEMO.md)  
**Hackathon:** [DEGA NBA Playoffs Prediction Market Hackathon](docs/dega-hackathon.md)

---

## What It Does

IVEE NBA is a real-time intelligence dashboard that automates trading strategies on NBA playoff prediction markets (Polymarket). It integrates Canon CLI's 4-agent AI pipeline — market analyst, strategy architect, developer, and QA — to scan opportunities, generate trade signals, run risk checks, and log every decision to `.canon/execution/`.

**Strategy focus:** Arbitrage Detection across NBA championship, conference, and player award markets.

---

## Features

### 6-Section Dashboard

| Section | Panels | Data Source |
|---------|--------|-------------|
| **Live** | Games, Standings, Injuries, Schedule | balldontlie.io API |
| **Markets** | Markets, Arbitrage, Momentum, Speed Opps, Fear & Greed | Polymarket Gamma API |
| **Analysis** | Teams, Bracket, Cross-Market | balldontlie + Polymarket |
| **Strategy** | Strategy Dashboard, P&L Tracker | DEGA Rank + Canon Bridge |
| **Automation** | AI Agent Pipeline (4 strategies) | AutomationEngine + Canon |
| **Logs** | Execution Logs (JSONL) | localStorage / `.canon/execution/` |

### AI Trading Pipeline (Canon Architecture)

4-agent workflow running on every automation cycle:

```
market-analyst → strategy-architect → developer → qa
      ↓                ↓                  ↓          ↓
  Scan NBA         Design entry        Validate     Pre-flight
  markets          approach            signal       checks
      └──────────────────┴──────────────────┴──────────┘
                              ↓
                    TradeSignal (RiskInterface checked)
                              ↓
                    BrowserRiskAdapter.preTradeCheck()
                    • Max position: 5% of portfolio
                    • Daily loss circuit breaker
                              ↓
                    Execution Log → .canon/execution/YYYY-MM-DD.jsonl
```

### 4 Built-in Strategies

| Strategy | Type | Description |
|----------|------|-------------|
| **Arbitrage Scanner** | `arbitrage` | Detect price spreads across NBA playoff markets |
| **Momentum Trader** | `momentum` | Capitalize on sustained directional movements |
| **Cross-Market Correlator** | `cross-market` | Exploit lag between correlated outcome markets |
| **Speed Opportunity Scanner** | `speed` | Act on injury/stats data before odds adjust |

Each strategy supports:
- **Run Once** — single pipeline execution
- **Auto-Run** — cron-based interval (e.g. `*/5 * * * *`)
- Real-time agent messages and step-by-step pipeline view

### Risk Management

- `BrowserRiskAdapter` implements `RiskInterface` from `types/RiskInterface.ts`
- Max position size: 5% of portfolio value
- Daily loss circuit breaker via `localStorage`
- All decisions logged with `TradeSignal` + `RiskDecision` types

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TypeScript, Vite, Vanilla DOM (no React) |
| NBA Data | balldontlie.io (free + paid endpoints) |
| Markets | Polymarket Gamma API (public, no key needed) |
| Canon Integration | Canon bridge + 4-agent AI pipeline |
| Risk | `RiskInterface` + `TradeSignal` typed interfaces |
| Logging | localStorage JSONL (browser) + `.canon/execution/` (CLI) |
| Deploy | Vercel |

---

## Getting Started

```bash
# Install
npm install

# Dev server (localhost:5173)
npm run dev

# Run demo pipeline (terminal)
npx tsx scripts/demo.ts

# Run a specific strategy
npx tsx scripts/demo.ts --strategy momentum

# Type check
npm run typecheck

# Full gate (typecheck + lint + tests)
npm run check
```

### Environment Variables (optional)

```bash
VITE_NBA_API_KEY=    # balldontlie.io — enables /standings and /injuries
                     # Free endpoints (games, teams) work without key
```

Polymarket Gamma API is public — no key required. All panels gracefully fall back to mock data when APIs are unavailable.

---

## Project Structure

```
src/
├── components/nba/          # 14 NBA panel components
│   ├── NbaAutomationPanel   # AI agent pipeline UI + auto-run
│   ├── NbaExecutionLogsPanel# JSONL log viewer + download
│   ├── NbaMarketsPanel      # Polymarket live markets
│   ├── NbaArbPanel          # Arbitrage opportunity scanner
│   └── ...                  # Live, Standings, Injuries, etc.
├── services/nba/
│   ├── automation-engine.ts # 4 strategies, 8-step pipeline, auto-run
│   ├── canon-bridge.ts      # Canon CLI integration + BrowserRiskAdapter
│   ├── browser-execution-log.ts  # localStorage JSONL log (500 entry cap)
│   ├── dega-rank.ts         # DEGA Rank positions + performance
│   ├── prediction-market.ts # Polymarket Gamma API + arbitrage
│   ├── client.ts            # balldontlie NBA API + mock fallback
│   └── predictions.ts       # Game prediction model
├── config/
│   ├── variant.ts           # SITE_VARIANT = 'nba'
│   └── panels.ts            # Panel registry
└── app/
    ├── panel-layout.ts      # Panel lifecycle + section nav
    └── app-context.ts       # Shared state

types/
├── TradeSignal.ts           # Signal interface (automation_id, direction, size…)
└── RiskInterface.ts         # Risk check interface

strategies/                  # Canon strategy templates
.canon/
├── execution/               # JSONL execution logs
└── state.json
scripts/
└── demo.ts                  # Terminal demo runner (Canon pipeline)
```

---

## Automation Logs

Every pipeline run writes structured JSONL entries to `.canon/execution/YYYY-MM-DD.jsonl`:

```jsonl
{"type":"run_start","run_id":"run-1748389201","strategy":"Arbitrage Scanner","mode":"dry-run","timestamp":"2026-05-28T…"}
{"type":"data_fetch","source":"polymarket","count":6,"timestamp":"…"}
{"type":"agent_message","role":"market-analyst","content":"Found 3 spread opportunities…","timestamp":"…"}
{"type":"signal","market":"Will the Celtics win?","direction":"buy_yes","size":25,"confidence":0.78,"timestamp":"…"}
{"type":"risk_check","approved":true,"size":25,"limit":50,"timestamp":"…"}
{"type":"order_submit","status":"dry-run","order_id":"ord-mpp9ox1l","timestamp":"…"}
{"type":"run_complete","status":"success","expected_pnl":0.6,"timestamp":"…"}
```

Logs are also viewable in the **Execution Logs** panel in the dashboard and exportable as JSONL.

---

## Hackathon Submission

- **Event:** DEGA NBA Playoffs Prediction Market Hackathon
- **Strategy:** Arbitrage Detection + Speed-Based Opportunity
- **Canon Integration:** 4-agent pipeline, `TradeSignal`, `RiskInterface`, execution logs
- **Demo Video:** [DEMO.md](DEMO.md) — 3–5 minute walkthrough script
- **Deadline:** May 31, 2026

---

## License

MIT — Free for personal and commercial use.
