import { getMarketWatchlistEntries } from './market-watchlist';
async function getDefaultSummarizer() {
    const { generateSummary } = await import('./summarization');
    return generateSummary;
}
async function getPersistentCacheApi() {
    const { getPersistentCache, setPersistentCache } = await import('./persistent-cache');
    return { getPersistentCache, setPersistentCache };
}
const CACHE_PREFIX = 'premium:daily-market-brief:v1';
const DEFAULT_SCHEDULE_HOUR = 8;
const DEFAULT_TARGET_COUNT = 4;
const BRIEF_NEWS_CATEGORIES = ['markets', 'economic', 'crypto', 'finance'];
const COMMON_NAME_TOKENS = new Set(['inc', 'corp', 'group', 'holdings', 'company', 'companies', 'class', 'common', 'plc', 'limited', 'ltd', 'adr']);
function resolveTimeZone(timezone) {
    const candidate = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try {
        Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
        return candidate;
    }
    catch {
        return 'UTC';
    }
}
function getLocalDateParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: resolveTimeZone(timezone),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const read = (type) => parts.find((part) => part.type === type)?.value || '';
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
    };
}
function getDateKey(date, timezone) {
    const parts = getLocalDateParts(date, timezone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function getLocalHour(date, timezone) {
    return Number.parseInt(getLocalDateParts(date, timezone).hour || '0', 10) || 0;
}
function formatTitleDate(date, timezone) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: resolveTimeZone(timezone),
        month: 'short',
        day: 'numeric',
    }).format(date);
}
function sanitizeCacheKeyPart(value) {
    return value.replace(/[^a-z0-9/_-]+/gi, '-').toLowerCase();
}
function getCacheKey(timezone) {
    return `${CACHE_PREFIX}:${sanitizeCacheKeyPart(resolveTimeZone(timezone))}`;
}
function isMeaningfulToken(token) {
    return token.length >= 3 && !COMMON_NAME_TOKENS.has(token);
}
function getSymbolTokens(item) {
    const raw = [
        item.symbol,
        item.display,
        ...item.name.toLowerCase().split(/[^a-z0-9]+/gi),
    ];
    const out = [];
    const seen = new Set();
    for (const token of raw) {
        const normalized = token.trim().toLowerCase();
        if (!isMeaningfulToken(normalized) || seen.has(normalized))
            continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}
function matchesMarketHeadline(market, title) {
    const normalizedTitle = title.toLowerCase();
    return getSymbolTokens(market).some((token) => {
        if (token.length <= 4) {
            return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedTitle);
        }
        return normalizedTitle.includes(token);
    });
}
function collectHeadlinePool(newsByCategory, extraCategories) {
    const cats = extraCategories ?? BRIEF_NEWS_CATEGORIES;
    return cats
        .flatMap((category) => newsByCategory[category] || [])
        .filter((item) => !!item?.title)
        .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
function resolveTargets(markets, explicitTargets) {
    const explicitEntries = explicitTargets?.length ? explicitTargets : null;
    const watchlistEntries = explicitEntries ? null : getMarketWatchlistEntries();
    const targetEntries = explicitEntries || (watchlistEntries && watchlistEntries.length > 0 ? watchlistEntries : []);
    const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
    const resolved = [];
    const seen = new Set();
    for (const entry of targetEntries) {
        const match = bySymbol.get(entry.symbol);
        if (!match || seen.has(match.symbol))
            continue;
        seen.add(match.symbol);
        resolved.push(match);
        if (resolved.length >= DEFAULT_TARGET_COUNT)
            return resolved;
    }
    if (!explicitEntries && !(watchlistEntries && watchlistEntries.length > 0)) {
        for (const market of markets) {
            if (seen.has(market.symbol))
                continue;
            seen.add(market.symbol);
            resolved.push(market);
            if (resolved.length >= DEFAULT_TARGET_COUNT)
                break;
        }
    }
    return resolved;
}
function getStance(change) {
    if (typeof change !== 'number')
        return 'neutral';
    if (change >= 1)
        return 'bullish';
    if (change <= -1)
        return 'defensive';
    return 'neutral';
}
function formatSignedPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return 'flat';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}
function buildItemNote(change, relatedHeadline) {
    const stance = getStance(change);
    const moveNote = stance === 'bullish'
        ? 'Momentum is constructive; favor leaders over laggards.'
        : stance === 'defensive'
            ? 'Price action is under pressure; protect capital first.'
            : 'Tape is balanced; wait for confirmation before pressing size.';
    return relatedHeadline
        ? `${moveNote} Headline driver: ${relatedHeadline}`
        : moveNote;
}
function buildRuleSummary(items, headlineCount) {
    const bullish = items.filter((item) => item.stance === 'bullish').length;
    const defensive = items.filter((item) => item.stance === 'defensive').length;
    const neutral = items.length - bullish - defensive;
    const bias = bullish > defensive
        ? 'Risk appetite is leaning positive across the tracked watchlist.'
        : defensive > bullish
            ? 'The watchlist is trading defensively and breadth is soft.'
            : 'The watchlist is mixed and conviction is limited.';
    const breadth = `Leaders: ${bullish}, neutral setups: ${neutral}, defensive names: ${defensive}.`;
    const headlines = headlineCount > 0
        ? `News flow remains active with ${headlineCount} relevant headline${headlineCount === 1 ? '' : 's'} in scope.`
        : 'Headline flow is thin, so price action matters more than narrative today.';
    return `${bias} ${breadth} ${headlines}`;
}
function buildActionPlan(items, headlineCount) {
    const bullish = items.filter((item) => item.stance === 'bullish').length;
    const defensive = items.filter((item) => item.stance === 'defensive').length;
    if (defensive > bullish) {
        return headlineCount > 0
            ? 'Keep gross exposure light, wait for downside to stabilize, and let macro headlines clear before adding risk.'
            : 'Keep exposure light and wait for price to reclaim short-term momentum before adding risk.';
    }
    if (bullish >= 2) {
        return headlineCount > 0
            ? 'Lean into relative strength, but size entries around macro releases and company-specific headlines.'
            : 'Lean into the strongest names on pullbacks and avoid chasing extended opening moves.';
    }
    return 'Stay selective, trade the cleanest relative-strength setups, and let index direction confirm before scaling.';
}
function buildRiskWatch(items, headlines) {
    const defensive = items.filter((item) => item.stance === 'defensive').map((item) => item.display);
    const headlineTitles = headlines.slice(0, 2).map((item) => item.title);
    if (defensive.length > 0 && headlineTitles.length > 0) {
        return `Watch ${defensive.join(', ')} for further weakness while monitoring: ${headlineTitles.join(' | ')}`;
    }
    if (defensive.length > 0) {
        return `Watch ${defensive.join(', ')} for further weakness and avoid averaging into fading momentum.`;
    }
    if (headlineTitles.length > 0) {
        return `Headline watch: ${headlineTitles.join(' | ')}`;
    }
    return 'Risk watch is centered on macro follow-through, index breadth, and any abrupt reversal in the strongest names.';
}
function buildSummaryInputs(items, headlines) {
    const marketContext = items.map((item) => {
        const change = formatSignedPercent(item.change);
        return `${item.name} (${item.display}) ${change}`;
    }).join(', ');
    const headlineLines = headlines.slice(0, 6).map((item) => item.title.trim()).filter(Boolean);
    return { headlines: headlineLines, marketContext };
}
function buildExtendedMarketContext(baseContext, regime, yieldCurve, sector) {
    const parts = [`Markets: ${baseContext}`];
    if (regime && regime.compositeScore > 0) {
        const lines = [
            `Fear & Greed: ${regime.compositeScore.toFixed(0)} (${regime.compositeLabel})`,
        ];
        if (regime.fsiValue > 0)
            lines.push(`FSI: ${regime.fsiValue.toFixed(2)} (${regime.fsiLabel})`);
        if (regime.vix > 0)
            lines.push(`VIX: ${regime.vix.toFixed(1)}`);
        if (regime.hySpread > 0)
            lines.push(`HY Spread: ${regime.hySpread.toFixed(0)}bps`);
        if (regime.cnnFearGreed > 0)
            lines.push(`CNN F&G: ${regime.cnnFearGreed.toFixed(0)} (${regime.cnnLabel})`);
        if (regime.momentum)
            lines.push(`Momentum: ${regime.momentum.score.toFixed(0)}/100`);
        if (regime.sentiment)
            lines.push(`Sentiment: ${regime.sentiment.score.toFixed(0)}/100`);
        parts.push(`Market Stress Indicators:\n${lines.join('\n')}`);
    }
    if (yieldCurve && yieldCurve.rate10y > 0) {
        const spreadStr = (yieldCurve.spread2s10s >= 0 ? '+' : '') + yieldCurve.spread2s10s.toFixed(0);
        parts.push([
            `Yield Curve: ${yieldCurve.inverted ? 'INVERTED' : 'NORMAL'} (2s/10s ${spreadStr}bps)`,
            `2Y: ${yieldCurve.rate2y.toFixed(2)}%  10Y: ${yieldCurve.rate10y.toFixed(2)}%  30Y: ${yieldCurve.rate30y.toFixed(2)}%`,
        ].join('\n'));
    }
    if (sector && sector.total > 0) {
        const topSign = sector.topChange >= 0 ? '+' : '';
        const worstSign = sector.worstChange >= 0 ? '+' : '';
        parts.push([
            `Sectors: ${sector.countPositive}/${sector.total} positive`,
            `Top: ${sector.topName} ${topSign}${sector.topChange.toFixed(1)}%  Worst: ${sector.worstName} ${worstSign}${sector.worstChange.toFixed(1)}%`,
        ].join('\n'));
    }
    return parts.join('\n\n');
}
export function shouldRefreshDailyBrief(brief, timezone = 'UTC', now = new Date(), scheduleHour = DEFAULT_SCHEDULE_HOUR) {
    if (!brief?.available)
        return true;
    const resolvedTimezone = resolveTimeZone(timezone || brief.timezone);
    const dateKey = getDateKey(now, resolvedTimezone);
    if (brief.dateKey === dateKey)
        return false;
    return getLocalHour(now, resolvedTimezone) >= scheduleHour;
}
export async function getCachedDailyMarketBrief(timezone) {
    const resolvedTimezone = resolveTimeZone(timezone);
    const { getPersistentCache } = await getPersistentCacheApi();
    const envelope = await getPersistentCache(getCacheKey(resolvedTimezone));
    return envelope?.data ?? null;
}
export async function cacheDailyMarketBrief(brief) {
    const { setPersistentCache } = await getPersistentCacheApi();
    await setPersistentCache(getCacheKey(brief.timezone), brief);
}
export async function buildDailyMarketBrief(options) {
    const now = options.now || new Date();
    const timezone = resolveTimeZone(options.timezone);
    const trackedMarkets = resolveTargets(options.markets, options.targets).slice(0, DEFAULT_TARGET_COUNT);
    const relevantHeadlines = collectHeadlinePool(options.newsByCategory, options.newsCategories);
    const items = trackedMarkets.map((market) => {
        const relatedHeadline = relevantHeadlines.find((headline) => matchesMarketHeadline(market, headline.title))?.title;
        return {
            symbol: market.symbol,
            name: market.name,
            display: market.display,
            price: market.price,
            change: market.change,
            stance: getStance(market.change),
            note: buildItemNote(market.change, relatedHeadline),
            ...(relatedHeadline ? { relatedHeadline } : {}),
        };
    });
    if (items.length === 0) {
        return {
            available: false,
            title: `Daily Market Brief • ${formatTitleDate(now, timezone)}`,
            dateKey: getDateKey(now, timezone),
            timezone,
            summary: 'Market data is not available yet for the daily brief.',
            actionPlan: '',
            riskWatch: '',
            items: [],
            provider: 'rules',
            model: '',
            fallback: true,
            generatedAt: now.toISOString(),
            headlineCount: 0,
        };
    }
    const { headlines: summaryHeadlines, marketContext } = buildSummaryInputs(items, relevantHeadlines);
    let extendedContext = buildExtendedMarketContext(marketContext, options.regimeContext, options.yieldCurveContext, options.sectorContext);
    if (options.frameworkAppend) {
        extendedContext = `${extendedContext}\n\n---\nAnalytical Framework:\n${options.frameworkAppend}`;
    }
    let summary = buildRuleSummary(items, relevantHeadlines.length);
    let provider = 'rules';
    let model = '';
    let fallback = true;
    if (summaryHeadlines.length >= 1) {
        try {
            const summaryProvider = options.summarize || await getDefaultSummarizer();
            const generated = await summaryProvider(summaryHeadlines, undefined, extendedContext, 'en');
            if (generated?.summary) {
                summary = generated.summary.trim();
                provider = generated.provider;
                model = generated.model;
                fallback = false;
            }
        }
        catch (err) {
            console.warn('[DailyBrief] AI summarization failed, using rules-based fallback:', err.message);
        }
    }
    return {
        available: true,
        title: `Daily Market Brief • ${formatTitleDate(now, timezone)}`,
        dateKey: getDateKey(now, timezone),
        timezone,
        summary,
        actionPlan: buildActionPlan(items, relevantHeadlines.length),
        riskWatch: buildRiskWatch(items, relevantHeadlines),
        items,
        provider,
        model,
        fallback,
        generatedAt: now.toISOString(),
        headlineCount: relevantHeadlines.length,
    };
}
