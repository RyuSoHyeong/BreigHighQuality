var AdjustPixelRatio = pc.createScript('adjustPixelRatio');

AdjustPixelRatio.attributes.add('scaleMobile', { type: 'number', default: 0.7 });
AdjustPixelRatio.attributes.add('scalePC', { type: 'number', default: 1 });

AdjustPixelRatio.attributes.add('adaptive', { type: 'boolean', default: true });

AdjustPixelRatio.attributes.add('minScaleMobile', { type: 'number', default: 0.5 });
AdjustPixelRatio.attributes.add('minScalePC', { type: 'number', default: 0.8 });

AdjustPixelRatio.attributes.add('maxScaleMobile', { type: 'number', default: 0.7 });
AdjustPixelRatio.attributes.add('maxScalePC', { type: 'number', default: 1 });

AdjustPixelRatio.attributes.add('step', { type: 'number', default: 0.05 });
AdjustPixelRatio.attributes.add('sampleMs', { type: 'number', default: 1000 });

AdjustPixelRatio.attributes.add('downFps', { type: 'number', default: 26 });
AdjustPixelRatio.attributes.add('upFps', { type: 'number', default: 45 });

AdjustPixelRatio.prototype.initialize = function () {
    this._app = this.app;
    this._gd = this._app?.graphicsDevice;

    if (!this._gd) return;

    this._nativeRatio = window.devicePixelRatio || 1;
    this._isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    this._baseScale = this._isMobileDevice ? this.scaleMobile : this.scalePC;

    this._minScale = this._isMobileDevice ? this.minScaleMobile : this.minScalePC;
    this._maxScale = this._isMobileDevice ? this.maxScaleMobile : this.maxScalePC;

    this._currentScale = this._clampScale(this._baseScale);

    this._accumMs = 0;
    this._frames = 0;

    this._applyScale(this._currentScale);
};

AdjustPixelRatio.prototype.update = function (dt) {
    if (!this._gd) return;
    if (!this.adaptive) return;

    const lockActive = !!(this.fpsLockerState?.active);
    const lockFps = this.fpsLockerState?.fps || 0;

    if (lockActive && lockFps === 30) {
        return;
    }

    this._frames += 1;
    this._accumMs += dt * 1000;

    if (this._accumMs < this.sampleMs) return;

    const fps = (this._frames * 1000) / this._accumMs;

    this._frames = 0;
    this._accumMs = 0;

    let nextScale = this._currentScale;

    if (fps < this.downFps) nextScale = this._currentScale - this.step;
    else if (fps > this.upFps) nextScale = this._currentScale + this.step;

    nextScale = this._clampScale(nextScale);

    if (nextScale !== this._currentScale) {
        this._currentScale = nextScale;
        this._applyScale(this._currentScale);
    }
};

AdjustPixelRatio.prototype._applyScale = function (scale) {
    const ratio = this._nativeRatio * scale;
    this._gd.maxPixelRatio = ratio;
    this._app.resizeCanvas();
};

AdjustPixelRatio.prototype._clampScale = function (scale) {
    if (!isFinite(scale) || isNaN(scale)) scale = this._baseScale;
    return Math.max(this._minScale, Math.min(this._maxScale, scale));
};