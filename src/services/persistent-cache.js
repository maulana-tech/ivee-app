import { isDesktopRuntime } from './runtime';
import { invokeTauri } from './tauri-bridge';
import { isStorageQuotaExceeded, isQuotaError, markStorageQuotaExceeded } from '@/utils/storage-quota';
const CACHE_PREFIX = 'ivee-persistent-cache:';
const CACHE_DB_NAME = 'ivee_persistent_cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE = 'entries';
let cacheDbPromise = null;
function isIndexedDbAvailable() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}
function getCacheDb() {
    if (!isIndexedDbAvailable()) {
        return Promise.reject(new Error('IndexedDB unavailable'));
    }
    if (cacheDbPromise)
        return cacheDbPromise;
    cacheDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
        request.onerror = () => reject(request.error ?? new Error('Failed to open cache IndexedDB'));
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onclose = () => { cacheDbPromise = null; };
            resolve(db);
        };
    });
    return cacheDbPromise;
}
async function getFromIndexedDb(key) {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}
async function setInIndexedDb(payload) {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(CACHE_STORE).put(payload);
    });
}
async function deleteFromIndexedDbByPrefix(prefix) {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(CACHE_STORE);
        const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
        const request = store.openKeyCursor(range);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor)
                return;
            store.delete(cursor.primaryKey);
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}
function deleteFromLocalStorageByPrefix(prefix) {
    if (typeof localStorage === 'undefined')
        return;
    const storagePrefix = `${CACHE_PREFIX}${prefix}`;
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(storagePrefix)) {
            keysToDelete.push(key);
        }
    }
    for (const key of keysToDelete) {
        localStorage.removeItem(key);
    }
}
function validateBreakerPrefix(prefix) {
    const trimmed = prefix.trim();
    const suffix = trimmed.slice('breaker:'.length);
    if (!trimmed.startsWith('breaker:') || suffix.length === 0 || !/\w/.test(suffix)) {
        throw new Error('deletePersistentCacheByPrefix requires a specific breaker: prefix');
    }
}
export async function getPersistentCache(key) {
    if (isDesktopRuntime()) {
        try {
            const value = await invokeTauri('read_cache_entry', { key });
            return value ?? null;
        }
        catch (error) {
            console.warn('[persistent-cache] Desktop read failed; falling back to browser storage', error);
        }
    }
    if (isIndexedDbAvailable()) {
        try {
            return await getFromIndexedDb(key);
        }
        catch (error) {
            console.warn('[persistent-cache] IndexedDB read failed; falling back to localStorage', error);
            cacheDbPromise = null;
        }
    }
    try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export async function setPersistentCache(key, data, updatedAt = Date.now()) {
    const payload = { key, data, updatedAt };
    if (isDesktopRuntime()) {
        try {
            await invokeTauri('write_cache_entry', { key, value: JSON.stringify(payload) });
            return;
        }
        catch (error) {
            console.warn('[persistent-cache] Desktop write failed; falling back to browser storage', error);
        }
    }
    if (isIndexedDbAvailable() && !isStorageQuotaExceeded()) {
        try {
            await setInIndexedDb(payload);
            return;
        }
        catch (error) {
            if (isQuotaError(error))
                markStorageQuotaExceeded();
            else
                console.warn('[persistent-cache] IndexedDB write failed; falling back to localStorage', error);
            cacheDbPromise = null;
        }
    }
    if (isStorageQuotaExceeded())
        return;
    try {
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
    }
    catch (error) {
        if (isQuotaError(error))
            markStorageQuotaExceeded();
    }
}
export async function deletePersistentCache(key) {
    if (isDesktopRuntime()) {
        try {
            await invokeTauri('delete_cache_entry', { key });
            return;
        }
        catch {
            // Fall through to browser storage
        }
    }
    if (isIndexedDbAvailable()) {
        try {
            const db = await getCacheDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(CACHE_STORE, 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.objectStore(CACHE_STORE).delete(key);
            });
            return;
        }
        catch (error) {
            console.warn('[persistent-cache] IndexedDB delete failed; falling back to localStorage', error);
            cacheDbPromise = null;
        }
    }
    if (isStorageQuotaExceeded())
        return;
    try {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    }
    catch {
        // Ignore
    }
}
export async function deletePersistentCacheByPrefix(prefix) {
    validateBreakerPrefix(prefix);
    if (isDesktopRuntime()) {
        try {
            await invokeTauri('delete_cache_entries_by_prefix', { prefix });
            return;
        }
        catch {
            // Fall through to browser storage
        }
    }
    if (isIndexedDbAvailable()) {
        try {
            await deleteFromIndexedDbByPrefix(prefix);
            return;
        }
        catch (error) {
            console.warn('[persistent-cache] IndexedDB prefix delete failed; falling back to localStorage', error);
            cacheDbPromise = null;
        }
    }
    try {
        deleteFromLocalStorageByPrefix(prefix);
    }
    catch {
        // Ignore
    }
}
export function cacheAgeMs(updatedAt) {
    return Math.max(0, Date.now() - updatedAt);
}
export function describeFreshness(updatedAt) {
    const age = cacheAgeMs(updatedAt);
    const mins = Math.floor(age / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
