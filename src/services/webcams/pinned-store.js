const STORAGE_KEY = 'wm-pinned-webcams';
const CHANGE_EVENT = 'wm-pinned-webcams-changed';
const MAX_ACTIVE = 4;
let _cachedList = null;
let _cacheFrame = null;
function load() {
    if (_cachedList !== null)
        return _cachedList;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        _cachedList = raw ? JSON.parse(raw) : [];
    }
    catch {
        _cachedList = [];
    }
    if (_cacheFrame === null) {
        _cacheFrame = requestAnimationFrame(() => { _cachedList = null; _cacheFrame = null; });
    }
    return _cachedList;
}
function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'wm-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
function save(webcams) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(webcams));
    }
    catch (err) {
        console.warn('[pinned-webcams] localStorage save failed:', err);
        showToast('Could not save pinned webcams — storage full');
    }
    _cachedList = null;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
export function getPinnedWebcams() {
    return load();
}
export function getActiveWebcams() {
    return load()
        .filter(w => w.active)
        .sort((a, b) => a.pinnedAt - b.pinnedAt)
        .slice(0, MAX_ACTIVE);
}
export function isPinned(webcamId) {
    return load().some(w => w.webcamId === webcamId);
}
export function pinWebcam(webcam) {
    const list = load();
    if (list.some(w => w.webcamId === webcam.webcamId))
        return;
    const activeCount = list.filter(w => w.active).length;
    list.push({
        ...webcam,
        active: activeCount < MAX_ACTIVE,
        pinnedAt: Date.now(),
    });
    save(list);
}
export function unpinWebcam(webcamId) {
    const list = load().filter(w => w.webcamId !== webcamId);
    save(list);
}
export function toggleWebcam(webcamId) {
    const list = load();
    const target = list.find(w => w.webcamId === webcamId);
    if (!target)
        return;
    if (!target.active) {
        const activeList = list
            .filter(w => w.active)
            .sort((a, b) => a.pinnedAt - b.pinnedAt);
        if (activeList.length >= MAX_ACTIVE && activeList[0]) {
            activeList[0].active = false;
        }
        target.active = true;
    }
    else {
        target.active = false;
    }
    save(list);
}
export function onPinnedChange(handler) {
    const wrapped = () => handler();
    window.addEventListener(CHANGE_EVENT, wrapped);
    return () => window.removeEventListener(CHANGE_EVENT, wrapped);
}
