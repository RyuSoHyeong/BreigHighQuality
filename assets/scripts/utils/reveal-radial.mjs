import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';
const { Vec3, Color } = pc;

const shaderGLSL = /* glsl */`
uniform float uTime;
uniform vec3 uCenter;
uniform float uSpeed;
uniform float uAcceleration;
uniform float uDelay;
uniform vec3 uDotTint;
uniform vec3 uWaveTint;
uniform float uOscillationIntensity;
uniform float uEndRadius;

uniform float uLiftHeight;
uniform float uLiftDuration;
uniform float uWaveWidth;
uniform vec3 uWaveColorA;
uniform vec3 uWaveColorB;
uniform float uTintStrength;

float g_dist;
float g_dotWavePos;
float g_liftTime;
float g_liftWavePos;

void initShared(vec3 center) {
    g_dist = length(center - uCenter);
    g_dotWavePos = uSpeed * uTime + 0.5 * uAcceleration * uTime * uTime;
    g_liftTime = max(0.0, uTime - uDelay);
    g_liftWavePos = uSpeed * g_liftTime + 0.5 * uAcceleration * g_liftTime * g_liftTime;
}

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void modifyCenter(inout vec3 center) {
    initShared(center);
    
    if (g_dist > uEndRadius) return;
    
    bool wavesActive = g_liftTime <= 0.0 || g_dist > g_liftWavePos - 1.5;
    if (wavesActive) {
        float phase = hash(center) * 6.28318;
        center.y += sin(uTime * 3.0 + phase) * uOscillationIntensity * 0.25;
    }
    
    if (g_liftTime > 0.0 && g_liftWavePos >= g_dist && uSpeed > 0.0001) {
        float behindDist = g_liftWavePos - g_dist;
        float since = behindDist / uSpeed;

        float x = clamp(since / max(uLiftDuration, 0.0001), 0.0, 1.0);
        float pulse = sin(3.14159265 * x);

        float fade = 1.0 - x;

        center.y += pulse * fade * uLiftHeight;
    }
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    if (g_dist > uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    if (g_liftTime <= 0.0) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    if (g_liftWavePos < g_dist) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    float behind = g_liftWavePos - g_dist;
    float t = clamp(behind / 2.0, 0.0, 1.0);

    float originalSize = gsplatExtractSize(covA, covB);
    float dotSize = min(originalSize, 0.05);

    vec3 origCovA = covA;
    vec3 origCovB = covB;

    gsplatMakeRound(covA, covB, dotSize);
    covA = mix(covA, origCovA, t);
    covB = mix(covB, origCovB, t);
}

void modifyColor(vec3 center, inout vec4 color) {
    if (g_dist > uEndRadius) return;
    if (g_liftTime <= 0.0) return;

    float d = g_dist - g_liftWavePos;

    float frontPad = 0.32;

    if (d > frontPad) return;

    float behind = clamp((frontPad - d) / max(uWaveWidth, 0.0001), 0.0, 1.0);

    float kIn  = smoothstep(0.00, 0.06, behind);
    float kOut = 1.0 - smoothstep(0.85, 1.00, behind);
    float k = kIn * kOut * uTintStrength;

    float t = smoothstep(0.0, 0.7, behind);
    vec3 tint = mix(uWaveColorA, uWaveColorB, t);

    color.rgb = mix(color.rgb, tint, k);
}

`;

const shaderWGSL = /* wgsl */`
uniform uTime: f32;
uniform uCenter: vec3f;
uniform uSpeed: f32;
uniform uAcceleration: f32;
uniform uDelay: f32;
uniform uDotTint: vec3f;
uniform uWaveTint: vec3f;
uniform uOscillationIntensity: f32;
uniform uEndRadius: f32;

uniform uLiftHeight: f32;
uniform uLiftDuration: f32;
uniform uWaveWidth: f32;
uniform uWaveColorA: vec3f;
uniform uWaveColorB: vec3f;
uniform uTintStrength: f32;

var<private> g_dist: f32;
var<private> g_dotWavePos: f32;
var<private> g_liftTime: f32;
var<private> g_liftWavePos: f32;

fn initShared(center: vec3f) {
    g_dist = length(center - uniform.uCenter);
    g_dotWavePos = uniform.uSpeed * uniform.uTime + 0.5 * uniform.uAcceleration * uniform.uTime * uniform.uTime;
    g_liftTime = max(0.0, uniform.uTime - uniform.uDelay);
    g_liftWavePos = uniform.uSpeed * g_liftTime + 0.5 * uniform.uAcceleration * g_liftTime * g_liftTime;
}

fn hash(p: vec3f) -> f32 {
    return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}

fn modifyCenter(center: ptr<function, vec3f>) {
    initShared(*center);
    
    if (g_dist > uniform.uEndRadius) {
        return;
    }
    
    let wavesActive = g_liftTime <= 0.0 || g_dist > g_liftWavePos - 1.5;
    if (wavesActive) {
        let phase = hash(*center) * 6.28318;
        (*center).y += sin(uniform.uTime * 3.0 + phase) * uniform.uOscillationIntensity * 0.25;
    }
    
    if (g_liftTime > 0.0 && g_liftWavePos >= g_dist && uniform.uSpeed > 0.0001) {
        let behindDist = g_liftWavePos - g_dist;
        let since = behindDist / uniform.uSpeed;

        let x = clamp(since / max(uniform.uLiftDuration, 0.0001), 0.0, 1.0);
        let pulse = sin(3.14159265 * x);
        let fade = 1.0 - x;

        (*center).y += pulse * fade * uniform.uLiftHeight;
    }
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    if (g_dist > uniform.uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    if (g_liftTime <= 0.0) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    if (g_liftWavePos < g_dist) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }

    let behind = g_liftWavePos - g_dist;
    let t = clamp(behind / 2.0, 0.0, 1.0);

    let originalSize = gsplatExtractSize(*covA, *covB);
    let dotSize = min(originalSize, 0.05);

    let origCovA = *covA;
    let origCovB = *covB;

    gsplatMakeRound(covA, covB, dotSize);
    *covA = mix(*covA, origCovA, t);
    *covB = mix(*covB, origCovB, t);
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    if (g_dist > uniform.uEndRadius) { return; }
    if (g_liftTime <= 0.0) { return; }

    let d = g_dist - g_liftWavePos;

    let frontPad = 0.32;
    if (d > frontPad) { return; }

    let behind = clamp((frontPad - d) / max(uniform.uWaveWidth, 0.0001), 0.0, 1.0);

    let kIn  = smoothstep(0.00, 0.06, behind);
    let kOut = 1.0 - smoothstep(0.85, 1.00, behind);
    let k = kIn * kOut * uniform.uTintStrength;

    let t = smoothstep(0.0, 0.7, behind);
    let tint = mix(uniform.uWaveColorA, uniform.uWaveColorB, t);

    (*color) = vec4f(mix((*color).rgb, tint, k), (*color).a);
}

`;

