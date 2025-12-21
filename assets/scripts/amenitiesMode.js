var AmenitiesMode = pc.createScript('amenitiesMode');

AmenitiesMode.attributes.add('mainEntity', { type: 'entity' });
AmenitiesMode.attributes.add('currentCsv', { type: 'asset' });
AmenitiesMode.attributes.add('futureCsv', { type: 'asset' });
AmenitiesMode.attributes.add('fpsLockerState', { type: 'json' });

AmenitiesMode.prototype.initialize = function () {
    this.cameraEntity = this.app.root.findByName('Camera');
    this.amenitiesContainer = document.querySelector('#amenities-container');
    this.infoPanel = document.querySelector('#info-panel');
    this.panelImage = this.infoPanel.querySelector('.panel-image');
    this.panelTitle = this.infoPanel.querySelector('.panel-title');
    this.panelDescription = this.infoPanel.querySelector('.panel-description');

    this.amenitiesData = [];
    this._screenPos = new pc.Vec3();
    this._domUpdateAcc = 0;

    this._canvasRect = null;
    this._rectDirty = true;

    this._modeButtons = Array.from(document.querySelectorAll('.mode-panel .button'));
    this._modeBtn1 = document.querySelector('[data-mode="1"]');
    this._modeBtn0 = document.querySelector('[data-mode="0"]');

    this._onModeBtn1Click = () => {
        this._modeButtons.forEach(btn => btn.classList.remove('active'));
        this._modeBtn1.classList.add('active');

        const orbit = this.cameraEntity?.script?.orbitCamera;
        if (orbit) {
            orbit.autoRotateMode = 1;
            if (orbit.setAutoRotateEnabled) orbit.setAutoRotateEnabled(false);
        }

        this.loadDataFromCsv();
    };

    this._onModeBtn0Click = () => {
        this._modeButtons.forEach(btn => btn.classList.remove('active'));
        this._modeBtn0.classList.add('active');

        this.clearAmenities();
        this.infoPanel.classList.remove('visible');

        const orbit = this.cameraEntity?.script?.orbitCamera;
        if (orbit) {
            orbit.autoRotateMode = 0;
            if (orbit.setAutoRotateEnabled) orbit.setAutoRotateEnabled(true);

            orbit.adjustDistanceForOrientation();
            orbit.setDistanceLimits(orbit.minDistance, orbit.maxDistance);

            const homeTarget = new pc.Vec3(-0.217, 0.204, 0.025);
            orbit.focusOn(homeTarget);
            orbit.lookAtPointSmoothly(homeTarget);
        }
    };

    if (this._modeBtn1) this._modeBtn1.addEventListener('click', this._onModeBtn1Click);
    if (this._modeBtn0) this._modeBtn0.addEventListener('click', this._onModeBtn0Click);

    this.currentState = "0";

    this._stateButtons = Array.from(document.querySelectorAll('.state-panel .button'));
    this._onStateClick = (e) => {
        const btn = e.currentTarget;
        this.currentState = btn.dataset.state;

        const activeMode = document.querySelector('.mode-panel .button.active')?.dataset.mode;
        if (activeMode === "1") {
            this.loadDataFromCsv();
        }
    };
    this._stateButtons.forEach(btn => btn.addEventListener('click', this._onStateClick));

    this._onAmenityClick = (e) => {
        const item = e.target.closest('.amenities');
        if (!item) return;

        const index = item.dataset.index | 0;
        const data = this.amenitiesData[index];
        if (!data) return;

        this.panelImage.src = data.image;
        this.panelTitle.textContent = data.title;
        this.panelDescription.textContent = data.description;
        this.infoPanel.classList.add('visible');
        this.focusCameraOn(data.worldPos);
    };

    if (this.amenitiesContainer) {
        this.amenitiesContainer.addEventListener('click', this._onAmenityClick);
    }

    this._onResize = () => {
        this._rectDirty = true;
    };
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('scroll', this._onResize, { passive: true });

    this._loadToken = 0;
};

AmenitiesMode.prototype.clearAmenities = function () {
    if (this.amenitiesContainer) this.amenitiesContainer.innerHTML = '';
    this.amenitiesData.length = 0;
};

