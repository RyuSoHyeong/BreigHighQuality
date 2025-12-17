var AmenitiesMode = pc.createScript('amenitiesMode');

AmenitiesMode.attributes.add('mainEntity', { type: 'entity' });
AmenitiesMode.attributes.add('currentCsv', { type: 'asset' });
AmenitiesMode.attributes.add('futureCsv', { type: 'asset' });

AmenitiesMode.prototype.initialize = function () {
    this.cameraEntity = this.app.root.findByName('Camera');
    this.amenitiesContainer = document.querySelector('#amenities-container');
    this.infoPanel = document.querySelector('#info-panel');
    this.panelImage = this.infoPanel.querySelector('.panel-image');
    this.panelTitle = this.infoPanel.querySelector('.panel-title');
    this.panelDescription = this.infoPanel.querySelector('.panel-description');

    const modeButtons = document.querySelectorAll('.mode-panel .button');
    const modeBtn1 = document.querySelector('[data-mode="1"]');
    const modeBtn0 = document.querySelector('[data-mode="0"]');

    modeBtn1.addEventListener('click', () => {
        modeButtons.forEach(btn => btn.classList.remove('active'));
        modeBtn1.classList.add('active');
        this.loadDataFromCsv();
    });

    modeBtn0.addEventListener('click', () => {
        modeButtons.forEach(btn => btn.classList.remove('active'));
        modeBtn0.classList.add('active');

        this.amenitiesContainer.innerHTML = '';
        this.amenitiesData = [];
        this.infoPanel.classList.remove('visible');

        const orbit = this.cameraEntity?.script?.orbitCamera;
        if (orbit) {
            orbit.adjustDistanceForOrientation();
            orbit.setDistanceLimits(orbit.minDistance, orbit.maxDistance);

            const homeTarget = new pc.Vec3(-0.217, 0.204, 0.025);
            orbit.focusOn(homeTarget);
            orbit.lookAtPointSmoothly(homeTarget);
        }
    });

    this.currentState = "0";

    const stateButtons = document.querySelectorAll('.state-panel .button');
    stateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            this.currentState = btn.dataset.state;
            const activeMode = document.querySelector('.mode-panel .button.active')?.dataset.mode;
            if (activeMode === "1") {
                this.loadDataFromCsv();
            }
        });
    });

    this.amenitiesData = [];
    this._screenPos = new pc.Vec3();
};

AmenitiesMode.prototype.loadDataFromCsv = function () {
    // const lang = (window.currentLang || navigator.language || 'en').slice(0, 2);
    const lang = 'en';
    const mode = this.currentState === "0" ? "Current" : "Future";

    const path = `/assets/data/dataAmenities${mode}_${lang}.csv`;
    const fallback = `/assets/data/dataAmenities${mode}_en.csv`;

    this.app.assets.loadFromUrl(path, 'text', (err, asset) => {
        if (err) {
            console.warn(`Не удалось загрузить ${path}, пробуем fallback: ${fallback}`);
            this.app.assets.loadFromUrl(fallback, 'text', (err2, fallbackAsset) => {
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
    this.amenitiesContainer.innerHTML = '';
    this.amenitiesData = [];

    rows.forEach((row, index) => {
        const [icon, title, image, description, x, y, z] = row.split(';');

        const dom = document.createElement('div');
        dom.className = 'amenities';
        dom.innerHTML = `
            <div class="glass-panel border-shadow"></div>
            <div class="panel-container">
                <img class="amenities-icon" src="${icon.trim()}" />
                <div class="amenities-text">${title.trim()}</div>
            </div>
        `;
        this.amenitiesContainer.appendChild(dom);

        const worldPos = new pc.Vec3(parseFloat(x), parseFloat(y), parseFloat(z));

        const domRect = dom.getBoundingClientRect();
        const offsetX = domRect.width / 2;
        const offsetY = domRect.height / 2;

        this.amenitiesData.push({ dom, worldPos, offsetX, offsetY });

        dom.dataset.index = index;

        dom.addEventListener('click', () => {
            this.panelImage.src = image.trim();
            this.panelTitle.textContent = title.trim();
            this.panelDescription.textContent = description.trim();
            this.infoPanel.classList.add('visible');
            this.focusCameraOn(worldPos);
        });
    });
};

AmenitiesMode.prototype.worldToScreen = function (worldPos) {
    const camera = this.cameraEntity;
    if (!camera || !camera.camera) return null;

    const screenPos = this._screenPos;
    camera.camera.worldToScreen(worldPos, screenPos);

    return { x: screenPos.x, y: screenPos.y };
};

AmenitiesMode.prototype.updateDomPositions = function () {
    const camera = this.cameraEntity;
    if (!camera || !camera.camera) return;

    const canvas = this.app.graphicsDevice.canvas;
    const rect = canvas.getBoundingClientRect();
    const screenPos = this._screenPos;

    this.amenitiesData.forEach(({ dom, worldPos, offsetX, offsetY }) => {
        camera.camera.worldToScreen(worldPos, screenPos);

        if (screenPos.z > 0 && !isNaN(screenPos.x) && !isNaN(screenPos.y)) {
            const x = rect.left + screenPos.x;
            const y = rect.top + screenPos.y;

            dom.style.position = 'absolute';
            dom.style.display = 'block';
            dom.style.left = (x - offsetX) + 'px';
            dom.style.top  = (y - offsetY) + 'px';
        } else {
            dom.style.display = 'none';
        }
    });
};

AmenitiesMode.prototype.postUpdate = function (dt) {
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