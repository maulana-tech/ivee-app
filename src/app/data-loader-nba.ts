import type { AppContext, AppModule } from '@/app/app-context';
import { SITE_VARIANT } from '@/config';

export interface DataLoaderCallbacks {
  renderCriticalBanner: (postures: unknown[]) => void;
  refreshOpenCountryBrief: () => void;
}

/**
 * NBA-specific data loader with minimal dependencies.
 * Only loads data relevant to NBA variant (predictions, automation).
 */
export class DataLoaderManagerNba implements AppModule {
  private ctx: AppContext;
  private callbacks: DataLoaderCallbacks;

  public updateSearchIndex: () => void = () => {};

  constructor(ctx: AppContext, callbacks: DataLoaderCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  init(): void {
    // NBA doesn't need market watchlist or framework subscriptions
  }

  destroy(): void {
    // No cleanup needed for NBA
  }

  async loadAllData(_forceAll = false): Promise<void> {
    this.updateSearchIndex();
  }

  async loadDataForLayer(_layer: string): Promise<void> {
    // NBA has no map layers
  }

  syncDataFreshnessWithLayers(): void {
    // No-op for NBA
  }

  stopLayerActivity(_layer: string): void {
    // No-op for NBA
  }

  async waitForAisData(): Promise<void> {
    // No-op for NBA
  }

  async loadNews(): Promise<void> {
    // NBA news handled by panels
  }

  async loadMarkets(): Promise<void> {
    // NBA markets handled by panels
  }

  async updateMonitorResults(): Promise<void> {
    // No monitors in NBA
  }

  async loadSecurityAdvisories(): Promise<void> {
    // No advisories in NBA
  }
}
