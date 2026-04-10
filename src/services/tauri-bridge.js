function resolveInvokeBridge() {
    if (typeof window === 'undefined') {
        return null;
    }
    const tauriWindow = window;
    const invoke = tauriWindow.__TAURI__?.core?.invoke ??
        tauriWindow.__TAURI_INTERNALS__?.invoke;
    return typeof invoke === 'function' ? invoke : null;
}
export function hasTauriInvokeBridge() {
    return resolveInvokeBridge() !== null;
}
export async function invokeTauri(command, payload) {
    const invoke = resolveInvokeBridge();
    if (!invoke) {
        throw new Error('Tauri invoke bridge unavailable');
    }
    return invoke(command, payload);
}
export async function tryInvokeTauri(command, payload) {
    try {
        return await invokeTauri(command, payload);
    }
    catch (error) {
        console.warn(`[tauri-bridge] Command failed: ${command}`, error);
        return null;
    }
}
