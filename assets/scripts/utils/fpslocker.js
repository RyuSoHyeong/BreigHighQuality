const ORIGINAL_RENDER = Symbol('fpslocker:originalRender');

export function createFpsLocker(app, options = {}) {
    const { toggleElementId = 'fps30', cappedFps = 30 } = options;

    const state = {
        active: false,
        fps: 0,
        renderFrameCounter: 0,
        rafId: 0,
        frameMs: 0,
        nextTime: 0
    };

    if (!app[ORIGINAL_RENDER]) {
        app[ORIGINAL_RENDER] = app.render.bind(app);

        app.render = function () {
            state.renderFrameCounter++;
            app[ORIGINAL_RENDER]();
        };
    }

    const stopLoop = () => {
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = 0;
        }
    };

    const loop = (now) => {
        if (!state.active) return;

        if (now >= state.nextTime) {
            app.renderNextFrame = true;

            state.nextTime += state.frameMs;

            if (now - state.nextTime > state.frameMs * 2) {
                state.nextTime = now + state.frameMs;
            }
        }

        state.rafId = requestAnimationFrame(loop);
    };

    const applyCap = (targetFps) => {
        stopLoop();

        if (!targetFps || targetFps >= 60) {
            app.autoRender = true;
            app.renderNextFrame = true;
            state.active = false;
            state.fps = 0;
            state.frameMs = 0;
            state.nextTime = 0;
            return;
        }

        app.autoRender = false;
        state.active = true;
        state.fps = targetFps;
        state.frameMs = 1000 / targetFps;
        state.nextTime = performance.now() + state.frameMs;

        state.rafId = requestAnimationFrame(loop);
    };

    const toggleEl = document.getElementById(toggleElementId);
    const onToggleChange = (e) => applyCap(e?.target?.checked ? cappedFps : 0);

    if (toggleEl) toggleEl.addEventListener('change', onToggleChange);

    const destroy = () => {
        if (toggleEl) toggleEl.removeEventListener('change', onToggleChange);

        stopLoop();

        if (app[ORIGINAL_RENDER]) {
            app.render = app[ORIGINAL_RENDER];
            app[ORIGINAL_RENDER] = null;
        }
    };

    return { state, setFpsCap: applyCap, destroy };
}