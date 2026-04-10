import { toApiUrl } from '@/services/runtime';
export async function fetchHormuzTracker() {
    try {
        const resp = await fetch(toApiUrl('/api/supply-chain/hormuz-tracker'), {
            signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok)
            return null;
        const raw = (await resp.json());
        return raw.attribution ? raw : null;
    }
    catch {
        return null;
    }
}
