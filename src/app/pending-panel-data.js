const pendingCalls = new Map();
export function enqueuePanelCall(key, method, args) {
    let methods = pendingCalls.get(key);
    if (!methods) {
        methods = new Map();
        pendingCalls.set(key, methods);
    }
    methods.set(method, args);
}
// Race-safe: panels[key] is set BEFORE replay starts (panel-layout.ts line 1147),
// so any concurrent callPanel() during async replay takes the direct-call path
// (not the queue). delete() before iteration prevents double-replay.
export async function replayPendingCalls(key, panel) {
    const methods = pendingCalls.get(key);
    if (!methods)
        return;
    pendingCalls.delete(key);
    for (const [method, args] of methods) {
        const fn = panel[method];
        if (typeof fn === 'function') {
            const result = fn.apply(panel, args);
            if (result instanceof Promise)
                await result;
        }
    }
}
export function clearAllPendingCalls() {
    pendingCalls.clear();
}
