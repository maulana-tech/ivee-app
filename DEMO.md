# DEMO.md — IVEE NBA Demo Script

**Format:** 3–5 minute screen recording  
**Target:** DEGA NBA Playoffs Prediction Market Hackathon judges  
**App URL:** https://ivee-apps.vercel.app

---

## Before You Record

```bash
# 1. Start the dev server
npm run dev

# 2. Open browser → localhost:5173
# 3. Open terminal side-by-side (for CLI demo)
# 4. Clear execution logs (optional fresh start)
#    → Execution Logs panel → "Clear Logs" button
```

Browser: Chrome/Arc fullscreen, zoom 90%. Terminal: dark theme, font size 14+.

---

## Script (≈4 minutes)

### [0:00 – 0:30] Opening — What is IVEE NBA?

> *"IVEE NBA is an AI-powered prediction market automation dashboard for the NBA playoffs, built on Canon CLI. It runs 4 AI agents — market analyst, strategy architect, developer, and QA — to detect arbitrage opportunities and generate trade signals on Polymarket, with full risk management and structured execution logging."*

**Show:** Dashboard landing page, section nav tabs at top.

---

### [0:30 – 1:00] Live Data — Real NBA + Polymarket feeds

Click **Live** tab.

> *"The Live section pulls real data from balldontlie.io — today's playoff games, team standings, and injury reports. All panels fall back to mock data gracefully if the API is unavailable."*

Click **Markets** tab.

> *"The Markets section connects to the Polymarket Gamma API — no key required. We scan active NBA championship, conference, and player award markets. Here you can see live odds, volume, and real-time arbitrage spreads."*

**Show:** Markets panel (live odds), Arbitrage panel (spread percentages).

---

### [1:00 – 1:45] Strategy Analysis

Click **Analysis** tab.

> *"Cross-market analysis lets us correlate related NBA outcomes — when the championship market moves, the conference winner markets often lag. The Bracket panel tracks live playoff series from real API data."*

Click **Strategy** tab.

> *"The Strategy Dashboard and P&L Tracker read directly from DEGA Rank — these reflect real positions created by the automation pipeline, not hardcoded values."*

---

### [1:45 – 3:00] Automation — Canon AI Pipeline (key demo moment)

Click **Automation** tab.

> *"This is the core of the Canon integration. We have 4 strategy templates — Arbitrage Scanner, Momentum Trader, Cross-Market Correlator, and Speed Opportunity Scanner."*

**Click "▶ Run Once" on Arbitrage Scanner.**

> *"Watch the 8-step pipeline execute. Each phase has a real AI agent behind it."*

Walk through the steps as they appear:
1. `fetch-markets` — *"Pulling live NBA markets from Polymarket"*
2. `fetch-games` — *"Today's playoff schedule from balldontlie"*
3. `analyze-arb` — *"Market analyst scanning for price spreads"*
4. `build-signal` — *"Strategy architect designs the entry"*
5. `risk-check` — *"BrowserRiskAdapter: position size vs 5% portfolio limit"*
6. `execute` — *"Signal logged, order submitted (dry-run)"*

> *"Every step produces a structured log entry — type, timestamp, agent role, payload — written to both localStorage and .canon/execution/."*

---

### [3:00 – 3:30] Auto-Run — Cron-Based Automation

**Click "↻ Auto" on Arbitrage Scanner.**

> *"Auto-run sets a cron interval — every 5 minutes, the full pipeline re-runs automatically. The badge turns green and stays active until you stop it. This is how you'd run it continuously against live playoff markets."*

**Show:** Green pulsing badge, strategy running.

---

### [3:30 – 4:00] Execution Logs + CLI Demo

Click **Logs** tab.

> *"Every pipeline run — signal generated, risk decision, order submission — is captured here as structured JSONL. You can filter by type, download the full log, or view the raw entries."*

**Click "Download JSONL"** to show the file.

Switch to terminal:

```bash
npx tsx scripts/demo.ts --strategy arbitrage
```

> *"The same pipeline also runs from the terminal via Canon CLI. Here you can see real Polymarket API calls, 4-agent messages, the TradeSignal produced, risk check result, and the execution log written to .canon/execution/."*

**Show:** Full terminal output — spinner steps, agent messages, summary table, arb opportunities.

---

### [4:00 – 4:15] Closing

> *"IVEE NBA: real NBA data, live Polymarket odds, Canon-compliant AI agents, full risk management, and structured execution logs — all running in the browser and from the terminal. Thank you."*

**Show:** Final dashboard overview with all 6 tabs.

---

## Key Talking Points

| Topic | What to say |
|-------|-------------|
| Canon compliance | "`TradeSignal` and `RiskInterface` types implemented exactly as Canon spec requires" |
| Risk management | "Max 5% position size, daily loss circuit breaker, never bypassed" |
| Real data | "Polymarket Gamma API + balldontlie.io, both called live, mock fallback on error" |
| Execution logs | "Every decision logged as JSONL to `.canon/execution/` — judges can verify the run" |
| Innovation | "Full browser-based dashboard with live section nav, auto-run cron, agent message stream" |

---

## Submission Checklist

- [ ] Record 3–5 minute screen video using this script
- [ ] Upload video (YouTube unlisted or Loom)
- [ ] Confirm GitHub repo is public
- [ ] Verify `.canon/execution/` has at least one log file
- [ ] Submit before **May 31, 2026**

---

## Quick Commands Reference

```bash
npm run dev                                  # Start dashboard → localhost:5173
npx tsx scripts/demo.ts                      # Run CLI pipeline (arbitrage, dry-run)
npx tsx scripts/demo.ts --strategy momentum  # Momentum strategy
npx tsx scripts/demo.ts --strategy speed     # Speed opportunity
npx tsx scripts/demo.ts --live               # Mark log entries as live mode
npm run typecheck                            # Verify 0 TypeScript errors
```
