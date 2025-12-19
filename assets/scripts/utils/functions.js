export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    gs.lodDistances = [20, 40, 60, 80];

    function step() {
        const t = Math.min((performance.now() - startTime) / duration, 1);
        const k = t * t * (3 - 2 * t);

        gs.splatBudget = Math.round(
            pc.math.lerp(startBudget, endBudget, k)
        );

        const newMin = Math.round(
            pc.math.lerp(startLodMin, endLodMin, k)
        );

        if (gsplat.lodRangeMin !== newMin) {
            gsplat.lodRangeMin = newMin;

            const max = gsplat.lodRangeMax;
            gsplat.lodRangeMax = max - 1;
            gsplat.lodRangeMax = max;
        }

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            gs.splatBudget = endBudget;

            if (gsplat.lodRangeMin !== endLodMin) {
                gsplat.lodRangeMin = endLodMin;
                const max = gsplat.lodRangeMax;
                gsplat.lodRangeMax = max - 1;
                gsplat.lodRangeMax = max;
            }
        }
    }

    step();
}