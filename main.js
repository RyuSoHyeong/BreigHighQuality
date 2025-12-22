import { createSplash, setSplashProgress, hideSplash, loadAssets } from './assets/scripts/loader.js';
import { setupFullscreenButton } from './assets/scripts/utils/fullscreen.js';
import { loadLanguage } from './assets/scripts/utils/language.js';
import { GsplatRevealRadial } from './assets/shaders/reveal-radial.mjs';
import { isMobile, isTablet } from './assets/scripts/utils/detect.js';
import { delay, loadLODSmooth, mapAssetProgress, waitForGsplatsGate, createDebugStatsOverlayUpdater, getDeviceProfile, finalizeStart, createSmoothProgress } from './assets/scripts/utils/functions.js';
import { createFpsLocker } from './assets/scripts/utils/fpslocker.js';
import { createDestroyRegistry } from './assets/scripts/utils/onAppDestroy.js';

const canvas = document.getElementById('application-canvas');
const startButton = document.getElementById('start-button');

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    elementInput: new pc.ElementInput(canvas),
    graphicsDeviceOptions: {
        alpha: false,
        preserveDrawingBuffer: false,
        devicePixelRatio: false,
        antialias: false,
        preferWebGl2: true
    }
});

const { onAppDestroy } = createDestroyRegistry(app);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const fpsLocker = createFpsLocker(app, { toggleElementId: 'fps30', cappedFps: 30 });
onAppDestroy(() => fpsLocker?.destroy?.());

const assets = {
    galleryCsv: new pc.Asset('gallery.csv', 'text', { url: 'assets/data/dataGallery.csv' }),
    splatCurrent: new pc.Asset('lod-meta.json', 'gsplat', { url: 'assets/gsplats/lod-meta.json' })
};

const scriptAssets = [
    ['adjustPixelRatio.js', 'assets/scripts/utils/adjustPixelRatio.js', 1024],
    ['orbitCamera.js', 'assets/scripts/orbitCamera.js', 3 * 1024],
    ['amenitiesMode.js', 'assets/scripts/amenitiesMode.js', 3 * 1024],
    ['stateSwitcher.js', 'assets/scripts/stateSwitcher.js', 3 * 1024],
    ['gallery.js', 'assets/scripts/gallery.js', 3 * 1024]
].map(([name, url]) => new pc.Asset(name, 'script', { url }));

Object.values(assets).forEach((a) => app.assets.add(a));
scriptAssets.forEach((a) => app.assets.add(a));

const assetList = [
    { asset: assets.galleryCsv, size: 1024 },
    { asset: assets.splatCurrent, size: 670 * 1024 },
    { asset: scriptAssets[0], size: 1024 },
    { asset: scriptAssets[1], size: 3 * 1024 },
    { asset: scriptAssets[2], size: 3 * 1024 },
    { asset: scriptAssets[3], size: 3 * 1024 },
    { asset: scriptAssets[4], size: 3 * 1024 }
];

const GSPLATS_ON_SCREEN_THRESHOLD = 300000;
const ASSET_PROGRESS_WEIGHT = 0.15;

const START_SETTINGS = {
    lodMin: 2,
    splatBudget: 400000,
    lodDistances: [6, 10, 14, 18, 22]
};

const DEVICE_PROFILES = {
    phone: {
        enableUpgrade: true,
        upgradeDelayMs: 7000,
        upgradedLodDistances: [10, 20, 30, 40, 50],
        lodSmooth: { duration: 5000, endBudget: 700000, endLodMin: 2 }
    },
    tablet: {
        enableUpgrade: true,
        upgradeDelayMs: 7000,
        upgradedLodDistances: [14, 18, 22, 26, 40],
        lodSmooth: { duration: 5000, endBudget: 1200000, endLodMin: 1 }
    },
    desktop: {
        enableUpgrade: true,
        upgradeDelayMs: 7000,
        upgradedLodDistances: [20, 40, 60, 80, 100],
        lodSmooth: { duration: 5000, endBudget: 2000000, endLodMin: 0 }
    }
};

