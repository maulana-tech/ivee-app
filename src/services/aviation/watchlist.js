/**
 * Aviation watchlist service — persists to localStorage.
 * Stores a short list of airports, airlines, and routes the user cares about.
 */
const STORAGE_KEY = 'aviation:watchlist:v1';
const DEFAULT_WATCHLIST = {
    airports: ['IST', 'ESB', 'SAW', 'LHR', 'FRA', 'CDG', 'DXB', 'RUH'],
    airlines: ['TK'],
    routes: ['IST-LHR', 'IST-FRA'],
};
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { ...DEFAULT_WATCHLIST };
        const parsed = JSON.parse(raw);
        return {
            airports: Array.isArray(parsed.airports) ? parsed.airports : DEFAULT_WATCHLIST.airports,
            airlines: Array.isArray(parsed.airlines) ? parsed.airlines : DEFAULT_WATCHLIST.airlines,
            routes: Array.isArray(parsed.routes) ? parsed.routes : DEFAULT_WATCHLIST.routes,
        };
    }
    catch {
        return { ...DEFAULT_WATCHLIST };
    }
}
function save(wl) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wl));
    }
    catch { /* storage quota */ }
}
export const aviationWatchlist = {
    get() {
        return load();
    },
    set(wl) {
        const current = load();
        save({ ...current, ...wl });
    },
    addAirport(iata) {
        const wl = load();
        const code = iata.toUpperCase().trim();
        if (code && !wl.airports.includes(code)) {
            wl.airports = [...wl.airports, code].slice(0, 20);
            save(wl);
        }
    },
    removeAirport(iata) {
        const wl = load();
        wl.airports = wl.airports.filter(a => a !== iata.toUpperCase());
        save(wl);
    },
    addAirline(iata) {
        const wl = load();
        const code = iata.toUpperCase().trim();
        if (code && !wl.airlines.includes(code)) {
            wl.airlines = [...wl.airlines, code].slice(0, 10);
            save(wl);
        }
    },
    removeAirline(iata) {
        const wl = load();
        wl.airlines = wl.airlines.filter(a => a !== iata.toUpperCase());
        save(wl);
    },
    addRoute(origin, destination) {
        const wl = load();
        const route = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
        if (!wl.routes.includes(route)) {
            wl.routes = [...wl.routes, route].slice(0, 20);
            save(wl);
        }
    },
    removeRoute(route) {
        const wl = load();
        wl.routes = wl.routes.filter(r => r !== route);
        save(wl);
    },
    reset() {
        save({ ...DEFAULT_WATCHLIST });
    },
};
