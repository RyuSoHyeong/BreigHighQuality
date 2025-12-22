var AmenitiesMode = pc.createScript('amenitiesMode');

AmenitiesMode.attributes.add('mainEntity', { type: 'entity' });
AmenitiesMode.attributes.add('currentCsv', { type: 'asset' });
AmenitiesMode.attributes.add('futureCsv', { type: 'asset' });
AmenitiesMode.attributes.add('fpsLockerState', { type: 'json' });

AmenitiesMode.prototype.initialize = function () {
    this.cameraEntity = this.app.root.findByName('Camera');
    this.amenitiesContainer = document.querySelector('#amenities-container');

    this.infoPanel = document.querySelector('#info-panel');
    this.panelImage = this.infoPanel?.querySelector('.panel-image') || null;
    this.panelTitle = this.infoPanel?.querySelector('.panel-title') || null;
    this.panelDescription = this.infoPanel?.querySelector('.panel-description') || null;

    this.amenitiesData = [];
    this._screenPos = new pc.Vec3();
    this._domUpdateAcc = 0;

    this._canvasRect = null;
    this._rectDirty = true;

    this._csvCache = new Map();
    this._loadToken = 0;

    this.currentState = "0";

    this._modeButtons = Array.from(document.querySelectorAll('.mode-panel .button'));
    this._modeBtn0 = document.querySelector('[data-mode="0"]');
    this._modeBtn1 = document.querySelector('[data-mode="1"]');

    this._stateButtons = Array.from(document.querySelectorAll('.state-panel .button'));

    this._homeTarget = new pc.Vec3(-0.217, 0.204, 0.025);

    this._onModeBtn0Click = this.onMode0Click.bind(this);
    this._onModeBtn1Click = this.onMode1Click.bind(this);
    this._onStateClick = this.onStateClick.bind(this);
    this._onAmenityClick = this.onAmenityClick.bind(this);
    this._onViewportDirty = () => { this._rectDirty = true; };

    this.bindDomEvents();
};

AmenitiesMode.prototype.bindDomEvents = function () {
    if (this._modeBtn0) this._modeBtn0.addEventListener('click', this._onModeBtn0Click);
    if (this._modeBtn1) this._modeBtn1.addEventListener('click', this._onModeBtn1Click);

    if (this._stateButtons && this._stateButtons.length) {
        this._stateButtons.forEach(btn => btn.addEventListener('click', this._onStateClick));
    }

    if (this.amenitiesContainer) {
        this.amenitiesContainer.addEventListener('click', this._onAmenityClick);
    }

    window.addEventListener('resize', this._onViewportDirty, { passive: true });
    window.addEventListener('scroll', this._onViewportDirty, { passive: true });
};

AmenitiesMode.prototype.unbindDomEvents = function () {
    if (this._modeBtn0) this._modeBtn0.removeEventListener('click', this._onModeBtn0Click);
    if (this._modeBtn1) this._modeBtn1.removeEventListener('click', this._onModeBtn1Click);

    if (this._stateButtons && this._stateButtons.length) {
        this._stateButtons.forEach(btn => btn.removeEventListener('click', this._onStateClick));
    }

    if (this.amenitiesContainer) {
        this.amenitiesContainer.removeEventListener('click', this._onAmenityClick);
    }

    window.removeEventListener('resize', this._onViewportDirty);
    window.removeEventListener('scroll', this._onViewportDirty);
};

AmenitiesMode.prototype.setActiveModeButton = function (modeStr) {
    if (!this._modeButtons) return;
    this._modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === modeStr));
};

AmenitiesMode.prototype.getOrbit = function () {
    return this.cameraEntity?.script?.orbitCamera || null;
};

AmenitiesMode.prototype.onMode1Click = function () {
    this.setActiveModeButton("1");

    const orbit = this.getOrbit();
    if (orbit) {
        orbit.autoRotateMode = 1;
        orbit.setAutoRotateEnabled?.(false);
    }

    this.loadDataFromCsv();
};

AmenitiesMode.prototype.onMode0Click = function () {
    this.setActiveModeButton("0");

    this.clearAmenities();
    this.infoPanel?.classList.remove('visible');

    const orbit = this.getOrbit();
    if (!orbit) return;

    orbit.autoRotateMode = 0;
    orbit.setAutoRotateEnabled?.(true);

    orbit.adjustDistanceForOrientation?.();
    orbit.setDistanceLimits?.(orbit.minDistance, orbit.maxDistance);

    orbit.focusOn?.(this._homeTarget);
    orbit.lookAtPointSmoothly?.(this._homeTarget);
};

AmenitiesMode.prototype.onStateClick = function (e) {
    const btn = e.currentTarget;
    this.currentState = btn?.dataset?.state ?? "0";

    const activeMode = document.querySelector('.mode-panel .button.active')?.dataset.mode;
    if (activeMode === "1") this.loadDataFromCsv();
};

AmenitiesMode.prototype.onAmenityClick = function (e) {
    const item = e.target.closest('.amenities');
    if (!item) return;

    const index = item.dataset.index | 0;
    const data = this.amenitiesData[index];
    if (!data) return;

    if (this.panelImage) this.panelImage.src = data.image;
    if (this.panelTitle) this.panelTitle.textContent = data.title;
    if (this.panelDescription) this.panelDescription.textContent = data.description;

    this.infoPanel?.classList.add('visible');
    this.focusCameraOn(data.worldPos);
};

AmenitiesMode.prototype.clearAmenities = function () {
    if (this.amenitiesContainer) this.amenitiesContainer.replaceChildren();
    this.amenitiesData.length = 0;
};

