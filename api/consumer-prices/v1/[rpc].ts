export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createConsumerPricesServiceRoutes } from '../../../src/generated/server/ivee/consumer_prices/v1/service_server';
import { consumerPricesHandler } from '../../../server/ivee/consumer-prices/v1/handler';

export default createDomainGateway(
  createConsumerPricesServiceRoutes(consumerPricesHandler, serverOptions),
);
