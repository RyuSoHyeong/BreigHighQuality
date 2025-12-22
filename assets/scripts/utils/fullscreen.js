export function setupFullscreenButton() {
    const btn = document.getElementById('fullscreen-button');
    if (!btn) return () => {};

    const el = document.documentElement;

    const enterIcon = 'assets/images/icons/ui_fullscreen.png';
    const exitIcon = 'assets/images/icons/ui_fullscreen_out.png';

    btn.style.display = 'none';

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isTelegram = /Telegram/.test(ua);
    const isAndroidWV = /Android/.test(ua) && /wv/.test(ua);
    const isIframe = window !== window.parent;

    if (isIOS || isTelegram || isAndroidWV || (isIframe && !document.fullscreenEnabled && !document.webkitFullscreenEnabled)) {
        return () => {};
    }

    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!request) return () => {};

    const getIsFullscreen = () => !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );

    const exitFullscreen = () => {
        const exit =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;

        if (exit) exit.call(document);
    };

    const updateIcon = () => {
        btn.style.backgroundImage = `url(${getIsFullscreen() ? exitIcon : enterIcon})`;
    };

    const onClick = () => {
        if (getIsFullscreen()) {
            exitFullscreen();
            return;
        }

        const req =
            el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.mozRequestFullScreen ||
            el.msRequestFullscreen;

        if (req) req.call(el);
    }

    const showButtonIfAllowed = () => {
        btn.style.display = 'block';
        btn.style.backgroundImage = `url(${enterIcon})`;
        updateIcon();
    };

    const testEl = document.createElement('div');
    document.body.appendChild(testEl);

    const testRequest =
        testEl.requestFullscreen ||
        testEl.webkitRequestFullscreen ||
        testEl.mozRequestFullScreen ||
        testEl.msRequestFullscreen;

    const cleanupTestEl = () => {
        if (testEl.parentElement) testEl.parentElement.removeChild(testEl);
    };

    if (testRequest) {
        try {
            const res = testRequest.call(testEl);
            if (res && typeof res.then === 'function') {
                res.then(() => {
                    document.exitFullscreen?.();
                    document.webkitExitFullscreen?.();
                    cleanupTestEl();
                    showButtonIfAllowed();
                }).catch(() => cleanupTestEl());
            } else {
                cleanupTestEl();
                showButtonIfAllowed();
            }
        } catch (e) {
            cleanupTestEl();
        }
    } else {
        cleanupTestEl();
    }

    btn.addEventListener('click', onClick);
    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon);
    document.addEventListener('mozfullscreenchange', updateIcon);
    document.addEventListener('MSFullscreenChange', updateIcon);

    return () => {
        btn.removeEventListener('click', onClick);
        document.removeEventListener('fullscreenchange', updateIcon);
        document.removeEventListener('webkitfullscreenchange', updateIcon);
        document.removeEventListener('mozfullscreenchange', updateIcon);
        document.removeEventListener('MSFullscreenChange', updateIcon);
    };
}