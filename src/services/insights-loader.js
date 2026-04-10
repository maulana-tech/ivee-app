import { getHydratedData } from '@/services/bootstrap';
let cached = null;
const MAX_AGE_MS = 15 * 60 * 1000;
function isFresh(data) {
    const age = Date.now() - new Date(data.generatedAt).getTime();
    return age < MAX_AGE_MS;
}
export function getServerInsights() {
    if (cached && isFresh(cached)) {
        return cached;
    }
    cached = null;
    const raw = getHydratedData('insights');
    if (!raw || typeof raw !== 'object')
        return null;
    const data = raw;
    if (!Array.isArray(data.topStories) || data.topStories.length === 0)
        return null;
    if (typeof data.generatedAt !== 'string')
        return null;
    if (!isFresh(data))
        return null;
    cached = data;
    return data;
}
export function setServerInsights(data) {
    cached = data;
}