AmenitiesMode.prototype.loadDataFromCsv = function () {
    // const lang = (window.currentLang || navigator.language || 'en').slice(0, 2);
    const lang = 'en';
    const mode = this.currentState === "0" ? "Current" : "Future";

    const path = `/assets/data/dataAmenities${mode}_${lang}.csv`;
    const fallback = `/assets/data/dataAmenities${mode}_en.csv`;

    const token = ++this._loadToken;

    this.app.assets.loadFromUrl(path, 'text', (err, asset) => {
        if (token !== this._loadToken) return;

        if (err) {
            console.warn(`Не удалось загрузить ${path}, пробуем fallback: ${fallback}`);
            this.app.assets.loadFromUrl(fallback, 'text', (err2, fallbackAsset) => {
                if (token !== this._loadToken) return;

                if (err2) {
                    console.error("Не удалось загрузить fallback CSV:", fallback, err2);
                    return;
                }
                this.parseCsv(fallbackAsset.resource);
            });
            return;
        }

        this.parseCsv(asset.resource);
    });
};

AmenitiesMode.prototype.parseCsv = function (csvText) {
    const rows = csvText.trim().split('\n');

    this.clearAmenities();
    this.infoPanel.classList.remove('visible');

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const parts = row.split(';');
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
        `;

        dom.style.position = 'absolute';
        dom.style.display = 'none';

        fragment.appendChild(dom);

        const worldPos = new pc.Vec3(x, y, z);

        this.amenitiesData[index] = {
            dom,
            worldPos,
            title,
            image,
            description,
            lastX: null,
            lastY: null,
            visible: false
        };
    }

    if (this.amenitiesContainer) {
        this.amenitiesContainer.appendChild(fragment);
    }

    this._rectDirty = true;
};

AmenitiesMode.prototype.getCanvasRect = function () {
    if (!this._rectDirty && this._canvasRect) return this._canvasRect;

    const canvas = this.app.graphicsDevice.canvas;
    this._canvasRect = canvas.getBoundingClientRect();
    this._rectDirty = false;
    return this._canvasRect;
};

AmenitiesMode.prototype.updateDomPositions = function () {
    const camera = this.cameraEntity;
    if (!camera || !camera.camera) return;

    const rect = this.getCanvasRect();
    const screenPos = this._screenPos;

    const threshold = 0.25;

    for (let i = 0; i < this.amenitiesData.length; i++) {
        const data = this.amenitiesData[i];
        if (!data) continue;

        const dom = data.dom;

        camera.camera.worldToScreen(data.worldPos, screenPos);

        const onScreen = (screenPos.z > 0 && isFinite(screenPos.x) && isFinite(screenPos.y));
        if (!onScreen) {
            if (data.visible) {
                data.visible = false;
                dom.style.display = 'none';
            }
            continue;
        }

        const x = rect.left + screenPos.x;
        const y = rect.top + screenPos.y;

        if (!data.visible) {
            data.visible = true;
            dom.style.display = 'block';
            data.lastX = null;
            data.lastY = null;
        }

        const dx = data.lastX === null ? Infinity : Math.abs(x - data.lastX);
        const dy = data.lastY === null ? Infinity : Math.abs(y - data.lastY);

        if (dx > threshold || dy > threshold) {
            dom.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            data.lastX = x;
            data.lastY = y;
        }
    }
};

AmenitiesMode.prototype.postUpdate = function (dt) {
    const fpsCapActive = !!this.fpsLockerState?.active;

    const orbit = this.cameraEntity?.script?.orbitCamera;
    const isInteracting = !!orbit && (orbit.touching || orbit.isZooming);

    if (fpsCapActive && !isInteracting) {
        const targetHz = 30;
        const step = 1 / targetHz;

        this._domUpdateAcc += dt;
        if (this._domUpdateAcc < step) return;

        this._domUpdateAcc %= step;
    } else {
        this._domUpdateAcc = 0;
    }

    this.updateDomPositions();
};

AmenitiesMode.prototype.focusCameraOn = function (targetPosition) {
    if (!this.cameraEntity || !this.cameraEntity.script || !this.cameraEntity.script.orbitCamera) return;

    const orbit = this.cameraEntity.script.orbitCamera;
    orbit.isZooming = false;
    orbit.touching = false;
    orbit.lastTouchDistance = null;

    orbit.setAmenitiesDistanceByOrientation();
    orbit.focusOn(targetPosition);
    orbit.lookAtPointSmoothly(targetPosition);
};

AmenitiesMode.prototype.onDestroy = function () {
    if (this._modeBtn1) this._modeBtn1.removeEventListener('click', this._onModeBtn1Click);
    if (this._modeBtn0) this._modeBtn0.removeEventListener('click', this._onModeBtn0Click);

    if (this._stateButtons) {
        this._stateButtons.forEach(btn => btn.removeEventListener('click', this._onStateClick));
    }

    if (this.amenitiesContainer) {
        this.amenitiesContainer.removeEventListener('click', this._onAmenityClick);
    }

    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onResize);

    this._loadToken++;

    this.clearAmenities();

    this._modeButtons = null;
    this._stateButtons = null;
    this._modeBtn1 = null;
    this._modeBtn0 = null;
};