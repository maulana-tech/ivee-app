import { Panel } from './Panel';
export class CryptoHeatmapPanel extends Panel {
  constructor() {
    super({ id: 'crypto-heatmap', title: 'CryptoHeatmap' });
  }

  renderSectors(sectors: any[]): void {
    console.log('[CryptoHeatmapPanel] renderSectors:', sectors?.length, 'sectors');
  }

  showRetrying(msg?: string): void {
    console.log('[CryptoHeatmapPanel] showRetrying:', msg);
  }
}
