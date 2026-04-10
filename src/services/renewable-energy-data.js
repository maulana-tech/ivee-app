/**
 * Renewable energy data service -- displays World Bank renewable electricity
 * indicator (EG.ELC.RNEW.ZS) for global + regional breakdown.
 *
 * Data is pre-seeded by seed-wb-indicators.mjs on Railway and read
 * from bootstrap/Redis. Never calls WB API from the frontend.
 *
 * EIA installed capacity (solar, wind, coal) still uses the RPC
 * endpoint since it's a different data source (not World Bank).
 */
import { fetchEnergyCapacityRpc } from '@/services/economic';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { toApiUrl } from '@/services/runtime';
// ---- Default / Empty ----
// Static fallback when seed data is unavailable and no cache exists.
// Source: https://data.worldbank.org/indicator/EG.ELC.RNEW.ZS — last verified Feb 2026
const FALLBACK_DATA = {
    globalPercentage: 29.6,
    globalYear: 2022,
    historicalData: [
        { year: 1990, value: 19.8 }, { year: 1995, value: 19.2 }, { year: 2000, value: 18.6 },
        { year: 2005, value: 18.0 }, { year: 2010, value: 20.3 }, { year: 2012, value: 21.6 },
        { year: 2014, value: 22.6 }, { year: 2016, value: 24.0 }, { year: 2018, value: 25.7 },
        { year: 2020, value: 28.2 }, { year: 2021, value: 28.7 }, { year: 2022, value: 29.6 },
    ],
    regions: [
        { code: 'LCN', name: 'Latin America & Caribbean', percentage: 58.1, year: 2022 },
        { code: 'SSF', name: 'Sub-Saharan Africa', percentage: 47.2, year: 2022 },
        { code: 'ECS', name: 'Europe & Central Asia', percentage: 35.8, year: 2022 },
        { code: 'SAS', name: 'South Asia', percentage: 22.1, year: 2022 },
        { code: 'EAS', name: 'East Asia & Pacific', percentage: 21.9, year: 2022 },
        { code: 'NAC', name: 'North America', percentage: 21.5, year: 2022 },
        { code: 'MEA', name: 'Middle East & N. Africa', percentage: 5.3, year: 2022 },
    ],
};
// ---- Circuit Breaker (persistent cache for instant reload) ----
const renewableBreaker = createCircuitBreaker({
    name: 'Renewable Energy',
    cacheTtlMs: 60 * 60 * 1000, // 1h — World Bank data changes yearly
    persistCache: true,
});
const capacityBreaker = createCircuitBreaker({
    name: 'Energy Capacity',
    cacheTtlMs: 60 * 60 * 1000,
    persistCache: true,
});
// ---- Data Fetching (from Railway seed via bootstrap) ----
async function fetchRenewableEnergyDataFresh() {
    // 1. Try bootstrap hydration cache (first page load)
    const hydrated = getHydratedData('renewableEnergy');
    if (hydrated?.historicalData?.length)
        return hydrated;
    // 2. Fallback: fetch from bootstrap endpoint directly
    try {
        const resp = await fetch(toApiUrl('/api/bootstrap?keys=renewableEnergy'), {
            signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
            const { data } = (await resp.json());
            if (data.renewableEnergy?.historicalData?.length)
                return data.renewableEnergy;
        }
    }
    catch { /* fall through */ }
    // 3. Static fallback
    return FALLBACK_DATA;
}
/**
 * Fetch renewable energy data with persistent caching.
 * Returns instantly from IndexedDB cache on subsequent loads.
 */
export async function fetchRenewableEnergyData() {
    return renewableBreaker.execute(() => fetchRenewableEnergyDataFresh(), FALLBACK_DATA);
}
/**
 * Fetch installed generation capacity for solar, wind, and coal from EIA.
 * Returns typed CapacitySeries[] ready for panel rendering.
 * Gracefully degrades: on failure returns empty array.
 */
export async function fetchEnergyCapacity() {
    return capacityBreaker.execute(async () => {
        const resp = await fetchEnergyCapacityRpc(['SUN', 'WND', 'COL'], 25);
        return resp.series.map(s => ({
            source: s.energySource,
            name: s.name,
            data: s.data.map(d => ({ year: d.year, capacityMw: d.capacityMw })),
        }));
    }, []);
}
