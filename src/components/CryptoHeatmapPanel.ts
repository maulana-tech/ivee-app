import { Panel } from './Panel';
import { formatChange, getChangeClass } from '@/utils';

interface SectorData {
  id: string;
  name: string;
  change: number;
}

export class CryptoHeatmapPanel extends Panel {
  private sectors: SectorData[] = [];

  constructor() {
    super({ id: 'crypto-heatmap', title: 'Crypto Sectors' });
    this.element.classList.add('heatmap-panel');
  }

  renderSectors(sectors: SectorData[]): void {
    this.sectors = sectors;
    this.render();
  }

  showRetrying(msg?: string): void {
    this.showLoading(msg || 'Loading sectors...');
  }

  private render(): void {
    if (this.sectors.length === 0) {
      this.showLoading('Loading crypto sectors...');
      return;
    }

    const html = `
      <div class="heatmap-grid">
        ${this.sectors.map(s => this.renderSector(s)).join('')}
      </div>
    `;
    this.setContent(html);
  }

  private renderSector(sector: SectorData): string {
    const changeClass = getChangeClass(sector.change);
    const changePrefix = sector.change >= 0 ? '+' : '';
    return `
      <div class="heatmap-cell ${changeClass}">
        <div class="heatmap-name">${sector.name}</div>
        <div class="heatmap-change">${changePrefix}${sector.change.toFixed(2)}%</div>
      </div>
    `;
  }
}