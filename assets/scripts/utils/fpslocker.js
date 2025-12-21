export function createFpsLocker(app, options = {}) {
    const {
        toggleElementId = 'fps30',
        cappedFps = 30
    } = options;

    const state = {
        intervalId: null,
        active: false,
        fps: 0,
        renderFrameCounter: 0
    };

    const originalRender = app.render.bind(app);
    app.render = function () {
        state.renderFrameCounter++;
        originalRender();
    };

    const applyCap = (targetFps) => {
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
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

        const intervalMs = 1000 / targetFps;

        state.intervalId = window.setInterval(() => {
            app.renderNextFrame = true;
        }, intervalMs);
    };

    const toggleEl = document.getElementById(toggleElementId);
    const onToggleChange = (e) => {
        applyCap(e.target.checked ? cappedFps : 0);
    };

    if (toggleEl) {
        toggleEl.addEventListener('change', onToggleChange);
    }

    const destroy = () => {
        if (toggleEl) {
            toggleEl.removeEventListener('change', onToggleChange);
        }
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
        app.render = originalRender;
    };

    return {
        state,
        setFpsCap: applyCap,
        destroy
    };
}