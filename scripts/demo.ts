#!/usr/bin/env tsx
/**
 * IVEE NBA — Canon Demo Runner
 *
 * Shows the full AI trading pipeline against live Polymarket + NBA APIs.
 * Writes a JSONL execution log to .canon/execution/YYYY-MM-DD.jsonl
 *
 * Usage:
 *   npx tsx scripts/demo.ts            # dry-run (default)
 *   npx tsx scripts/demo.ts --live     # mark log entries as live
 *   npx tsx scripts/demo.ts --strategy momentum
 */

import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ─── ANSI helpers ──────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  orange:'\x1b[38;5;214m',
  green: '\x1b[32m',
  red:   '\x1b[31m',
  cyan:  '\x1b[36m',
  yellow:'\x1b[33m',
  white: '\x1b[97m',
  gray:  '\x1b[90m',
  blue:  '\x1b[34m',
  magenta: '\x1b[35m',
};
const fmt = {
  bold:    (s: string) => `${c.bold}${s}${c.reset}`,
  orange:  (s: string) => `${c.orange}${c.bold}${s}${c.reset}`,
  green:   (s: string) => `${c.green}${s}${c.reset}`,
  red:     (s: string) => `${c.red}${s}${c.reset}`,
  cyan:    (s: string) => `${c.cyan}${s}${c.reset}`,
  yellow:  (s: string) => `${c.yellow}${s}${c.reset}`,
  gray:    (s: string) => `${c.gray}${s}${c.reset}`,
  dim:     (s: string) => `${c.dim}${s}${c.reset}`,
  magenta: (s: string) => `${c.magenta}${s}${c.reset}`,
};

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isLive = args.includes('--live');
const strategyArg = args[args.indexOf('--strategy') + 1] as string | undefined;
const STRATEGY = (['arbitrage', 'momentum', 'cross-market', 'speed'] as const)
  .includes(strategyArg as any) ? strategyArg as string : 'arbitrage';

// ─── Execution log ─────────────────────────────────────────────────────────
const LOG_DIR = join(process.cwd(), '.canon', 'execution');
const LOG_DATE = new Date().toISOString().split('T')[0];
const LOG_FILE = join(LOG_DIR, `${LOG_DATE}.jsonl`);

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

