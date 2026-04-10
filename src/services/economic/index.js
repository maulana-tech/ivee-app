/**
 * Unified economic service module -- replaces three legacy services:
 *   - src/services/fred.ts (FRED economic data)
 *   - src/services/oil-analytics.ts (EIA energy data)
 *   - src/services/worldbank.ts (World Bank indicators)
 *
 * All data now flows through the EconomicServiceClient RPC.
 */
import { getRpcBaseUrl } from '@/services/rpc-client';
import { EconomicServiceClient, ApiError, } from '@/generated/client/ivee/economic/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getCSSColor } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';
import { dataFreshness } from '../data-freshness';
import { getHydratedData } from '@/services/bootstrap';
import { toApiUrl } from '@/services/runtime';
// ---- Client + Circuit Breakers ----
const client = new EconomicServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const WB_BREAKERS_WARN_THRESHOLD = 50;
const wbBreakers = new Map();
function getWbBreaker(indicatorCode) {
    if (!wbBreakers.has(indicatorCode)) {
        if (wbBreakers.size >= WB_BREAKERS_WARN_THRESHOLD) {
            console.warn(`[wb] breaker pool at ${wbBreakers.size} — unexpected growth, investigate getWbBreaker callers`);
        }
        wbBreakers.set(indicatorCode, createCircuitBreaker({
            name: `WB:${indicatorCode}`,
            cacheTtlMs: 30 * 60 * 1000,
            persistCache: true,
        }));
    }
    return wbBreakers.get(indicatorCode);
}
const eiaBreaker = createCircuitBreaker({ name: 'EIA Energy', cacheTtlMs: 15 * 60 * 1000, persistCache: true });
const capacityBreaker = createCircuitBreaker({ name: 'EIA Capacity', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const bisPolicyBreaker = createCircuitBreaker({ name: 'BIS Policy', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const bisEerBreaker = createCircuitBreaker({ name: 'BIS EER', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const bisCreditBreaker = createCircuitBreaker({ name: 'BIS Credit', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const emptyBlsFallback = { series: undefined };
const blsBreaker = createCircuitBreaker({ name: 'BLS Batch', cacheTtlMs: 15 * 60 * 1000, persistCache: true });
const emptyFredBatchFallback = { results: {}, fetched: 0, requested: 0 };
const fredBatchBreaker = createCircuitBreaker({ name: 'FRED Batch', cacheTtlMs: 15 * 60 * 1000, persistCache: true });
const emptyWbFallback = { data: [], pagination: undefined };
const emptyEiaFallback = { prices: [] };
const emptyCrudeFallback = { weeks: [], latestPeriod: '' };
const crudeBreaker = createCircuitBreaker({ name: 'EIA Crude Inventories', cacheTtlMs: 60 * 60 * 1000, persistCache: true });
const emptyEuGasFallback = { fillPct: 0, fillPctChange1d: 0, gasDaysConsumption: 0, trend: 'stable', history: [], seededAt: '0', updatedAt: '', unavailable: true };
const euGasBreaker = createCircuitBreaker({ name: 'EU Gas Storage', cacheTtlMs: 4 * 60 * 60 * 1000, persistCache: true });
const emptyEurostatFallback = { countries: {}, seededAt: '0', unavailable: true };
const eurostatBreaker = createCircuitBreaker({ name: 'Eurostat Country Data', cacheTtlMs: 4 * 60 * 60 * 1000, persistCache: true });
const emptyNatGasFallback = { weeks: [], latestPeriod: '' };
const natGasBreaker = createCircuitBreaker({ name: 'EIA Nat Gas Storage', cacheTtlMs: 60 * 60 * 1000, persistCache: true });
const emptyCapacityFallback = { series: [] };
const emptyBisPolicyFallback = { rates: [] };
const emptyBisEerFallback = { rates: [] };
const emptyBisCreditFallback = { entries: [] };
const emptyOilStocksAnalysisFallback = {
    updatedAt: '',
    dataMonth: '',
    ieaMembers: [],
    belowObligation: [],
    unavailable: true,
};
const oilStocksAnalysisBreaker = createCircuitBreaker({ name: 'IEA Oil Stocks Analysis', cacheTtlMs: 4 * 60 * 60 * 1000, persistCache: true });
const FRED_SERIES = [
    { id: 'VIXCLS', name: 'VIX', unit: '', precision: 2 },
    { id: 'BAMLH0A0HYM2', name: 'HY Spread', unit: '%', precision: 2 },
    { id: 'ICSA', name: 'Jobless Claims', unit: '', precision: 0 },
    { id: 'MORTGAGE30US', name: '30Y Mortgage', unit: '%', precision: 2 },
    { id: 'FEDFUNDS', name: 'Fed Funds Rate', unit: '%', precision: 2 },
    { id: 'T10Y2Y', name: '10Y-2Y Spread', unit: '%', precision: 2 },
    { id: 'M2SL', name: 'M2 Supply', unit: '$T', precision: 1, scaleDivisor: 1000 },
    { id: 'UNRATE', name: 'Unemployment', unit: '%', precision: 1 },
    { id: 'CPIAUCSL', name: 'CPI Index', unit: '', precision: 1 },
    { id: 'DGS10', name: '10Y Treasury', unit: '%', precision: 2 },
    { id: 'WALCL', name: 'Fed Total Assets', unit: '$T', precision: 1, scaleDivisor: 1000 },
];
function toDisplayValue(value, config) {
    return value / (config.scaleDivisor ?? 1);
}
function roundValue(value, precision) {
    return Number(value.toFixed(precision));
}
export async function fetchFredData() {
    if (!isFeatureAvailable('economicFred'))
        return [];
    const resp = await fredBatchBreaker.execute(async () => {
        try {
            return await client.getFredSeriesBatch({ seriesIds: FRED_SERIES.map((c) => c.id), limit: 120 }, { signal: AbortSignal.timeout(30000) });
        }
        catch (err) {
            // 404 deploy-skew fallback: batch endpoint not yet deployed, use per-item calls
            if (err instanceof ApiError && err.statusCode === 404) {
                const items = await Promise.all(FRED_SERIES.map((c) => client.getFredSeries({ seriesId: c.id, limit: 120 }, { signal: AbortSignal.timeout(20000) })
                    .catch(() => ({ series: undefined }))));
                const fallbackResults = {};
                for (const item of items) {
                    if (item.series)
                        fallbackResults[item.series.seriesId] = item.series;
                }
                return { results: fallbackResults, fetched: Object.keys(fallbackResults).length, requested: FRED_SERIES.length };
            }
            throw err;
        }
    }, emptyFredBatchFallback, { shouldCache: (r) => r.fetched > 0 });
    const out = [];
    for (const config of FRED_SERIES) {
        const series = resp.results[config.id];
        if (!series)
            continue;
        const obs = series.observations;
        if (!obs || obs.length === 0)
            continue;
        if (obs.length >= 2) {
            const latest = obs[obs.length - 1];
            const previous = obs[obs.length - 2];
            const latestDisplayValue = toDisplayValue(latest.value, config);
            const previousDisplayValue = toDisplayValue(previous.value, config);
            const change = latestDisplayValue - previousDisplayValue;
            const changePercent = previous.value !== 0
                ? ((latest.value - previous.value) / previous.value) * 100
                : null;
            out.push({
                id: config.id, name: config.name,
                value: roundValue(latestDisplayValue, config.precision),
                previousValue: roundValue(previousDisplayValue, config.precision),
                change: roundValue(change, config.precision),
                changePercent: changePercent !== null ? Number(changePercent.toFixed(2)) : null,
                date: latest.date, unit: config.unit,
                observations: obs.slice(-30).map(o => ({ date: o.date, value: toDisplayValue(o.value, config) })),
            });
        }
        else {
            const latest = obs[0];
            const displayValue = toDisplayValue(latest.value, config);
            out.push({
                id: config.id, name: config.name,
                value: roundValue(displayValue, config.precision),
                previousValue: null, change: null, changePercent: null,
                date: latest.date, unit: config.unit,
                observations: obs.map(o => ({ date: o.date, value: toDisplayValue(o.value, config) })),
            });
        }
    }
    return out;
}
export function getFredStatus() {
    return fredBatchBreaker.getStatus();
}
const BLS_SERIES = [
    { id: 'USPRIV', name: 'Private Payrolls', unit: 'K', precision: 0 },
    { id: 'ECIALLCIV', name: 'Employment Cost Index', unit: '', precision: 1 },
];
export const BLS_METRO_IDS = new Set(); // metro-area LAUMT* series dropped — no FRED equivalent
export async function fetchBlsData() {
    return blsBreaker.execute(async () => {
        const results = await Promise.allSettled(BLS_SERIES.map(cfg => client.getBlsSeries({ seriesId: cfg.id, limit: 60 }, { signal: AbortSignal.timeout(15000) })
            .catch(() => emptyBlsFallback)));
        const out = [];
        for (let i = 0; i < BLS_SERIES.length; i++) {
            const cfg = BLS_SERIES[i];
            const result = results[i];
            if (result?.status !== 'fulfilled')
                continue;
            const series = result.value.series;
            if (!series || series.observations.length === 0)
                continue;
            const obs = series.observations;
            const observations = obs.map(o => ({
                date: `${o.year}-${o.period}`,
                value: parseFloat(o.value),
            })).filter(o => Number.isFinite(o.value));
            if (observations.length === 0)
                continue;
            const latest = observations[observations.length - 1];
            const previous = observations.length >= 2 ? observations[observations.length - 2] : null;
            const change = previous ? Number((latest.value - previous.value).toFixed(cfg.precision)) : null;
            const changePercent = previous && previous.value !== 0
                ? Number(((latest.value - previous.value) / previous.value * 100).toFixed(2))
                : null;
            const lastObs = obs[obs.length - 1];
            const displayDate = lastObs.periodName ? `${lastObs.periodName} ${lastObs.year}` : latest.date;
            out.push({
                id: cfg.id, name: cfg.name,
                value: Number(latest.value.toFixed(cfg.precision)),
                previousValue: previous ? Number(previous.value.toFixed(cfg.precision)) : null,
                change, changePercent,
                date: displayDate, unit: cfg.unit,
                observations: observations.slice(-30),
            });
        }
        return out;
    }, [], { shouldCache: (r) => r.length > 0 });
}
export function getChangeClass(change) {
    if (change === null)
        return '';
    if (change > 0)
        return 'positive';
    if (change < 0)
        return 'negative';
    return '';
}
function getFractionDigits(value) {
    const text = String(value);
    const decimal = text.split('.')[1];
    return decimal ? decimal.length : 0;
}
function formatValueWithUnit(value, unit) {
    const digits = getFractionDigits(value);
    const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    if (!unit)
        return formatted;
    if (unit.startsWith('$'))
        return `$${formatted}${unit.slice(1)}`;
    return `${formatted}${unit}`;
}
export function formatFredValue(value, unit) {
    if (value === null)
        return 'N/A';
    return formatValueWithUnit(value, unit);
}
export function formatChange(change, unit) {
    if (change === null)
        return 'N/A';
    const sign = change > 0 ? '+' : change < 0 ? '-' : '';
    return `${sign}${formatValueWithUnit(Math.abs(change), unit)}`;
}
function protoEnergyToOilMetric(proto) {
    const change = proto.change;
    return {
        id: proto.commodity,
        name: proto.name,
        description: `${proto.name} price/volume`,
        current: proto.price,
        previous: change !== 0 ? proto.price / (1 + change / 100) : proto.price,
        changePct: Math.round(change * 10) / 10,
        unit: proto.unit,
        trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable',
        lastUpdated: proto.priceAt ? new Date(proto.priceAt).toISOString() : new Date().toISOString(),
    };
}
export async function fetchOilAnalytics() {
    const empty = {
        wtiPrice: null, brentPrice: null, usProduction: null, usInventory: null, fetchedAt: new Date(),
    };
    if (!isFeatureAvailable('energyEia'))
        return empty;
    try {
        const resp = await eiaBreaker.execute(async () => {
            return client.getEnergyPrices({ commodities: [] }, { signal: AbortSignal.timeout(20000) }); // all commodities
        }, emptyEiaFallback, { shouldCache: (r) => r.prices.length > 0 });
        const byId = new Map();
        for (const p of resp.prices)
            byId.set(p.commodity, p);
        const result = {
            wtiPrice: byId.has('wti') ? protoEnergyToOilMetric(byId.get('wti')) : null,
            brentPrice: byId.has('brent') ? protoEnergyToOilMetric(byId.get('brent')) : null,
            usProduction: byId.has('production') ? protoEnergyToOilMetric(byId.get('production')) : null,
            usInventory: byId.has('inventory') ? protoEnergyToOilMetric(byId.get('inventory')) : null,
            fetchedAt: new Date(),
        };
        const metricCount = [result.wtiPrice, result.brentPrice, result.usProduction, result.usInventory]
            .filter(Boolean).length;
        if (metricCount > 0) {
            dataFreshness.recordUpdate('oil', metricCount);
        }
        return result;
    }
    catch {
        dataFreshness.recordError('oil', 'Fetch failed');
        return empty;
    }
}
export function formatOilValue(value, unit) {
    const v = Number(value);
    if (!Number.isFinite(v))
        return '—';
    if (unit.includes('$'))
        return `$${v.toFixed(2)}`;
    if (v >= 1000)
        return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(1);
}
export function getTrendIndicator(trend) {
    switch (trend) {
        case 'up': return '\u25B2';
        case 'down': return '\u25BC';
        default: return '\u25CF';
    }
}
export function getTrendColor(trend, inverse = false) {
    const upColor = inverse ? getCSSColor('--semantic-normal') : getCSSColor('--semantic-critical');
    const downColor = inverse ? getCSSColor('--semantic-critical') : getCSSColor('--semantic-normal');
    switch (trend) {
        case 'up': return upColor;
        case 'down': return downColor;
        default: return getCSSColor('--text-dim');
    }
}
export async function fetchCrudeInventoriesRpc() {
    if (!isFeatureAvailable('energyEia'))
        return emptyCrudeFallback;
    const hydrated = getHydratedData('crudeInventories');
    if (hydrated?.weeks?.length)
        return hydrated;
    try {
        return await crudeBreaker.execute(async () => {
            return client.getCrudeInventories({}, { signal: AbortSignal.timeout(20000) });
        }, emptyCrudeFallback, { shouldCache: (r) => r.weeks.length > 0 });
    }
    catch {
        return emptyCrudeFallback;
    }
}
export async function fetchNatGasStorageRpc() {
    if (!isFeatureAvailable('energyEia'))
        return emptyNatGasFallback;
    const hydrated = getHydratedData('natGasStorage');
    if (hydrated?.weeks?.length)
        return hydrated;
    try {
        return await natGasBreaker.execute(async () => {
            return client.getNatGasStorage({}, { signal: AbortSignal.timeout(20000) });
        }, emptyNatGasFallback, { shouldCache: (r) => r.weeks.length > 0 });
    }
    catch {
        return emptyNatGasFallback;
    }
}
// ========================================================================
// EIA Capacity -- installed generation capacity (solar, wind, coal)
// ========================================================================
export async function fetchEnergyCapacityRpc(energySources, years) {
    if (!isFeatureAvailable('energyEia'))
        return emptyCapacityFallback;
    try {
        return await capacityBreaker.execute(async () => {
            return client.getEnergyCapacity({
                energySources: energySources ?? [],
                years: years ?? 0,
            }, { signal: AbortSignal.timeout(20000) });
        }, emptyCapacityFallback, { shouldCache: (r) => r.series.length > 0 });
    }
    catch {
        return emptyCapacityFallback;
    }
}
const TECH_INDICATORS = {
    'IT.NET.USER.ZS': 'Internet Users (% of population)',
    'IT.CEL.SETS.P2': 'Mobile Subscriptions (per 100 people)',
    'IT.NET.BBND.P2': 'Fixed Broadband Subscriptions (per 100 people)',
    'IT.NET.SECR.P6': 'Secure Internet Servers (per million people)',
    'GB.XPD.RSDV.GD.ZS': 'R&D Expenditure (% of GDP)',
    'IP.PAT.RESD': 'Patent Applications (residents)',
    'IP.PAT.NRES': 'Patent Applications (non-residents)',
    'IP.TMK.TOTL': 'Trademark Applications',
    'TX.VAL.TECH.MF.ZS': 'High-Tech Exports (% of manufactured exports)',
    'BX.GSR.CCIS.ZS': 'ICT Service Exports (% of service exports)',
    'TM.VAL.ICTG.ZS.UN': 'ICT Goods Imports (% of total goods imports)',
    'SE.TER.ENRR': 'Tertiary Education Enrollment (%)',
    'SE.XPD.TOTL.GD.ZS': 'Education Expenditure (% of GDP)',
    'NY.GDP.MKTP.KD.ZG': 'GDP Growth (annual %)',
    'NY.GDP.PCAP.CD': 'GDP per Capita (current US$)',
    'NE.EXP.GNFS.ZS': 'Exports of Goods & Services (% of GDP)',
};
const TECH_COUNTRIES = [
    'USA', 'CHN', 'JPN', 'DEU', 'KOR', 'GBR', 'IND', 'ISR', 'SGP', 'TWN',
    'FRA', 'CAN', 'SWE', 'NLD', 'CHE', 'FIN', 'IRL', 'AUS', 'BRA', 'IDN',
    'ARE', 'SAU', 'QAT', 'BHR', 'EGY', 'TUR',
    'MYS', 'THA', 'VNM', 'PHL',
    'ESP', 'ITA', 'POL', 'CZE', 'DNK', 'NOR', 'AUT', 'BEL', 'PRT', 'EST',
    'MEX', 'ARG', 'CHL', 'COL',
    'ZAF', 'NGA', 'KEN',
];
export async function getAvailableIndicators() {
    return { indicators: TECH_INDICATORS, defaultCountries: TECH_COUNTRIES };
}
function buildWorldBankResponse(indicator, records) {
    const byCountry = {};
    const latestByCountry = {};
    const timeSeries = [];
    const indicatorName = records[0]?.indicatorName || TECH_INDICATORS[indicator] || indicator;
    for (const r of records) {
        const cc = r.countryCode;
        if (!cc)
            continue;
        const yearStr = String(r.year);
        if (!byCountry[cc]) {
            byCountry[cc] = { code: cc, name: r.countryName, values: [] };
        }
        byCountry[cc].values.push({ year: yearStr, value: r.value });
        if (!latestByCountry[cc] || yearStr > latestByCountry[cc].year) {
            latestByCountry[cc] = { code: cc, name: r.countryName, year: yearStr, value: r.value };
        }
        timeSeries.push({
            countryCode: cc,
            countryName: r.countryName,
            year: yearStr,
            value: r.value,
        });
    }
    // Sort values oldest first
    for (const c of Object.values(byCountry)) {
        c.values.sort((a, b) => a.year.localeCompare(b.year));
    }
    timeSeries.sort((a, b) => b.year.localeCompare(a.year) || a.countryCode.localeCompare(b.countryCode));
    return {
        indicator,
        indicatorName,
        metadata: { page: 1, pages: 1, total: records.length },
        byCountry,
        latestByCountry,
        timeSeries,
    };
}
export async function getIndicatorData(indicator, options = {}) {
    const { countries, years = 5 } = options;
    const resp = await getWbBreaker(indicator).execute(async () => {
        return client.listWorldBankIndicators({
            indicatorCode: indicator,
            countryCode: countries?.join(';') || '',
            year: years,
            pageSize: 0,
            cursor: '',
        }, { signal: AbortSignal.timeout(20000) });
    }, emptyWbFallback);
    return buildWorldBankResponse(indicator, resp.data);
}
export const INDICATOR_PRESETS = {
    digitalInfrastructure: [
        'IT.NET.USER.ZS',
        'IT.CEL.SETS.P2',
        'IT.NET.BBND.P2',
        'IT.NET.SECR.P6',
    ],
    innovation: [
        'GB.XPD.RSDV.GD.ZS',
        'IP.PAT.RESD',
        'IP.PAT.NRES',
    ],
    techTrade: [
        'TX.VAL.TECH.MF.ZS',
        'BX.GSR.CCIS.ZS',
    ],
    education: [
        'SE.TER.ENRR',
        'SE.XPD.TOTL.GD.ZS',
    ],
};
export async function getTechReadinessRankings(countries) {
    // Fast path: bootstrap-hydrated data available on first page load
    const hydrated = getHydratedData('techReadiness');
    if (hydrated?.length && !countries)
        return hydrated;
    // Fallback: fetch the pre-computed seed key directly from bootstrap endpoint.
    // Data is seeded by seed-wb-indicators.mjs — never call WB API from frontend.
    try {
        const resp = await fetch(toApiUrl('/api/bootstrap?keys=techReadiness'), {
            signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
            const { data } = (await resp.json());
            if (data.techReadiness?.length) {
                const scores = countries
                    ? data.techReadiness.filter(s => countries.includes(s.country))
                    : data.techReadiness;
                return scores;
            }
        }
    }
    catch { /* fall through */ }
    return [];
}
export async function getCountryComparison(indicator, _countryCodes) {
    // All WB data is now pre-seeded by seed-wb-indicators.mjs.
    // This function is unused but kept for API compat.
    return {
        indicator,
        indicatorName: TECH_INDICATORS[indicator] || indicator,
        metadata: { page: 0, pages: 0, total: 0 },
        byCountry: {},
        latestByCountry: {},
        timeSeries: [],
    };
}
// ========================================================================
// National Debt Clock
// ========================================================================
// No persistCache: IndexedDB hydration on first call can deadlock in some browsers,
// causing the panel to hang indefinitely on "Loading debt data from IMF..."
const nationalDebtBreaker = createCircuitBreaker({ name: 'National Debt', cacheTtlMs: 6 * 60 * 60 * 1000 });
const emptyNationalDebtFallback = { entries: [], seededAt: '', unavailable: true };
export async function getNationalDebtData() {
    const hydrated = getHydratedData('nationalDebt');
    if (hydrated?.entries?.length)
        return hydrated;
    // Race all fetch paths against a hard 20s deadline so the panel never hangs.
    return Promise.race([
        _fetchNationalDebt(),
        new Promise(resolve => setTimeout(() => resolve(emptyNationalDebtFallback), 20000)),
    ]);
}
async function _fetchNationalDebt() {
    try {
        const resp = await fetch(toApiUrl('/api/bootstrap?keys=nationalDebt'), {
            signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
            const { data } = (await resp.json());
            if (data.nationalDebt?.entries?.length)
                return data.nationalDebt;
        }
    }
    catch { /* fall through to RPC */ }
    try {
        return await nationalDebtBreaker.execute(async () => {
            return client.getNationalDebt({}, { signal: AbortSignal.timeout(12000) });
        }, emptyNationalDebtFallback, { shouldCache: (r) => r.entries.length > 0 });
    }
    catch {
        return emptyNationalDebtFallback;
    }
}
export async function fetchBisData() {
    const empty = { policyRates: [], exchangeRates: [], creditToGdp: [], fetchedAt: new Date() };
    const hPolicy = getHydratedData('bisPolicy');
    const hEer = getHydratedData('bisExchange');
    const hCredit = getHydratedData('bisCredit');
    try {
        const [policy, eer, credit] = await Promise.all([
            hPolicy?.rates?.length ? Promise.resolve(hPolicy) : bisPolicyBreaker.execute(() => client.getBisPolicyRates({}, { signal: AbortSignal.timeout(20000) }), emptyBisPolicyFallback, { shouldCache: (r) => (r.rates?.length ?? 0) > 0 }),
            hEer?.rates?.length ? Promise.resolve(hEer) : bisEerBreaker.execute(() => client.getBisExchangeRates({}, { signal: AbortSignal.timeout(20000) }), emptyBisEerFallback, { shouldCache: (r) => (r.rates?.length ?? 0) > 0 }),
            hCredit?.entries?.length ? Promise.resolve(hCredit) : bisCreditBreaker.execute(() => client.getBisCredit({}, { signal: AbortSignal.timeout(20000) }), emptyBisCreditFallback, { shouldCache: (r) => (r.entries?.length ?? 0) > 0 }),
        ]);
        return {
            policyRates: policy.rates ?? [],
            exchangeRates: eer.rates ?? [],
            creditToGdp: credit.entries ?? [],
            fetchedAt: new Date(),
        };
    }
    catch {
        return empty;
    }
}
const ecbFxRatesBreaker = createCircuitBreaker({ name: 'ECB FX Rates', cacheTtlMs: 4 * 60 * 60 * 1000 });
const emptyEcbFxRatesFallback = { rates: [], updatedAt: '', seededAt: '0', unavailable: true };
export async function getEcbFxRatesData() {
    const hydrated = getHydratedData('ecbFxRates');
    if (hydrated?.rates?.length)
        return hydrated;
    try {
        return await ecbFxRatesBreaker.execute(() => client.getEcbFxRates({}, { signal: AbortSignal.timeout(12000) }), emptyEcbFxRatesFallback, { shouldCache: (r) => (r.rates?.length ?? 0) > 0 });
    }
    catch {
        return emptyEcbFxRatesFallback;
    }
}
export async function getEuGasStorageData() {
    const hydrated = getHydratedData('euGasStorage');
    if (hydrated && !hydrated.unavailable && hydrated.fillPct > 0)
        return hydrated;
    try {
        return await euGasBreaker.execute(() => client.getEuGasStorage({}, { signal: AbortSignal.timeout(12000) }), emptyEuGasFallback, { shouldCache: (r) => !r.unavailable && r.fillPct > 0 });
    }
    catch {
        return emptyEuGasFallback;
    }
}
export async function getEurostatCountryData() {
    const hydrated = getHydratedData('eurostatCountryData');
    if (hydrated && !hydrated.unavailable && Object.keys(hydrated.countries).length > 0)
        return hydrated;
    try {
        return await eurostatBreaker.execute(() => client.getEurostatCountryData({}, { signal: AbortSignal.timeout(12000) }), emptyEurostatFallback, { shouldCache: (r) => !r.unavailable && Object.keys(r.countries).length > 0 });
    }
    catch {
        return emptyEurostatFallback;
    }
}
export async function getOilStocksAnalysisData() {
    const hydrated = getHydratedData('oilStocksAnalysis');
    if (hydrated && !hydrated.unavailable && hydrated.ieaMembers.length > 0)
        return hydrated;
    try {
        return await oilStocksAnalysisBreaker.execute(() => client.getOilStocksAnalysis({}, { signal: AbortSignal.timeout(12000) }), emptyOilStocksAnalysisFallback, { shouldCache: (r) => !r.unavailable && r.ieaMembers.length > 0 });
    }
    catch {
        return emptyOilStocksAnalysisFallback;
    }
}
export async function fetchLngVulnerability() {
    const hydrated = getHydratedData('lngVulnerability');
    if (hydrated?.top20LngDependent?.length)
        return hydrated;
    return null;
}
