import { createSplash, setSplashProgress, hideSplash, loadAssets } from './assets/scripts/loader.js';
import { setupFullscreenButton } from './assets/scripts/utils/fullscreen.js';
import { loadLanguage } from './assets/scripts/utils/language.js';
import { GsplatRevealRadial } from './assets/shaders/reveal-radial.mjs';
import { isMobile, isTablet } from './assets/scripts/utils/detect.js';
import { delay, loadLODSmooth, mapAssetProgress, waitForGsplatsGate, createDebugStatsOverlayUpdater, getDeviceProfile, finalizeStart, createSmoothProgress} from './assets/scripts/utils/functions.js';
import { createFpsLocker } from './assets/scripts/utils/fpslocker.js';
import { createDestroyRegistry } from './assets/scripts/utils/onAppDestroy.js';

const canvas = document.getElementById('application-canvas');

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

let resizeRaf = 0;
const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        app.resizeCanvas();
    });
};
window.addEventListener('resize', onResize);

onAppDestroy(() => {
    window.removeEventListener('resize', onResize);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
});

const fpsLocker = createFpsLocker(app, { toggleElementId: 'fps30', cappedFps: 30 });
onAppDestroy(() => fpsLocker?.destroy?.());

const startButton = document.getElementById('start-button');

const assets = {
    galleryCsv: new pc.Asset('gallery.csv', 'text', { url: 'assets/data/dataGallery.csv' }),
    SplatCurrent: new pc.Asset('lod-meta.json', 'gsplat', { url: 'assets/gsplats/lod-meta.json' })
};

const scriptAssets = [
    new pc.Asset('adjustPixelRatio.js', 'script', { url: 'assets/scripts/utils/adjustPixelRatio.js' }),
    new pc.Asset('orbitCamera.js', 'script', { url: 'assets/scripts/orbitCamera.js' }),
    new pc.Asset('amenitiesMode.js', 'script', { url: 'assets/scripts/amenitiesMode.js' }),
    new pc.Asset('stateSwitcher.js', 'script', { url: 'assets/scripts/stateSwitcher.js' }),
    new pc.Asset('gallery.js', 'script', { url: 'assets/scripts/gallery.js' })
];

Object.values(assets).forEach((a) => app.assets.add(a));
scriptAssets.forEach((a) => app.assets.add(a));

const assetList = [
    { asset: assets.galleryCsv, size: 1024 },
    { asset: assets.SplatCurrent, size: 670 * 1024 },
    { asset: scriptAssets[0], size: 1024 },
    { asset: scriptAssets[1], size: 3 * 1024 },
    { asset: scriptAssets[2], size: 3 * 1024 },
    { asset: scriptAssets[3], size: 3 * 1024 },
    { asset: scriptAssets[4], size: 3 * 1024 }
];

const gsplatsOnScreenThreshold = 300000;
const assetProgressWeight = 0.15;
let hasStarted = false;

const START_SETTINGS = {
    lodMin: 2,
    splatBudget: 400000,
    lodDistances: [6, 10, 14, 18, 22]
};

const DEVICE_PROFILES = {
    phone: {
        enableUpgrade: true,
        upgradeDelayMs: 7000,
        upgradedLodDistances: [14, 20, 26, 32, 38],
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
        upgradedLodDistances: [20, 35, 50, 65, 80],
        lodSmooth: { duration: 5000, endBudget: 2000000, endLodMin: 0 }
    }
};

