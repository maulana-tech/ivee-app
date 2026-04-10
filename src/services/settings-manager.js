import { RUNTIME_FEATURES, getEffectiveSecrets, getRuntimeConfigSnapshot, getSecretState, isFeatureEnabled, setSecretValue, validateSecret, verifySecretWithApi, } from './runtime-config';
import { PLAINTEXT_KEYS, MASKED_SENTINEL } from './settings-constants';
export class SettingsManager {
    constructor() {
        Object.defineProperty(this, "pendingSecrets", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "validatedKeys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "validationMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    captureUnsavedInputs(container) {
        container.querySelectorAll('input[data-secret]').forEach((input) => {
            const key = input.dataset.secret;
            if (!key)
                return;
            const raw = input.value.trim();
            if (!raw || raw === MASKED_SENTINEL)
                return;
            if (PLAINTEXT_KEYS.has(key) && !this.pendingSecrets.has(key)) {
                const stored = getRuntimeConfigSnapshot().secrets[key]?.value || '';
                if (raw === stored)
                    return;
            }
            this.pendingSecrets.set(key, raw);
            const result = validateSecret(key, raw);
            if (!result.valid) {
                this.validatedKeys.set(key, false);
                this.validationMessages.set(key, result.hint || 'Invalid format');
            }
        });
        const modelSelect = container.querySelector('select[data-model-select]');
        const modelManual = container.querySelector('input[data-model-manual]');
        const modelValue = (modelManual && !modelManual.classList.contains('hidden-input') ? modelManual.value.trim() : modelSelect?.value) || '';
        if (modelValue && !this.pendingSecrets.has('OLLAMA_MODEL')) {
            this.pendingSecrets.set('OLLAMA_MODEL', modelValue);
            this.validatedKeys.set('OLLAMA_MODEL', true);
        }
    }
    hasPendingChanges() {
        return this.pendingSecrets.size > 0;
    }
    getMissingRequiredSecrets() {
        const missing = [];
        for (const feature of RUNTIME_FEATURES) {
            if (!isFeatureEnabled(feature.id))
                continue;
            const secrets = getEffectiveSecrets(feature);
            const hasPending = secrets.some(k => this.pendingSecrets.has(k));
            if (!hasPending)
                continue;
            for (const key of secrets) {
                if (!getSecretState(key).valid && !this.pendingSecrets.has(key)) {
                    missing.push(key);
                }
            }
        }
        return missing;
    }
    getValidationErrors() {
        const errors = [];
        for (const [key, value] of this.pendingSecrets) {
            const result = validateSecret(key, value);
            if (!result.valid)
                errors.push(`${key}: ${result.hint || 'Invalid format'}`);
        }
        return errors;
    }
    async verifyPendingSecrets() {
        const errors = [];
        const context = Object.fromEntries(this.pendingSecrets.entries());
        const toVerifyRemotely = [];
        for (const [key, value] of this.pendingSecrets) {
            const localResult = validateSecret(key, value);
            if (!localResult.valid) {
                this.validatedKeys.set(key, false);
                this.validationMessages.set(key, localResult.hint || 'Invalid format');
                errors.push(`${key}: ${localResult.hint || 'Invalid format'}`);
            }
            else {
                toVerifyRemotely.push([key, value]);
            }
        }
        if (toVerifyRemotely.length > 0) {
            const results = await Promise.race([
                Promise.all(toVerifyRemotely.map(async ([key, value]) => {
                    const result = await verifySecretWithApi(key, value, context);
                    return { key, result };
                })),
                new Promise(resolve => setTimeout(() => resolve(toVerifyRemotely.map(([key]) => ({
                    key, result: { valid: true, message: 'Saved (verification timed out)' },
                }))), 15000)),
            ]);
            for (const { key, result: verifyResult } of results) {
                this.validatedKeys.set(key, verifyResult.valid);
                if (!verifyResult.valid) {
                    this.validationMessages.set(key, verifyResult.message || 'Verification failed');
                    errors.push(`${key}: ${verifyResult.message || 'Verification failed'}`);
                }
                else {
                    this.validationMessages.delete(key);
                }
            }
        }
        return errors;
    }
    async commitVerifiedSecrets() {
        for (const [key, value] of this.pendingSecrets) {
            if (this.validatedKeys.get(key) !== false) {
                await setSecretValue(key, value);
                this.pendingSecrets.delete(key);
                this.validatedKeys.delete(key);
                this.validationMessages.delete(key);
            }
        }
    }
    setPending(key, value) {
        this.pendingSecrets.set(key, value);
    }
    getPending(key) {
        return this.pendingSecrets.get(key);
    }
    hasPending(key) {
        return this.pendingSecrets.has(key);
    }
    deletePending(key) {
        this.pendingSecrets.delete(key);
        this.validatedKeys.delete(key);
        this.validationMessages.delete(key);
    }
    setValidation(key, valid, message) {
        this.validatedKeys.set(key, valid);
        if (message) {
            this.validationMessages.set(key, message);
        }
        else {
            this.validationMessages.delete(key);
        }
    }
    getValidationState(key) {
        return {
            validated: this.validatedKeys.get(key),
            message: this.validationMessages.get(key),
        };
    }
    destroy() {
        this.pendingSecrets.clear();
        this.validatedKeys.clear();
        this.validationMessages.clear();
    }
}
