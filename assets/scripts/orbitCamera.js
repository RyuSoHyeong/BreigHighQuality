var OrbitCamera = pc.createScript('orbitCamera');

OrbitCamera.attributes.add('portraitDistance', { type: 'number', default: 50 });
OrbitCamera.attributes.add('portraitMinDistance', { type: 'number', default: 30 });
OrbitCamera.attributes.add('portraitMaxDistance', { type: 'number', default: 72 });

OrbitCamera.attributes.add('landscapeDistance', { type: 'number', default: 26 });
OrbitCamera.attributes.add('landscapeMinDistance', { type: 'number', default: 14 });
OrbitCamera.attributes.add('landscapeMaxDistance', { type: 'number', default: 34 });

OrbitCamera.attributes.add('amenitiesLandscapeDistance', { type: 'number', default: 8 });
OrbitCamera.attributes.add('amenitiesLandscapeMinDistance', { type: 'number', default: 8 });
OrbitCamera.attributes.add('amenitiesLandscapeMaxDistance', { type: 'number', default: 28 });

OrbitCamera.attributes.add('amenitiesPortraitDistance', { type: 'number', default: 12 });
OrbitCamera.attributes.add('amenitiesPortraitMinDistance', { type: 'number', default: 12 });
OrbitCamera.attributes.add('amenitiesPortraitMaxDistance', { type: 'number', default: 32 });

OrbitCamera.attributes.add('rotationSpeed', { type: 'number', default: 0.3 });
OrbitCamera.attributes.add('zoomSpeed', { type: 'number', default: 0.5 });
OrbitCamera.attributes.add('lerpFactor', { type: 'number', default: 0.05 });
OrbitCamera.attributes.add('minPitch', { type: 'number', default: 25});
OrbitCamera.attributes.add('maxPitch', { type: 'number', default: 60});

OrbitCamera.attributes.add('autoRotateSpeed', { type: 'number', default: 7 });
OrbitCamera.attributes.add('autoRotateDelay', { type: 'number', default: 3 });

OrbitCamera.attributes.add('mouseRotationSensitivity', { type: 'number', default: 0.2});
OrbitCamera.attributes.add('touchRotationSensitivity', { type: 'number', default: 0.6});
OrbitCamera.attributes.add('mouseZoomSensitivity', { type: 'number', default: 1});
OrbitCamera.attributes.add('touchZoomSensitivity', { type: 'number', default: 5});

OrbitCamera.prototype.initialize = function () {
    this.initState();
    this.initMouseHandlers();
    this.initTouchHandlers();

    this.adjustDistanceForOrientation();
    window.addEventListener('resize', this.adjustDistanceForOrientation.bind(this));
};

OrbitCamera.prototype.initState = function () {
    this.target = new pc.Vec3(-0.217, 0.204, 0.025);
    this.targetLerp = this.target.clone();

    this.distance = 5;
    this.distanceTarget = this.distance;

    this.eulers = new pc.Vec2(30, -100);
    this.eulersTarget = this.eulers.clone();

    this.lastInputTime = performance.now();

    this.isDragging = false;
    this.lastTouchDistance = null;
    this.lastTouchPos = new pc.Vec2();
    this.isZooming = false;
    this.touching = false;

    this.pinchStartDistance = 0;
    this.pinchStartCameraDistance = 0;

    this._dirTmp = new pc.Vec3();
};



OrbitCamera.prototype.initMouseHandlers = function () {
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
};

