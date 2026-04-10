import { subscribeAuthState } from '@/services/auth-state';
import { mountUserButton, openSignIn } from '@/services/clerk';
export class AuthHeaderWidget {
    constructor(_onSignInClick, _onSettingsClick) {
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "unsubscribeAuth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "unmountUserButton", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.container = document.createElement('div');
        this.container.className = 'auth-header-widget';
        this.unsubscribeAuth = subscribeAuthState((state) => {
            if (state.isPending) {
                this.container.innerHTML = '';
                return;
            }
            this.render(state);
        });
    }
    getElement() {
        return this.container;
    }
    destroy() {
        this.unmountUserButton?.();
        this.unmountUserButton = null;
        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
            this.unsubscribeAuth = null;
        }
    }
    render(state) {
        // Cleanup previous Clerk mount
        this.unmountUserButton?.();
        this.unmountUserButton = null;
        this.container.innerHTML = '';
        if (!state.user) {
            // Signed out -- show Sign In button
            const btn = document.createElement('button');
            btn.className = 'auth-signin-btn';
            btn.textContent = 'Sign In';
            btn.addEventListener('click', () => openSignIn());
            this.container.appendChild(btn);
            return;
        }
        // Signed in -- mount Clerk UserButton
        const userBtnEl = document.createElement('div');
        userBtnEl.className = 'auth-clerk-user-button';
        this.container.appendChild(userBtnEl);
        this.unmountUserButton = mountUserButton(userBtnEl);
    }
}
