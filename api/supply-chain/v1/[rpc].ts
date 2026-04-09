export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createSupplyChainServiceRoutes } from '../../../src/generated/server/ivee/supply_chain/v1/service_server';
import { supplyChainHandler } from '../../../server/ivee/supply-chain/v1/handler';

export default createDomainGateway(
  createSupplyChainServiceRoutes(supplyChainHandler, serverOptions),
);
