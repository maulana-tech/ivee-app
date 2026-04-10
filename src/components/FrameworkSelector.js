import { loadFrameworkLibrary, getActiveFrameworkForPanel, setActiveFrameworkForPanel, } from '../services/analysis-framework-store';
import { PanelGateReason } from '../services/panel-gating';
export class FrameworkSelector {
    constructor(opts) {
        Object.defineProperty(this, "el", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "select", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "panelId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "popup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "btn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "outsideClickHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "note", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.panelId = opts.panelId;
        this.note = opts.note;
        const btn = document.createElement('button');
        btn.className = 'icon-btn framework-settings-btn';
        btn.innerHTML = '⚙';
        this.btn = btn;
        if (opts.isPremium) {
            const select = document.createElement('select');
            select.className = 'framework-popup-select';
            this.select = select;
            this.populateOptions(select);
            select.value = getActiveFrameworkForPanel(opts.panelId)?.id ?? '';
            select.addEventListener('change', () => {
                setActiveFrameworkForPanel(opts.panelId, select.value || null);
                this.updateBtnTitle();
                this.closePopup();
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.popup) {
                    this.closePopup();
                }
                else {
                    this.openPopup();
                }
            });
        }
        else {
            btn.classList.add('framework-settings-btn--locked');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                opts.panel?.showGatedCta(PanelGateReason.FREE_TIER, () => { });
            });
        }
        this.updateBtnTitle();
        this.el = btn;
    }
    updateBtnTitle() {
        const fw = this.select ? getActiveFrameworkForPanel(this.panelId) : null;
        this.btn.title = fw ? `Framework: ${fw.name}` : 'Analysis framework';
    }
    openPopup() {
        const btnRect = this.btn.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = 'framework-settings-popup';
        popup.style.top = `${btnRect.bottom + 4}px`;
        popup.style.right = `${document.documentElement.clientWidth - btnRect.right}px`;
        const label = document.createElement('div');
        label.className = 'framework-settings-label';
        label.textContent = 'Analysis Framework';
        popup.appendChild(label);
        if (this.select) {
            popup.appendChild(this.select);
        }
        if (this.note) {
            const noteEl = document.createElement('div');
            noteEl.className = 'framework-settings-note';
            noteEl.textContent = this.note;
            popup.appendChild(noteEl);
        }
        document.body.appendChild(popup);
        this.popup = popup;
        this.btn.setAttribute('aria-expanded', 'true');
        const handler = (e) => {
            if (!popup.contains(e.target) && e.target !== this.btn) {
                this.closePopup();
            }
        };
        this.outsideClickHandler = handler;
        setTimeout(() => document.addEventListener('click', handler), 0);
    }
    closePopup() {
        if (!this.popup)
            return;
        if (this.select && this.popup.contains(this.select)) {
            this.popup.removeChild(this.select);
        }
        this.popup.remove();
        this.popup = null;
        this.btn.setAttribute('aria-expanded', 'false');
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
    }
    populateOptions(select) {
        select.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Default (Neutral)';
        select.appendChild(defaultOpt);
        for (const fw of loadFrameworkLibrary()) {
            const opt = document.createElement('option');
            opt.value = fw.id;
            opt.textContent = fw.name;
            select.appendChild(opt);
        }
    }
    refresh() {
        if (!this.select)
            return;
        const current = this.select.value;
        this.populateOptions(this.select);
        this.select.value = getActiveFrameworkForPanel(this.panelId)?.id ?? current;
        this.updateBtnTitle();
    }
    destroy() {
        this.closePopup();
    }
}
