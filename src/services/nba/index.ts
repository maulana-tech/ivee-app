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
