# IVEE NBA - Deployment Guide

## Current Build Status
```
✓ Build: Success
✓ TypeScript: 0 errors
✓ Variant: nba (DEGA NBA Playoffs Prediction Market)
✓ All 16 NBA Panels: Registered
```

---

## 1. Quick Deploy

```bash
# Install dependencies
npm install

# Build
npm run build

# Deploy to Vercel (production)
npx vercel --prod --yes
```

---

## 2. Environment Variables

### Required for full functionality:
```
VITE_NBA_API_KEY=       # balldontlie.io — needed for /standings and /injuries endpoints
                        # Free endpoints (games, teams) work without key
```

### Optional:
```
VITE_SENTRY_DSN=        # Error tracking
VITE_AVE_API_KEY=       # AVE Data API (crypto variant only)
```

> **Note:** Polymarket Gamma API is public — no key needed. All panels have mock fallbacks for when APIs are unavailable.

---

## 3. Vercel Project Settings

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node Version | 18+ |

---

## 4. Data Sources & Panel Status

| Panel | Data Source | API Key Required | Fallback |
|-------|------------|-----------------|---------|
| Live Games | balldontlie.io `/games` | No | Mock games |
| Standings | balldontlie.io `/standings` | Yes | Mock standings |
| Injuries | balldontlie.io `/injuries` | Yes | Mock injuries |
| Schedule | balldontlie.io `/games` | No | Mock schedule |
| Markets | Polymarket Gamma API | No | Mock markets |
| Arbitrage | Polymarket Gamma API | No | Mock arb |
| Momentum | Polymarket Gamma API | No | Mock momentum |
| Speed Opps | injuries + games API | Yes (injuries) | Mock opportunities |
| Fear & Greed | Computed from markets | No | Computed |
| Teams | balldontlie.io `/teams` | No | Mock teams |
| Bracket | balldontlie.io `/games?postseason=true` | No | Mock bracket |
| Cross-Market | Polymarket + NBA | No | Mock |
| Strategy | DEGA Rank positions | No | Mock positions |
| Performance | DEGA Rank positions | No | Mock positions |
| Automation | AutomationEngine + Polymarket | No | — |
| Execution Logs | localStorage (browser) | No | — |

---

## 5. Canon CLI Integration

The app integrates with DEGA Canon CLI for AI trading agents:

```
.canon/
  agents/          # AI agent definitions
  skills/          # Reusable strategy skills
  workflows/       # Automation pipelines
```

Execution logs are stored in `localStorage` key `canon-execution-log` and exportable as JSONL from the Execution Logs panel.

---

## 6. Pre-Deploy Checklist

- [x] TypeScript: 0 errors (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] All 16 panels registered
- [x] Real API calls with mock fallbacks
- [x] Auto-run cron intervals working
- [x] Execution log persistence (localStorage)
- [x] Section nav (Live / Markets / Analysis / Strategy / Automation / Logs)
- [ ] Set `VITE_NBA_API_KEY` in Vercel environment variables
- [ ] Test production build: `npm run build && npx serve dist`
- [ ] Verify Polymarket panels load (no key needed)

---

## 7. Local Development

```bash
# Dev server (Vite, port 5173)
npm run dev

# Full stack (Vite + Express)
npm run dev:all

# Type check
npm run typecheck

# Run tests
npm run test

# Full gate (typecheck + lint + tests)
npm run check
```

---

## 8. Post-Deploy Verification

1. **Section nav** — click all 6 tabs (Live, Markets, Analysis, Strategy, Automation, Logs)
2. **Live data** — Live Games panel shows today's games or "No games today"
3. **Markets panel** — Polymarket data loads (no key needed)
4. **Automation** — Run Once on any strategy produces an Execution Log entry
5. **Auto-run** — Toggle Auto on a strategy; badge turns green
6. **Execution Logs** — Entries appear after running automation; JSONL download works

---

## 9. Architecture Notes

- **Variant system**: `VITE_VARIANT=nba` sets NBA mode. Other variants (crypto, finance, etc.) exist but are not the focus.
- **No React/Vue**: Pure TypeScript + Vite, DOM via class-based Panel components.
- **Domain layering**: Types → Config → Services → Components → App (no upward imports).
- **Risk limits**: Max position size 5% of portfolio, enforced in `BrowserRiskAdapter`.
