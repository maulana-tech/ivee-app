import { hashString } from '@/utils/hash';
const DB_NAME = 'ivee_vector_store';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';
const MAX_VECTORS = 5000;
let db = null;
let queue = Promise.resolve();
function enqueue(fn) {
    const task = queue.then(fn, () => fn());
    queue = task.then(() => { }, () => { });
    return task;
}
function openDB() {
    if (db)
        return Promise.resolve(db);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            db.onclose = () => { db = null; };
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('by_ingestedAt', 'ingestedAt');
            }
        };
    });
}
export function sanitizeTitle(text) {
    return text.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 200);
}
export function makeVectorId(source, url, pubDate, text) {
    return hashString(JSON.stringify([source, url || '', pubDate, text]));
}
export function storeVectors(entries) {
    return enqueue(async () => {
        const database = await openDB();
        const now = Date.now();
        let stored = 0;
        await new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const entry of entries) {
                const clean = sanitizeTitle(entry.text);
                if (!clean)
                    continue;
                stored++;
                const id = makeVectorId(entry.source, entry.url, entry.pubDate, clean);
                store.put({
                    id,
                    text: clean,
                    embedding: entry.embedding,
                    pubDate: entry.pubDate,
                    ingestedAt: now,
                    source: entry.source,
                    url: entry.url,
                    ...(entry.tags?.length ? { tags: entry.tags } : {}),
                });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        const count = await new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (count > MAX_VECTORS) {
            const toDelete = count - MAX_VECTORS;
            await new Promise((resolve, reject) => {
                const tx = database.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const index = store.index('by_ingestedAt');
                const cursor = index.openCursor();
                let deleted = 0;
                cursor.onsuccess = () => {
                    const c = cursor.result;
                    if (!c || deleted >= toDelete)
                        return;
                    c.delete();
                    deleted++;
                    c.continue();
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }
        return stored;
    });
}
export function searchVectors(queryEmbeddings, topK, minScore, cosineFn) {
    return enqueue(async () => {
        const database = await openDB();
        const best = new Map();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const cursor = store.openCursor();
            cursor.onsuccess = () => {
                const c = cursor.result;
                if (!c)
                    return;
                const record = c.value;
                const stored = record.embedding instanceof Float32Array
                    ? record.embedding
                    : new Float32Array(record.embedding);
                for (const query of queryEmbeddings) {
                    const score = cosineFn(query, stored);
                    if (score < minScore)
                        continue;
                    const existing = best.get(record.id);
                    if (!existing || score > existing.score) {
                        best.set(record.id, {
                            text: record.text,
                            pubDate: record.pubDate,
                            source: record.source,
                            score,
                        });
                    }
                }
                c.continue();
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return Array.from(best.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    });
}
export function getCount() {
    return enqueue(async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    });
}
export function closeDB() {
    return enqueue(async () => {
        if (db) {
            db.close();
            db = null;
        }
    });
}
export function resetStore() {
    return enqueue(async () => {
        const database = await openDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        database.close();
        db = null;
    });
}
