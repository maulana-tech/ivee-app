// @ts-nocheck
export class EconomicServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export class ApiError extends Error {
  statusCode: number;
  body: string;
}

export interface GetFredSeriesResponse {
  data: any[];
  updatedAt: number;
}

export interface GetFredSeriesBatchResponse {
  results: any[];
  updatedAt: number;
}

export interface ListWorldBankIndicatorsResponse {
  indicators: any[];
  updatedAt: number;
}

export interface WorldBankCountryData {
  countryCode: string;
  data: any;
}

export interface GetEnergyPricesResponse {
  prices: EnergyPrice[];
  updatedAt: number;
}

export interface EnergyPrice {
  type: string;
  price: number;
  unit: string;
}

export interface GetEnergyCapacityResponse {
  capacity: any[];
  updatedAt: number;
}

export interface GetBisPolicyRatesResponse {
  rates: BisPolicyRate[];
  updatedAt: number;
}

export interface BisPolicyRate {
  countryCode: string;
  rate: number;
  date: string;
}

export interface GetBisExchangeRatesResponse {
  rates: BisExchangeRate[];
  updatedAt: number;
}

export interface BisExchangeRate {
  currency: string;
  rate: number;
  date: string;
}

export interface GetBisCreditResponse {
  credit: BisCreditToGdp[];
  updatedAt: number;
}

export interface BisCreditToGdp {
  countryCode: string;
  value: number;
  quarter: string;
}

export interface GetNationalDebtResponse {
  entries: NationalDebtEntry[];
  updatedAt: number;
}

export interface NationalDebtEntry {
  countryCode: string;
  amount: number;
  date: string;
}

export interface GetBlsSeriesResponse {
  data: any[];
  updatedAt: number;
}

export interface GetCrudeInventoriesResponse {
  inventories: CrudeInventoryWeek[];
  updatedAt: number;
}

export interface CrudeInventoryWeek {
  date: string;
  value: number;
  change: number;
}

export interface GetNatGasStorageResponse {
  storage: NatGasStorageWeek[];
  updatedAt: number;
}

export interface NatGasStorageWeek {
  date: string;
  value: number;
  change: number;
}

export interface GetEcbFxRatesResponse {
  rates: EcbFxRate[];
  updatedAt: number;
}

export interface EcbFxRate {
  currency: string;
  rate: number;
  date: string;
}

export interface GetEuGasStorageResponse {
  history: EuGasStorageHistoryEntry[];
  updatedAt: number;
}

export interface EuGasStorageHistoryEntry {
  countryCode: string;
  fillLevel: number;
  date: string;
}

export interface GetEurostatCountryDataResponse {
  data: EurostatCountryEntry[];
  updatedAt: number;
}

export interface EurostatCountryEntry {
  countryCode: string;
  values: any;
}

export interface GetOilStocksAnalysisResponse {
  members: OilStocksAnalysisMember[];
  summary: OilStocksRegionalSummary;
  updatedAt: number;
}

export interface OilStocksAnalysisMember {
  countryCode: string;
  stocks: number;
  change: number;
}

export interface OilStocksRegionalSummary {
  total: number;
  change: number;
}

export interface OilStocksRegionalSummaryEurope extends OilStocksRegionalSummary {}

export interface OilStocksRegionalSummaryAsiaPacific extends OilStocksRegionalSummary {}

export interface OilStocksRegionalSummaryNorthAmerica extends OilStocksRegionalSummary {}

export interface GetMacroSignalsResponse {
  signals: any[];
  updatedAt: number;
}

export interface ListGroceryBasketPricesResponse {
  items: any[];
  updatedAt: number;
}

export interface ListFuelPricesResponse {
  items: any[];
  updatedAt: number;
}

export interface GetFaoFoodPriceIndexResponse {
  dataPoints: FaoFoodPricePoint[];
  updatedAt: number;
}

export interface FaoFoodPricePoint {
  date: string;
  value: number;
}

export interface GetEuFsiResponse {
  value: number;
  countryCode: string;
  updatedAt: number;
}

export interface ListBigMacPricesResponse {
  items: any[];
  updatedAt: number;
}

export interface GetEconomicStressResponse {
  overall: number;
  components: EconomicStressComponent[];
  updatedAt: number;
}

export interface EconomicStressComponent {
  name: string;
  value: number;
}
