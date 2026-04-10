import { Panel } from './Panel';
export class OtherTokensPanel extends Panel {
  constructor() {
    super({ id: 'other-tokens', title: 'OtherTokens' });
  }

  renderTokens(tokens: any[]): void {
    console.log('[OtherTokensPanel] renderTokens:', tokens?.length, 'tokens');
  }

  showRetrying(msg?: string): void {
    console.log('[OtherTokensPanel] showRetrying:', msg);
  }
}
