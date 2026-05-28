# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read and follow all instructions in [AGENTS.md](AGENTS.md).

---

## Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run dev:all      # Vite + Express server concurrently
npm run server       # Express server only (tsx server/index.ts)
npm run build        # Vite production build
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint
npm run test         # vitest (tests in __tests__/)
npm run check        # tsc + oxlint + vitest (full gate)

npx vercel --prod --yes   # Deploy to production
```

Run a single test file:
```bash
npx vitest run __tests__/execution-log.test.ts
```

---

## Architecture

**Multi-variant real-time intelligence dashboard** — vanilla TypeScript + Vite, no React/Vue. Currently deployed as the `nba` variant (DEGA NBA Playoffs Prediction Market hackathon).

### Variant System

`SITE_VARIANT` in `src/config/variant.ts` controls which panels, feeds, and meta are active. Supported variants: `full` (geopolitical), `tech`, `finance`, `crypto`, `commodity`, `happy`, `nba`. All variant metadata lives in `src/config/variant-meta.ts`; panel sets in `src/config/panels.ts`.

The Vite build reads `VITE_VARIANT` env var to select the variant build; `src/config/variant.ts` is the runtime source of truth.

### Domain Layering (strict, enforced by convention)

```
Types (src/types/)
  → Config (src/config/)
    → Services (src/services/)
      → Components (src/components/)
        → App (src/app/)
```

Import only downward — services must not import from components; config must not import from services (except the three annotated exceptions in `src/config/panels.ts`).

### Panel System

All panels extend `Panel` (`src/components/Panel.ts`). `AppContext` (`src/app/app-context.ts`) is the shared mutable state bag passed to every panel. `PanelLayoutManager` (`src/app/panel-layout.ts`) owns panel lifecycle, drag-and-drop order, and premium gating.

To add a panel (NBA variant):
1. Add entry to `NBA_PANELS` in `src/config/panels.ts`
2. Add key to `VARIANT_DEFAULTS.nba` array
3. Add panel class in `src/components/nba/`
4. Register in `src/app/panel-layout.ts` `createPanels()` inside the NBA guard
5. Add CSS to `src/styles/nba-app.css`

### NBA-Specific Services (`src/services/nba/`)

| File | Purpose |
|------|---------|
| `client.ts` | balldontlie API + mock fallback |
| `prediction-market.ts` | Polymarket gamma API + arbitrage |
| `automation-engine.ts` | 4 strategy templates, 8-step pipeline, 4 AI agents |
| `canon-bridge.ts` | DEGA Canon CLI integration |
| `dega-rank.ts` | DEGA Rank leaderboard API |

### Backend / Edge Functions

`server/index.ts` — Express dev server. `api/` — Vercel edge functions (CORS proxy for AVE Data API, Telegram webhook, OAuth, chart data).

### Path Alias

`@/` resolves to `src/` (configured in vite.config.ts and tsconfig).

---

## Non-Negotiable Rules

1. All trading strategies implement `TradeSignal` + `RiskInterface` types
2. Position size never >5% of portfolio
3. Domain layering: Types → Config → Services → Components → App (no upward imports)
4. All SITE_VARIANT-specific panel creation must be wrapped in `if (SITE_VARIANT === 'nba')` guards in `panel-layout.ts`

---

## Environment Variables

```
VITE_NBA_API_KEY=      # balldontlie.io (optional — mock fallback works without it)
VITE_SENTRY_DSN=       # Sentry error tracking
VITE_AVE_API_KEY=      # AVE Data API (crypto variant)
VITE_AVE_BOT_KEY=      # AVE Bot API access key
VITE_AVE_BOT_SECRET=   # AVE Bot API HMAC secret
```

Polymarket gamma API is public — no key needed.

---

## Known Pre-existing Issues

~30 TypeScript errors exist in unrelated files (`wingbits.ts`, `export.ts`, etc.) that predate the NBA codebase. Do not treat these as regressions.
