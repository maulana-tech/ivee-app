# DEMO.md — IVEE NBA Demo Script

**Format:** 3–5 minute screen recording  
**Target:** DEGA NBA Playoffs Prediction Market Hackathon judges  
**App URL:** https://ivee-apps.vercel.app

---

## Before You Record

```bash
# 1. Start the dev server (optional — deployed app is live)
npm run dev

# 2. Open browser → https://ivee-apps.vercel.app (or localhost:5173)
# 3. Open terminal side-by-side (for CLI demo at the end)
```

Browser: Chrome/Arc fullscreen, zoom 90%. Terminal: dark theme, font size 14+.

---

## Layout Overview

The app has a **two-column layout**:
- **Left column (42%)** — hero panel, changes per section
- **Right column** — section nav tabs + card grid. Click any card to open it in a modal.

---

## Script (≈4 minutes)

### [0:00 – 0:30] Opening — What is IVEE NBA?

> *"IVEE NBA is an AI-powered prediction market automation dashboard for the NBA playoffs, built on Canon CLI. It runs 4 AI agents — Market Analyst, Strategy Architect, Developer, and QA — to detect arbitrage and momentum opportunities on Polymarket, with full risk management and structured execution logging."*

**Show:** Dashboard landing page. Left = Live Games hero panel. Right = section nav + card grid.

---

### [0:30 – 1:00] Live Data — Real NBA + Polymarket feeds

The **Live** tab is active by default. Left shows live game scores.

> *"The Live section pulls real playoff data from balldontlie.io. Today's games, scores, and status are shown in the left panel. If the API is unavailable, we fall back to mock data gracefully."*

Click the **Injury Report** card → modal opens.

> *"Each card opens in a full panel modal. Here you can see active player injury statuses — Out vs Questionable — pulled live from balldontlie."*

Close modal. Click **Markets** tab.

> *"The Markets section connects to the Polymarket Gamma API — no key required, fully public. Left panel shows live prediction market odds. Click Arbitrage to see real-time price spreads."*

Click the **Arbitrage** card → show the price spread scanner.

---

### [1:00 – 1:45] Analysis & Strategy

Click **Analysis** tab. Left shows the **Playoff Bracket** panel.

> *"Analysis shows the live 2025 playoff bracket and cross-market correlation data. The bracket tracks real series results from the API."*

Click **Strategy** tab. Left shows the **Strategy Dashboard**.

> *"The Strategy Dashboard and P&L Tracker read from DEGA Rank — these reflect real positions created by the automation pipeline, not hardcoded values."*

Click the **P&L Tracker** card to show portfolio metrics.

---

### [1:45 – 3:00] Automation — Canon AI Pipeline (key demo moment)

Click **Automation** tab.

Left panel: **AI Agent Dashboard** — shows 4 agents (Market Analyst, Strategy Architect, Developer, QA) and the pipeline terminal.

> *"This is the Canon integration core. The left panel is our AI Agent Dashboard — it shows each agent's live status as the pipeline runs."*

> *"On the right, we have 4 strategy templates registered with the automation engine."*

Click the **Automation Engine** card → modal opens.

> *"The Automation Engine modal shows our strategy templates, pipeline progress, and agent console."*

**Click "▶ Run Once" on Arbitrage Scanner.**

> *"Watch the 8-step pipeline execute in real time. Each step maps to a specific AI agent phase."*

Walk through the steps as they appear:
1. `Fetch Market Data` — *"Market Analyst: pulling live NBA markets from Polymarket Gamma API"*
2. `Fetch NBA Statistics` — *"Today's playoff schedule, standings, injury data from balldontlie"*
3. `Scan Arbitrage Opportunities` — *"Strategy Architect: computing Yes+No price sums, flagging mispricings"*
4. `AI Decision Engine` — *"Developer agent: evaluating all signals, picks the best market and side"*
5. `Risk Assessment` — *"BrowserRiskAdapter: position size vs 5% portfolio cap, daily loss limit"*
6. `Execute Strategy` — *"Signal submitted — dry-run mode, no real funds moved"*
7. `Log & Monitor` — *"Every decision written to localStorage and .canon/execution/ as JSONL"*

> *"The result: a structured decision — BUY YES or BUY NO — with confidence %, edge %, and expected P&L."*

**Close the modal** — watch the AI Agent Dashboard (left panel) update with agent activity and terminal logs.

---

### [3:00 – 3:30] Auto-Run — Scheduled Automation

Open Automation Engine card again. **Click "↻ Auto" on Arbitrage Scanner.**

> *"Auto-run sets a cron schedule — every 5 minutes the full 8-step pipeline re-runs automatically. The badge turns active and stays running until you stop it. This is how you'd run it continuously against live playoff markets throughout the day."*

**Show:** Active badge on the Auto button, pipeline re-triggering.

---

### [3:30 – 4:00] Execution Logs + CLI Demo

Click **Logs** tab. Left shows the **Execution Logs** panel with all pipeline runs.

> *"Every pipeline run is captured here as structured JSONL entries — signal type, timestamp, agent role, market ID, payload. You can filter by type or download the full log."*

**Click "Download JSONL"** to show the file export.

Switch to terminal:

```bash
npx tsx scripts/demo.ts --strategy arbitrage
```

> *"The identical pipeline also runs from the terminal via Canon CLI. Same Polymarket API calls, same 4 agent messages, same TradeSignal output, same risk check — and the execution log written to .canon/execution/."*

**Show:** Full terminal output — spinner steps, agent messages, summary table, arb opportunities listed.

---

### [4:00 – 4:15] Closing

> *"IVEE NBA: real NBA data from balldontlie, live Polymarket prediction market odds, Canon-compliant AI agents, full risk management with the 5% position cap, and structured JSONL execution logs — running both in the browser dashboard and from the terminal. Thank you."*

**Show:** Overview of the 6-tab layout with all sections.

---

## Key Talking Points

| Topic | What to say |
|-------|-------------|
| Canon compliance | "`TradeSignal` and `RiskInterface` types implemented exactly as Canon spec requires" |
| Risk management | "Max 5% position size, daily loss circuit breaker, never bypassed" |
| Real data | "Polymarket Gamma API + balldontlie.io, both called live, mock fallback on error" |
| Execution logs | "Every decision logged as JSONL to `.canon/execution/` — judges can verify each run" |
| UI innovation | "Two-column live dashboard — contextual left panel per section, card grid with modal drill-down, auto-run cron, agent message stream" |
| 4 AI agents | "Market Analyst, Strategy Architect, Developer, QA — each logs messages to the terminal as the pipeline progresses" |

---

## Submission Checklist

- [ ] Record 3–5 minute screen video using this script
- [ ] Upload video (YouTube unlisted or Loom)
- [ ] Confirm GitHub repo is public
- [ ] Verify `.canon/execution/` has at least one log file after running the CLI demo
- [ ] Submit before **May 31, 2026**

---

## Quick Commands Reference

```bash
npm run dev                                  # Start dashboard → localhost:5173
npx tsx scripts/demo.ts                      # Run CLI pipeline (arbitrage, dry-run)
npx tsx scripts/demo.ts --strategy momentum  # Momentum strategy
npx tsx scripts/demo.ts --strategy speed     # Speed opportunity
npx tsx scripts/demo.ts --live               # Mark log entries as live mode
npm run typecheck                            # Verify TypeScript
npm run build                                # Production build
npx vercel --prod --yes                      # Deploy to production
```
