export function isMobile() {
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

    if (/(iphone|ipod)/i.test(ua)) return true;
    if (/android/i.test(ua) && /mobile/i.test(ua)) return true;

    return false;
}

export function isTablet() {
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

    if (/ipad/i.test(ua)) return true;

    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;

    if (/android/i.test(ua) && !/mobile/i.test(ua)) return true;

    return false;
}
