/**
 * Renewable Energy Installation Data Service
 *
 * Curated dataset of notable renewable energy installations worldwide,
 * including utility-scale solar farms, wind farms, hydro stations, and
 * geothermal sites. Compiled from WRI Global Power Plant Database and
 * published project reports.
 *
 * Refresh cadence: update renewable-installations.json when notable
 * new installations reach operational status.
 */
/**
 * Load curated renewable energy installations from static JSON.
 * Uses dynamic import for code-splitting (JSON only loaded for happy variant).
 */
export async function fetchRenewableInstallations() {
    const { default: data } = await import('@/data/renewable-installations.json');
    return data;
}
