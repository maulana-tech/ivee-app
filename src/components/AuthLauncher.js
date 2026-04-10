import { openSignIn } from '@/services/clerk';
/**
 * Minimal auth launcher -- wraps Clerk.openSignIn().
 * Replaces the custom OTP modal. Clerk handles all UI.
 */
export class AuthLauncher {
    open() {
        openSignIn();
    }
    close() {
        // Clerk manages its own modal lifecycle
    }
    destroy() {
        // Nothing to clean up -- Clerk manages its own resources
    }
}
