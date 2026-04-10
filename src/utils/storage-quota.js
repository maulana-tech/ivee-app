let storageQuotaExceeded = false;
export function isStorageQuotaExceeded() {
    return storageQuotaExceeded;
}
export function isQuotaError(error) {
    return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
}
export function markStorageQuotaExceeded() {
    if (!storageQuotaExceeded) {
        storageQuotaExceeded = true;
        console.warn('[Storage] Quota exceeded — disabling further writes');
    }
}
