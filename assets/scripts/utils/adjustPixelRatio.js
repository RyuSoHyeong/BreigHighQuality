var AdjustPixelRatio = pc.createScript('adjustPixelRatio');

AdjustPixelRatio.attributes.add('scaleMobile', { type: 'number', default: 0.45 });
AdjustPixelRatio.attributes.add('scalePC', { type: 'number', default: 1 });

AdjustPixelRatio.prototype.initialize = function () {
    const app = this.app;
    const gd = app?.graphicsDevice;
    if (!gd) return;

    const nativeRatio = window.devicePixelRatio || 1;
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const scale = isMobileDevice ? this.scaleMobile : this.scalePC;

    gd.maxPixelRatio = nativeRatio * scale;
    app.resizeCanvas();
};