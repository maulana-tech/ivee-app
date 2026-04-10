/**
 * ML Capabilities Detection
 * Detects device capabilities for ONNX Runtime Web
 */
import { isMobileDevice } from '@/utils';
import { ML_THRESHOLDS } from '@/config/ml-config';
let cachedCapabilities = null;
export async function detectMLCapabilities() {
    if (cachedCapabilities)
        return cachedCapabilities;
    const isDesktop = !isMobileDevice();
    const hasWebGL = checkWebGLSupport();
    const hasWebGPU = await checkWebGPUSupport();
    const hasSIMD = checkSIMDSupport();
    const hasThreads = checkThreadsSupport();
    const estimatedMemoryMB = estimateAvailableMemory();
    const isSupported = isDesktop &&
        (hasWebGL || hasWebGPU) &&
        estimatedMemoryMB >= 100;
    let recommendedExecutionProvider;
    if (hasWebGPU) {
        recommendedExecutionProvider = 'webgpu';
    }
    else if (hasWebGL) {
        recommendedExecutionProvider = 'webgl';
    }
    else {
        recommendedExecutionProvider = 'wasm';
    }
    const recommendedThreads = hasThreads
        ? Math.min(navigator.hardwareConcurrency || 4, 4)
        : 1;
    cachedCapabilities = {
        isSupported,
        isDesktop,
        hasWebGL,
        hasWebGPU,
        hasSIMD,
        hasThreads,
        estimatedMemoryMB,
        recommendedExecutionProvider,
        recommendedThreads,
    };
    return cachedCapabilities;
}
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return !!gl;
    }
    catch {
        return false;
    }
}
async function checkWebGPUSupport() {
    try {
        if (!('gpu' in navigator))
            return false;
        const adapter = await navigator.gpu?.requestAdapter();
        return adapter !== null && adapter !== undefined;
    }
    catch {
        return false;
    }
}
function checkSIMDSupport() {
    try {
        return typeof WebAssembly.validate === 'function' &&
            WebAssembly.validate(new Uint8Array([
                0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
                3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
            ]));
    }
    catch {
        return false;
    }
}
function checkThreadsSupport() {
    return typeof SharedArrayBuffer !== 'undefined';
}
function estimateAvailableMemory() {
    if (isMobileDevice())
        return 0;
    const deviceMemory = navigator.deviceMemory;
    if (deviceMemory) {
        return Math.min(deviceMemory * 256, ML_THRESHOLDS.memoryBudgetMB);
    }
    return 256;
}
export function shouldEnableMLFeatures() {
    return cachedCapabilities?.isSupported ?? false;
}
export function getMLCapabilities() {
    return cachedCapabilities;
}
export function clearCapabilitiesCache() {
    cachedCapabilities = null;
}
