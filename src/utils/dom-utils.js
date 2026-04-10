export function h(tag, propsOrChild, ...children) {
    const el = document.createElement(tag);
    let allChildren;
    if (propsOrChild != null &&
        typeof propsOrChild === 'object' &&
        !(propsOrChild instanceof Node)) {
        applyProps(el, propsOrChild);
        allChildren = children;
    }
    else {
        allChildren = [propsOrChild, ...children];
    }
    appendChildren(el, allChildren);
    return el;
}
export function text(value) {
    return document.createTextNode(value);
}
export function fragment(...children) {
    const frag = document.createDocumentFragment();
    appendChildren(frag, children);
    return frag;
}
export function clearChildren(el) {
    while (el.lastChild)
        el.removeChild(el.lastChild);
}
export function replaceChildren(el, ...children) {
    const frag = document.createDocumentFragment();
    appendChildren(frag, children);
    clearChildren(el);
    el.appendChild(frag);
}
export function rawHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    return tpl.content;
}
const SAFE_TAGS = new Set([
    'strong', 'em', 'b', 'i', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div', 'a',
]);
const SAFE_ATTRS = new Set(['class', 'href', 'target', 'rel', 'style']);
// Only permit `color` declarations using hex, rgb(), named colors, or CSS vars.
// Blocks url(), expression(), javascript:, data: and other CSS injection vectors.
const SAFE_STYLE_RE = /^color:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+|var\(--[\w-]+\))\s*;?\s*$/;
/** Like rawHtml() but strips tags and attributes not in the allowlist. */
export function safeHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const walk = (parent) => {
        const children = Array.from(parent.childNodes);
        for (const node of children) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node;
                if (!SAFE_TAGS.has(el.tagName.toLowerCase())) {
                    // Unwrap: keep children, remove the element itself
                    while (el.firstChild)
                        parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                    continue;
                }
                // Strip unsafe attributes
                for (const attr of Array.from(el.attributes)) {
                    if (!SAFE_ATTRS.has(attr.name.toLowerCase())) {
                        el.removeAttribute(attr.name);
                    }
                }
                // Sanitize href to prevent javascript: URIs
                if (el.hasAttribute('href')) {
                    const href = el.getAttribute('href') || '';
                    if (!/^https?:\/\//i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
                        el.removeAttribute('href');
                    }
                }
                // Sanitize style to color-only values; strip anything else (url(), expression(), etc.)
                if (el.hasAttribute('style')) {
                    const style = el.getAttribute('style') || '';
                    if (!SAFE_STYLE_RE.test(style.trim())) {
                        el.removeAttribute('style');
                    }
                }
                walk(el);
            }
        }
    };
    walk(tpl.content);
    return tpl.content;
}
function applyProps(el, props) {
    for (const key in props) {
        const value = props[key];
        if (value == null || value === false)
            continue;
        if (key === 'className') {
            el.className = value;
        }
        else if (key === 'style') {
            if (typeof value === 'string') {
                el.style.cssText = value;
            }
            else if (typeof value === 'object') {
                Object.assign(el.style, value);
            }
        }
        else if (key === 'dataset') {
            const ds = value;
            for (const k in ds) {
                el.dataset[k] = ds[k];
            }
        }
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (value === true) {
            el.setAttribute(key, '');
        }
        else {
            el.setAttribute(key, String(value));
        }
    }
}
function appendChildren(parent, children) {
    for (const child of children) {
        if (child == null || child === false)
            continue;
        if (child instanceof Node) {
            parent.appendChild(child);
        }
        else {
            parent.appendChild(document.createTextNode(String(child)));
        }
    }
}
