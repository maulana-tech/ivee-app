function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function runThrottledTargetRequests(targets, request, delayMs = 200) {
    const results = [];
    for (let i = 0; i < targets.length; i++) {
        if (i > 0)
            await sleep(delayMs);
        try {
            const result = await request(targets[i]);
            if (result.available)
                results.push(result);
        }
        catch {
            // Skip failed individual requests.
        }
    }
    return results;
}