AmenitiesMode.prototype.loadDataFromCsv = function () {
    const lang = 'en';
    const mode = this.currentState === "0" ? "Current" : "Future";

    const path = `assets/data/dataAmenities${mode}_${lang}.csv`;
    const fallback = `assets/data/dataAmenities${mode}_en.csv`;

    const token = ++this._loadToken;

    const tryParseCached = (url) => {
        const cached = this._csvCache.get(url);
        if (cached) {
            this.parseCsv(cached);
            return true;
        }
        return false;
    };

    const cleanupTempAsset = (asset) => {
        if (!asset) return;
        asset.unload?.();
        this.app.assets.remove(asset);
    };

    const loadText = (url, onOk, onFail) => {
        if (tryParseCached(url)) return;

        this.app.assets.loadFromUrl(url, 'text', (err, asset) => {
            if (token !== this._loadToken) {
                cleanupTempAsset(asset);
                return;
            }

            if (err || !asset) {
                cleanupTempAsset(asset);
                onFail?.(err);
                return;
            }

            const text = asset.resource || '';
            this._csvCache.set(url, text);

            cleanupTempAsset(asset);
            onOk?.(text);
        });
    };

    loadText(path, (text) => this.parseCsv(text), () => {
        console.warn(`Can't load ${path}, try fallback: ${fallback}`);
        loadText(fallback, (text) => this.parseCsv(text), (err2) => {
            console.error("Can't load fallback CSV:", fallback, err2);
        });
    });
};

AmenitiesMode.prototype.parseCsv = function (csvText) {
    const rows = csvText.trim().split('\n');

    this.clearAmenities();
    this.infoPanel?.classList.remove('visible');

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < rows.length; index++) {
        const parts = rows[index].split(';');
        if (parts.length < 7) continue;

        const icon = parts[0].trim();
        const title = parts[1].trim();
        const image = parts[2].trim();
        const description = parts[3].trim();
        const x = parseFloat(parts[4]);
        const y = parseFloat(parts[5]);
        const z = parseFloat(parts[6]);

        const dom = document.createElement('div');
        dom.className = 'amenities';
        dom.dataset.index = index;

        dom.innerHTML = `
            <div class="glass-panel border-shadow"></div>
            <div class="panel-container">
                <img class="amenities-icon" src="${icon}" />
                <div class="amenities-text">${title}</div>
            </div>
            <div class="amenities-line"></div>
        `;

        dom.style.position = 'absolute';
        dom.style.display = 'none';

        fragment.appendChild(dom);

        this.amenitiesData[index] = {
            dom,
            worldPos: new pc.Vec3(x, y, z),
            title,
            image,
            description,
            lastX: null,
            lastY: null,
            visible: false
        };
    }

    this.amenitiesContainer?.appendChild(fragment);
    this._rectDirty = true;
};

AmenitiesMode.prototype.getCanvasRect = function () {
    if (!this._rectDirty && this._canvasRect) return this._canvasRect;
    this._canvasRect = this.app.graphicsDevice.canvas.getBoundingClientRect();
    this._rectDirty = false;
    return this._canvasRect;
};

AmenitiesMode.prototype.updateDomPositions = function () {
    const cam = this.cameraEntity?.camera;
    if (!cam) return;

    const rect = this.getCanvasRect();
    const screenPos = this._screenPos;
    const threshold = 0.25;

    for (let i = 0; i < this.amenitiesData.length; i++) {
        const data = this.amenitiesData[i];
        if (!data) continue;

        cam.worldToScreen(data.worldPos, screenPos);

        const onScreen = (screenPos.z > 0 && isFinite(screenPos.x) && isFinite(screenPos.y));
        if (!onScreen) {
            if (data.visible) {
                data.visible = false;
                data.dom.style.display = 'none';
            }
            continue;
        }

        const x = rect.left + screenPos.x;
        const y = rect.top + screenPos.y;

        if (!data.visible) {
            data.visible = true;
            data.dom.style.display = 'block';
            data.lastX = null;
            data.lastY = null;
        }

        const dx = data.lastX === null ? Infinity : Math.abs(x - data.lastX);
        const dy = data.lastY === null ? Infinity : Math.abs(y - data.lastY);

        if (dx > threshold || dy > threshold) {
            data.dom.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            data.lastX = x;
            data.lastY = y;
        }
    }
};

AmenitiesMode.prototype.postUpdate = function (dt) {
    const fpsCapActive = !!this.fpsLockerState?.active;
    const orbit = this.getOrbit();
    const isInteracting = !!orbit && (orbit.touching || orbit.isZooming);

    if (fpsCapActive && !isInteracting) {
        const step = 1 / 30;
        this._domUpdateAcc += dt;
        if (this._domUpdateAcc < step) return;
        this._domUpdateAcc %= step;
    } else {
        this._domUpdateAcc = 0;
    }

    this.updateDomPositions();
};

AmenitiesMode.prototype.focusCameraOn = function (targetPosition) {
    const orbit = this.getOrbit();
    if (!orbit) return;

    orbit.isZooming = false;
    orbit.touching = false;
    orbit.lastTouchDistance = null;

    orbit.setAmenitiesDistanceByOrientation?.();
    orbit.focusOn?.(targetPosition);
    orbit.lookAtPointSmoothly?.(targetPosition);
};

AmenitiesMode.prototype.onDestroy = function () {
    this.unbindDomEvents();

    this._loadToken++;
    this.clearAmenities();

    this._modeButtons = null;
    this._stateButtons = null;
    this._modeBtn0 = null;
    this._modeBtn1 = null;

    this.amenitiesContainer = null;
    this.infoPanel = null;
    this.panelImage = null;
    this.panelTitle = null;
    this.panelDescription = null;
};