const SCENE_GSPLAT_SETTINGS = {
    lodRangeMax: 4,
    lodUpdateAngle: 90,
    lodBehindPenalty: 5,
    radialSorting: true,
    lodUpdateDistance: 2,
    lodUnderfillLimit: 5
};

const CAMERA_SETTINGS = {
    position: [-1.792, 0.976, 1.127],
    euler: [-24.6, -58, 0],
    clearColor: [1, 1, 1],
    fov: 50
};

const ROOT_SETTINGS = {
    mainPosition: [-0.217, 0.204, 0.025],
    gsplatPosition: [0.323, 0, 0.246],
    gsplatEuler: [180, 0, 0]
};

const REVEAL_SETTINGS = {
    enabled: false,
    center: [0, 0, 0],
    speed: 10,
    acceleration: 20,
    delay: 1.5,
    waveColorA: [1, 1, 1],
    waveColorB: [0.55, 0.78, 0.94],
    tintStrength: 1,
    liftHeight: 2,
    liftHeightStart: 0,
    liftHeightEnd: 3,
    liftDuration: 1,
    waveWidth: 3,
    waveWidthStart: 3,
    waveWidthEnd: 20,
    oscillationIntensity: 0.5,
    endRadius: 300
};

function createScene() {
    const root = new pc.Entity('Root');

    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.setPosition(...CAMERA_SETTINGS.position);
    cameraEntity.setEulerAngles(...CAMERA_SETTINGS.euler);
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(...CAMERA_SETTINGS.clearColor),
        fov: CAMERA_SETTINGS.fov
    });
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera');
    root.addChild(cameraEntity);

    const mainEntity = new pc.Entity('Main');
    mainEntity.setPosition(...ROOT_SETTINGS.mainPosition);
    root.addChild(mainEntity);

    const gsplatEntity = new pc.Entity('GSPlatCurrent');
    gsplatEntity.setPosition(...ROOT_SETTINGS.gsplatPosition);
    gsplatEntity.setEulerAngles(...ROOT_SETTINGS.gsplatEuler);
    gsplatEntity.addComponent('gsplat', { asset: assets.splatCurrent, unified: true });

    gsplatEntity.addComponent('script');
    const reveal = gsplatEntity.script.create(GsplatRevealRadial);
    applyRevealSettings(reveal);

    root.addChild(gsplatEntity);

    gsplatEntity.script.create('stateSwitcher', {
        attributes: { currentEntity: gsplatEntity, futureEntity: gsplatEntity }
    });

    root.addComponent('script');
    root.script.create('gallery', { attributes: { galleryTextAsset: assets.galleryCsv } });
    root.script.create('amenitiesMode', { attributes: { fpsLockerState: fpsLocker.state } });
    const adjustPixelRatio = root.script.create('adjustPixelRatio');
    adjustPixelRatio.fpsLockerState = fpsLocker.state;

    app.root.addChild(root);

    applySceneGsplatSettings();

    return { gsplatComponent: gsplatEntity.gsplat, reveal };
}

function applyRevealSettings(reveal) {
    const s = REVEAL_SETTINGS;
    reveal.enabled = s.enabled;

    reveal.center.set(...s.center);
    reveal.speed = s.speed;
    reveal.acceleration = s.acceleration;
    reveal.delay = s.delay;

    reveal.waveColorA = new pc.Color(...s.waveColorA);
    reveal.waveColorB = new pc.Color(...s.waveColorB);
    reveal.tintStrength = s.tintStrength;

    reveal.liftHeight = s.liftHeight;
    reveal.liftHeightStart = s.liftHeightStart;
    reveal.liftHeightEnd = s.liftHeightEnd;
    reveal.liftDuration = s.liftDuration;

    reveal.waveWidth = s.waveWidth;
    reveal.waveWidthStart = s.waveWidthStart;
    reveal.waveWidthEnd = s.waveWidthEnd;

    reveal.oscillationIntensity = s.oscillationIntensity;
    reveal.endRadius = s.endRadius;
}

