export function buildChunkReloadStorageKey(version) {
    return `wm-chunk-reload:${version}`;
}
export function installChunkReloadGuard(version, options = {}) {
    const storageKey = buildChunkReloadStorageKey(version);
    const eventName = options.eventName ?? 'vite:preloadError';
    const eventTarget = options.eventTarget ?? window;
    const storage = options.storage ?? sessionStorage;
    const reload = options.reload ?? (() => window.location.reload());
    eventTarget.addEventListener(eventName, () => {
        if (storage.getItem(storageKey))
            return;
        storage.setItem(storageKey, '1');
        reload();
    });
    return storageKey;
}
export function clearChunkReloadGuard(storageKey, storage = sessionStorage) {
    storage.removeItem(storageKey);
}
