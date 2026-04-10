import { getSecretState } from './runtime-config';
import { isProUser } from './widget-store';
export var PanelGateReason;
(function (PanelGateReason) {
    PanelGateReason["NONE"] = "none";
    PanelGateReason["ANONYMOUS"] = "anonymous";
    PanelGateReason["FREE_TIER"] = "free_tier";
})(PanelGateReason || (PanelGateReason = {}));
/**
 * Single source of truth for premium access.
 * Covers all access paths: desktop API key, tester keys (wm-pro-key / wm-widget-key), Clerk Pro.
 */
export function hasPremiumAccess(authState) {
    if (getSecretState('WORLDMONITOR_API_KEY').present)
        return true;
    if (isProUser())
        return true;
    if (authState?.user?.role === 'pro')
        return true;
    return false;
}
/**
 * Determine gating reason for a premium panel given current auth state.
 * Non-premium panels always return NONE.
 */
export function getPanelGateReason(authState, isPremium) {
    // Non-premium panels are never gated
    if (!isPremium)
        return PanelGateReason.NONE;
    // API key, tester key, or Clerk Pro: always unlocked
    if (hasPremiumAccess(authState))
        return PanelGateReason.NONE;
    // Web gating based on Clerk auth state
    if (!authState.user)
        return PanelGateReason.ANONYMOUS;
    return PanelGateReason.FREE_TIER;
}
