export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
}

export function createDebugStatsOverlayUpdater(app, options) {
    const {
        elementId = 'debug-stats',
        gs
    } = options;

    const el = document.getElementById(elementId);
    if (!el) return () => {};

    app.stats.enabled = true;

    let frames = 0;
    let lastTime = performance.now();
    let fps = 0;

    const update = () => {
        frames++;
        const now = performance.now();

        if (now - lastTime < 500) return;

        fps = Math.round((frames * 1000) / (now - lastTime));
        frames = 0;
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