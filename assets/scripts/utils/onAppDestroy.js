export function createDestroyRegistry(app) {
    const callbacks = [];
    let isDestroyed = false;

    const onAppDestroy = (fn) => {
        if (typeof fn !== 'function') return;

        if (isDestroyed) {
            try { fn(); } catch (e) { console.warn('Destroy callback error', e); }
            return;
        }

        callbacks.push(fn);
    };

    app.once('destroy', () => {
        isDestroyed = true;

        for (let i = 0; i < callbacks.length; i++) {
            try { callbacks[i](); } catch (e) { console.warn('Destroy callback error', e); }
        }

        callbacks.length = 0;
    });

    return { onAppDestroy };
}