class GsplatRevealRadial extends GsplatShaderEffect {
    static scriptName = 'gsplatRevealRadial';

    _centerArray = [0, 0, 0];

    _dotTintArray = [0, 0, 0];

    _waveTintArray = [0, 0, 0];

    _waveColorAArray = [0, 0, 0];
    
    _waveColorBArray = [0, 0, 0];

    center = new Vec3(0, 0, 0);

    speed = 1;

    acceleration = 5;

    delay = 2;

    dotTint = new Color(0, 1, 1);

    waveTint = new Color(5, 0, 0);

    oscillationIntensity = 0.1;

    endRadius = 25;
    waveColorA = new Color(1, 1, 1);
    waveColorB = new Color(0.1, 0.35, 1.0);
    tintStrength = 0.9;
    liftHeight = 0.12;
    liftDuration = 0.45;
    liftHeightStart = 1.0;
    liftHeightEnd = 10.0;
    waveWidth = 1.2;
    waveWidthStart = 1.2;
    waveWidthEnd = 10.0;


    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    updateEffect(effectTime, dt) {
        if (this.isEffectComplete()) {
            this.enabled = false;
            return;
        }

        this.setUniform('uTime', effectTime);

        this._centerArray[0] = this.center.x;
        this._centerArray[1] = this.center.y;
        this._centerArray[2] = this.center.z;
        this.setUniform('uCenter', this._centerArray);

        this.setUniform('uSpeed', this.speed);
        this.setUniform('uAcceleration', this.acceleration);
        this.setUniform('uDelay', this.delay);

        this._dotTintArray[0] = this.dotTint.r;
        this._dotTintArray[1] = this.dotTint.g;
        this._dotTintArray[2] = this.dotTint.b;
        this.setUniform('uDotTint', this._dotTintArray);

        this._waveTintArray[0] = this.waveTint.r;
        this._waveTintArray[1] = this.waveTint.g;
        this._waveTintArray[2] = this.waveTint.b;
        this.setUniform('uWaveTint', this._waveTintArray);

        let wavePos;

        if (this.acceleration !== 0) {
            wavePos = this.speed * effectTime + 0.5 * this.acceleration * effectTime * effectTime;
        } else {
            wavePos = this.speed * effectTime;
        }

        const progress = pc.math.clamp(wavePos / this.endRadius, 0, 1);

        const eased = progress * progress;

        this.liftHeight = pc.math.lerp(this.liftHeightStart, this.liftHeightEnd, eased);
        const wProg = pc.math.clamp((progress - 0.10) / 0.90, 0, 1);
        this.waveWidth = pc.math.lerp(this.waveWidthStart, this.waveWidthEnd, wProg);


        this.setUniform('uLiftHeight', this.liftHeight);
        this.setUniform('uLiftDuration', this.liftDuration);
        this.setUniform('uWaveWidth', this.waveWidth);
        this.setUniform('uTintStrength', this.tintStrength);

        this._waveColorAArray[0] = this.waveColorA.r;
        this._waveColorAArray[1] = this.waveColorA.g;
        this._waveColorAArray[2] = this.waveColorA.b;
        this.setUniform('uWaveColorA', this._waveColorAArray);

        this._waveColorBArray[0] = this.waveColorB.r;
        this._waveColorBArray[1] = this.waveColorB.g;
        this._waveColorBArray[2] = this.waveColorB.b;
        this.setUniform('uWaveColorB', this._waveColorBArray);

        this.setUniform('uOscillationIntensity', this.oscillationIntensity);
        this.setUniform('uEndRadius', this.endRadius);
    }

    getCompletionTime() {
        const liftStartTime = this.delay;

        if (this.acceleration === 0) {
            return liftStartTime + (this.endRadius / this.speed);
        }
        const discriminant = this.speed * this.speed + 2 * this.acceleration * this.endRadius;
        if (discriminant < 0) {
            return Infinity;
        }
        const t = (-this.speed + Math.sqrt(discriminant)) / this.acceleration;
        return liftStartTime + t;

    }

    isEffectComplete() {
        return this.effectTime >= this.getCompletionTime();
    }
}

export { GsplatRevealRadial };