import { createSplash, setSplashProgress, hideSplash, loadAssets } from './assets/scripts/loader.js';
import { setupFullscreenButton } from './assets/scripts/utils/fullscreen.js';
import { loadLanguage } from './assets/scripts/utils/language.js';
import { GsplatRevealRadial } from './assets/scripts/utils/reveal-radial.mjs';
import { isMobile, isTablet } from './assets/scripts/utils/detect.js';
import { delay, loadLODSmooth } from './assets/scripts/utils/functions.js';

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

window.addEventListener('resize', () => {
    app.resizeCanvas();
});

const startButton = document.getElementById("start-button");

const assetMap = {
    galleryCsv: new pc.Asset("gallery.csv", "text", { url: "assets/data/dataGallery.csv" }),
    currentPly: new pc.Asset("current", "gsplat", { url: "assets/gsplats/lod-meta.json" })
};

const scriptAssets = [
    new pc.Asset("adjustPixelRatio.js", "script", { url: "assets/scripts/utils/adjustPixelRatio.js" }),
    new pc.Asset("orbitCamera.js", "script", { url: "assets/scripts/orbitCamera.js" }),
    new pc.Asset("amenitiesMode.js", "script", { url: "assets/scripts/amenitiesMode.js" }),
    new pc.Asset("stateSwitcher.js", "script", { url: "assets/scripts/stateSwitcher.js" }),
    new pc.Asset("gallery.js", "script", { url: "assets/scripts/gallery.js" })
];

Object.values(assetMap).forEach(a => app.assets.add(a));
scriptAssets.forEach(a => app.assets.add(a));

const assetList = [
    { asset: assetMap.galleryCsv, size: 1024 },
    { asset: assetMap.currentPly, size: 598 * 1024 },
    { asset: scriptAssets[0], size: 1024 },
    { asset: scriptAssets[1], size: 3 * 1024 },
    { asset: scriptAssets[2], size: 3 * 1024 },
    { asset: scriptAssets[3], size: 3 * 1024 },
    { asset: scriptAssets[4], size: 3 * 1024 }
];

let appStarted = false;

function createScene() {
    const Root = new pc.Entity("Root");

    const Camera = new pc.Entity("Camera");
    Camera.setPosition(-1.792, 0.976, 1.127);
    Camera.setEulerAngles(-24.6, -58, 0);
    Camera.addComponent("camera", {
        clearColor: new pc.Color(1, 1, 1),
        fov: 50
    });
    Camera.addComponent("script");
    Camera.script.create("orbitCamera");
    Root.addChild(Camera);

    const Main = new pc.Entity("Main");
    Main.setPosition(-0.217, 0.204, 0.025);
    Root.addChild(Main);

    const gsplatCurrent = new pc.Entity("GSPlatCurrent");
    gsplatCurrent.setPosition(0.323, 0, 0.246);
    gsplatCurrent.setEulerAngles(180, 0, 0);
    gsplatCurrent.addComponent("gsplat", {
        asset: assetMap.currentPly,
        unified: true
    });

    gsplatCurrent.addComponent('script');
    const reveal = gsplatCurrent.script.create(GsplatRevealRadial);
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

    Root.addChild(gsplatCurrent);

    const gs = gsplatCurrent.gsplat;

    app.scene.gsplat.lodRangeMin = 1;
    app.scene.gsplat.lodRangeMax = 3;
    gs.splatBudget = 500000;
    gs.lodDistances = [10, 15, 20, 25];

    gsplatCurrent.addComponent("script");
    gsplatCurrent.script.create("stateSwitcher", {
        attributes: {
            currentEntity: gsplatCurrent,
            futureEntity: gsplatCurrent
        }
    });

    Root.addComponent("script");
    Root.script.create("gallery", {
        attributes: { galleryTextAsset: assetMap.galleryCsv }
    });
    Root.script.create("amenitiesMode");
    Root.script.create("adjustPixelRatio");

    app.root.addChild(Root);

    return gs;
}

function startApp() {
    if (appStarted) return;
    appStarted = true;

    createSplash();

    loadAssets(
        app,
        assetList,
        async () => {
            const gs = createScene();

            if (!isMobile() && !isTablet()) {
                gs.lodDistances = [4, 8, 12, 25];
                setTimeout(() => {
                    gs.lodDistances = [20, 40, 60, 80];
                    loadLODSmooth(app, gs, { duration: 5000 });
                }, 7000);
            }
            setSplashProgress(1);
            await delay(500);
            hideSplash();
            app.start();

            app.scene.gsplat.lodUpdateAngle = 90;
            app.scene.gsplat.lodBehindPenalty = 5;
            app.scene.gsplat.radialSorting = true;
            app.scene.gsplat.lodUpdateDistance = 2;
            app.scene.gsplat.lodUnderfillLimit = 5;
            app.scene.gsplat.colorizeLod = true;

            const startScreen = document.getElementById("start-screen");
            if (startScreen) {
                startScreen.remove();
            }

            document.querySelector('.mode-panel')?.classList.remove('hidden');
            //document.querySelector('.state-panel')?.classList.remove('hidden');

            setupFullscreenButton();
            loadLanguage();
        },
        setSplashProgress
    );
}

startButton?.addEventListener("click", startApp);
startButton?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startApp();
    }
});