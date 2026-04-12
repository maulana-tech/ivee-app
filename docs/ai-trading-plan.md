# AVE Crypto Dashboard - AI Trading Planning
# Inspired by TradingAgents (TauricResearch)

## Reference: TradingAgents Architecture
https://github.com/TauricResearch/TradingAgents

TradingAgents uses multi-agent debate:
- Analyst Team (Fundamentals, Sentiment, News, Technical)
- Researcher Team (Bullish/Bearish debate)
- Trader Agent (makes decision)
- Risk Management + Portfolio Manager (final approval)

---

## 1. Our Simplified Architecture (For Hackathon Demo)

```
┌─────────────────────────────────────────────────────────────┐
│                    AI DEBATE FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────┐  │
│  │  Fundamental │     │  Technical   │     │ Sentiment│  │
│  │  Analyst    │     │  Analyst    │     │ Analyst  │  │
│  └──────────────┘     └──────────────┘     └──────────┘  │
│         │                    │                    │        │
│         └──────────────────┼────────────────────┘        │
│                            ▼                             │
│                    ┌──────────────┐                     │
│                    │   Debater   │  ← Bullish vs Bearish │
│                    └──────────────┘                     │
│                            │                             │
│                            ▼                             │
│                    ┌──────────────┐                     │
│                    │  Trader    │   ← Decision maker  │
│                    └──────────────┘                     │
│                            │                             │
│                            ▼                             │
│                    ┌──────────────┐                     │
│                    │   Risk Mgr  │   ← Approve/Reject  │
│                    └──────────────┘                     │
│                            │                             │
│                            ▼                             │
│                    ┌──────────────┐                     │
│                    │  Execute    │   ← Simulated trade  │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Agent Implementation

### 2.1 Analyst Agents ( run in parallel )
```typescript
// src/services/ave/ai-agent.ts

interface AnalystResult {
  type: 'fundamental' | 'technical' | 'sentiment';
  score: number;        // -100 to +100
  bias: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
  confidence: number;   // 0-100
}

// Fundamental: price, volume, market cap analysis
async function analyzeFundamental(token: Token): Promise<AnalystResult>

// Technical: RSI, MACD, Moving Averages
async function analyzeTechnical(token: Token, klines: Kline[]): Promise<AnalystResult>  

// Sentiment: social buzz, news mentions
async function analyzeSentiment(token: Token): Promise<AnalystResult>
```

### 2.2 Debate Phase
```typescript
// Compare bullish vs bearish arguments
interface DebateResult {
  winner: 'bullish' | 'bearish' | 'neutral';
  consensusScore: number;  // -100 to +100
  arguments: string[];     // Key points from debate
}

async function runDebate(analystResults: AnalystResult[]): Promise<DebateResult>
```

### 2.3 Trader Decision
```typescript
// Combine all inputs and make decision
interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;    // 0-100
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  size: number;          // Position size 1-10
  reasoning: string;
}

async function makeDecision(debate: DebateResult, portfolio: Portfolio): Promise<TradeDecision>
```

### 2.4 Risk Approval
```typescript
// Final risk check before execution
interface RiskCheck {
  approved: boolean;
  adjustments: {
    sizeReduce?: number;    // Reduce size by X%
    strictStopLoss?: number; // Tighter stop loss
  };
  reasons: string[];
}

async function checkRisk(decision: TradeDecision, portfolio: Portfolio): Promise<RiskCheck>
```

---

## 3. Existing Panels Integration

### 3.1 Trading Panel - Full AI Flow Display
```
┌────────────────────────────────────────────────────────┐
│  🤖 AI Agent: Running         [Stop] [Settings]        │
├────────────────────────────────────────────────────────┤
│  📊 Analysis Running...                             │
│  ┌──────────────────────────────────────────────┐ │
│  │📈 Technical:  BULLISH (+65)  ████████░░    │ │
│  │💰 Fundamental: BEARISH (-20) ███░░░░░░░░    │ │
│  │📰 Sentiment:  NEUTRAL (+10)  ██░░░░░░░░░    │ │
│  └──────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  ⚖️ Debate: BULLISH wins (+52)                     │
│  "Strong momentum, volume spike, positive sentiment" │
├────────────────────────────────────────────────────────┤
│  🎯 Decision: BUY WETH @ $2,250                 │
│  Target: $2,600 (+15%)  Stop: $2,025 (-10%)      │
├────────────────────────────────────────────────────────┤
│  ✅ Risk: APPROVED                               │
│  Position size: 3/10                          │
├────────────────────────────────────────────────────────┤
│  [AUTO-EXECUTE]  or  [SKIP]                      │
└────────────────────────────────────────────────────────┘
```

### 3.2 Risk Scanner Panel - Agent Status
```
┌────────────────────────────────────────────────────────┐
│  🤖 Agent Status                                  │
├────────────────────────────────────────────────────────┤
│  State: Running    │ Last Run: 2 min ago           │
│  ─────────────────────────────────────────────    │
│  Analysts Run: 3/3                              │
│  Current: WETH analysis (technical)              │
│  ─────────────────────────────────────────────    │
│  Total Runs: 156    │ Trades: 12                 │
│  Win Rate: 75%     │ Total PnL: +$2,340        │
└────────────────────────────────────────────────────────┘
```

### 3.3 Portfolio Panel - Unchanged
Already works.

---

## 4. API Endpoints (for Demo)

### 4.1 Analysis Endpoints
```
GET /api/ai/analyze/{token}
  → { fundamental, technical, sentiment } (parallel)

GET /api/ai/debate/{token}  
  → { winner, consensusScore, arguments }

GET /api/ai/decision/{token}
  → { action, confidence, entryPrice, target, stopLoss, size }

GET /api/ai/risk-check/{tradeId}  
  → { approved, adjustments, reasons }
```

### 4.2 Execution
```
POST /api/ai/execute
  Body: { token, action, amount, price }
  → { success, tradeId, simulated }
```

---

## 5. Implementation Priority

| # | Component | File | Priority |
|---|----------|------|----------|
| 1 | Analyst Functions | `ai-agent.ts` | HIGH |
| 2 | Trading Panel Update | `TradingPanel.ts` | HIGH |
| 3 | Risk Scanner Update | `RiskScannerPanel.ts` | MEDIUM |
| 4 | API Endpoints | `vite.config.ts` | MEDIUM |

---

## 6. No New Panels - Use Existing

22 panels tetap, tidak ada yang baru.

---

## 7. Success Metrics

- [ ] Technical analysis shows RSI/MACD
- [ ] Fundamental shows price/volume  
- [ ] Sentiment shows social buzz
- [ ] Debate shows bullish vs bearish
- [ ] Risk check before execution
- [ ] Trade history in Trading Panel
- [ ] Agent stats in Risk Scanner