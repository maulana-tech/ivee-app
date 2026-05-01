# IVEE - DEGA NBA Playoffs Prediction Market Hackathon

**Variant** `nba` of the WorldMonitor platform.
**Deployed**: https://ivee-apps.vercel.app
**Status**: Submission-ready dashboard with full automation pipeline

---

## Hackathon Details

| Item | Value |
|------|-------|
| Event | DEGA NBA Playoffs Prediction Market Hackathon |
| Prize | $1,000 |
| Registration | May 4 – May 31, 2025 |
| Winners Announced | June 23, 2025 |
| Submission Deadline | May 31, 2025 |
| Judging Criteria | Innovation 25%, Technical Execution 30%, Real World Utility 30%, Presentation 15% |

---

## App Concept & Integration Plan

### Core Value Proposition
**AI-powered prediction market automation for NBA Playoffs** — real-time market scanning, arbitrage detection, and automated strategy execution with live AI agent decision-making visible to users.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    IVEE NBA Dashboard                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Live Games  │  │ Markets     │  │ Automation Engine   │ │
│  │ (balldontlie│  │ (Polymarket)│  │ (4 AI Agents)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Data Flow Integration                     │
│  1. Fetch NBA stats → 2. Fetch markets → 3. Run strategies │ │
│  4. AI agents analyze → 5. Decision → 6. Execute/Log       │ │
└─────────────────────────────────────────────────────────────┘
```

### Features (19 Panels)

| Panel | Function |
|-------|----------|
| **NbaLivePanel** | Live game scores, quarter/period, play-by-play |
| **NbaMarketsPanel** | Polymarket NBA prediction markets with prices/volumes |
| **NbaTeamsPanel** | Team standings, records, win streaks |
| **NbaArbPanel** | Real-time arbitrage opportunity detection |
| **NbaStrategyPanel** | Strategy template management and configuration |
| **NbaInjuryPanel** | Player injury reports with impact analysis |
| **NbaMomentumPanel** | Market momentum tracking (price trends, volume) |
| **NbaBracketPanel** | Interactive playoff bracket with series status |
| **NbaSpeedPanel** | Pre-game statistical edges (injuries, rest, travel) |
| **NbaPerformancePanel** | P&L tracker for all strategy positions |
| **NbaAutomationPanel** | **Main feature** — live pipeline visualization + terminal |

---

## Automation Engine (Canon-Equivalent)

### 4 Strategy Templates

| Strategy | Type | Description |
|----------|------|-------------|
| **Arbitrage Scanner** | `arbitrage` | Scan Yes+No price sums for mispricing >2% edge |
| **Momentum Trader** | `momentum` | Detect price trends + volume spikes |
| **Cross-Market Correlation** | `cross-market` | Find pricing lags between correlated markets |
| **Speed-Based Opportunity** | `speed` | Act on injury reports before markets adjust |

### Pipeline (8 Steps)

```
1. Fetch Market Data    → Polymarket prices, volumes
2. Fetch NBA Stats     → Team records, injuries, schedule
3. [Strategy-specific analysis]
4. AI Decision Engine  → 4 agents evaluate → generate signal
5. Risk Assessment     → Position limits, portfolio exposure
6. Execute Strategy    → Place position (or alert if auto-disabled)
7. Log & Monitor       → Record to DEGA Rank, update P&L
8. Wait for next cycle
```

### 4 AI Agents

| Agent | Role | Logs |
|-------|------|------|
| **Market Analyst** | Scan markets, fetch NBA data, find opportunities | "Found 6 active NBA markets..." |
| **Strategy Architect** | Analyze edges, detect patterns, design trades | "Detected 2 arbitrage opportunities..." |
| **Developer** | Execute decisions, API calls, order placement | "Executing: BUY YES $50..." |
| **QA** | Validate risk, check limits, log results | "Risk check PASSED — position $50 OK" |

### Demo Flow (Live in Automation Panel)

1. User clicks "Start Strategy"
2. Pipeline visual shows each step completing in real-time
3. Terminal updates with agent messages
4. Final decision displayed with confidence, edge, expected P&L
5. P&L updates in Performance Panel

---

## Technical Stack

- **Frontend**: Vanilla TypeScript, Vite, no React/Vue
- **NBA Data**: balldontlie.io API (mock fallback)
- **Markets**: Polymarket gamma API (public, no key)
- **Automation**: Custom engine (Canon-equivalent)
- **Deployment**: Vercel

---

## Commands

```bash
npm run dev              # Vite dev server (port 5173)
npm run lint             # Biome lint
npm run typecheck        # tsc --noEmit

npx vercel --prod --yes  # Deploy to production
```

---

## Non-Negotiable Rules

1. All strategies implement `TradeSignal` + `RiskInterface` types
2. Position size never >5% of portfolio
3. Domain layering: Types → Config → Repo → Service → Runtime → UI
4. Error messages include what/why/how
5. "If it's not in the repo, it doesn't exist"

---

## Project Structure

```
src/
├── config/
│   ├── variant.ts          # SITE_VARIANT = 'nba'
│   ├── panels.ts           # NBA_PANELS (19 keys)
│   └── feeds.ts            # NBA_FEEDS (ESPN, Polymarket, etc.)
├── services/nba/
│   ├── client.ts           # balldontlie API + mock
│   ├── prediction-market.ts # Polymarket API + arbitrage
│   ├── predictions.ts       # AI prediction model
│   └── automation-engine.ts # 4 strategies, pipeline, 4 agents
├── components/nba/         # 11 panels including automation
└── app/
    └── panel-layout.ts     # Panel registration
```

---

## Adding a New Panel

1. Add entry to `NBA_PANELS` in `src/config/panels.ts`
2. Add key to `VARIANT_DEFAULTS.nba` array
3. Add panel class in `src/components/nba/`
4. Register in `src/app/panel-layout.ts` `createPanels()`
5. Add CSS to `src/styles/nba-app.css`

---

## Submission Requirements

| Requirement | Status |
|-------------|--------|
| Project description | ✅ In AGENTS.md |
| GitHub repository | ⚠️ Need to create & push |
| Documentation | ✅ In AGENTS.md + inline comments |
| Demo video (3-5 min) | ⏳ User to record |
| DEGA Rank registration | ⏳ User to register at degarank.com |

---

## Environment Variables

```
VITE_NBA_API_KEY=        # balldontlie.io API key (optional — works without)
```

Polymarket gamma API is public, no key needed.

---

## Pre-existing TypeScript Errors

~30 TS errors in unrelated files (`wingbits.ts`, `export.ts`, etc.). Not from NBA code.

---

## Next Steps for Submission

1. **Create GitHub repo** and push all code
2. **Record demo video** (3-5 min showing automation panel)
3. **Register at DEGA Rank** (opens May 4)
4. **Submit before May 31** — description, repo URL, video link