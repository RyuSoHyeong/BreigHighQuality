export function createSplash() {
    const wrapper = document.createElement('div');
    wrapper.id = 'application-splash-wrapper';

    const splash = document.createElement('div');
    splash.id = 'application-splash';

    const title = document.createElement('div');
    title.textContent = 'Loading Data...';

    const progressBarContainer = document.createElement('div');
    progressBarContainer.id = 'progress-bar-container';

    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBarContainer.appendChild(progressBar);

    const progressText = document.createElement('div');
    progressText.id = 'progress-text';
    progressText.textContent = '0%';

    splash.appendChild(title);
    splash.appendChild(progressBarContainer);
    splash.appendChild(progressText);
    wrapper.appendChild(splash);
    document.body.appendChild(wrapper);
}

export function setSplashProgress(progress) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');

    if (!bar && !text) return;

    let percent = progress * 100;
    if (!isFinite(percent) || isNaN(percent)) percent = 0;

    const clamped = Math.max(0, Math.min(100, percent));

    if (bar) {
        bar.style.width = `${clamped}%`;
    }

    if (text) {
        text.textContent = `${Math.round(clamped)}%`;
    }
}

export function hideSplash() {
    const wrapper = document.getElementById('application-splash-wrapper');
    if (!wrapper) return;

    wrapper.parentElement?.removeChild(wrapper);
}

function createUrlResolver(assetList) {
    const map = new Map();
    const keys = [];

    assetList.forEach((info) => {
        const asset = info.asset;
        let url = null;

        if (asset.file && asset.file.url) {
            url = asset.file.url;
        } else if (typeof asset.getFileUrl === "function") {
            url = asset.getFileUrl();
        } else if (asset.url) {
            url = asset.url;
        }

        if (!url) return;

        const clean = url.split("?")[0];
        const short = clean.substring(clean.lastIndexOf("/") + 1);

        [clean, short].forEach((key) => {
            if (key && !map.has(key)) {
                map.set(key, info);
                keys.push(key);
            }
        });
    });

    return function resolve(url) {
        if (!url) return null;

        const str =
            typeof url === "string"
                ? url
                : (url && url.url) || String(url);

        const clean = str.split("?")[0];
        const short = clean.substring(clean.lastIndexOf("/") + 1);

        if (map.has(clean)) return map.get(clean);
        if (map.has(short)) return map.get(short);

        for (const key of keys) {
            if (clean.endsWith(key) || clean.includes(key)) {
                return map.get(key);
            }
        }
        return null;
    };
}

function patchNetworkProgress(resolveInfo, onBytes) {
    if (XMLHttpRequest.prototype._pcProgressPatched) {
        return function restore() {};
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalFetch =
        typeof window !== "undefined" && window.fetch
            ? window.fetch.bind(window)
            : null;

    XMLHttpRequest.prototype._pcProgressPatched = true;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._pcUrl = url;
        return originalOpen.call(this, method, url, async, user, password);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const xhr = this;
        const info = resolveInfo(xhr._pcUrl);

        if (info && info.size) {
            const size = info.size;

            const finalize = () => onBytes(info, size);

            xhr.addEventListener("progress", (e) => {
                if (!e || typeof e.loaded !== "number" || !size) return;
                onBytes(info, Math.min(size, e.loaded));
            });

            xhr.addEventListener("load", finalize);
            xhr.addEventListener("error", finalize);
            xhr.addEventListener("abort", finalize);
        }

        return originalSend.call(xhr, body);
    };

    if (originalFetch) {
        window.fetch = function (input, init) {
            const url =
                typeof input === "string"
                    ? input
                    : (input && input.url) || null;

            const info = resolveInfo(url);
            if (!info || !info.size) {
                return originalFetch(input, init);
            }

            const size = info.size;
            let loaded = info.loadedBytes || 0;

            return originalFetch(input, init).then((response) => {
                const body = response.body;

                if (!body || !body.getReader) {
                    onBytes(info, size);
                    return response;
                }

                const reader = body.getReader();

                const stream = new ReadableStream({
                    start(controller) {
                        function read() {
                            reader
                                .read()
                                .then(({ done, value }) => {
                                    if (done) {
                                        onBytes(info, size);
                                        controller.close();
                                        return;
                                    }

                                    loaded += value.byteLength;
                                    onBytes(info, Math.min(size, loaded));

                                    controller.enqueue(value);
                                    read();
                                })
                                .catch(() => {
                                    onBytes(info, size);
                                    controller.close();
                                });
                        }

                        read();
                    }
                });

                return new Response(stream, {
                    headers: response.headers,
                    status: response.status,
                    statusText: response.statusText
                });
            }).catch((err) => {
                onBytes(info, size);
                throw err;
            });
        };
    }

    return function restore() {
        XMLHttpRequest.prototype.open = originalOpen;
        XMLHttpRequest.prototype.send = originalSend;
        if (originalFetch) {
            window.fetch = originalFetch;
        }
        XMLHttpRequest.prototype._pcProgressPatched = false;
    };
}

export function loadAssets(app, assetList, onComplete, onProgress) {
    if (!assetList || !assetList.length) {
        if (onProgress) onProgress(1);
        if (onComplete) onComplete(null);
        return;
    }

    const assets = assetList.map((i) => i.asset);

    const totalSize =
        assetList.reduce((sum, i) => sum + (i.size || 0), 0) ||
        assetList.length;

    assetList.forEach((i) => {
        i.loadedBytes = 0;
    });

    let rafId = 0;
    let pending = false;

    function emitProgress(p) {
        if (onProgress) onProgress(p);
    }

    function recalcProgress() {
        if (pending) return;
        pending = true;

        rafId = requestAnimationFrame(() => {
            pending = false;

            let loaded = 0;
            for (const info of assetList) {
                loaded += info.loadedBytes || 0;
            }

            let p = totalSize > 0 ? loaded / totalSize : 1;
            if (!isFinite(p) || isNaN(p)) p = 0;
            p = Math.max(0, Math.min(1, p));

            emitProgress(p);
        });
    }

    function onBytes(info, absLoaded) {
        if (!info || !info.size) return;

        const size = info.size;
        const clamped = Math.min(size, absLoaded || 0);

        if (clamped > (info.loadedBytes || 0)) {
            info.loadedBytes = clamped;
            recalcProgress();
        }
    }

    const resolveInfo = createUrlResolver(assetList);
    const restoreNetwork = patchNetworkProgress(resolveInfo, onBytes);

    const listLoader = new pc.AssetListLoader(assets, app.assets);
    listLoader.load((err) => {
        restoreNetwork();

        for (const info of assetList) {
            if (info.size && !(info.loadedBytes > 0)) {
                info.loadedBytes = info.size;
            }
        }

        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
            pending = false;
        }
        
        recalcProgress();
        if (onComplete) onComplete(err || null);
    });
}