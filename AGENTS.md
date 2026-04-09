# AGENTS.md

Agent entry point for WorldMonitor. Read this first, then follow links for depth.

## What This Project Is

Real-time global intelligence dashboard. TypeScript SPA (Vite + Preact) with 86 panel components, 60+ Vercel Edge API endpoints, a Tauri desktop app with Node.js sidecar, and a Railway relay service. Aggregates 30+ external data sources (geopolitics, military, finance, climate, cyber, maritime, aviation).

## Repository Map

```
.
├── src/                    # Browser SPA (TypeScript, class-based components)
│   ├── app/                # App orchestration (data-loader, refresh-scheduler, panel-layout)
│   ├── components/         # 86 UI panels + map components (Panel subclasses)
│   ├── config/             # Variant configs, panel/layer definitions, market symbols
│   ├── services/           # Business logic (120+ service files, organized by domain)
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Shared utilities (circuit-breaker, theme, URL state, DOM)
│   ├── workers/            # Web Workers (analysis, ML/ONNX, vector DB)
│   ├── generated/          # Proto-generated client/server stubs (DO NOT EDIT)
│   ├── locales/            # i18n translation files
│   └── App.ts              # Main application entry
├── api/                    # Vercel Edge Functions (plain JS, self-contained)
│   ├── _*.js               # Shared helpers (CORS, rate-limit, API key, relay)
│   ├── health.js           # Health check endpoint
│   ├── bootstrap.js        # Bulk data hydration endpoint
│   └── <domain>/           # Domain-specific endpoints (aviation/, climate/, etc.)
├── server/                 # Server-side shared code (used by Edge Functions)
│   ├── _shared/            # Redis, rate-limit, LLM, caching, response headers
│   ├── gateway.ts          # Domain gateway factory (CORS, auth, cache tiers)
│   ├── router.ts           # Route matching
│   └── worldmonitor/       # Domain handlers (mirrors proto service structure)
├── proto/                  # Protobuf definitions (sebuf framework)
│   ├── buf.yaml            # Buf configuration
│   └── worldmonitor/       # Service definitions with HTTP annotations
├── shared/                 # Cross-platform data (JSON configs for markets, RSS domains)
├── scripts/                # Seed scripts, build helpers, data fetchers
├── src-tauri/              # Tauri desktop shell (Rust + Node.js sidecar)
│   └── sidecar/            # Node.js sidecar API server
├── tests/                  # Unit/integration tests (node:test runner)
├── e2e/                    # Playwright E2E specs
├── docs/                   # Mintlify documentation site
├── docker/                 # Docker build for Railway services
├── deploy/                 # Deployment configs
└── blog-site/              # Static blog (built into public/blog/)
```

## Dev Commands

```bash
npm install              # Install deps (also blog-site postinstall)
npm run lint             # Biome lint (src, server, api, tests, e2e, scripts)
npm run lint:fix         # Auto-fix lint issues
npm run lint:boundaries  # Architectural boundary check (types→config→services→components→app)
npm run typecheck        # tsc --noEmit (src only)
npm run typecheck:api    # tsc --noEmit for API layer
npm run typecheck:all    # Both typechecks
npm run dev              # Vite dev server (full variant)
npm run dev:tech         # Tech variant
npm run dev:finance      # Finance variant
npm run test:data        # Unit/integration tests (node:test runner)
npm run test:sidecar     # Sidecar + API handler tests
npm run test:e2e         # All E2E tests
npm run test:e2e:runtime # Single E2E spec (fast iteration)
make generate            # Regenerate proto stubs (requires buf + sebuf plugins)
```

## Architecture Rules

### Dependency Direction

```
types -> config -> services -> components -> app -> App.ts
```

- `types/` has zero internal imports
- `config/` imports only from `types/`
- `services/` imports from `types/` and `config/`
- `components/` imports from all above
- `app/` orchestrates components and services
- Enforced by `npm run lint:boundaries` (pre-push hook + CI)

### API Layer Constraints

**Legacy `api/*.js` (self-contained Edge Functions):**

- CANNOT import from `../src/` or `../server/` (different runtime)
- Only same-directory `_*.js` helpers and npm packages
- Enforced by `tests/edge-functions.test.mjs` and pre-push esbuild check

**RPC `api/**/*.ts` (sebuf-generated):**

- May import `server/` and `src/generated/`
- Must NOT import `src/` non-generated paths (components, services, config)

### Server Layer

- `server/` code is bundled INTO Edge Functions at deploy time via gateway
- `server/_shared/` contains Redis client, rate limiting, LLM helpers
- `server/worldmonitor/<domain>/` has RPC handlers matching proto services
- `server/` must NOT import from `src/components/` or `src/app/`
- All handlers use `cachedFetchJson()` for Redis caching with stampede protection

