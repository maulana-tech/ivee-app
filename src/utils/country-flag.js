export function toFlagEmoji(code, fallback = '🌍') {
    const upperCode = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(upperCode))
        return fallback;
    return upperCode
        .split('')
        .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
        .join('');
}