function createScene() {
    const root = new pc.Entity('Root');

    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.setPosition(-1.792, 0.976, 1.127);
    cameraEntity.setEulerAngles(-24.6, -58, 0);
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        fov: 50
    });
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera');
    root.addChild(cameraEntity);

    const mainEntity = new pc.Entity('Main');
    mainEntity.setPosition(-0.217, 0.204, 0.025);
    root.addChild(mainEntity);

    const gsplatEntity = new pc.Entity('GSPlatCurrent');
    gsplatEntity.setPosition(0.323, 0, 0.246);
    gsplatEntity.setEulerAngles(180, 0, 0);
    gsplatEntity.addComponent('gsplat', {
        asset: assets.SplatCurrent,
        unified: true
    });

    gsplatEntity.addComponent('script');
    const reveal = gsplatEntity.script.create(GsplatRevealRadial);
    reveal.enabled = false;

    reveal.center.set(0, 0, 0);
    reveal.speed = 10;
    reveal.acceleration = 20;
    reveal.delay = 1.5;
    reveal.waveColorA = new pc.Color(1, 1, 1);
    reveal.waveColorB = new pc.Color(0.55, 0.78, 0.94);
    reveal.tintStrength = 1;
    reveal.liftHeight = 2;
    reveal.liftHeightStart = 0;
    reveal.liftHeightEnd = 3;
    reveal.liftDuration = 1;
    reveal.waveWidth = 3;
    reveal.waveWidthStart = 3;
    reveal.waveWidthEnd = 20;
    reveal.oscillationIntensity = 0.5;
    reveal.endRadius = 300;

    root.addChild(gsplatEntity);

    const gsplatComponent = gsplatEntity.gsplat;

    app.scene.gsplat.lodRangeMax = 4;

    gsplatEntity.script.create('stateSwitcher', {
        attributes: {
            currentEntity: gsplatEntity,
            futureEntity: gsplatEntity
        }
    });

    root.addComponent('script');
    root.script.create('gallery', { attributes: { galleryTextAsset: assets.galleryCsv } });
    root.script.create('amenitiesMode', { attributes: { fpsLockerState: fpsLocker.state } });
    root.script.create('adjustPixelRatio');

    app.root.addChild(root);

    return { gsplatComponent, reveal };
}

async function startApp() {
    if (hasStarted) return;
    hasStarted = true;

    createSplash();

    const smoothProgress = createSmoothProgress(setSplashProgress, { speed: 10 });

    let upgradeTimerId = 0;
    onAppDestroy(() => {
        if (upgradeTimerId) {
            clearTimeout(upgradeTimerId);
            upgradeTimerId = 0;
        }
    });

    loadAssets(
        app,
        assetList,
        async () => {
            const { gsplatComponent, reveal } = createScene();
            const profile = getDeviceProfile({ isMobile, isTablet, profiles: DEVICE_PROFILES });

            app.scene.gsplat.lodRangeMin = START_SETTINGS.lodMin;
            gsplatComponent.splatBudget = START_SETTINGS.splatBudget;
            gsplatComponent.lodDistances = START_SETTINGS.lodDistances;

            app.start();

            const stopDebugOverlay = createDebugStatsOverlayUpdater(app, {
                gs: gsplatComponent,
                fpsLockerState: fpsLocker.state
            });
            onAppDestroy(() => stopDebugOverlay?.());

            app.scene.gsplat.lodUpdateAngle = 90;
            app.scene.gsplat.lodBehindPenalty = 5;
            app.scene.gsplat.radialSorting = true;
            app.scene.gsplat.lodUpdateDistance = 2;
            app.scene.gsplat.lodUnderfillLimit = 5;
            //app.scene.gsplat.colorizeLod = true;

            if (profile.enableUpgrade) {
                upgradeTimerId = window.setTimeout(() => {
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

            waitForGsplatsGate(app, {
                threshold: gsplatsOnScreenThreshold,
                assetProgressWeight,
                onProgress: (p) => smoothProgress.setTarget(p),
                onReady: async () => {
                    smoothProgress.setNow(1);

                    await delay(200);

                    finalizeStart({ reveal, setSplashProgress, hideSplash, setupFullscreenButton, loadLanguage });
                }
            });
        },
        (p) => smoothProgress.setTarget(mapAssetProgress(p, assetProgressWeight))
    );
}

const onStartClick = (e) => {
    e?.preventDefault?.();
    startApp();
};

if (startButton) startButton.addEventListener('click', onStartClick);

onAppDestroy(() => {
    if (startButton) startButton.removeEventListener('click', onStartClick);
});