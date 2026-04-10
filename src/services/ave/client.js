const AVE_BASE_URL = 'https://prod.ave-api.com/v2';
function getApiKey() {
    return import.meta.env.VITE_AVE_API_KEY || '';
}
function isEnabled() {
    return import.meta.env.VITE_AVE_ENABLED === 'true' && !!getApiKey();
}
async function aveFetch(endpoint, options = {}) {
    if (!isEnabled()) {
        throw new Error('AVE integration is not enabled. Set VITE_AVE_ENABLED=true and VITE_AVE_API_KEY');
    }
    const url = endpoint.startsWith('http') ? endpoint : `${AVE_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'X-API-KEY': getApiKey(),
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`AVE API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
export async function searchTokens(keyword, chain = 'base') {
    const data = await aveFetch(`/tokens?keyword=${encodeURIComponent(keyword)}&chain=${chain}&limit=20`);
    return data.data || [];
}
export async function getTokenPrice(tokenId) {
    const data = await aveFetch('/tokens/price', {
        method: 'POST',
        body: JSON.stringify({ token_ids: [tokenId] }),
    });
    const priceData = data.data?.[tokenId];
    if (!priceData)
        return null;
    return {
        id: tokenId,
        symbol: '',
        name: '',
        chain: '',
        price: priceData.current_price_usd,
        priceUsd: priceData.current_price_usd,
        change24h: priceData.price_change_percentage_24h || '0',
        volume24h: '',
        marketCap: '',
        tvl: '',
    };
}
export async function getTrendingTokens(chain = 'base', topic = 'hot') {
    const data = await aveFetch(`/ranks?chain=${chain}&topic=${topic}`);
    return data.data || [];
}
export async function getRiskReport(address, chain = 'base') {
    const data = await aveFetch(`/tokens/risk?address=${address}&chain=${chain}`);
    return data.data || null;
}
export async function getRecentSwaps(pair, chain = 'base', limit = 50) {
    const data = await aveFetch(`/swaps?pair=${pair}&chain=${chain}&limit=${limit}`);
    return data.data || [];
}
export async function getTokenHolders(address, chain = 'base') {
    const data = await aveFetch(`/holders?address=${address}&chain=${chain}&limit=100`);
    return data.data || [];
}
export async function getChains() {
    const data = await aveFetch('/chains');
    return (data.data || []).map(c => ({ id: c.chain_id, name: c.name, icon: c.icon }));
}
export { isEnabled, getApiKey };
