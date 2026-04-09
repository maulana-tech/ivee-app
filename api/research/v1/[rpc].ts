export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createResearchServiceRoutes } from '../../../src/generated/server/ivee/research/v1/service_server';
import { researchHandler } from '../../../server/ivee/research/v1/handler';

export default createDomainGateway(
  createResearchServiceRoutes(researchHandler, serverOptions),
);