OrbitCamera.prototype.initTouchHandlers = function () {
    if (!this.app.touch) return;
    this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
    this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    this.app.touch.on(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
};


OrbitCamera.prototype.onMouseDown = function (e) {
    if (e.button === 0) {
        this.isDragging = true;
        this.lastInputTime = performance.now();
    }
};

OrbitCamera.prototype.onMouseUp = function (e) {
    if (e.button === 0) {
        this.isDragging = false;
    }
};

OrbitCamera.prototype.onMouseMove = function (e) {
    if (!this.isDragging) return;

    this.lastInputTime = performance.now();

    this.eulersTarget.x += e.dy * this.rotationSpeed;
    this.eulersTarget.y -= e.dx * this.rotationSpeed;

    this.eulersTarget.x = pc.math.clamp(this.eulersTarget.x, this.minPitch, this.maxPitch);
};

OrbitCamera.prototype.onMouseWheel = function (e) {
    this.lastInputTime = performance.now();
    this.distanceTarget -= e.wheel * this.zoomSpeed * this.mouseZoomSensitivity;
    this.distanceTarget = pc.math.clamp(this.distanceTarget, this.minDistance, this.maxDistance);
    e.event.preventDefault();
};

OrbitCamera.prototype.onTouchStart = function (e) {
    this.touching = true;
    this.lastInputTime = performance.now();
    if (e.touches.length === 1) {
        this.isZooming = false;
        this.lastTouchPos.set(e.touches[0].x, e.touches[0].y);
    }
    if (e.touches.length === 2) {
        this.isZooming = true;
        const dx = e.touches[0].x - e.touches[1].x;
        const dy = e.touches[0].y - e.touches[1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.lastTouchDistance = dist;

        this.pinchStartDistance = dist || 1;
        this.pinchStartCameraDistance = this.distanceTarget;
    }
};

OrbitCamera.prototype.onTouchMove = function (e) {
    this.lastInputTime = performance.now();

    if (e.touches.length === 2) {
        this.isZooming = true;

        const dx = e.touches[0].x - e.touches[1].x;
        const dy = e.touches[0].y - e.touches[1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this.pinchStartDistance) {
            this.pinchStartDistance = dist || 1;
            this.pinchStartCameraDistance = this.distanceTarget;
        }

        let scale = dist / this.pinchStartDistance;
        if (!isFinite(scale) || scale <= 0) scale = 1;

        const zoomPower = this.zoomSpeed * this.touchZoomSensitivity;

        const zoomEffect = (scale - 1) * zoomPower;

        let zoomFactor = 1 + zoomEffect;

        zoomFactor = pc.math.clamp(zoomFactor, 0.2, 5);

        const desiredDistance = this.pinchStartCameraDistance / zoomFactor;

        this.distanceTarget = pc.math.clamp(
            desiredDistance,
            this.minDistance,
            this.maxDistance
        );

        this.lastTouchDistance = dist;
    } else if (e.touches.length === 1 && !this.isZooming) {
        const x = e.touches[0].x;
        const y = e.touches[0].y;

        const dx = x - this.lastTouchPos.x;
        const dy = y - this.lastTouchPos.y;

        this.eulersTarget.x += dy * this.touchRotationSensitivity;
        this.eulersTarget.y -= dx * this.touchRotationSensitivity;

        this.eulersTarget.x = pc.math.clamp(this.eulersTarget.x, this.minPitch, this.maxPitch);
        this.lastTouchPos.set(x, y);
    }
};

OrbitCamera.prototype.onTouchEnd = function (e) {
    if (e.touches.length === 0) {
        this.isZooming = false;
        this.touching = false;
        this.lastTouchDistance = null;

        this.pinchStartDistance = 0;
        this.pinchStartCameraDistance = this.distanceTarget;
    } else if (e.touches.length === 1 && this.isZooming) {
        this.isZooming = false;
        this.lastTouchPos.set(e.touches[0].x, e.touches[0].y);
    }
};

OrbitCamera.prototype.update = function (dt) {
    const now = performance.now();
    const idleTime = (now - this.lastInputTime) / 1000;

    if (idleTime > this.autoRotateDelay) {
        this.eulersTarget.y -= this.autoRotateSpeed * dt;
    }

    const clampedDt = Math.min(Math.max(dt, 0), 0.25);
    this._alpha = 1 - Math.pow(1 - this.lerpFactor, clampedDt * 60);

    this.updateRotationAndZoom();
    this.updatePosition();
};

OrbitCamera.prototype.updateRotationAndZoom = function () {
    const alpha = this._alpha || this.lerpFactor;

    this.eulers.x += (this.eulersTarget.x - this.eulers.x) * alpha;
    this.eulers.y = this.lerpAngle(this.eulers.y, this.eulersTarget.y, alpha);

    this.distance += (this.distanceTarget - this.distance) * alpha;
};

OrbitCamera.prototype.updatePosition = function () {
    const alpha = this._alpha || this.lerpFactor;

    const pitch = this.eulers.x * pc.math.DEG_TO_RAD;
    const yaw = this.eulers.y * pc.math.DEG_TO_RAD;

    const x = this.distance * Math.cos(pitch) * Math.sin(yaw);
    const y = this.distance * Math.sin(pitch);
    const z = this.distance * Math.cos(pitch) * Math.cos(yaw);

    this.target.lerp(this.target, this.targetLerp, alpha);

    this.entity.setPosition(
        this.target.x + x,
        this.target.y + y,
        this.target.z + z
    );
    this.entity.lookAt(this.target);
};



OrbitCamera.prototype.adjustDistanceForOrientation = function () {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
        this.distanceTarget = this.portraitDistance;
        this.minDistance = this.portraitMinDistance;
        this.maxDistance = this.portraitMaxDistance;
    } else {
        this.distanceTarget = this.landscapeDistance;
        this.minDistance = this.landscapeMinDistance;
        this.maxDistance = this.landscapeMaxDistance;
    }
};

OrbitCamera.prototype.focusOn = function (vec3, distance) {
    this.targetLerp.copy(vec3);
    if (distance !== undefined) {
        this.distanceTarget = pc.math.clamp(distance, this.minDistance, this.maxDistance);
    }
    this.lastInputTime = performance.now();
};


OrbitCamera.prototype.lookAtPointSmoothly = function (vec3) {
    const dir = this._dirTmp;
    dir.sub2(vec3, this.entity.getPosition()).normalize();

    let yaw = Math.atan2(-dir.x, -dir.z) * pc.math.RAD_TO_DEG;
    let pitch = Math.asin(dir.y) * pc.math.RAD_TO_DEG;

    pitch = pc.math.clamp(pitch, this.minPitch, this.maxPitch);

    const currentYaw = this.eulers.y;
    while (yaw - currentYaw > 180) yaw -= 360;
    while (yaw - currentYaw < -180) yaw += 360;

    this.eulersTarget.set(pitch, yaw);
};

OrbitCamera.prototype.lerpAngle = function (a, b, t) {
    let delta = ((b - a + 180) % 360) - 180;
    return a + delta * t;
};

OrbitCamera.prototype.setDistanceLimits = function (min, max) {
    this.minDistance = min;
    this.maxDistance = max;

    this.distanceTarget = pc.math.clamp(this.distanceTarget, min, max);
};


OrbitCamera.prototype.setAmenitiesDistanceByOrientation = function () {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
        this.setDistanceLimits(this.amenitiesPortraitMinDistance, this.amenitiesPortraitMaxDistance);
        this.distanceTarget = this.amenitiesPortraitDistance;
    } else {
        this.setDistanceLimits(this.amenitiesLandscapeMinDistance, this.amenitiesLandscapeMaxDistance);
        this.distanceTarget = this.amenitiesLandscapeDistance;
    }
};