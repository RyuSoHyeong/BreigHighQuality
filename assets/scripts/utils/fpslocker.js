const ORIGINAL_RENDER = Symbol('fpslocker:originalRender');

export function createFpsLocker(app, options = {}) {
    const { toggleElementId = 'fps30', cappedFps = 30 } = options;

    const state = {
        intervalId: 0,
        active: false,
        fps: 0,
        renderFrameCounter: 0
    };

    if (!app[ORIGINAL_RENDER]) {
        app[ORIGINAL_RENDER] = app.render.bind(app);

        app.render = function () {
            state.renderFrameCounter++;
            app[ORIGINAL_RENDER]();
        };
    }

    const applyCap = (targetFps) => {
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = 0;
        }

        if (!targetFps || targetFps >= 60) {
            app.autoRender = true;
            app.renderNextFrame = true;
            state.active = false;
            state.fps = 0;
            return;
        }

        app.autoRender = false;
        state.active = true;
        state.fps = targetFps;

        state.intervalId = window.setInterval(() => {
            app.renderNextFrame = true;
        }, 1000 / targetFps);
    };

    const toggleEl = document.getElementById(toggleElementId);
    const onToggleChange = (e) => applyCap(e?.target?.checked ? cappedFps : 0);

    if (toggleEl) toggleEl.addEventListener('change', onToggleChange);

    const destroy = () => {
        if (toggleEl) toggleEl.removeEventListener('change', onToggleChange);

        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = 0;
        }

        if (app[ORIGINAL_RENDER]) {
            app.render = app[ORIGINAL_RENDER];
            app[ORIGINAL_RENDER] = null;
        }
    };

    return { state, setFpsCap: applyCap, destroy };
}