import type { ForecastServiceHandler } from '../../../../src/generated/server/ivee/forecast/v1/service_server';
import { getForecasts } from './get-forecasts';
import { getSimulationPackage } from './get-simulation-package';
import { getSimulationOutcome } from './get-simulation-outcome';

export const forecastHandler: ForecastServiceHandler = { getForecasts, getSimulationPackage, getSimulationOutcome };