function applySceneGsplatSettings() {
    const s = SCENE_GSPLAT_SETTINGS;
    app.scene.gsplat.lodRangeMax = s.lodRangeMax;
    app.scene.gsplat.lodUpdateAngle = s.lodUpdateAngle;
    app.scene.gsplat.lodBehindPenalty = s.lodBehindPenalty;
    app.scene.gsplat.radialSorting = s.radialSorting;
    app.scene.gsplat.lodUpdateDistance = s.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = s.lodUnderfillLimit;
}

let hasStarted = false;
let upgradeTimerId = 0;

async function startApp() {
    if (hasStarted) return;
    hasStarted = true;

    createSplash();

    const smoothProgress = createSmoothProgress(setSplashProgress, { speed: 10 });

    loadAssets(
        app,
        assetList,
        async () => {
            const { gsplatComponent, reveal } = createScene();
            const profile = getDeviceProfile({ isMobile, isTablet, profiles: DEVICE_PROFILES });

            applyStartSettings(gsplatComponent);

            app.start();

            const stopDebugOverlay = createDebugStatsOverlayUpdater(app, {
                gs: gsplatComponent,
                fpsLockerState: fpsLocker.state
            });
            onAppDestroy(() => stopDebugOverlay?.());

            scheduleUpgradeIfNeeded(profile, gsplatComponent);

            waitForGsplatsGate(app, {
                threshold: GSPLATS_ON_SCREEN_THRESHOLD,
                assetProgressWeight: ASSET_PROGRESS_WEIGHT,
                onProgress: (p) => smoothProgress.setTarget(p),
                onReady: async () => {
                    smoothProgress.setNow(1);
                    await delay(200);
                    const destroyFullscreen = finalizeStart({ reveal, setSplashProgress, hideSplash, setupFullscreenButton, loadLanguage });
                    if (typeof destroyFullscreen === 'function') onAppDestroy(destroyFullscreen);
                }
            });
        },
        (p) => smoothProgress.setTarget(mapAssetProgress(p, ASSET_PROGRESS_WEIGHT))
    );
}

function applyStartSettings(gsplatComponent) {
    app.scene.gsplat.lodRangeMin = START_SETTINGS.lodMin;
    gsplatComponent.splatBudget = START_SETTINGS.splatBudget;
    gsplatComponent.lodDistances = START_SETTINGS.lodDistances;
}

function scheduleUpgradeIfNeeded(profile, gsplatComponent) {
    if (!profile.enableUpgrade) return;

    if (upgradeTimerId) clearTimeout(upgradeTimerId);
    upgradeTimerId = window.setTimeout(() => {
        if (!app || app._destroyed) return;
        if (!gsplatComponent || !gsplatComponent.entity || !gsplatComponent.entity.enabled) return;
        gsplatComponent.lodDistances = profile.upgradedLodDistances;

        loadLODSmooth(app, gsplatComponent, {
            duration: profile.lodSmooth.duration,
            startBudget: START_SETTINGS.splatBudget,
            endBudget: profile.lodSmooth.endBudget,
            startLodMin: START_SETTINGS.lodMin,
            endLodMin: profile.lodSmooth.endLodMin
        });
    }, profile.upgradeDelayMs);
}

let resizeRaf = 0;

const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        app.resizeCanvas();
    });
};

const destroyAppSafely = () => {
    if (!app || app._destroyed) return;
    try { app.destroy(); } catch (e) { console.warn('App destroy failed:', e); }
};

const onStartClick = (e) => {
    e?.preventDefault?.();
    startApp();
};

window.addEventListener('resize', onResize);
window.addEventListener('pagehide', destroyAppSafely, { passive: true });
window.addEventListener('beforeunload', destroyAppSafely, { passive: true });
if (startButton) startButton.addEventListener('click', onStartClick);

onAppDestroy(() => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pagehide', destroyAppSafely);
    window.removeEventListener('beforeunload', destroyAppSafely);
    if (startButton) startButton.removeEventListener('click', onStartClick);

    if (upgradeTimerId) clearTimeout(upgradeTimerId);
    upgradeTimerId = 0;

    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
});