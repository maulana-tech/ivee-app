import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { postProcessAnalystHtml } from '@/utils/analyst-markdown';
import { premiumFetch } from '@/services/premium-fetch';
import { h, replaceChildren } from '@/utils/dom-utils';
const API_URL = '/api/chat-analyst';
const MAX_HISTORY = 20;
const QUICK_ACTIONS = [
    { label: 'Situation', icon: '🌍', query: "Summarize today's geopolitical situation" },
    { label: 'Markets', icon: '📈', query: 'Key market moves, macro signals, and commodity moves today' },
    { label: 'Conflicts', icon: '⚔️', query: 'Top active conflicts and military developments' },
    { label: 'Forecasts', icon: '🔮', query: 'Active forecasts and prediction market outlook' },
    { label: 'Risk', icon: '⚠️', query: 'Highest risk countries and instability hotspots' },
];
const DOMAINS = [
    { id: 'all', label: 'All' },
    { id: 'geo', label: 'Geo' },
    { id: 'market', label: 'Market' },
    { id: 'military', label: 'Military' },
    { id: 'economic', label: 'Economic' },
];
// Narrow allowlist: text formatting + tables only. No img/a/iframe so
// prompt-injected or hallucinated URLs cannot trigger third-party requests.
const ANALYST_PURIFY_CONFIG = {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'b', 'i', 'br', 'hr',
        'ul', 'ol', 'li', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span'],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
};
function renderMarkdown(raw) {
    const sanitized = DOMPurify.sanitize(marked.parse(raw), ANALYST_PURIFY_CONFIG);
    return postProcessAnalystHtml(sanitized);
}
export class ChatAnalystPanel extends Panel {
    constructor() {
        super({
            id: 'chat-analyst',
            title: 'WM Analyst',
            premium: 'locked',
            defaultRowSpan: 2,
            infoTooltip: t('components.chatAnalyst.infoTooltip'),
        });
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "domainFocus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'all'
        });
        Object.defineProperty(this, "streamAbort", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isStreaming", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "messagesEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inputEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.buildUI();
    }
    buildUI() {
        const wrapper = h('div', { className: 'chat-analyst-wrapper' });
        // Domain filter chips
        const chipBar = h('div', { className: 'chat-analyst-chips' });
        for (const d of DOMAINS) {
            const chip = h('button', {
                className: `chat-chip${d.id === this.domainFocus ? ' active' : ''}`,
                dataset: { domain: d.id },
            }, d.label);
            chipBar.appendChild(chip);
        }
        // Messages container
        const messages = h('div', { className: 'chat-analyst-messages' });
        this.messagesEl = messages;
        // Quick actions bar
        const quickBar = h('div', { className: 'chat-analyst-quick' });
        for (const qa of QUICK_ACTIONS) {
            const btn = h('button', {
                className: 'chat-quick-btn',
                dataset: { quickAction: qa.query },
            }, `${qa.icon} ${qa.label}`);
            quickBar.appendChild(btn);
        }
        // Input row
        const inputRow = h('div', { className: 'chat-analyst-input-row' });
        const textarea = document.createElement('textarea');
        textarea.className = 'chat-analyst-input';
        textarea.placeholder = 'Ask the analyst...';
        textarea.rows = 2;
        this.inputEl = textarea;
        const sendBtn = h('button', { className: 'chat-analyst-send', dataset: { action: 'send' } }, '▶');
        const clearBtn = h('button', { className: 'chat-analyst-clear', dataset: { action: 'clear' } }, '✕');
        const exportBtn = h('button', { className: 'chat-analyst-export', dataset: { action: 'export' } }, '↓');
        inputRow.appendChild(textarea);
        inputRow.appendChild(clearBtn);
        inputRow.appendChild(exportBtn);
        inputRow.appendChild(sendBtn);
        wrapper.appendChild(chipBar);
        wrapper.appendChild(messages);
        wrapper.appendChild(quickBar);
        wrapper.appendChild(inputRow);
        replaceChildren(this.content, wrapper);
        this.showWelcome();
        this.attachListeners();
    }
    attachListeners() {
        this.content.addEventListener('click', (e) => {
            const target = e.target;
            const chip = target.closest('[data-domain]');
            if (chip) {
                this.setDomain(chip.dataset.domain ?? 'all');
                return;
            }
            const qa = target.closest('[data-quick-action]');
            if (qa) {
                const query = qa.dataset.quickAction ?? '';
                if (query)
                    this.send(query);
                return;
            }
            const action = target.closest('[data-action]');
            if (action) {
                const a = action.dataset.action;
                if (a === 'send')
                    this.sendFromInput();
                else if (a === 'clear')
                    this.clear();
                else if (a === 'export')
                    this.exportChat();
            }
        });
        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendFromInput();
                }
            });
        }
    }
    setDomain(domain) {
        this.domainFocus = domain;
        const chips = this.content.querySelectorAll('[data-domain]');
        for (const chip of chips) {
            const el = chip;
            el.classList.toggle('active', el.dataset.domain === domain);
        }
    }
    sendFromInput() {
        if (!this.inputEl || this.isStreaming)
            return;
        const query = this.inputEl.value.trim();
        if (!query)
            return;
        this.inputEl.value = '';
        this.send(query);
    }
    showWelcome() {
        const bubble = h('div', { className: 'chat-msg chat-msg-assistant' }, h('div', { className: 'chat-msg-label' }, 'ANALYST'), h('div', { className: 'chat-msg-body' }, 'Ready. I have live context across geopolitical, market, military, and economic domains. Ask anything.'));
        replaceChildren(this.messagesEl, bubble);
    }
    appendMessage(role, content) {
        const label = role === 'user' ? 'YOU' : 'ANALYST';
        const body = h('div', { className: 'chat-msg-body' });
        if (role === 'assistant') {
            body.innerHTML = renderMarkdown(content);
        }
        else {
            body.textContent = content;
        }
        const bubble = h('div', { className: `chat-msg chat-msg-${role}` }, h('div', { className: 'chat-msg-label' }, label), body);
        this.messagesEl.appendChild(bubble);
        this.scrollToBottom();
    }
    appendStreamingBubble() {
        const body = h('div', { className: 'chat-msg-body' }, h('span', { className: 'chat-streaming-dot' }));
        const bubble = h('div', { className: 'chat-msg chat-msg-assistant chat-msg-streaming' }, h('div', { className: 'chat-msg-label' }, 'ANALYST'), body);
        this.messagesEl.appendChild(bubble);
        this.scrollToBottom();
        return { bubble, body };
    }
    renderSourceChips(bubble, meta) {
        if (meta.sources.length === 0 && !meta.degraded)
            return;
        const chipsRow = document.createElement('div');
        chipsRow.className = 'chat-source-chips';
        for (const src of meta.sources) {
            const chip = document.createElement('span');
            chip.className = 'chat-source-chip';
            chip.textContent = src;
            chipsRow.appendChild(chip);
        }
        if (meta.degraded) {
            const warn = document.createElement('span');
            warn.className = 'chat-source-chip chat-source-chip--warn';
            warn.textContent = '⚠ partial';
            chipsRow.appendChild(warn);
        }
        // Insert chips row before the body element inside the bubble
        const body = bubble.querySelector('.chat-msg-body');
        if (body)
            bubble.insertBefore(chipsRow, body);
    }
    renderActionChip(bubble, action) {
        if (action.type !== 'suggest-widget')
            return;
        const chip = document.createElement('button');
        chip.className = 'chat-action-chip';
        chip.textContent = `${action.label} →`;
        chip.addEventListener('click', () => {
            this.element.dispatchEvent(new CustomEvent('wm:open-widget-creator', {
                bubbles: true,
                detail: { initialMessage: action.prefill ?? '' },
            }));
        });
        const body = bubble.querySelector('.chat-msg-body');
        if (body)
            bubble.insertBefore(chip, body);
        else
            bubble.appendChild(chip);
    }
    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        });
    }
    setSendDisabled(disabled) {
        const btn = this.content.querySelector('[data-action="send"]');
        if (btn)
            btn.disabled = disabled;
        if (this.inputEl)
            this.inputEl.disabled = disabled;
    }
    async send(query) {
        if (this.isStreaming)
            return;
        this.isStreaming = true;
        this.setSendDisabled(true);
        const trimmedQuery = query.trim().slice(0, 500);
        if (!trimmedQuery) {
            this.isStreaming = false;
            this.setSendDisabled(false);
            return;
        }
        this.appendMessage('user', trimmedQuery);
        const trimmedHistory = this.history.slice(-MAX_HISTORY).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 800),
        }));
        const { bubble, body: streamingBody } = this.appendStreamingBubble();
        let accumulatedText = '';
        this.streamAbort = new AbortController();
        try {
            const res = await premiumFetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: trimmedHistory,
                    query: trimmedQuery,
                    domainFocus: this.domainFocus,
                    // geoContext (ISO-2 country focus) is supported by the API but wired in Phase 2
                    // when the panel can read the map's selected country. Agent callers can pass it directly.
                }),
                signal: this.streamAbort.signal,
            });
            if (!res.ok) {
                const err = res.status === 403 ? 'Pro subscription required.' : `Error ${res.status}`;
                this.finalizeStreamingBubble(streamingBody, `⚠ ${err}`, false);
                return;
            }
            const reader = res.body?.getReader();
            if (!reader) {
                this.finalizeStreamingBubble(streamingBody, '⚠ Stream unavailable.', false);
                return;
            }
            const finished = await this.readStream(reader, bubble, streamingBody, (text) => { accumulatedText = text; });
            if (finished === 'error')
                return;
            if (finished === 'done') {
                this.finalizeStreamingBubble(streamingBody, accumulatedText, true);
                this.pushHistory(trimmedQuery, accumulatedText);
                return;
            }
            // Stream ended without a done event — response was truncated mid-stream
            if (accumulatedText) {
                this.finalizeStreamingBubble(streamingBody, `${accumulatedText}\n\n⚠ *Response may be incomplete.*`, false);
                // Do not push to history — a truncated answer would corrupt the conversation context
            }
            else {
                this.finalizeStreamingBubble(streamingBody, '⚠ Response cut off. Try again.', false);
            }
        }
        catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                if (accumulatedText) {
                    this.finalizeStreamingBubble(streamingBody, `${accumulatedText}\n\n*Response cut off.*`, true);
                }
                else {
                    this.finalizeStreamingBubble(streamingBody, '⚠ Request cancelled.', false);
                }
            }
            else {
                this.finalizeStreamingBubble(streamingBody, '⚠ Network error. Try again.', false);
            }
        }
        finally {
            this.streamAbort = null;
            this.isStreaming = false;
            this.setSendDisabled(false);
            bubble.classList.remove('chat-msg-streaming');
        }
    }
    pushHistory(query, response) {
        this.history.push({ role: 'user', content: query });
        this.history.push({ role: 'assistant', content: response });
        if (this.history.length > MAX_HISTORY)
            this.history = this.history.slice(-MAX_HISTORY);
    }
    async readStream(reader, bubble, bodyEl, onToken) {
        const decoder = new TextDecoder();
        let buf = '';
        let accumulated = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                try {
                    const payload = JSON.parse(line.slice(6));
                    if (payload.error) {
                        this.finalizeStreamingBubble(bodyEl, '⚠ Analyst unavailable. Try again shortly.', false);
                        return 'error';
                    }
                    if (payload.meta) {
                        this.renderSourceChips(bubble, payload.meta);
                    }
                    if (payload.action) {
                        this.renderActionChip(bubble, payload.action);
                    }
                    if (payload.delta) {
                        accumulated += payload.delta;
                        bodyEl.appendChild(document.createTextNode(payload.delta));
                        onToken(accumulated);
                        this.scrollToBottom();
                    }
                    if (payload.done)
                        return 'done';
                }
                catch { /* malformed SSE chunk */ }
            }
        }
        return 'incomplete';
    }
    finalizeStreamingBubble(bodyEl, text, success) {
        bodyEl.innerHTML = renderMarkdown(text);
        if (!success)
            bodyEl.classList.add('chat-msg-error');
        this.scrollToBottom();
    }
    clear() {
        this.history = [];
        this.streamAbort?.abort();
        this.streamAbort = null;
        this.isStreaming = false;
        this.setSendDisabled(false);
        this.showWelcome();
    }
    exportChat() {
        if (this.history.length === 0)
            return;
        const lines = [`# WM Analyst Session\n*Exported: ${new Date().toISOString()}*\n`];
        for (const msg of this.history) {
            const role = msg.role === 'user' ? '**You**' : '**Analyst**';
            lines.push(`\n${role}:\n${msg.content}`);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wm-analyst-session-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
    destroy() {
        this.streamAbort?.abort();
        this.streamAbort = null;
        super.destroy();
    }
}
