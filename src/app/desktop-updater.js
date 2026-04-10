import { invokeTauri } from '@/services/tauri-bridge';
import { trackUpdateShown, trackUpdateClicked, trackUpdateDismissed } from '@/services/analytics';
import { escapeHtml } from '@/utils/sanitize';
import { getDismissed, setDismissed } from '@/utils/cross-domain-storage';
const DESKTOP_BUILD_VARIANT = (import.meta.env.VITE_VARIANT === 'tech' || import.meta.env.VITE_VARIANT === 'finance'
    ? import.meta.env.VITE_VARIANT
    : 'full');
export class DesktopUpdater {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "updateCheckIntervalId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "UPDATE_CHECK_INTERVAL_MS", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 6 * 60 * 60 * 1000
        });
        this.ctx = ctx;
    }
    init() {
        this.setupUpdateChecks();
    }
    destroy() {
        if (this.updateCheckIntervalId) {
            clearInterval(this.updateCheckIntervalId);
            this.updateCheckIntervalId = null;
        }
    }
    setupUpdateChecks() {
        if (!this.ctx.isDesktopApp || this.ctx.isDestroyed)
            return;
        setTimeout(() => {
            if (this.ctx.isDestroyed)
                return;
            void this.checkForUpdate();
        }, 5000);
        if (this.updateCheckIntervalId) {
            clearInterval(this.updateCheckIntervalId);
        }
        this.updateCheckIntervalId = setInterval(() => {
            if (this.ctx.isDestroyed)
                return;
            void this.checkForUpdate();
        }, this.UPDATE_CHECK_INTERVAL_MS);
    }
    logUpdaterOutcome(outcome, context = {}) {
        const logger = outcome === 'open_failed' || outcome === 'fetch_failed'
            ? console.warn
            : console.info;
        logger('[updater]', outcome, context);
    }
    getDesktopBuildVariant() {
        return DESKTOP_BUILD_VARIANT;
    }
    async checkForUpdate() {
        try {
            const res = await fetch('https://api.ivee.app/api/version', {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) {
                this.logUpdaterOutcome('fetch_failed', { status: res.status });
                return;
            }
            const data = await res.json();
            const remote = data.version;
            if (!remote) {
                this.logUpdaterOutcome('fetch_failed', { reason: 'missing_remote_version' });
                return;
            }
            const current = __APP_VERSION__;
            if (!this.isNewerVersion(remote, current)) {
                this.logUpdaterOutcome('no_update', { current, remote });
                return;
            }
            const dismissKey = `wm-update-dismissed-${remote}`;
            if (getDismissed(dismissKey)) {
                this.logUpdaterOutcome('update_available', { current, remote, dismissed: true });
                return;
            }
            const releaseUrl = typeof data.url === 'string' && data.url
                ? data.url
                : 'https://github.com/koala73/ivee/releases/latest';
            this.logUpdaterOutcome('update_available', { current, remote, dismissed: false });
            trackUpdateShown(current, remote);
            await this.showUpdateToast(remote, releaseUrl);
        }
        catch (error) {
            this.logUpdaterOutcome('fetch_failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    isNewerVersion(remote, current) {
        const r = remote.split('.').map(Number);
        const c = current.split('.').map(Number);
        for (let i = 0; i < Math.max(r.length, c.length); i++) {
            const rv = r[i] ?? 0;
            const cv = c[i] ?? 0;
            if (rv > cv)
                return true;
            if (rv < cv)
                return false;
        }
        return false;
    }
    mapDesktopDownloadPlatform(os, arch) {
        const normalizedOs = os.toLowerCase();
        const normalizedArch = arch.toLowerCase()
            .replace('amd64', 'x86_64')
            .replace('x64', 'x86_64')
            .replace('arm64', 'aarch64');
        if (normalizedOs === 'windows') {
            return normalizedArch === 'x86_64' ? 'windows-msi' : null;
        }
        if (normalizedOs === 'macos' || normalizedOs === 'darwin') {
            if (normalizedArch === 'aarch64')
                return 'macos-arm64';
            if (normalizedArch === 'x86_64')
                return 'macos-x64';
            return null;
        }
        if (normalizedOs === 'linux') {
            if (normalizedArch === 'x86_64')
                return 'linux-appimage';
            if (normalizedArch === 'aarch64')
                return 'linux-appimage-arm64';
            return null;
        }
        return null;
    }
    async resolveUpdateDownloadUrl(releaseUrl) {
        try {
            const runtimeInfo = await invokeTauri('get_desktop_runtime_info');
            const platform = this.mapDesktopDownloadPlatform(runtimeInfo.os, runtimeInfo.arch);
            if (platform) {
                const variant = this.getDesktopBuildVariant();
                return `https://api.ivee.app/api/download?platform=${platform}&variant=${variant}`;
            }
        }
        catch {
            // Silent fallback to release page when desktop runtime info is unavailable.
        }
        return releaseUrl;
    }
    async showUpdateToast(version, releaseUrl) {
        const existing = document.querySelector('.update-toast');
        if (existing?.dataset.version === version)
            return;
        existing?.remove();
        const url = await this.resolveUpdateDownloadUrl(releaseUrl);
        const toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.dataset.version = version;
        toast.innerHTML = `
      <div class="update-toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <div class="update-toast-body">
        <div class="update-toast-title">Update Available</div>
        <div class="update-toast-detail">v${escapeHtml(__APP_VERSION__)} \u2192 v${escapeHtml(version)}</div>
      </div>
      <button class="update-toast-action" data-action="download">Download</button>
      <button class="update-toast-dismiss" data-action="dismiss" aria-label="Dismiss">\u00d7</button>
    `;
        const dismissToast = () => {
            setDismissed(`wm-update-dismissed-${version}`);
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        };
        toast.addEventListener('click', (e) => {
            const target = e.target;
            const action = target.closest('[data-action]')?.dataset.action;
            if (action === 'download') {
                trackUpdateClicked(version);
                if (this.ctx.isDesktopApp) {
                    void invokeTauri('open_url', { url }).catch((error) => {
                        this.logUpdaterOutcome('open_failed', { url, error: error instanceof Error ? error.message : String(error) });
                        window.open(url, '_blank', 'noopener');
                    });
                }
                else {
                    window.open(url, '_blank', 'noopener');
                }
                dismissToast();
            }
            else if (action === 'dismiss') {
                trackUpdateDismissed(version);
                dismissToast();
            }
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('visible'));
        });
    }
}
