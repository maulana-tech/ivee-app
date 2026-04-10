import { getClerkToken } from '@/services/clerk';
import { SITE_VARIANT } from '@/config/variant';
async function authFetch(path, init) {
    let token = await getClerkToken();
    if (!token) {
        console.warn('[authFetch] getClerkToken returned null, retrying in 2s...');
        await new Promise((r) => setTimeout(r, 2000));
        token = await getClerkToken();
    }
    if (!token)
        throw new Error('Not authenticated (Clerk token null after retry)');
    return fetch(path, {
        ...init,
        headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${token}`,
        },
    });
}
export async function getChannelsData() {
    const res = await authFetch('/api/notification-channels');
    if (!res.ok)
        throw new Error(`get channels: ${res.status}`);
    return res.json();
}
export async function createPairingToken() {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-pairing-token', variant: SITE_VARIANT }),
    });
    if (!res.ok)
        throw new Error(`create pairing token: ${res.status}`);
    return res.json();
}
export async function setEmailChannel(email) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-channel', channelType: 'email', email }),
    });
    if (!res.ok)
        throw new Error(`set email channel: ${res.status}`);
}
export async function setSlackChannel(webhookEnvelope) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-channel', channelType: 'slack', webhookEnvelope }),
    });
    if (!res.ok)
        throw new Error(`set slack channel: ${res.status}`);
}
export async function startSlackOAuth() {
    const res = await authFetch('/api/slack/oauth/start', { method: 'POST' });
    if (!res.ok)
        throw new Error(`slack oauth start: ${res.status}`);
    const data = await res.json();
    return data.oauthUrl;
}
export async function startDiscordOAuth() {
    const res = await authFetch('/api/discord/oauth/start', { method: 'POST' });
    if (!res.ok)
        throw new Error(`discord oauth start: ${res.status}`);
    const data = await res.json();
    return data.oauthUrl;
}
export async function deleteChannel(channelType) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-channel', channelType }),
    });
    if (!res.ok)
        throw new Error(`delete channel: ${res.status}`);
}
export async function saveAlertRules(rules) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-alert-rules', ...rules }),
    });
    if (!res.ok)
        throw new Error(`save alert rules: ${res.status}`);
}
export async function setQuietHours(settings) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-quiet-hours', ...settings }),
    });
    if (!res.ok)
        throw new Error(`set quiet hours: ${res.status}`);
}
export async function setDigestSettings(settings) {
    const res = await authFetch('/api/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-digest-settings', ...settings }),
    });
    if (!res.ok)
        throw new Error(`set digest settings: ${res.status}`);
}
