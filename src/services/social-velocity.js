import { getRpcBaseUrl } from '@/services/rpc-client';
import { IntelligenceServiceClient, } from '@/generated/client/ivee/intelligence/v1/service_client';
import { getHydratedData } from '@/services/bootstrap';
const client = new IntelligenceServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const emptyVelocity = { posts: [], fetchedAt: 0 };
export async function fetchSocialVelocity() {
    const hydrated = getHydratedData('socialVelocity');
    if (hydrated?.posts?.length)
        return hydrated;
    try {
        return await client.getSocialVelocity({});
    }
    catch {
        return emptyVelocity;
    }
}