### Proto Contract Flow

```
proto/ definitions -> buf generate -> src/generated/{client,server}/ -> handlers wire up
```

- GET fields need `(sebuf.http.query)` annotation
- `repeated string` fields need `parseStringArray()` in handler
- `int64` maps to `string` in TypeScript
- CI checks proto freshness via `.github/workflows/proto-check.yml`
- `scripts/shared/` must stay in sync with `shared/`

## Variant System

The app ships multiple variants with different panel/layer configurations:

- `full` (default): All features
- `tech`: Technology-focused subset
- `finance`: Financial markets focus
- `commodity`: Commodity markets focus
- `happy`: Positive news only

Variant is set via `VITE_VARIANT` env var. Config lives in `src/config/variants/`.

## Key Patterns

### Adding a New API Endpoint

1. Define proto message in `proto/worldmonitor/<domain>/`
2. Add RPC with `(sebuf.http.config)` annotation
3. Run `make generate`
4. Create handler in `server/worldmonitor/<domain>/`
5. Wire handler in domain's `handler.ts`
6. Use `cachedFetchJson()` for caching, include request params in cache key

### Adding a New Panel

1. Create `src/components/MyPanel.ts` extending `Panel`
2. Register in `src/config/panels.ts`
3. Add to variant configs in `src/config/variants/`
4. Wire data loading in `src/app/data-loader.ts`

### Circuit Breakers

`src/utils/circuit-breaker.ts` for client-side; separate breaker per data domain.

### Caching

Redis (Upstash) via `server/_shared/redis.ts`. `cachedFetchJson()` coalesces concurrent cache misses. Cache tiers: fast (5m), medium (10m), slow (30m), static (2h), daily (24h). Cache key MUST include request-varying params.

## Testing

- **Unit/Integration**: `tests/*.test.{mjs,mts}` using `node:test` runner
- **Sidecar tests**: `api/*.test.mjs`, `src-tauri/sidecar/*.test.mjs`
- **E2E**: `e2e/*.spec.ts` using Playwright
- **Visual regression**: Golden screenshot comparison per variant

## CI Checks (GitHub Actions)

| Workflow | Trigger | What it checks |
|---|---|---|
| `typecheck.yml` | PR + push to main | `tsc --noEmit` for src and API |
| `lint.yml` | PR (markdown changes) | markdownlint-cli2 |
| `proto-check.yml` | PR (proto changes) | Generated code freshness |
| `build-desktop.yml` | Manual | Tauri desktop build |
| `test-linux-app.yml` | Manual | Linux AppImage smoke test |

## Pre-Push Hook

Runs automatically before `git push`. Order matters:

1. `npm run typecheck` + `npm run typecheck:api`
2. CJS syntax check (`scripts/*.cjs`)
3. Unicode safety check
4. `npm run lint:boundaries` — blocks backward imports in src/ layers
5. Edge function esbuild bundle check (verifies Vercel compatibility)
6. Tests (varies by changed files: `tests/`, `server/`, `scripts/`, `src/`/api`)
7. Edge function import guardrail test
8. Markdown lint (if `.md`/`.mdx` changed)
9. MDX lint (if `.mdx` changed)
10. Proto freshness check (if proto/ changed)
11. `npm run version:check`

## Deployment

- **Web**: Vercel (auto-deploy on push to main)
- **Relay/Seeds**: Railway (Docker, cron services)
- **Desktop**: Tauri builds via GitHub Actions
- **Docs**: Mintlify (proxied through Vercel at `/docs`)

## Critical Conventions

- `fetch.bind(globalThis)` is BANNED. Use `(...args) => globalThis.fetch(...args)` instead
- Edge Functions cannot use `node:http`, `node:https`, `node:zlib`
- Always include `User-Agent` header in server-side fetch calls
- Yahoo Finance requests must be staggered (150ms delays)
- New data sources MUST have bootstrap hydration wired in `api/bootstrap.js`
- Redis seed scripts MUST write `seed-meta:<key>` for health monitoring

## External References

- [Architecture (system reference)](ARCHITECTURE.md)
- [Design Philosophy (why decisions were made)](docs/architecture.mdx)
- [Contributing guide](CONTRIBUTING.md)
- [Data sources catalog](docs/data-sources.mdx)
- [Health endpoints](docs/health-endpoints.mdx)
- [Adding endpoints guide](docs/adding-endpoints.mdx)
- [API reference (OpenAPI)](docs/api/)
