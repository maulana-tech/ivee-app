# Ivee - AVE Claw Hackathon

Crypto trading dashboard built with AVE Skills API.

## Quick Start

```bash
npm install
npm run dev
# or with crypto variant
VITE_VARIANT=crypto npm run dev
```

## Project Structure

```
src/
├── components/ave/    # Crypto trading panels
├── services/ave/     # AVE API integration
└── config/           # Variant configs

api/                  # Vercel Edge Functions
server/               # Server handlers
proto/                # Protocol Buffers
```

## Commands

```bash
npm run dev           # Dev server
npm run build         # Production build
npm run lint          # Lint check
npm run typecheck     # TypeScript check
```

## Environment

Copy `.env.example` to `.env.local` and add your `AVE_API_KEY` from https://cloud.ave.ai
