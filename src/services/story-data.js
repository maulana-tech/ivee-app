import { calculateCII } from './country-instability';
import { CURATED_COUNTRIES } from '@/config/countries';
import { tokenizeForMatch, matchKeyword } from '@/utils/keyword-match';
export function collectStoryData(countryCode, countryName, allNews, theaterPostures, predictionMarkets, signals, convergence) {
    const scores = calculateCII();
    const countryScore = scores.find(s => s.code === countryCode) || null;
    const keywords = CURATED_COUNTRIES[countryCode]?.scoringKeywords || [countryName.toLowerCase()];
    const countryNews = allNews.filter(e => {
        const tokens = tokenizeForMatch(e.primaryTitle);
        return keywords.some(kw => matchKeyword(tokens, kw));
    });
    const sortedNews = [...countryNews].sort((a, b) => {
        const priorities = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
        const pa = priorities[a.threat?.level || 'info'] || 0;
        const pb = priorities[b.threat?.level || 'info'] || 0;
        return pb - pa;
    });
    const theater = theaterPostures.find(t => t.targetNation?.toLowerCase() === countryName.toLowerCase() ||
        t.shortName?.toLowerCase() === countryCode.toLowerCase()) || null;
    const countryMarkets = predictionMarkets.filter(m => {
        const mTokens = tokenizeForMatch(m.title);
        return keywords.some(kw => matchKeyword(mTokens, kw));
    });
    const threatCounts = { critical: 0, high: 0, medium: 0, categories: new Set() };
    for (const n of countryNews) {
        const level = n.threat?.level;
        if (level === 'critical')
            threatCounts.critical++;
        else if (level === 'high')
            threatCounts.high++;
        else if (level === 'medium')
            threatCounts.medium++;
        if (n.threat?.category && n.threat.category !== 'general') {
            threatCounts.categories.add(n.threat.category);
        }
    }
    return {
        countryCode,
        countryName,
        cii: countryScore ? {
            score: countryScore.score,
            level: countryScore.level,
            trend: countryScore.trend,
            components: countryScore.components,
            change24h: countryScore.change24h,
        } : null,
        news: sortedNews.slice(0, 5).map(n => ({
            title: n.primaryTitle,
            threatLevel: (n.threat?.level || 'info'),
            sourceCount: n.sourceCount,
        })),
        theater: theater ? {
            theaterName: theater.theaterName,
            postureLevel: theater.postureLevel,
            totalAircraft: theater.totalAircraft,
            totalVessels: theater.totalVessels,
            fighters: theater.fighters,
            tankers: theater.tankers,
            awacs: theater.awacs,
            strikeCapable: theater.strikeCapable,
        } : null,
        markets: countryMarkets.slice(0, 4).map(m => ({
            title: m.title,
            yesPrice: m.yesPrice,
        })),
        threats: {
            critical: threatCounts.critical,
            high: threatCounts.high,
            medium: threatCounts.medium,
            categories: [...threatCounts.categories],
        },
        signals: signals || { protests: 0, militaryFlights: 0, militaryVessels: 0, outages: 0, gpsJammingHexes: 0 },
        convergence: convergence || null,
    };
}
