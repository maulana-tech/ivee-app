import { Panel } from './Panel';
export class CryptoPanel extends Panel {
  constructor() {
    super({ id: 'crypto', title: 'Crypto' });
  }

  renderCrypto(crypto: any[]): void {
    console.log('[CryptoPanel] renderCrypto:', crypto?.length, 'coins');
  }
}
