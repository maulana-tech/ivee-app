/**
 * Shared ConvexClient singleton for frontend services.
 *
 * Both the entitlement subscription and the checkout service need a
 * ConvexClient instance. This module provides a single lazy-loaded
 * client to avoid duplicate WebSocket connections.
 *
 * The client and API reference are loaded via dynamic import so they
 * don't impact the initial bundle size.
 */
import { getClerkToken, clearClerkTokenCache } from './clerk';
let client = null;
let apiRef = null;
let authReadyResolve = null;
let authReadyPromise = null;
/**
 * Returns the shared ConvexClient instance, creating it on first call.
 * Returns null if VITE_CONVEX_URL is not configured.
 */
export async function getConvexClient() {
    if (client)
        return client;
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (!convexUrl)
        return null;
    authReadyPromise = new Promise((resolve) => { authReadyResolve = resolve; });
    const { ConvexClient: CC } = await import('convex/browser');
    client = new CC(convexUrl);
    client.setAuth(async ({ forceRefreshToken } = {}) => {
        if (forceRefreshToken) {
            clearClerkTokenCache();
        }
        return getClerkToken();
    }, (isAuthenticated) => {
        if (isAuthenticated) {
            if (authReadyResolve) {
                authReadyResolve();
                authReadyResolve = null;
            }
        }
        else {
            // Sign-out or token expiry: reset the promise so the next
            // waitForConvexAuth() blocks until re-authentication completes.
            authReadyPromise = new Promise((resolve) => { authReadyResolve = resolve; });
        }
    });
    return client;
}
/**
 * Wait for ConvexClient auth to be established.
 * Resolves when the server confirms the client is authenticated.
 * Times out after 10s to prevent indefinite hangs for unauthenticated users.
 */
export async function waitForConvexAuth(timeoutMs = 10000) {
    if (!authReadyPromise)
        return false;
    const timeout = new Promise((r) => setTimeout(() => r('timeout'), timeoutMs));
    const result = await Promise.race([authReadyPromise.then(() => 'ready'), timeout]);
    return result === 'ready';
}
/**
 * Returns the generated Convex API reference, loading it on first call.
 * Returns null if the import fails.
 */
export async function getConvexApi() {
    if (apiRef)
        return apiRef;
    const { api } = await import('../../convex/_generated/api');
    apiRef = api;
    return apiRef;
}
