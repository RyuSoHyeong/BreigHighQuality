export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSmoothProgress(setProgress, options = {}) {
    const {
        speed = 8,
        snapEps = 0.001
    } = options;

    let current = 0;
    let target = 0;
    let running = false;
    let lastTime = performance.now();

    const tick = () => {
        if (!running) return;

        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        const k = 1 - Math.exp(-speed * dt);
        current = current + (target - current) * k;

        if (Math.abs(target - current) <= snapEps) {
            current = target;
        }

        setProgress(current);

        if (current !== target) {
            requestAnimationFrame(tick);
        } else {
            running = false;
        }
    };

    return {
        setTarget(value01) {
            const v = Math.max(0, Math.min(1, value01));
            target = Math.max(target, v);
            if (!running) {
                running = true;
                lastTime = performance.now();
                requestAnimationFrame(tick);
            }
        },
        setNow(value01) {
            const v = Math.max(0, Math.min(1, value01));
            current = v;
            target = v;
            setProgress(v);
        }
    };
}

export function clamp01(v) {
    if (!isFinite(v) || isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
}

export function mapAssetProgress(assetProgress01, assetProgressWeight) {
    return clamp01(assetProgress01) * clamp01(assetProgressWeight);
}

export function loadLODSmooth(app, gs, options = {}) {
    const {
        duration = 3000,
        startBudget = 500000,
        endBudget = 3000000,
        startLodMin = 2,
        endLodMin = 0
    } = options;

    const startTime = performance.now();
    const gsplat = app.scene.gsplat;

    function step() {
        const t = Math.min((performance.now() - startTime) / duration, 1);
        const k = t * t * (3 - 2 * t);

        gs.splatBudget = Math.round(pc.math.lerp(startBudget, endBudget, k));

        const newMin = Math.round(pc.math.lerp(startLodMin, endLodMin, k));
        if (gsplat.lodRangeMin !== newMin) {
            gsplat.lodRangeMin = newMin;

            const max = gsplat.lodRangeMax;
            gsplat.lodRangeMax = max - 1;
            gsplat.lodRangeMax = max;
        }

        if (t < 1) {
            requestAnimationFrame(step);
            return;
        }

        gs.splatBudget = endBudget;

        if (gsplat.lodRangeMin !== endLodMin) {
            gsplat.lodRangeMin = endLodMin;
            const max = gsplat.lodRangeMax;
            gsplat.lodRangeMax = max - 1;
            gsplat.lodRangeMax = max;
        }
    }

    step();
}

export function waitForGsplatsGate(app, options) {
    const {
        threshold,
        assetProgressWeight,
        onProgress,
        onReady
    } = options;

    app.stats.enabled = true;

    const update = () => {
        const gsplats = app.stats?.frame?.gsplats || 0;
        const k = clamp01(gsplats / Math.max(1, threshold));
        const progress = clamp01(assetProgressWeight) + (1 - clamp01(assetProgressWeight)) * k;

        if (onProgress) onProgress(progress);

        if (gsplats >= threshold) {
            app.off('update', update);
            if (onReady) onReady();
        }
    };

    app.on('update', update);
    app.once('destroy', () => app.off('update', update));
}

export function createDebugStatsOverlayUpdater(app, options) {
    const {
        elementId = 'debug-stats',
        gs,
        fpsLockerState
    } = options;

    const el = document.getElementById(elementId);
    if (!el) return () => {};

    app.stats.enabled = true;

    let lastTime = performance.now();
    let lastRenderCount = fpsLockerState?.renderFrameCounter || 0;

    const update = () => {
        const now = performance.now();
        if (now - lastTime < 1000) return;

        const renderCount = fpsLockerState?.renderFrameCounter || 0;
        const renderedFrames = renderCount - lastRenderCount;

        const fps = Math.round((renderedFrames * 1000) / (now - lastTime));

        lastRenderCount = renderCount;
        lastTime = now;

        const gsplats = app.stats?.frame?.gsplats;
        const splatsText = (typeof gsplats === 'number') ? gsplats.toLocaleString() : 'n/a';

        const budgetValue = gs?.splatBudget;
        const budgetText =
            (typeof budgetValue === 'number') ? budgetValue.toLocaleString() :
            (budgetValue ?? 'n/a');

        const sceneGs = app.scene?.gsplat;
        const lodText = sceneGs ? `${sceneGs.lodRangeMin} → ${sceneGs.lodRangeMax}` : '-';

        el.textContent =
            `FPS: ${fps}\n` +
            `Splats: ${splatsText}\n` +
            `Budget: ${budgetText}\n` +
            `LOD: ${lodText}`;
    };

    app.on('update', update);

    return () => {
        app.off('update', update);
    };
}

export function getDeviceProfile({ isMobile, isTablet, profiles }) {
    if (isMobile()) return profiles.phone;
    if (isTablet()) return profiles.tablet;
    return profiles.desktop;
}

export function finalizeStart({ reveal, setSplashProgress, hideSplash, setupFullscreenButton, loadLanguage}) {
    setSplashProgress(1);
    hideSplash();

    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();

    document.querySelector('.mode-panel')?.classList.remove('hidden');
    document.getElementById('fps-locker')?.classList.remove('hidden');
    document.getElementById('debug-stats')?.classList.remove('hidden');

    if (reveal) {
        if ('effectTime' in reveal) reveal.effectTime = 0;
        reveal.enabled = true;
    }

    setupFullscreenButton();
    loadLanguage();
}