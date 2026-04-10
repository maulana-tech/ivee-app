import { Panel } from './Panel';
export class AiTokensPanel extends Panel {
  constructor() {
    super({ id: 'ai-tokens', title: 'AiTokens' });
  }

  renderTokens(tokens: any[]): void {
    console.log('[AiTokensPanel] renderTokens:', tokens?.length, 'tokens');
  }

  showRetrying(msg?: string): void {
    console.log('[AiTokensPanel] showRetrying:', msg);
  }
}
