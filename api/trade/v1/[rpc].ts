export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createTradeServiceRoutes } from '../../../src/generated/server/ivee/trade/v1/service_server';
import { tradeHandler } from '../../../server/ivee/trade/v1/handler';

export default createDomainGateway(
  createTradeServiceRoutes(tradeHandler, serverOptions),
);
