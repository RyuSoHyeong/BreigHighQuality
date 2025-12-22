export function isMobile() {
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    return (/(iphone|ipod)/i.test(ua)) || (/android/i.test(ua) && /mobile/i.test(ua));
}

export function isTablet() {
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

    if (/ipad/i.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return /android/i.test(ua) && !/mobile/i.test(ua);
}