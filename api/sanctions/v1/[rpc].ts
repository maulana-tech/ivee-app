export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createSanctionsServiceRoutes } from '../../../src/generated/server/ivee/sanctions/v1/service_server';
import { sanctionsHandler } from '../../../server/ivee/sanctions/v1/handler';

export default createDomainGateway(
  createSanctionsServiceRoutes(sanctionsHandler, serverOptions),
);
