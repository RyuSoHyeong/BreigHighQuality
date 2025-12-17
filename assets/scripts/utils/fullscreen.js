export function setupFullscreenButton() {
    const btn = document.getElementById("fullscreen-button");
    if (!btn) return;

    const el = document.documentElement;

    const enterIcon = 'assets/images/icons/ui_fullscreen.png';
    const exitIcon = 'assets/images/icons/ui_fullscreen_out.png';

    btn.style.display = "none";

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isTelegram = /Telegram/.test(navigator.userAgent);
    const isAndroidWV = /Android/.test(navigator.userAgent) && /wv/.test(navigator.userAgent);
    const isIframe = window !== window.parent;

    if (
        isIOS || isTelegram || isAndroidWV || (isIframe && !document.fullscreenEnabled && !document.webkitFullscreenEnabled)
    ) {
        return;
    }

    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!request) return;

    const testEl = document.createElement('div');
    document.body.appendChild(testEl);
    const testRequest = testEl.requestFullscreen || testEl.webkitRequestFullscreen || testEl.mozRequestFullScreen || testEl.msRequestFullscreen;

    if (testRequest) {
        try {
            const res = testRequest.call(testEl);
            if (res && typeof res.then === "function") {
                res.then(() => {
                    document.exitFullscreen?.();
                    document.webkitExitFullscreen?.();
                    btn.style.display = "block";
                    btn.style.backgroundImage = `url(${enterIcon})`;
                    document.body.removeChild(testEl);
                }).catch(() => {
                    document.body.removeChild(testEl);
                });
            } else {
                btn.style.display = "block";
                btn.style.backgroundImage = `url(${enterIcon})`;
                document.body.removeChild(testEl);
            }
        } catch (err) {
            document.body.removeChild(testEl);
        }
    }

    btn.addEventListener("click", () => {
        const isFull = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (isFull) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) exit.call(document);
        } else {
            const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
            if (req) req.call(el);
        }
    });

    function updateIcon() {
        const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        btn.style.backgroundImage = `url(${isFull ? exitIcon : enterIcon})`;
    }

    document.addEventListener("fullscreenchange", updateIcon);
    document.addEventListener("webkitfullscreenchange", updateIcon);
    document.addEventListener("mozfullscreenchange", updateIcon);
    document.addEventListener("MSFullscreenChange", updateIcon);
}