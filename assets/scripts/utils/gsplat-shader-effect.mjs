const { Script } = pc;

class GsplatShaderEffect extends Script {
    static scriptName = 'gsplatShaderEffect';

    camera = null;
    effectTime = 0;
    materialsApplied = new Set();

    initialize() {
        this.initialized = false;
        this.effectTime = 0;
        this.materialsApplied.clear();
        this.shadersNeedApplication = false;

        this.on('enable', () => {
            this.effectTime = 0;

            if (!this.initialized && this.entity.gsplat) {
                this.initialized = true;
            }

            if (this.initialized) {
                this.applyShaders();
            } else {
                this.shadersNeedApplication = true;
            }
        });

        this.on('disable', () => {
            this.removeShaders();
        });

        this.setupUnifiedEventListener();

        if (!this.entity.gsplat) {
            return;
        }

        this.initialized = true;

        if (this.enabled) {
            this.applyShaders();
        }
    }

    applyShaders() {
        if (this.entity.gsplat?.unified) {
            this.applyToUnifiedMaterials();
        } else {
            this.applyToComponentMaterial();
        }
    }

    removeShaders() {
        if (this.materialsApplied.size === 0) return;

        const device = this.app.graphicsDevice;
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';

        this.materialsApplied.forEach((material) => {
            material.getShaderChunks(shaderLanguage).delete('gsplatCustomizeVS');
            material.update();
        });

        this.materialsApplied.clear();
    }

    setupUnifiedEventListener() {
        if (this._materialCreatedHandler) return;

        const gsplatSystem = this.app.systems.gsplat;

        this._materialCreatedHandler = (material, camera, layer) => {
            if (!this.enabled) return;

            if (!this.materialsApplied.has(material)) {
                if (this.camera && this.camera.camera && this.camera.camera.camera !== camera) {
                    return;
                }

                this.applyShaderToMaterial(material);
                this.materialsApplied.add(material);

                if (!this._materialLayers) {
                    this._materialLayers = new Map();
                }
                this._materialLayers.set(material, layer.id);
            }
        };

        gsplatSystem.on('material:created', this._materialCreatedHandler);
    }

    applyToComponentMaterial() {
        const applyShader = () => {
            const material = this.entity.gsplat?.material;
            if (!material) {
                console.error(`${this.constructor.name}: gsplat material not available.`);
                return;
            }
            this.applyShaderToMaterial(material);
        };

        if (this.entity.gsplat?.material) {
            applyShader();
        } else {
            this.entity.gsplat?.once('load', applyShader);
        }
    }

    applyToUnifiedMaterials() {
        this.updateUnifiedMaterials();

        if (this.materialsApplied.size === 0) {
            this.needsRetry = true;
        }
    }

    updateUnifiedMaterials() {
        const gsplatSystem = this.app.systems.gsplat;
        const scene = this.app.scene;
        const composition = scene.layers;

        const componentLayers = this.entity.gsplat?.layers;
        if (!componentLayers) return;

        let targetCameras;
        const cam = this.camera?.camera?.camera;
        if (cam) {
            targetCameras = [cam];
        } else {
            targetCameras = composition.cameras.map(cameraComponent => cameraComponent.camera);
        }

        targetCameras.forEach((camera) => {
            componentLayers.forEach((layerId) => {
                if (camera.layers.indexOf(layerId) >= 0) {
                    const layer = composition.getLayerById(layerId);
                    if (layer) {
                        const material = gsplatSystem.getGSplatMaterial(camera, layer);
                        if (material && !this.materialsApplied.has(material)) {
                            this.applyShaderToMaterial(material);
                            this.materialsApplied.add(material);
                        }
                    }
                }
            });
        });

        if (this.materialsApplied.size > 0) {
            this.needsRetry = false;
        }
    }

    applyShaderToMaterial(material) {
        const device = this.app.graphicsDevice;
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';
        const customShader = shaderLanguage === 'wgsl' ? this.getShaderWGSL() : this.getShaderGLSL();

        material.getShaderChunks(shaderLanguage).set('gsplatCustomizeVS', customShader);
        material.update();
    }

    update(dt) {
        if (!this.initialized) {
            if (this.entity.gsplat) {
                this.initialized = true;
                if (this.enabled && this.shadersNeedApplication) {
                    this.applyShaders();
                    this.shadersNeedApplication = false;
                }
            }
            return;
        }

        if (this.shadersNeedApplication) {
            this.applyShaders();
            this.shadersNeedApplication = false;
        }

        if (this.entity.gsplat?.unified && this.needsRetry) {
            this.updateUnifiedMaterials();
        }

        if (this.materialsApplied.size === 0) return;

        this.effectTime += dt;

        this.updateEffect(this.effectTime, dt);
    }

    destroy() {
        this.removeShaders();

        if (this._materialCreatedHandler) {
            this.app.systems.gsplat.off('material:created', this._materialCreatedHandler);
            this._materialCreatedHandler = null;
        }
    }

    getShaderGLSL() {
        throw new Error(`${this.constructor.name} must implement getShaderGLSL()`);
    }

    getShaderWGSL() {
        throw new Error(`${this.constructor.name} must implement getShaderWGSL()`);
    }

    setUniform(name, value) {
        this.materialsApplied.forEach((material) => {
            material.setParameter(name, value);
        });
    }

    updateEffect(effectTime, dt) {
    }
}

export { GsplatShaderEffect };