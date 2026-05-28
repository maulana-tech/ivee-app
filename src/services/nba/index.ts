export {
  getTodayGames,
  getGamesByDate,
  getPlayoffGames,
  getTeams,
  getStandings,
  getInjuries,
  getPlayerStats,
  type NbaGame,
  type NbaTeam,
  type NbaPlayer,
  type PlayerStats,
  type TeamStanding,
  type InjuryReport,
} from './client';

export {
  getNbaMarkets,
  getPlayoffMarkets,
  searchMarkets,
  findArbitrageOpportunities,
  calculateMarketSentiment,
  type PredictionMarket,
  type MarketArbitrage,
} from './prediction-market';

export {
  generatePrediction,
  generateBatchPredictions,
  getMockPositions,
  calculatePortfolioSummary,
  type GamePrediction,
  type PredictionFactor,
  type StrategyPosition,
} from './predictions';

export {
  degasRankService,
  type DegaPosition,
  type DegaPerformance,
  type DegaLeaderboard,
} from './dega-rank';

export {
  automationEngine,
  type AutomationResult,
  type StrategyConfig,
  type StrategyType,
} from './automation-engine';

export {
  canonBridge,
  automationResultToTradeSignal,
} from './canon-bridge';

export {
  browserExecutionLog,
  type BrowserLogEntry,
  type ExecutionLogEntryType,
} from './browser-execution-log';
