import { createSplash, setSplashProgress, hideSplash, loadAssets } from './assets/scripts/loader.js';
import { setupFullscreenButton } from './assets/scripts/utils/fullscreen.js';
import { loadLanguage } from './assets/scripts/utils/language.js';
import { GsplatRevealRadial } from './assets/scripts/utils/reveal-radial.mjs';
import { isMobile, isTablet } from './assets/scripts/utils/detect.js';
import {
    delay,
    loadLODSmooth,
    mapAssetProgress,
    waitForGsplatsGate,
    createDebugStatsOverlayUpdater
} from './assets/scripts/utils/functions.js';

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

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

const startButton = document.getElementById('start-button');

const assets = {
    galleryCsv: new pc.Asset('gallery.csv', 'text', { url: 'assets/data/dataGallery.csv' }),
    lodMeta: new pc.Asset('lod-meta.json', 'gsplat', { url: 'assets/gsplats/lod-meta.json' })
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
    { asset: assets.lodMeta, size: 598 * 1024 },
    { asset: scriptAssets[0], size: 1024 },
    { asset: scriptAssets[1], size: 3 * 1024 },
    { asset: scriptAssets[2], size: 3 * 1024 },
    { asset: scriptAssets[3], size: 3 * 1024 },
    { asset: scriptAssets[4], size: 3 * 1024 }
];

const gsplatsOnScreenThreshold = 550000;
const assetProgressWeight = 0.15;

let hasStarted = false;

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
        asset: assets.lodMeta,
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

    app.scene.gsplat.lodRangeMin = 1;
    app.scene.gsplat.lodRangeMax = 3;

    gsplatComponent.splatBudget = 500000;
    gsplatComponent.lodDistances = [10, 15, 20, 25];

    gsplatEntity.addComponent('script');
    gsplatEntity.script.create('stateSwitcher', {
        attributes: {
            currentEntity: gsplatEntity,
            futureEntity: gsplatEntity
        }
    });

    root.addComponent('script');
    root.script.create('gallery', { attributes: { galleryTextAsset: assets.galleryCsv } });
    root.script.create('amenitiesMode');
    root.script.create('adjustPixelRatio');

    app.root.addChild(root);

    return { gsplatComponent, reveal };
}

function finalizeStart(reveal) {
    setSplashProgress(1);
    hideSplash();

    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();

    document.querySelector('.mode-panel')?.classList.remove('hidden');

    if (reveal) {
        if ('effectTime' in reveal) reveal.effectTime = 0;
        reveal.enabled = true;
    }

    setupFullscreenButton();
    loadLanguage();
}

async function startApp() {
    if (hasStarted) return;
    hasStarted = true;

    createSplash();

    loadAssets(
        app,
        assetList,
        async () => {
            const { gsplatComponent, reveal } = createScene();

            app.start();

            createDebugStatsOverlayUpdater(app, { gs: gsplatComponent });

            app.scene.gsplat.lodUpdateAngle = 90;
            app.scene.gsplat.lodBehindPenalty = 5;
            app.scene.gsplat.radialSorting = true;
            app.scene.gsplat.lodUpdateDistance = 2;
            app.scene.gsplat.lodUnderfillLimit = 5;

            if (!isMobile() && !isTablet()) {
                gsplatComponent.lodDistances = [2, 4, 12, 16];
                setTimeout(() => {
                    gsplatComponent.lodDistances = [20, 40, 60, 80];
                    loadLODSmooth(app, gsplatComponent, { duration: 5000 });
                }, 7000);
            }

            waitForGsplatsGate(app, {
                threshold: gsplatsOnScreenThreshold,
                assetProgressWeight,
                onProgress: (p) => setSplashProgress(p),
                onReady: () => finalizeStart(reveal)
            });

            await delay(0);
        },
        (p) => setSplashProgress(mapAssetProgress(p, assetProgressWeight))
    );
}

startButton?.addEventListener('click', startApp);
startButton?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    startApp();
});