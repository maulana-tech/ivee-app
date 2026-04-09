# Ivee - AVE Claw Hackathon

**Real-time crypto trading intelligence dashboard** — whale alerts, trading signals, portfolio tracking, and risk scanning powered by AVE Skills API.

Built for the [AVE Claw Hackathon](https://clawhackathon.aveai.trade/) — Complete Application Track.

[![GitHub stars](https://img.shields.io/github/stars/maulana-tech/ivee-app?style=social)](https://github.com/maulana-tech/ivee-app/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

### Trading Intelligence
- **Whale Alert Panel** — Real-time large transaction monitoring on Base chain
- **Trading Signals Panel** — AI-powered buy/sell signals with confidence scores
- **Portfolio Panel** — Holdings tracking and P&L calculation
- **Risk Scanner Panel** — Token security and risk analysis
- **Trending Panel** — Hot tokens and top gainers

### Technology
- **130+ chains** supported via AVE Cloud API
- **Real-time monitoring** with circuit breaker pattern
- **Testnet trading** via AVE Trading API (Chain Wallet)

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | TypeScript, Vite, Preact |
| **Crypto API** | [AVE Cloud API](https://cloud.ave.ai), [AVE Trading API](https://docs.aveai.trade/) |
| **Architecture** | Panel-based SPA with circuit breakers |

---

## Getting Started

### 1. Get AVE API Keys

Register at [AVE Cloud](https://cloud.ave.ai/register) for free tier access.

### 2. Configure Environment

```bash
cp .env.example .env.local
# Add your AVE_API_KEY
```

### 3. Run Development Server

```bash
npm install
npm run dev
```

### 4. Run Crypto Variant

```bash
VITE_VARIANT=crypto npm run dev
```

---

## Project Structure

```
src/
├── components/ave/     # Crypto trading panels
│   ├── WhaleAlertPanel.ts
│   ├── SignalsPanel.ts
│   ├── PortfolioPanel.ts
│   ├── RiskScannerPanel.ts
│   └── TrendingPanel.ts
├── services/ave/      # AVE API integration
│   ├── client.ts
│   ├── monitor.ts
│   ├── signals.ts
│   └── portfolio.ts
└── config/            # Variant configs
```

---

## API Reference

### AVE Cloud API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/token/transfers` | Large transactions (whale alerts) |
| `GET /v1/token/trending` | Trending tokens |
| `GET /v1/defi/risk-score` | Token risk analysis |

### AVE Trading API

Wallet-based trading on 130+ chains. See [docs](https://docs.aveai.trade/).

---

## Hackathon Submission

- **Track**: Complete Application
- **Demo**: [Video](https://clowf.es) (max 5 min)
- **Deadline**: April 15, 2026

---

## License

**MIT License** — Free for personal and commercial use.

---

<p align="center">
  <a href="https://cloud.ave.ai"><strong>AVE Cloud</strong></a> &nbsp;·&nbsp;
  <a href="https://docs.aveai.trade"><strong>Trading API</strong></a> &nbsp;·&nbsp;
  <a href="https://clawhackathon.aveai.trade"><strong>Hackathon</strong></a>
</p>