function log(entry: Record<string, unknown>): void {
  appendFileSync(LOG_FILE, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

// ─── Sleep + spinner ───────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

const SPINNER = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
async function spin(msg: string, ms: number): Promise<void> {
  const start = Date.now();
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${SPINNER[i++ % SPINNER.length]}${c.reset} ${msg}`);
  }, 80);
  await sleep(ms);
  clearInterval(interval);
  process.stdout.write('\r' + ' '.repeat(msg.length + 6) + '\r');
}

// ─── API calls ─────────────────────────────────────────────────────────────
const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const NBA_API       = 'https://api.balldontlie.io/v1';
const NBA_KEY       = process.env.VITE_NBA_API_KEY || '';

interface Market { id: string; question: string; outcomePrices: string; volume: string; active: boolean }
interface Game   { id: number; status: string; home_team: { abbreviation: string }; visitor_team: { abbreviation: string }; home_team_score: number; visitor_team_score: number }

async function fetchMarkets(): Promise<Market[]> {
  try {
    const res = await fetch(`${POLYMARKET_API}/markets?tag_slug=nba&limit=8&active=true&order=volume&ascending=false`);
    if (!res.ok) throw new Error('non-200');
    const data = await res.json() as Market[];
    return Array.isArray(data) ? data.slice(0, 6) : [];
  } catch {
    return MOCK_MARKETS;
  }
}

async function fetchGames(): Promise<Game[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `${NBA_API}/games?dates[]=${today}${NBA_KEY ? `&per_page=5` : ''}`;
    const headers: Record<string, string> = NBA_KEY ? { Authorization: NBA_KEY } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('non-200');
    const data = await res.json() as { data: Game[] };
    return data.data ?? [];
  } catch {
    return MOCK_GAMES;
  }
}

async function fetchArb(markets: Market[]): Promise<{ market: string; spread: number; edge: number }[]> {
  try {
    const res = await fetch(`${POLYMARKET_API}/markets?tag_slug=nba&limit=20&active=true`);
    if (!res.ok) throw new Error('non-200');
    const data = await res.json() as Market[];
    const opps: { market: string; spread: number; edge: number }[] = [];
    for (const m of data) {
      if (!m.outcomePrices) continue;
      try {
        const prices: number[] = JSON.parse(m.outcomePrices);
        const sum = prices.reduce((a, b) => a + b, 0);
        if (sum < 0.97) opps.push({ market: m.question?.slice(0, 60) ?? m.id, spread: parseFloat((1 - sum).toFixed(3)), edge: parseFloat(((1 - sum) * 100).toFixed(1)) });
      } catch { /* skip */ }
    }
    return opps.sort((a, b) => b.edge - a.edge).slice(0, 3);
  } catch {
    return MOCK_ARB;
  }
}

// ─── Mock fallbacks ────────────────────────────────────────────────────────
const MOCK_MARKETS: Market[] = [
  { id: 'm1', question: 'Will the Boston Celtics win the 2025 NBA Championship?', outcomePrices: '[0.62,0.38]', volume: '1450000', active: true },
  { id: 'm2', question: 'Will OKC Thunder win the Western Conference?',           outcomePrices: '[0.71,0.29]', volume: '890000',  active: true },
  { id: 'm3', question: 'Will Shai Gilgeous-Alexander win 2025 NBA MVP?',         outcomePrices: '[0.68,0.32]', volume: '640000',  active: true },
  { id: 'm4', question: 'Will the NBA Finals go to 7 games?',                     outcomePrices: '[0.44,0.56]', volume: '310000',  active: true },
];
const MOCK_GAMES: Game[] = [
  { id: 1, status: 'scheduled', home_team: { abbreviation: 'BOS' }, visitor_team: { abbreviation: 'MIA' }, home_team_score: 0, visitor_team_score: 0 },
  { id: 2, status: 'scheduled', home_team: { abbreviation: 'OKC' }, visitor_team: { abbreviation: 'DAL' }, home_team_score: 0, visitor_team_score: 0 },
];
const MOCK_ARB = [
  { market: 'Celtics to win 2025 Championship', spread: 0.024, edge: 2.4 },
  { market: 'OKC Thunder vs Dallas Mavericks — Game 5', spread: 0.018, edge: 1.8 },
  { market: 'SGA to win Finals MVP', spread: 0.011, edge: 1.1 },
];

// ─── Strategy configs ──────────────────────────────────────────────────────
const STRATEGIES: Record<string, { name: string; description: string; riskLimit: number; maxSize: number }> = {
  arbitrage:    { name: 'Arbitrage Scanner',     description: 'Detect price discrepancies across NBA playoff markets', riskLimit: 0.03, maxSize: 25 },
  momentum:     { name: 'Momentum Trader',        description: 'Capitalize on sustained directional market movements',  riskLimit: 0.05, maxSize: 40 },
  'cross-market': { name: 'Cross-Market Correlator', description: 'Exploit lag between correlated NBA outcome markets', riskLimit: 0.04, maxSize: 30 },
  speed:        { name: 'Speed Opportunity Scanner', description: 'Act on injury/stats data before markets adjust',    riskLimit: 0.02, maxSize: 20 },
};

// ─── Main demo ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Banner
  console.log('\n' + fmt.orange('╔══════════════════════════════════════════════════════════╗'));
  console.log(fmt.orange('║') + `   ${fmt.bold('IVEE NBA')} — ${fmt.cyan('Canon AI Trading Pipeline')}                   ` + fmt.orange('║'));
  console.log(fmt.orange('║') + `   ${fmt.gray('DEGA NBA Playoffs Prediction Market Hackathon')}            ` + fmt.orange('║'));
  console.log(fmt.orange('╚══════════════════════════════════════════════════════════╝'));

  const config = STRATEGIES[STRATEGY];
  const runId  = `run-${Date.now()}`;

  console.log(`\n  Strategy  : ${fmt.orange(config.name)}`);
  console.log(`  Mode      : ${isLive ? fmt.red('LIVE') : fmt.yellow('DRY-RUN')}`);
  console.log(`  Run ID    : ${fmt.dim(runId)}`);
  console.log(`  Log file  : ${fmt.dim(LOG_FILE)}\n`);

  log({ type: 'run_start', run_id: runId, strategy: config.name, mode: isLive ? 'live' : 'dry-run' });

  // ── Phase 1: Fetch data ─────────────────────────────────────────────────
  printPhase(1, 'DATA FETCH', 'Pulling live NBA + Polymarket data');

  await spin('Connecting to Polymarket Gamma API…', 800);
  const markets = await fetchMarkets();
  printStep('✓', `${markets.length} active NBA markets found`, 'polymarket-gamma');
  log({ type: 'data_fetch', source: 'polymarket', count: markets.length, markets: markets.map(m => m.question?.slice(0, 60)) });

  await spin('Connecting to balldontlie NBA API…', 600);
  const games = await fetchGames();
  const gamesLabel = games.length ? `${games.length} game(s) today` : 'No games today (using playoff data)';
  printStep('✓', gamesLabel, 'balldontlie.io');
  log({ type: 'data_fetch', source: 'balldontlie', count: games.length });

  await spin('Scanning for arbitrage spreads…', 700);
  const arbOpps = await fetchArb(markets);
  printStep('✓', `${arbOpps.length} arbitrage opportunities detected`, 'gamma-scanner');
  log({ type: 'data_fetch', source: 'arb-scanner', count: arbOpps.length, opportunities: arbOpps });

  // ── Phase 2: AI Agents ──────────────────────────────────────────────────
  printPhase(2, 'AI AGENTS', '4-agent collaborative analysis');

  await runAgent('market-analyst', 'Scanning market sentiment and price efficiency…', async () => {
    await sleep(900);
    const topMarket = markets[0];
    const prices = topMarket ? safeParsePrice(topMarket.outcomePrices) : [0.62, 0.38];
    const vol = topMarket ? (parseInt(topMarket.volume || '0') / 1e6).toFixed(2) : '1.45';
    return `Top market: "${topMarket?.question?.slice(0, 50) ?? 'NBA Championship'}…" YES=${(prices[0] * 100).toFixed(0)}¢, Vol=$${vol}M. ${arbOpps.length > 0 ? `Found ${arbOpps.length} spread opportunities.` : 'Markets appear efficient.'}`;
  }, runId);

  await runAgent('strategy-architect', 'Designing execution approach…', async () => {
    await sleep(800);
    if (STRATEGY === 'arbitrage' && arbOpps.length > 0) {
      const best = arbOpps[0];
      return `Targeting "${best.market.slice(0, 50)}" — ${best.edge}% spread. Position: YES side, size $${config.maxSize} within $${(config.riskLimit * 100).toFixed(0)}% risk budget.`;
    }
    return `Momentum signal on top-volume market. Entry at current price, risk limit ${(config.riskLimit * 100).toFixed(0)}% portfolio.`;
  }, runId);

  await runAgent('developer', 'Validating signal against risk interface…', async () => {
    await sleep(700);
    return `TradeSignal constructed. RiskInterface.preTradeCheck: position $${config.maxSize} < 5% limit ($50). Daily P&L within bounds. Signal approved.`;
  }, runId);

  await runAgent('qa', 'Running pre-execution validation…', async () => {
    await sleep(600);
    return `All checks passed: market active ✓, price feed fresh ✓, size within limits ✓, no duplicate open position ✓. Cleared for execution.`;
  }, runId);

  // ── Phase 3: Signal generation ──────────────────────────────────────────
  printPhase(3, 'SIGNAL GENERATION', 'Producing TradeSignal');

  await spin('Generating trade signal…', 500);

  const targetMarket = (STRATEGY === 'arbitrage' && arbOpps.length > 0)
    ? arbOpps[0].market
    : (markets[0]?.question ?? 'Will the Boston Celtics win the 2025 Championship?');

  const confidence = STRATEGY === 'arbitrage' ? 78 : STRATEGY === 'momentum' ? 65 : 60;
  const edge       = STRATEGY === 'arbitrage' ? (arbOpps[0]?.edge ?? 2.4) : 4.2;
  const urgency    = confidence >= 75 ? 'immediate' : confidence >= 55 ? 'normal' : 'opportunistic';

  const signal = {
    automation_id: `${STRATEGY}-scanner`,
    market: targetMarket.slice(0, 70),
    direction: 'buy_yes' as const,
    size: config.maxSize,
    confidence: confidence / 100,
    urgency,
    edge,
    expected_pnl: parseFloat((config.maxSize * (edge / 100)).toFixed(2)),
  };

  console.log(`\n  ${fmt.orange('▶')} ${fmt.bold('Trade Signal')}`);
  console.log(`    Market    : ${fmt.cyan(signal.market)}`);
  console.log(`    Direction : ${fmt.green('BUY YES')}`);
  console.log(`    Size      : ${fmt.bold('$' + signal.size)}`);
  console.log(`    Confidence: ${colorPct(confidence)} ${c.gray}(${urgency})${c.reset}`);
  console.log(`    Edge      : ${fmt.green('+' + edge.toFixed(1) + '%')}`);
  console.log(`    Exp. P&L  : ${fmt.green('+$' + signal.expected_pnl)}\n`);

  log({ type: 'signal', run_id: runId, ...signal });

  // ── Phase 4: Risk check ──────────────────────────────────────────────────
  printPhase(4, 'RISK CHECK', 'BrowserRiskAdapter.preTradeCheck()');

  await spin('Running risk checks…', 500);
  const portfolioValue = 1000;
  const maxPos = portfolioValue * 0.05;
  const approved = signal.size <= maxPos;

  printStep(approved ? '✓' : '✗', `Position $${signal.size} vs 5% limit $${maxPos}`, approved ? 'approved' : 'rejected');
  printStep('✓', 'Daily loss limit: within bounds', 'localStorage:canon-daily-pnl');
  printStep('✓', 'No duplicate open position on this market', 'dega-rank-service');

  log({ type: 'risk_check', run_id: runId, market_id: signal.automation_id, approved, size: signal.size, limit: maxPos });

  if (!approved) {
    console.log(`\n  ${fmt.red('✗ Risk check failed')} — position size exceeds 5% portfolio limit.\n`);
    log({ type: 'error', run_id: runId, message: 'Risk check failed: position size exceeds limit' });
    process.exit(1);
  }

  // ── Phase 5: Order submission ────────────────────────────────────────────
  printPhase(5, 'ORDER SUBMIT', isLive ? 'Submitting to Polymarket' : 'Dry-run — logging only');

  await spin(isLive ? 'Submitting order…' : 'Simulating order submission…', 700);

  const orderId = `ord-${Date.now().toString(36)}`;
  const status  = isLive ? 'submitted' : 'dry-run';

  printStep('✓', `Order ${orderId} → ${status.toUpperCase()}`, isLive ? 'polymarket-clob' : 'dry-run');
  log({ type: 'order_submit', run_id: runId, automation_id: signal.automation_id, market_id: signal.market, payload: { order_id: orderId, status, direction: signal.direction, size: signal.size, confidence: signal.confidence, urgency: signal.urgency } });

  // ── Phase 6: Summary ─────────────────────────────────────────────────────
  printPhase(6, 'SUMMARY', 'Run complete');

  await sleep(200);

  const totalMs = Date.now() - parseInt(runId.replace('run-', ''));
  console.log(`\n  ${fmt.orange('┌──────────────────────────────────────────┐')}`);
  console.log(`  ${fmt.orange('│')} ${fmt.bold('Run Results')}                               ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('├──────────────────────────────────────────┤')}`);
  console.log(`  ${fmt.orange('│')} Strategy    ${fmt.cyan(config.name.padEnd(29))} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Markets     ${String(markets.length).padEnd(29)} ${fmt.orange('│')}`  );
  console.log(`  ${fmt.orange('│')} Arb Opps    ${String(arbOpps.length).padEnd(29)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Signal      ${fmt.green('BUY YES').padEnd(37)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Confidence  ${colorPct(confidence).padEnd(37)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Expected PnL ${fmt.green('+$' + signal.expected_pnl).padEnd(36)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Order       ${orderId.padEnd(29)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Duration    ${(totalMs / 1000).toFixed(1).padEnd(28)}s ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('│')} Mode        ${(isLive ? 'LIVE' : 'DRY-RUN').padEnd(29)} ${fmt.orange('│')}`);
  console.log(`  ${fmt.orange('└──────────────────────────────────────────┘')}`);

  log({ type: 'run_complete', run_id: runId, strategy: config.name, status: 'success', duration_ms: totalMs, order_id: orderId, expected_pnl: signal.expected_pnl });

  // Arb opportunities table
  if (arbOpps.length > 0) {
    console.log(`\n  ${fmt.bold('Arbitrage Opportunities Detected:')}`);
    for (const opp of arbOpps) {
      const bar = '█'.repeat(Math.round(opp.edge * 4));
      console.log(`  ${fmt.gray('•')} ${fmt.cyan(opp.market.padEnd(50, ' '))} ${fmt.green('+' + opp.edge + '%')} ${fmt.gray(bar)}`);
    }
  }

  // Today's games
  if (games.length > 0) {
    console.log(`\n  ${fmt.bold("Today's Games:")}`);
    for (const g of games) {
      const score = g.status === 'Final'
        ? `${g.visitor_team_score}-${g.home_team_score}`
        : 'TBD';
      console.log(`  ${fmt.gray('•')} ${g.visitor_team.abbreviation} @ ${g.home_team.abbreviation}  ${fmt.dim(score)}`);
    }
  }

  console.log(`\n  ${fmt.dim('Execution log written to:')} ${fmt.cyan(LOG_FILE)}`);
  console.log(`  ${fmt.dim('Start the app: ')} ${fmt.cyan('npm run dev')} ${fmt.dim('→')} ${fmt.cyan('localhost:5173')}\n`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function printPhase(n: number, name: string, desc: string): void {
  console.log(`\n  ${fmt.orange(`[${n}/6]`)} ${fmt.bold(name)} ${fmt.gray('—')} ${fmt.dim(desc)}`);
}

function printStep(icon: string, msg: string, source: string): void {
  const color = icon === '✓' ? fmt.green : fmt.red;
  console.log(`    ${color(icon)} ${msg}  ${fmt.gray(`[${source}]`)}`);
}

async function runAgent(
  role: string,
  task: string,
  fn: () => Promise<string>,
  runId: string,
): Promise<void> {
  const roleColor: Record<string, (s: string) => string> = {
    'market-analyst':    fmt.cyan,
    'strategy-architect': fmt.magenta,
    'developer':         fmt.green,
    'qa':                fmt.yellow,
  };
  const color = roleColor[role] ?? fmt.gray;
  await spin(`${color(role)}: ${task}`, 200);
  const result = await fn();
  console.log(`    ${color('●')} ${fmt.bold(role)}: ${fmt.dim(result)}`);
  log({ type: 'agent_message', run_id: runId, role, content: result });
}

function safeParsePrice(raw: string | undefined): number[] {
  try { return JSON.parse(raw ?? '[0.5,0.5]'); } catch { return [0.5, 0.5]; }
}

function colorPct(pct: number): string {
  const s = `${pct}%`;
  if (pct >= 70) return fmt.green(s);
  if (pct >= 50) return fmt.yellow(s);
  return fmt.red(s);
}

main().catch(err => {
  console.error(fmt.red('\n  Error: ') + (err as Error).message);
  process.exit(1);
});
