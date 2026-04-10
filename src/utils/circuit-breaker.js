const DEFAULT_MAX_FAILURES = 2;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PERSISTENT_STALE_CEILING_MS = 24 * 60 * 60 * 1000; // 24h — discard persistent entries older than this
const DEFAULT_CACHE_KEY = '__default__';
const DEFAULT_MAX_CACHE_ENTRIES = 256;
function isDesktopOfflineMode() {
    if (typeof window === 'undefined')
        return false;
    const hasTauri = Boolean(window.__TAURI__);
    return hasTauri && typeof navigator !== 'undefined' && navigator.onLine === false;
}
export class CircuitBreaker {
    constructor(options) {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { failures: 0, cooldownUntil: 0 }
        });
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxFailures", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cooldownMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cacheTtlMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "persistEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "revivePersistedData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "persistentLoadedKeys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "persistentLoadPromises", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lastDataState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { mode: 'unavailable', timestamp: null, offline: false }
        });
        Object.defineProperty(this, "backgroundRefreshPromises", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "maxCacheEntries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "persistentStaleCeilingMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = options.name;
        this.maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
        this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
        this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        this.persistEnabled = this.cacheTtlMs === 0
            ? false
            : (options.persistCache ?? false);
        this.revivePersistedData = options.revivePersistedData;
        this.maxCacheEntries = options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
        const rawCeiling = options.persistentStaleCeilingMs ?? PERSISTENT_STALE_CEILING_MS;
        this.persistentStaleCeilingMs = Number.isFinite(rawCeiling) && rawCeiling >= 0 ? rawCeiling : PERSISTENT_STALE_CEILING_MS;
    }
    resolveCacheKey(cacheKey) {
        const key = cacheKey?.trim();
        return key && key.length > 0 ? key : DEFAULT_CACHE_KEY;
    }
    isStateOnCooldown() {
        if (Date.now() < this.state.cooldownUntil)
            return true;
        if (this.state.cooldownUntil > 0) {
            this.state.failures = 0;
            this.state.cooldownUntil = 0;
        }
        return false;
    }
    getPersistKey(cacheKey) {
        return cacheKey === DEFAULT_CACHE_KEY
            ? `breaker:${this.name}`
            : `breaker:${this.name}:${cacheKey}`;
    }
    getCacheEntry(cacheKey) {
        return this.cache.get(cacheKey) ?? null;
    }
    isCacheEntryFresh(entry, now = Date.now()) {
        return now - entry.timestamp < this.cacheTtlMs;
    }
    /** Move a key to the most-recent position after a cache-backed read. */
    touchCacheKey(cacheKey) {
        const entry = this.cache.get(cacheKey);
        if (entry !== undefined) {
            this.cache.delete(cacheKey);
            this.cache.set(cacheKey, entry);
        }
    }
    evictCacheKey(cacheKey) {
        this.cache.delete(cacheKey);
        this.backgroundRefreshPromises.delete(cacheKey);
        this.persistentLoadPromises.delete(cacheKey);
        this.persistentLoadedKeys.delete(cacheKey);
    }
    evictOldest() {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) {
            this.evictCacheKey(oldest);
            if (this.persistEnabled) {
                this.deletePersistentCache(oldest);
            }
        }
    }
    /** Evict oldest cache entries when the cache exceeds maxCacheEntries. */
    evictIfNeeded() {
        while (this.cache.size > this.maxCacheEntries) {
            this.evictOldest();
        }
    }
    /** Hydrate in-memory cache from persistent storage on first call. */
    hydratePersistentCache(cacheKey) {
        if (this.persistentLoadedKeys.has(cacheKey))
            return Promise.resolve();
        const existingPromise = this.persistentLoadPromises.get(cacheKey);
        if (existingPromise)
            return existingPromise;
        const loadPromise = (async () => {
            try {
                const { getPersistentCache } = await import('../services/persistent-cache');
                const entry = await getPersistentCache(this.getPersistKey(cacheKey));
                if (entry == null || entry.data === undefined || entry.data === null)
                    return;
                const age = Date.now() - entry.updatedAt;
                if (age > this.persistentStaleCeilingMs)
                    return;
                // Only hydrate if in-memory cache is empty (don't overwrite live data)
                if (this.getCacheEntry(cacheKey) === null) {
                    const data = this.revivePersistedData ? this.revivePersistedData(entry.data) : entry.data;
                    this.cache.set(cacheKey, { data, timestamp: entry.updatedAt });
                    this.evictIfNeeded();
                    const withinTtl = (Date.now() - entry.updatedAt) < this.cacheTtlMs;
                    this.lastDataState = {
                        mode: withinTtl ? 'cached' : 'unavailable',
                        timestamp: entry.updatedAt,
                        offline: false,
                    };
                }
            }
            catch (err) {
                console.warn(`[${this.name}] Persistent cache hydration failed:`, err);
            }
            finally {
                this.persistentLoadedKeys.add(cacheKey);
                this.persistentLoadPromises.delete(cacheKey);
            }
        })();
        this.persistentLoadPromises.set(cacheKey, loadPromise);
        return loadPromise;
    }
    /** Fire-and-forget write to persistent storage. */
    writePersistentCache(data, cacheKey) {
        import('../services/persistent-cache').then(({ setPersistentCache }) => {
            setPersistentCache(this.getPersistKey(cacheKey), data).catch(() => { });
        }).catch(() => { });
    }
    /** Fire-and-forget delete from persistent storage. */
    deletePersistentCache(cacheKey) {
        import('../services/persistent-cache').then(({ deletePersistentCache }) => {
            deletePersistentCache(this.getPersistKey(cacheKey)).catch(() => { });
        }).catch(() => { });
    }
    /** Fire-and-forget delete for all persistent entries owned by this breaker. */
    deleteAllPersistentCache() {
        import('../services/persistent-cache').then(({ deletePersistentCache, deletePersistentCacheByPrefix }) => {
            const baseKey = this.getPersistKey(DEFAULT_CACHE_KEY);
            deletePersistentCache(baseKey).catch(() => { });
            deletePersistentCacheByPrefix(`${baseKey}:`).catch(() => { });
        }).catch(() => { });
    }
    isOnCooldown() {
        return this.isStateOnCooldown();
    }
    getCooldownRemaining() {
        if (!this.isStateOnCooldown())
            return 0;
        return Math.max(0, Math.ceil((this.state.cooldownUntil - Date.now()) / 1000));
    }
    getStatus() {
        if (this.lastDataState.offline) {
            return this.lastDataState.mode === 'cached'
                ? 'offline mode (serving cached data)'
                : 'offline mode (live API unavailable)';
        }
        if (this.isOnCooldown()) {
            return `temporarily unavailable (retry in ${this.getCooldownRemaining()}s)`;
        }
        return 'ok';
    }
    getDataState() {
        return { ...this.lastDataState };
    }
    getCached(cacheKey) {
        const resolvedKey = this.resolveCacheKey(cacheKey);
        const entry = this.getCacheEntry(resolvedKey);
        if (entry !== null && this.isCacheEntryFresh(entry)) {
            this.touchCacheKey(resolvedKey);
            return entry.data;
        }
        return null;
    }
    getCachedOrDefault(defaultValue, cacheKey) {
        const resolvedKey = this.resolveCacheKey(cacheKey);
        return this.getCacheEntry(resolvedKey)?.data ?? defaultValue;
    }
    getKnownCacheKeys() {
        return [...this.cache.keys()];
    }
    markSuccess(timestamp) {
        this.state.failures = 0;
        this.state.cooldownUntil = 0;
        this.state.lastError = undefined;
        this.lastDataState = { mode: 'live', timestamp, offline: false };
    }
    writeCacheEntry(data, cacheKey, timestamp) {
        // Delete first so re-insert moves key to most-recent position
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, { data, timestamp });
        this.evictIfNeeded();
        if (this.persistEnabled) {
            this.writePersistentCache(data, cacheKey);
        }
    }
    recordSuccess(data, cacheKey) {
        const resolvedKey = this.resolveCacheKey(cacheKey);
        const now = Date.now();
        this.markSuccess(now);
        this.writeCacheEntry(data, resolvedKey, now);
    }
    clearCache(cacheKey) {
        if (cacheKey !== undefined) {
            const resolvedKey = this.resolveCacheKey(cacheKey);
            this.evictCacheKey(resolvedKey);
            if (this.persistEnabled) {
                this.deletePersistentCache(resolvedKey);
            }
            return;
        }
        this.cache.clear();
        this.backgroundRefreshPromises.clear();
        this.persistentLoadPromises.clear();
        this.persistentLoadedKeys.clear();
        if (this.persistEnabled) {
            this.deleteAllPersistentCache();
        }
    }
    /** Clear only the in-memory cache without touching persistent storage.
     *  Use when the caller wants fresh live data but must not destroy the
     *  persisted fallback that a concurrent hydration may still need. */
    clearMemoryCache(cacheKey) {
        if (cacheKey !== undefined) {
            this.evictCacheKey(this.resolveCacheKey(cacheKey));
            return;
        }
        this.cache.clear();
        this.backgroundRefreshPromises.clear();
        this.persistentLoadPromises.clear();
        this.persistentLoadedKeys.clear();
    }
    recordFailure(error) {
        this.state.failures++;
        this.state.lastError = error;
        if (this.state.failures >= this.maxFailures) {
            this.state.cooldownUntil = Date.now() + this.cooldownMs;
            console.warn(`[${this.name}] On cooldown for ${this.cooldownMs / 1000}s after ${this.state.failures} failures`);
        }
    }
    async execute(fn, defaultValue, options = {}) {
        const offline = isDesktopOfflineMode();
        const cacheKey = this.resolveCacheKey(options.cacheKey);
        const shouldCache = options.shouldCache ?? (() => true);
        // Hydrate from persistent storage on first call (~1-5ms IndexedDB read)
        if (this.persistEnabled && !this.persistentLoadedKeys.has(cacheKey)) {
            await this.hydratePersistentCache(cacheKey);
        }
        let cachedEntry = this.getCacheEntry(cacheKey);
        // If the cached data fails the shouldCache predicate, evict it and fetch
        // fresh rather than serving known-invalid data for the full TTL.
        // The default shouldCache (() => true) never returns false, so this only
        // fires when an explicit predicate is passed.
        // deletePersistentCache is fire-and-forget; on the rare case that
        // hydratePersistentCache runs again before the delete commits, the entry
        // is evicted once more — safe and self-resolving.
        if (cachedEntry !== null && !shouldCache(cachedEntry.data)) {
            this.evictCacheKey(cacheKey);
            if (this.persistEnabled)
                this.deletePersistentCache(cacheKey);
            cachedEntry = null;
        }
        if (this.isStateOnCooldown()) {
            console.log(`[${this.name}] Currently unavailable, ${this.getCooldownRemaining()}s remaining`);
            if (cachedEntry !== null && this.isCacheEntryFresh(cachedEntry)) {
                this.lastDataState = { mode: 'cached', timestamp: cachedEntry.timestamp, offline };
                this.touchCacheKey(cacheKey);
                return cachedEntry.data;
            }
            this.lastDataState = { mode: 'unavailable', timestamp: null, offline };
            return (cachedEntry?.data ?? defaultValue);
        }
        if (cachedEntry !== null && this.isCacheEntryFresh(cachedEntry)) {
            this.lastDataState = { mode: 'cached', timestamp: cachedEntry.timestamp, offline };
            this.touchCacheKey(cacheKey);
            return cachedEntry.data;
        }
        // Stale-while-revalidate: if we have stale cached data (outside TTL but
        // within the 24h persistent ceiling), return it instantly and refresh in
        // the background. This prevents "Loading..." on every page reload when
        // the persistent cache is older than the TTL. Skip SWR when cacheTtlMs === 0.
        if (cachedEntry !== null && this.cacheTtlMs > 0) {
            this.lastDataState = { mode: 'cached', timestamp: cachedEntry.timestamp, offline };
            this.touchCacheKey(cacheKey);
            // Fire-and-forget background refresh — guard against concurrent SWR fetches
            // so that multiple callers with the same stale cache key don't each
            // spawn a parallel request.
            if (!this.backgroundRefreshPromises.has(cacheKey)) {
                const refreshPromise = fn().then(result => {
                    const now = Date.now();
                    this.markSuccess(now);
                    if (shouldCache(result)) {
                        this.writeCacheEntry(result, cacheKey, now);
                    }
                }).catch(e => {
                    console.warn(`[${this.name}] Background refresh failed:`, e);
                    this.recordFailure(String(e));
                }).finally(() => {
                    this.backgroundRefreshPromises.delete(cacheKey);
                });
                this.backgroundRefreshPromises.set(cacheKey, refreshPromise);
            }
            return cachedEntry.data;
        }
        try {
            const result = await fn();
            const now = Date.now();
            this.markSuccess(now);
            if (shouldCache(result)) {
                this.writeCacheEntry(result, cacheKey, now);
            }
            return result;
        }
        catch (e) {
            const msg = String(e);
            console.error(`[${this.name}] Failed:`, msg);
            this.recordFailure(msg);
            this.lastDataState = { mode: 'unavailable', timestamp: null, offline };
            return defaultValue;
        }
    }
}
// Registry of circuit breakers for global status
const breakers = new Map();
export function createCircuitBreaker(options) {
    const breaker = new CircuitBreaker(options);
    breakers.set(options.name, breaker);
    return breaker;
}
export function getCircuitBreakerStatus() {
    const status = {};
    breakers.forEach((breaker, name) => {
        status[name] = breaker.getStatus();
    });
    return status;
}
export function isCircuitBreakerOnCooldown(name) {
    const breaker = breakers.get(name);
    return breaker ? breaker.isOnCooldown() : false;
}
export function getCircuitBreakerCooldownInfo(name) {
    const breaker = breakers.get(name);
    if (!breaker)
        return { onCooldown: false, remainingSeconds: 0 };
    return {
        onCooldown: breaker.isOnCooldown(),
        remainingSeconds: breaker.getCooldownRemaining()
    };
}
export function removeCircuitBreaker(name) {
    breakers.delete(name);
}
export function clearAllCircuitBreakers() {
    breakers.clear();
}
