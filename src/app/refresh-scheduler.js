import { startSmartPollLoop, VisibilityHub } from '@/services/runtime';
export class RefreshScheduler {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "refreshRunners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "flushTimeoutIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "hiddenSince", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "visibilityHub", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new VisibilityHub()
        });
        this.ctx = ctx;
    }
    init() { }
    destroy() {
        for (const timeoutId of this.flushTimeoutIds) {
            clearTimeout(timeoutId);
        }
        this.flushTimeoutIds.clear();
        for (const { loop } of this.refreshRunners.values()) {
            loop.stop();
        }
        this.refreshRunners.clear();
        this.visibilityHub.destroy();
    }
    setHiddenSince(ts) {
        this.hiddenSince = ts;
    }
    getHiddenSince() {
        return this.hiddenSince;
    }
    scheduleRefresh(name, fn, intervalMs, condition) {
        this.refreshRunners.get(name)?.loop.stop();
        const loop = startSmartPollLoop(async () => {
            if (this.ctx.isDestroyed)
                return;
            if (condition && !condition())
                return;
            if (this.ctx.inFlight.has(name))
                return;
            this.ctx.inFlight.add(name);
            try {
                return await fn();
            }
            finally {
                this.ctx.inFlight.delete(name);
            }
        }, {
            intervalMs,
            pauseWhenHidden: true,
            refreshOnVisible: false,
            runImmediately: false,
            maxBackoffMultiplier: 4,
            visibilityHub: this.visibilityHub,
            onError: (e) => {
                console.error(`[App] Refresh ${name} failed:`, e);
            },
        });
        this.refreshRunners.set(name, { loop, intervalMs });
    }
    flushStaleRefreshes() {
        if (!this.hiddenSince)
            return;
        const hiddenMs = Date.now() - this.hiddenSince;
        this.hiddenSince = 0;
        for (const timeoutId of this.flushTimeoutIds) {
            clearTimeout(timeoutId);
        }
        this.flushTimeoutIds.clear();
        // Collect stale tasks and sort by interval ascending (highest-frequency first)
        const stale = [];
        for (const entry of this.refreshRunners.values()) {
            if (hiddenMs >= entry.intervalMs) {
                stale.push(entry);
            }
        }
        stale.sort((a, b) => a.intervalMs - b.intervalMs);
        // Tiered stagger: first 4 gaps are 100ms (covering tasks 1-5), remaining gaps are 300ms
        const FLUSH_STAGGER_FAST_MS = 100;
        const FLUSH_STAGGER_SLOW_MS = 300;
        let stagger = 0;
        let idx = 0;
        for (const entry of stale) {
            const delay = stagger;
            stagger += (idx < 4) ? FLUSH_STAGGER_FAST_MS : FLUSH_STAGGER_SLOW_MS;
            idx++;
            const timeoutId = setTimeout(() => {
                this.flushTimeoutIds.delete(timeoutId);
                entry.loop.trigger();
            }, delay);
            this.flushTimeoutIds.add(timeoutId);
        }
    }
    registerAll(registrations) {
        for (const reg of registrations) {
            this.scheduleRefresh(reg.name, reg.fn, reg.intervalMs, reg.condition);
        }
    }
}
