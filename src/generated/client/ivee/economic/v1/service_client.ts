// @ts-nocheck
export class EconomicServiceClient {
  private baseURL: string;
  private fetchFn: typeof fetch;
  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.baseURL = baseURL;
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }
  private async get<T>(path: string, params?: Record<string, any>, options?: any): Promise<T> {
    const url = new URL(path, this.baseURL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          if (value.length > 0) url.searchParams.set(key, value.join(','));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const resp = await this.fetchFn(url.toString(), { signal: options?.signal });
    if (!resp.ok) throw new Error(`Service ${path}: ${resp.status}`);
    return resp.json();
  }

  getFredSeries(req?: any, options?: any) { return this.get('/api/economic/v1/get-fred-series', req, options); }
  getFredSeriesBatch(req?: any, options?: any) { return this.get('/api/economic/v1/get-fred-series-batch', req, options); }
  getBlsSeries(req?: any, options?: any) { return this.get('/api/economic/v1/get-bls-series', req, options); }
  getEnergyPrices(req?: any, options?: any) { return this.get('/api/economic/v1/get-energy-prices', req, options); }
  getCrudeInventories(req?: any, options?: any) { return this.get('/api/economic/v1/get-crude-inventories', req, options); }
  getNatGasStorage(req?: any, options?: any) { return this.get('/api/economic/v1/get-nat-gas-storage', req, options); }
  getEnergyCapacity(req?: any, options?: any) { return this.get('/api/economic/v1/get-energy-capacity', req, options); }
  listWorldBankIndicators(req?: any, options?: any) { return this.get('/api/economic/v1/list-world-bank-indicators', req, options); }
  getNationalDebt(req?: any, options?: any) { return this.get('/api/economic/v1/get-national-debt', req, options); }
  getBisPolicyRates(req?: any, options?: any) { return this.get('/api/economic/v1/get-bis-policy-rates', req, options); }
  getBisExchangeRates(req?: any, options?: any) { return this.get('/api/economic/v1/get-bis-exchange-rates', req, options); }
  getBisCredit(req?: any, options?: any) { return this.get('/api/economic/v1/get-bis-credit', req, options); }
  getEcbFxRates(req?: any, options?: any) { return this.get('/api/economic/v1/get-ecb-fx-rates', req, options); }
  getEuGasStorage(req?: any, options?: any) { return this.get('/api/economic/v1/get-eu-gas-storage', req, options); }
  getEurostatCountryData(req?: any, options?: any) { return this.get('/api/economic/v1/get-eurostat-country-data', req, options); }
  getOilStocksAnalysis(req?: any, options?: any) { return this.get('/api/economic/v1/get-oil-stocks-analysis', req, options); }
  getMacroSignals(req?: any, options?: any) { return this.get('/api/economic/v1/get-macro-signals', req, options); }
  listGroceryBasketPrices(req?: any, options?: any) { return this.get('/api/economic/v1/list-grocery-basket-prices', req, options); }
  listBigMacPrices(req?: any, options?: any) { return this.get('/api/economic/v1/list-bigmac-prices', req, options); }
  listFuelPrices(req?: any, options?: any) { return this.get('/api/economic/v1/list-fuel-prices', req, options); }
  getFaoFoodPriceIndex(req?: any, options?: any) { return this.get('/api/economic/v1/get-fao-food-price-index', req, options); }
  getEuFsi(req?: any, options?: any) { return this.get('/api/economic/v1/get-eu-fsi', req, options); }
  getEconomicStress(req?: any, options?: any) { return this.get('/api/economic/v1/get-economic-stress', req, options); }
  getEconomicCalendar(req?: any, options?: any) { return this.get('/api/economic/v1/get-economic-calendar', req, options); }
  getEuYieldCurve(req?: any, options?: any) { return this.get('/api/economic/v1/get-eu-yield-curve', req, options); }
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
