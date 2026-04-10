import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';
const R2_PROXY = import.meta.env.VITE_PMTILES_URL ?? '';
const R2_PUBLIC = import.meta.env.VITE_PMTILES_URL_PUBLIC ?? '';
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
const R2_BASE = isTauri && R2_PUBLIC ? R2_PUBLIC : R2_PROXY;
const hasTilesUrl = !!R2_BASE;
let registered = false;
export function registerPMTilesProtocol() {
    if (registered)
        return;
    registered = true;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
}
export function buildPMTilesStyle(flavor) {
    if (!hasTilesUrl)
        return null;
    const spriteName = ['light', 'white'].includes(flavor) ? 'light' : 'dark';
    return {
        version: 8,
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${spriteName}`,
        sources: {
            basemap: {
                type: 'vector',
                url: `pmtiles://${R2_BASE}`,
                attribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
            },
        },
        layers: layers('basemap', namedFlavor(flavor), { lang: 'en' }),
    };
}
export const FALLBACK_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
export const FALLBACK_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const STORAGE_KEY = 'wm-map-provider';
const THEME_STORAGE_PREFIX = 'wm-map-theme:';
export { hasTilesUrl as hasPMTilesUrl };
export const MAP_PROVIDER_OPTIONS = (() => {
    const opts = [];
    if (hasTilesUrl) {
        opts.push({ value: 'auto', label: 'Auto (PMTiles → OpenFreeMap fallback)' });
        opts.push({ value: 'pmtiles', label: 'PMTiles (self-hosted)' });
    }
    opts.push({ value: 'openfreemap', label: 'OpenFreeMap' });
    opts.push({ value: 'carto', label: 'CARTO' });
    return opts;
})();
const PMTILES_THEMES = [
    { value: 'black', label: 'Black (deepest dark)' },
    { value: 'dark', label: 'Dark' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'light', label: 'Light' },
    { value: 'white', label: 'White' },
];
export const MAP_THEME_OPTIONS = {
    pmtiles: PMTILES_THEMES,
    auto: PMTILES_THEMES,
    openfreemap: [
        { value: 'dark', label: 'Dark' },
        { value: 'positron', label: 'Positron (light)' },
    ],
    carto: [
        { value: 'dark-matter', label: 'Dark Matter' },
        { value: 'voyager', label: 'Voyager (light)' },
        { value: 'positron', label: 'Positron (light)' },
    ],
};
const DEFAULT_THEME = {
    pmtiles: 'black',
    auto: 'black',
    openfreemap: 'dark',
    carto: 'dark-matter',
};
export function getMapProvider() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        if (stored === 'pmtiles' || stored === 'auto') {
            return hasTilesUrl ? stored : 'openfreemap';
        }
        return stored;
    }
    return hasTilesUrl ? 'auto' : 'openfreemap';
}
export function setMapProvider(provider) {
    localStorage.setItem(STORAGE_KEY, provider);
}
export function getMapTheme(provider) {
    const stored = localStorage.getItem(THEME_STORAGE_PREFIX + provider);
    const options = MAP_THEME_OPTIONS[provider];
    if (stored && options.some(o => o.value === stored))
        return stored;
    return DEFAULT_THEME[provider];
}
export function setMapTheme(provider, theme) {
    const options = MAP_THEME_OPTIONS[provider];
    if (!options.some(o => o.value === theme))
        return;
    localStorage.setItem(THEME_STORAGE_PREFIX + provider, theme);
}
export function isLightMapTheme(mapTheme) {
    return ['light', 'white', 'positron', 'voyager'].includes(mapTheme);
}
const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_VOYAGER = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const CARTO_POSITRON = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const CARTO_STYLES = {
    'dark-matter': CARTO_DARK,
    'voyager': CARTO_VOYAGER,
    'positron': CARTO_POSITRON,
};
function asPMTilesTheme(mapTheme) {
    const valid = PMTILES_THEMES.some(o => o.value === mapTheme);
    return (valid ? mapTheme : 'black');
}
export function getStyleForProvider(provider, mapTheme) {
    const lightFallback = isLightMapTheme(mapTheme);
    switch (provider) {
        case 'pmtiles': {
            const style = buildPMTilesStyle(asPMTilesTheme(mapTheme));
            if (style)
                return style;
            return lightFallback ? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE;
        }
        case 'openfreemap':
            return mapTheme === 'positron' ? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE;
        case 'carto':
            return CARTO_STYLES[mapTheme] ?? CARTO_DARK;
        default: {
            const pmtiles = buildPMTilesStyle(asPMTilesTheme(mapTheme));
            return pmtiles ?? (lightFallback ? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE);
        }
    }
}
