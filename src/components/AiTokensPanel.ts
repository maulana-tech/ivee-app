import { Panel } from './Panel';
import { getChangeClass } from '@/utils';

interface TokenData {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

export class AiTokensPanel extends Panel {
  private tokens: TokenData[] = [];

  constructor() {
    super({ id: 'ai-tokens', title: 'AI Tokens' });
    this.element.classList.add('token-list-panel');
  }

  renderTokens(tokens: TokenData[]): void {
    this.tokens = tokens;
    this.render();
  }

  showRetrying(msg?: string): void {
    this.showLoading(msg || 'Loading AI tokens...');
  }

  private render(): void {
    if (this.tokens.length === 0) {
      this.showLoading('Loading AI tokens...');
      return;
    }

    const html = `
      <div class="token-list">
        ${this.tokens.map(t => this.renderToken(t)).join('')}
      </div>
    `;
    this.setContent(html);
  }

  private renderToken(token: TokenData): string {
    const changeClass = getChangeClass(token.change24h);
    const changePrefix = token.change24h >= 0 ? '+' : '';
    return `
      <div class="token-row">
        <div class="token-symbol">${token.symbol}</div>
        <div class="token-name">${token.name}</div>
        <div class="token-price">$${token.price.toFixed(2)}</div>
        <div class="token-change ${changeClass}">${changePrefix}${token.change24h.toFixed(2)}%</div>
      </div>
    `;
  }
}