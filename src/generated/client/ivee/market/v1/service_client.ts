// @ts-nocheck
export class MarketServiceClient {
  constructor(baseURL: string, options?: any) {}
}

export interface ListMarketQuotesResponse {
  items: MarketQuote[];
  updatedAt: number;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface ListCommodityQuotesResponse {
  items: CommodityQuote[];
  updatedAt: number;
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
}

export interface GetSectorSummaryResponse {
  sectors: SectorSummary[];
  updatedAt: number;
}

export interface SectorSummary {
  name: string;
  performance: number;
  volume: number;
}

export interface ListCryptoQuotesResponse {
  items: CryptoQuote[];
  updatedAt: number;
}

export interface CryptoQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
}

export interface ListCryptoSectorsResponse {
  sectors: CryptoSector[];
  updatedAt: number;
}

export interface CryptoSector {
  name: string;
  performance: number;
  volume: number;
}

export interface ListDefiTokensResponse {
  items: CryptoQuote[];
  updatedAt: number;
}

export interface ListAiTokensResponse {
  items: CryptoQuote[];
  updatedAt: number;
}

export interface ListOtherTokensResponse {
  items: CryptoQuote[];
  updatedAt: number;
}

export interface CryptoQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}
