import { Panel } from './Panel';
export class DefiTokensPanel extends Panel {
  constructor() {
    super({ id: 'defi-tokens', title: 'DefiTokens' });
  }

  renderTokens(tokens: any[]): void {
    console.log('[DefiTokensPanel] renderTokens:', tokens?.length, 'tokens');
  }

  showRetrying(msg?: string): void {
    console.log('[DefiTokensPanel] showRetrying:', msg);
  }
}
