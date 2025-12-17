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
    
    float distToLiftWave = abs(g_dist - g_liftWavePos);
    if (distToLiftWave < 1.0 && g_liftTime > 0.0) {
        float liftAmount = (1.0 - distToLiftWave) * sin(distToLiftWave * 3.14159);
        center.y += liftAmount * uOscillationIntensity * 0.9;
    }
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    if (g_dist > uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    float scale;
    bool isLiftWave = g_liftTime > 0.0 && g_liftWavePos > g_dist;
    
    if (isLiftWave) {
        scale = (g_liftWavePos >= g_dist + 2.0) ? 1.0 : mix(0.1, 1.0, (g_liftWavePos - g_dist) * 0.5);
    } else if (g_dist > g_dotWavePos + 1.0) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    } else if (g_dist > g_dotWavePos - 1.0) {
        float distToWave = abs(g_dist - g_dotWavePos);
        scale = (distToWave < 0.5) 
            ? mix(0.1, 0.2, 1.0 - distToWave * 2.0)
            : mix(0.0, 0.1, smoothstep(g_dotWavePos + 1.0, g_dotWavePos - 1.0, g_dist));
    } else {
        scale = 0.1;
    }
    
    if (scale >= 1.0) {
        return;
    } else if (isLiftWave) {
        float t = (scale - 0.1) * 1.111111; // normalize [0.1, 1.0] to [0, 1]
        float dotSize = scale * 0.05;
        float originalSize = gsplatExtractSize(covA, covB);
        float finalSize = mix(dotSize, originalSize, t);
        
        vec3 origCovA = covA * (scale * scale);
        vec3 origCovB = covB * (scale * scale);
        gsplatMakeRound(covA, covB, finalSize);
        covA = mix(covA, origCovA, t);
        covB = mix(covB, origCovB, t);
    } else {
        float originalSize = gsplatExtractSize(covA, covB);
        gsplatMakeRound(covA, covB, min(scale * 0.05, originalSize));
    }
}

void modifyColor(vec3 center, inout vec4 color) {
    if (g_dist > uEndRadius) return;
    
    if (g_liftTime > 0.0 && g_dist >= g_liftWavePos - 1.5 && g_dist <= g_liftWavePos + 0.5) {
        float distToLift = abs(g_dist - g_liftWavePos);
        float liftIntensity = smoothstep(1.5, 0.0, distToLift);
        color.rgb += uWaveTint * liftIntensity;
    }
    else if (g_dist <= g_dotWavePos && (g_liftTime <= 0.0 || g_dist > g_liftWavePos + 0.5)) {
        float distToDot = abs(g_dist - g_dotWavePos);
        float dotIntensity = smoothstep(1.0, 0.0, distToDot);
        color.rgb += uDotTint * dotIntensity;
    }
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
        // Apply oscillation with per-splat phase offset
        let phase = hash(*center) * 6.28318;
        (*center).y += sin(uniform.uTime * 3.0 + phase) * uniform.uOscillationIntensity * 0.25;
    }
    
    let distToLiftWave = abs(g_dist - g_liftWavePos);
    if (distToLiftWave < 1.0 && g_liftTime > 0.0) {
        let liftAmount = (1.0 - distToLiftWave) * sin(distToLiftWave * 3.14159);
        (*center).y += liftAmount * uniform.uOscillationIntensity * 0.9;
    }
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    if (g_dist > uniform.uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    var scale: f32;
    let isLiftWave = g_liftTime > 0.0 && g_liftWavePos > g_dist;
    
    if (isLiftWave) {
        scale = select(mix(0.1, 1.0, (g_liftWavePos - g_dist) * 0.5), 1.0, g_liftWavePos >= g_dist + 2.0);
    } else if (g_dist > g_dotWavePos + 1.0) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    } else if (g_dist > g_dotWavePos - 1.0) {
        let distToWave = abs(g_dist - g_dotWavePos);
        scale = select(
            mix(0.0, 0.1, smoothstep(g_dotWavePos + 1.0, g_dotWavePos - 1.0, g_dist)),
            mix(0.1, 0.2, 1.0 - distToWave * 2.0),
            distToWave < 0.5
        );
    } else {
        scale = 0.1;
    }
    
    if (scale >= 1.0) {
        return;
    } else if (isLiftWave) {
        let t = (scale - 0.1) * 1.111111; // normalize [0.1, 1.0] to [0, 1]
        let dotSize = scale * 0.05;
        let originalSize = gsplatExtractSize(*covA, *covB);
        let finalSize = mix(dotSize, originalSize, t);
        
        let origCovA = *covA * (scale * scale);
        let origCovB = *covB * (scale * scale);
        gsplatMakeRound(covA, covB, finalSize);
        *covA = mix(*covA, origCovA, t);
        *covB = mix(*covB, origCovB, t);
    } else {
        let originalSize = gsplatExtractSize(*covA, *covB);
        gsplatMakeRound(covA, covB, min(scale * 0.05, originalSize));
    }
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    if (g_dist > uniform.uEndRadius) {
        return;
    }
    
    if (g_liftTime > 0.0 && g_dist >= g_liftWavePos - 1.5 && g_dist <= g_liftWavePos + 0.5) {
        let distToLift = abs(g_dist - g_liftWavePos);
        let liftIntensity = smoothstep(1.5, 0.0, distToLift);
        (*color) = vec4f((*color).rgb + uniform.uWaveTint * liftIntensity, (*color).a);
    }
    else if (g_dist <= g_dotWavePos && (g_liftTime <= 0.0 || g_dist > g_liftWavePos + 0.5)) {
        let distToDot = abs(g_dist - g_dotWavePos);
        let dotIntensity = smoothstep(1.0, 0.0, distToDot);
        (*color) = vec4f((*color).rgb + uniform.uDotTint * dotIntensity, (*color).a);
    }
}
`;

class GsplatRevealRadial extends GsplatShaderEffect {
    static scriptName = 'gsplatRevealRadial';

    _centerArray = [0, 0, 0];

    _dotTintArray = [0, 0, 0];

    _waveTintArray = [0, 0, 0];

    center = new Vec3(0, 0, 0);

    speed = 1;

    acceleration = 5;

    delay = 2;

    dotTint = new Color(0, 1, 1);

    waveTint = new Color(5, 0, 0);

    oscillationIntensity = 0.1;

    endRadius = 25;

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