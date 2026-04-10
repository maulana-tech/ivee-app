import * as Sentry from '@sentry/browser';
import { initClerk, getCurrentClerkUser, subscribeClerk } from './clerk';
let _currentSession = { user: null, isPending: true };
function snapshotSession() {
    const cu = getCurrentClerkUser();
    if (!cu) {
        Sentry.setUser(null);
        return { user: null, isPending: false };
    }
    Sentry.setUser({ id: cu.id });
    return {
        user: {
            id: cu.id,
            name: cu.name,
            email: cu.email,
            image: cu.image,
            role: cu.plan,
        },
        isPending: false,
    };
}
/**
 * Initialize auth state. Call once at app startup before UI subscribes.
 */
export async function initAuthState() {
    await initClerk();
    _currentSession = snapshotSession();
}
/**
 * Subscribe to reactive auth state changes.
 * @returns Unsubscribe function.
 */
export function subscribeAuthState(callback) {
    // Emit current state immediately
    callback(_currentSession);
    return subscribeClerk(() => {
        _currentSession = snapshotSession();
        callback(_currentSession);
    });
}
/**
 * Synchronous snapshot of current auth state.
 */
export function getAuthState() {
    return _currentSession;
}
