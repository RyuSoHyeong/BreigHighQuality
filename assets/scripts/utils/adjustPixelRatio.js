var AdjustPixelRatio = pc.createScript('adjustPixelRatio');

AdjustPixelRatio.attributes.add('scaleMobile', { type: 'number', default: 0.45 });
AdjustPixelRatio.attributes.add('scalePC', { type: 'number', default: 1 });

AdjustPixelRatio.prototype.initialize = function () {
    const app = this.app;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const nativeRatio = window.devicePixelRatio || 1;
    const scale = isMobile ? this.scaleMobile : this.scalePC;

    app.graphicsDevice.maxPixelRatio = nativeRatio * scale;
    app.graphicsDevice.resizeCanvas(app.graphicsDevice.canvas.width, app.graphicsDevice.canvas.height);
};