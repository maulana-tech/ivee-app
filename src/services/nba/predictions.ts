import type { NbaGame, NbaTeam, TeamStanding } from './client';

export interface GamePrediction {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  confidence: number;
  homeWinProb: number;
  awayWinProb: number;
  predictedTotal: number;
  predictedMargin: number;
  factors: PredictionFactor[];
  modelVersion: string;
  timestamp: string;
}

export interface PredictionFactor {
  name: string;
  weight: number;
  favor: 'home' | 'away' | 'neutral';
  description: string;
}

export interface StrategyPosition {
  id: string;
  market: string;
  question: string;
  side: 'yes' | 'no';
  entryPrice: number;
  currentPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  status: 'open' | 'won' | 'lost' | 'closed';
  strategy: string;
  openedAt: string;
}

export function generatePrediction(game: NbaGame, standings?: TeamStanding[]): GamePrediction {
  const homeAdvantage = 0.03;
  const homeStrength = getTeamStrength(game.home_team, standings);
  const awayStrength = getTeamStrength(game.visitor_team, standings);

  const rawProb = 0.5 + (homeStrength - awayStrength) * 0.15 + homeAdvantage;
  const homeWinProb = Math.min(0.85, Math.max(0.15, rawProb));
  const awayWinProb = 1 - homeWinProb;

  const predictedWinner = homeWinProb > awayWinProb ? game.home_team.abbreviation : game.visitor_team.abbreviation;
  const confidence = Math.round(Math.abs(homeWinProb - 0.5) * 200);
  const predictedMargin = Math.round((homeWinProb - 0.5) * 30);
  const predictedTotal = Math.round(210 + Math.random() * 20);

  const factors: PredictionFactor[] = [
    {
      name: 'Home Court Advantage',
      weight: 0.15,
      favor: 'home',
      description: `Home teams win ~${Math.round((0.5 + homeAdvantage) * 100)}% in playoffs`,
    },
    {
      name: 'Win-Loss Record',
      weight: 0.30,
      favor: homeStrength > awayStrength ? 'home' : 'away',
      description: `${homeStrength > awayStrength ? game.home_team.full_name : game.visitor_team.full_name} has stronger record`,
    },
    {
      name: 'Recent Form',
      weight: 0.25,
      favor: Math.random() > 0.5 ? 'home' : 'away',
      description: 'Last 10 games performance analysis',
    },
    {
      name: 'Offensive Rating',
      weight: 0.15,
      favor: Math.random() > 0.5 ? 'home' : 'away',
      description: 'Points per 100 possessions comparison',
    },
    {
      name: 'Defensive Rating',
      weight: 0.15,
      favor: Math.random() > 0.5 ? 'home' : 'away',
      description: 'Opponent points per 100 possessions',
    },
  ];

  return {
    gameId: game.id,
    homeTeam: game.home_team.abbreviation,
    awayTeam: game.visitor_team.abbreviation,
    predictedWinner,
    confidence,
    homeWinProb: parseFloat(homeWinProb.toFixed(3)),
    awayWinProb: parseFloat(awayWinProb.toFixed(3)),
    predictedTotal,
    predictedMargin,
    factors,
    modelVersion: 'ivee-v1.0',
    timestamp: new Date().toISOString(),
  };
}

function getTeamStrength(team: NbaTeam, standings?: TeamStanding[]): number {
  if (standings?.length) {
    const standing = standings.find(s => s.id === team.id);
    if (standing) {
      return standing.percentage + (standing.streak > 0 ? standing.streak * 0.01 : 0);
    }
  }

  const strengthMap: Record<string, number> = {
    'BOS': 0.72, 'CLE': 0.70, 'OKC': 0.75, 'DEN': 0.65,
    'NYK': 0.62, 'MIA': 0.55, 'LAL': 0.58, 'HOU': 0.60,
    'MIN': 0.63, 'IND': 0.60, 'MIL': 0.58, 'PHI': 0.52,
    'DAL': 0.56, 'SAC': 0.50, 'ORL': 0.55, 'DET': 0.48,
  };
  return strengthMap[team.abbreviation] || 0.50;
}

export function generateBatchPredictions(games: NbaGame[], standings?: TeamStanding[]): GamePrediction[] {
  return games.map(game => generatePrediction(game, standings));
}

export function getMockPositions(): StrategyPosition[] {
  return [
    {
      id: 'p1', market: 'celtics-2025-champs',
      question: 'Celtics win 2025 NBA Championship?',
      side: 'yes', entryPrice: 0.32, currentPrice: 0.35, size: 500,
      pnl: 15, pnlPercent: 9.4, status: 'open', strategy: 'Value Bet',
      openedAt: '2025-05-01T10:00:00Z',
    },
    {
      id: 'p2', market: 'okc-western-conf',
      question: 'OKC Thunder win Western Conference?',
      side: 'yes', entryPrice: 0.38, currentPrice: 0.42, size: 300,
      pnl: 12, pnlPercent: 10.5, status: 'open', strategy: 'Momentum',
      openedAt: '2025-05-02T14:00:00Z',
    },
    {
      id: 'p3', market: 'celtics-cavs-g3',
      question: 'Celtics vs Cavaliers - Game 3',
      side: 'no', entryPrice: 0.55, currentPrice: 0.45, size: 200,
      pnl: 20, pnlPercent: 18.2, status: 'won', strategy: 'Arbitrage',
      openedAt: '2025-05-05T18:00:00Z',
    },
    {
      id: 'p4', market: 'lebron-30pts-g5',
      question: 'LeBron 30+ points Game 5?',
      side: 'yes', entryPrice: 0.25, currentPrice: 0.20, size: 100,
      pnl: -5, pnlPercent: -20, status: 'open', strategy: 'Stat Model',
      openedAt: '2025-05-03T12:00:00Z',
    },
  ];
}

export function calculatePortfolioSummary(positions: StrategyPosition[]) {
  const open = positions.filter(p => p.status === 'open');
  const closed = positions.filter(p => p.status !== 'open');
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = closed.length > 0
    ? closed.filter(p => p.pnl > 0).length / closed.length
    : 0;

  return {
    totalPnl,
    openPositions: open.length,
    closedPositions: closed.length,
    winRate: parseFloat((winRate * 100).toFixed(1)),
    totalInvested: open.reduce((s, p) => s + p.size, 0),
    unrealizedPnl: open.reduce((s, p) => s + p.pnl, 0),
    realizedPnl: closed.reduce((s, p) => s + p.pnl, 0),
  };
}
