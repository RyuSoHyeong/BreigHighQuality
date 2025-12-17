export function isMobile() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /android|iphone/i.test(ua);
}

export function isTablet() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /ipad/i.test(ua);
}