import type { Plugin } from 'vite';

export function createSebufApiPlugin(): Plugin {
  let cachedRouter: Awaited<ReturnType<typeof buildRouter>> | null = null;
  let cachedCorsMod: any = null;

  async function buildRouter() {
    const routerMod = await import('./server/router');
    const corsMod = await import('./server/cors');
    const errorMod = await import('./server/error-mapper');
    const seismologyServerMod = await import('./src/generated/server/ivee/seismology/v1/service_server');
    const seismologyHandlerMod = await import('./server/ivee/seismology/v1/handler');
    const wildfireServerMod = await import('./src/generated/server/ivee/wildfire/v1/service_server');
    const wildfireHandlerMod = await import('./server/ivee/wildfire/v1/handler');
    const climateServerMod = await import('./src/generated/server/ivee/climate/v1/service_server');
    const climateHandlerMod = await import('./server/ivee/climate/v1/handler');
    const predictionServerMod = await import('./src/generated/server/ivee/prediction/v1/service_server');
    const predictionHandlerMod = await import('./server/ivee/prediction/v1/handler');
    const displacementServerMod = await import('./src/generated/server/ivee/displacement/v1/service_server');
    const displacementHandlerMod = await import('./server/ivee/displacement/v1/handler');
    const aviationServerMod = await import('./src/generated/server/ivee/aviation/v1/service_server');
    const aviationHandlerMod = await import('./server/ivee/aviation/v1/handler');
    const researchServerMod = await import('./src/generated/server/ivee/research/v1/service_server');
    const researchHandlerMod = await import('./server/ivee/research/v1/handler');
    const unrestServerMod = await import('./src/generated/server/ivee/unrest/v1/service_server');
    const unrestHandlerMod = await import('./server/ivee/unrest/v1/handler');
    const conflictServerMod = await import('./src/generated/server/ivee/conflict/v1/service_server');
    const conflictHandlerMod = await import('./server/ivee/conflict/v1/handler');
    const maritimeServerMod = await import('./src/generated/server/ivee/maritime/v1/service_server');
    const maritimeHandlerMod = await import('./server/ivee/maritime/v1/handler');
    const cyberServerMod = await import('./src/generated/server/ivee/cyber/v1/service_server');
    const cyberHandlerMod = await import('./server/ivee/cyber/v1/handler');
    const economicServerMod = await import('./src/generated/server/ivee/economic/v1/service_server');
    const economicHandlerMod = await import('./server/ivee/economic/v1/handler');
    const infrastructureServerMod = await import('./src/generated/server/ivee/infrastructure/v1/service_server');
    const infrastructureHandlerMod = await import('./server/ivee/infrastructure/v1/handler');
    const marketServerMod = await import('./src/generated/server/ivee/market/v1/service_server');
    const marketHandlerMod = await import('./server/ivee/market/v1/handler');
    const newsServerMod = await import('./src/generated/server/ivee/news/v1/service_server');
    const newsHandlerMod = await import('./server/ivee/news/v1/handler');
    const intelligenceServerMod = await import('./src/generated/server/ivee/intelligence/v1/service_server');
    const intelligenceHandlerMod = await import('./server/ivee/intelligence/v1/handler');
    const militaryServerMod = await import('./src/generated/server/ivee/military/v1/service_server');
    const militaryHandlerMod = await import('./server/ivee/military/v1/handler');
    const positiveEventsServerMod = await import('./src/generated/server/ivee/positive_events/v1/service_server');
    const positiveEventsHandlerMod = await import('./server/ivee/positive-events/v1/handler');
    const givingServerMod = await import('./src/generated/server/ivee/giving/v1/service_server');
    const givingHandlerMod = await import('./server/ivee/giving/v1/handler');
    const tradeServerMod = await import('./src/generated/server/ivee/trade/v1/service_server');
    const tradeHandlerMod = await import('./server/ivee/trade/v1/handler');
    const supplyChainServerMod = await import('./src/generated/server/ivee/supply_chain/v1/service_server');
    const supplyChainHandlerMod = await import('./server/ivee/supply-chain/v1/handler');
    const naturalServerMod = await import('./src/generated/server/ivee/natural/v1/service_server');
    const naturalHandlerMod = await import('./server/ivee/natural/v1/handler');
    const resilienceServerMod = await import('./src/generated/server/ivee/resilience/v1/service_server');
    const resilienceHandlerMod = await import('./server/ivee/resilience/v1/handler');

    const serverOptions = { onError: errorMod.mapErrorToResponse };
    const allRoutes = [
      ...seismologyServerMod.createSeismologyServiceRoutes(seismologyHandlerMod.seismologyHandler, serverOptions),
      ...wildfireServerMod.createWildfireServiceRoutes(wildfireHandlerMod.wildfireHandler, serverOptions),
      ...climateServerMod.createClimateServiceRoutes(climateHandlerMod.climateHandler, serverOptions),
      ...predictionServerMod.createPredictionServiceRoutes(predictionHandlerMod.predictionHandler, serverOptions),
      ...displacementServerMod.createDisplacementServiceRoutes(displacementHandlerMod.displacementHandler, serverOptions),
      ...aviationServerMod.createAviationServiceRoutes(aviationHandlerMod.aviationHandler, serverOptions),
      ...researchServerMod.createResearchServiceRoutes(researchHandlerMod.researchHandler, serverOptions),
      ...unrestServerMod.createUnrestServiceRoutes(unrestHandlerMod.unrestHandler, serverOptions),
      ...conflictServerMod.createConflictServiceRoutes(conflictHandlerMod.conflictHandler, serverOptions),
      ...maritimeServerMod.createMaritimeServiceRoutes(maritimeHandlerMod.maritimeHandler, serverOptions),
      ...cyberServerMod.createCyberServiceRoutes(cyberHandlerMod.cyberHandler, serverOptions),
      ...economicServerMod.createEconomicServiceRoutes(economicHandlerMod.economicHandler, serverOptions),
      ...infrastructureServerMod.createInfrastructureServiceRoutes(infrastructureHandlerMod.infrastructureHandler, serverOptions),
      ...marketServerMod.createMarketServiceRoutes(marketHandlerMod.marketHandler, serverOptions),
      ...newsServerMod.createNewsServiceRoutes(newsHandlerMod.newsHandler, serverOptions),
      ...intelligenceServerMod.createIntelligenceServiceRoutes(intelligenceHandlerMod.intelligenceHandler, serverOptions),
      ...militaryServerMod.createMilitaryServiceRoutes(militaryHandlerMod.militaryHandler, serverOptions),
      ...positiveEventsServerMod.createPositiveEventsServiceRoutes(positiveEventsHandlerMod.positiveEventsHandler, serverOptions),
      ...givingServerMod.createGivingServiceRoutes(givingHandlerMod.givingHandler, serverOptions),
      ...tradeServerMod.createTradeServiceRoutes(tradeHandlerMod.tradeHandler, serverOptions),
      ...supplyChainServerMod.createSupplyChainServiceRoutes(supplyChainHandlerMod.supplyChainHandler, serverOptions),
      ...naturalServerMod.createNaturalServiceRoutes(naturalHandlerMod.naturalHandler, serverOptions),
      ...resilienceServerMod.createResilienceServiceRoutes(resilienceHandlerMod.resilienceHandler, serverOptions),
    ];
    cachedCorsMod = corsMod;
    return routerMod.createRouter(allRoutes);
  }

  return {
    name: 'sebuf-api',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.includes('/server/') || file.includes('/src/generated/server/')) {
          cachedRouter = null;
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !/^\/api\/[a-z-]+\/v1\//.test(req.url)) {
          return next();
        }

        try {
          if (!cachedRouter) {
            cachedRouter = await buildRouter();
          }
          const router = cachedRouter;
          const corsMod = cachedCorsMod;

          const port = server.config.server.port || 3000;
          const url = new URL(req.url, `http://localhost:${port}`);

          let body: string | undefined;
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks).toString();
          }

          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
              headers[key] = value;
            } else if (Array.isArray(value)) {
              headers[key] = value.join(', ');
            }
          }

          const webRequest = new Request(url.toString(), {
            method: req.method,
            headers,
            body: body || undefined,
          });

          const corsHeaders = corsMod.getCorsHeaders(webRequest);

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            for (const [key, value] of Object.entries(corsHeaders)) {
              res.setHeader(key, value);
            }
            res.end();
            return;
          }

          if (corsMod.isDisallowedOrigin(webRequest)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            for (const [key, value] of Object.entries(corsHeaders)) {
              res.setHeader(key, value);
            }
            res.end(JSON.stringify({ error: 'Origin not allowed' }));
            return;
          }

          const matchedHandler = router.match(webRequest);
          if (!matchedHandler) {
            const allowed = router.allowedMethods(new URL(webRequest.url).pathname);
            if (allowed.length > 0) {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Allow', allowed.join(', '));
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
            }
            for (const [key, value] of Object.entries(corsHeaders)) {
              res.setHeader(key, value);
            }
            res.end(JSON.stringify({ error: res.statusCode === 405 ? 'Method not allowed' : 'Not found' }));
            return;
          }

          const response = await matchedHandler(webRequest);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          for (const [key, value] of Object.entries(corsHeaders)) {
            res.setHeader(key, value);
          }
          res.end(await response.text());
        } catch (err) {
          console.error('[sebuf-api] Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    },
  };
}
