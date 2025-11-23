// ============================================================================
// MODULAR PHYSICALLY-BASED OCEAN SYSTEM
// ============================================================================
// Comprehensive abstraction for ocean rendering, waves, and water shading
// Based on: Tessendorf "Simulating Ocean Water" (SIGGRAPH 2001)
//          Jensen et al. "A Practical Model for Subsurface Light Transport"
//          Filament PBR Engine
//          Unreal Engine 4/5 Water Shading
//          "Multiple-Scattering Microfacet BSDFs with the Smith Model"
// ============================================================================

#ifndef OCEAN_SYSTEM_FRAG
#define OCEAN_SYSTEM_FRAG

#include "Common.frag"
#include "SkySystem.frag"

// ============================================================================
// WAVE PARAMETERS
// ============================================================================

// Wave Parameters - Weta Digital quality ocean with proper spectrum distribution
// Increased wave count for more realistic detail and interaction
const int NUM_WAVES = 10;

// Primary swell direction (dominant wind direction) - pre-normalized
// vec2(1.0, 0.3) normalized = approximately vec2(0.9578, 0.2873)
const vec2 PRIMARY_SWELL_DIR = vec2(0.9578, 0.2873);

// Get wave direction for a given wave index
// Uses proper angular distribution around primary swell for realistic wave interaction
vec2 getWaveDir(int i) {
    if (i == 0) return PRIMARY_SWELL_DIR;                                    // Primary swell
    if (i == 1) return normalize(PRIMARY_SWELL_DIR + vec2(0.15, 0.08));      // Secondary swell
    if (i == 2) return normalize(PRIMARY_SWELL_DIR + vec2(-0.12, 0.15));     // Tertiary swell
    if (i == 3) return normalize(vec2(PRIMARY_SWELL_DIR.y, -PRIMARY_SWELL_DIR.x)); // Cross swell
    if (i == 4) return normalize(PRIMARY_SWELL_DIR + vec2(0.08, -0.25));    // Detail wave 1
    if (i == 5) return normalize(PRIMARY_SWELL_DIR + vec2(-0.18, -0.08));   // Detail wave 2
    if (i == 6) return normalize(PRIMARY_SWELL_DIR + vec2(0.25, 0.12));     // Detail wave 3
    if (i == 7) return normalize(PRIMARY_SWELL_DIR + vec2(-0.22, 0.18));   // Detail wave 4
    if (i == 8) return normalize(PRIMARY_SWELL_DIR + vec2(0.12, -0.2));     // Detail wave 5
    return normalize(PRIMARY_SWELL_DIR + vec2(-0.15, -0.12));                // Detail wave 6
}

// Wave amplitudes (m) - follows realistic ocean spectrum (Phillips-like distribution)
// Primary swell dominates, with proper falloff for detail waves
float waveAmps[NUM_WAVES] = float[](
    1.4,  // Primary swell - largest
    0.55, // Secondary swell
    0.35, // Tertiary swell
    0.22, // Cross swell
    0.14, // Detail wave 1
    0.09, // Detail wave 2
    0.06, // Detail wave 3
    0.04, // Detail wave 4
    0.025, // Detail wave 5
    0.015  // Detail wave 6
);

// Wave frequencies (rad/m) - proper spectrum distribution
// Lower frequencies (longer waves) have more energy, following ocean physics
float waveFreqs[NUM_WAVES] = float[](
    0.12, // Primary swell - very long wavelength (~52m)
    0.20, // Secondary swell
    0.32, // Tertiary swell
    0.50, // Cross swell
    0.85, // Detail wave 1
    1.4,  // Detail wave 2
    2.2,  // Detail wave 3
    3.5,  // Detail wave 4
    5.5,  // Detail wave 5
    8.5   // Detail wave 6
);

// Wave speeds computed from dispersion: w = sqrt(g*k) for deep water
// Time scaling factor to slow down wave motion for more realistic appearance
const float TIME_SCALE = 0.3; // Slower, more contemplative motion

float getWaveSpeed(float k) {
    return sqrt(GRAVITY * k) * TIME_SCALE;
}

// ============================================================================
// WATER PROPERTIES
// ============================================================================

const vec3 waterAbsorption = vec3(0.15, 0.045, 0.015); // m^-1 (realistic values)
const float baseRoughness = 0.03; // Base roughness for calm water (very smooth)
const float maxRoughness = 0.12;  // Maximum roughness for choppy water
const float WATER_IOR = 1.33; // Index of refraction for water
const float AIR_IOR = 1.0;    // Index of refraction for air

// Water Colors - Realistic ocean colors
// Shallow: Bright turquoise/cyan (tropical water)
// Deep: Darker blue but still vibrant (not too dark)
const vec3 deepWaterColor = vec3(0.0, 0.2, 0.4);   // Darker blue, more vibrant
const vec3 shallowWaterColor = vec3(0.0, 0.5, 0.75); // Bright turquoise

// ============================================================================
// OCEAN FLOOR TERRAIN
// ============================================================================

struct OceanFloorParams {
    float baseDepth;        // Base depth of the ocean floor (negative Y value)
    float heightVariation;  // Maximum height variation from base depth
    float largeScale;       // Large-scale terrain feature size
    float mediumScale;      // Medium-scale terrain feature size
    float smallScale;       // Small-scale terrain feature size (detail)
    float largeAmplitude;   // Amplitude of large-scale features
    float mediumAmplitude;  // Amplitude of medium-scale features
    float smallAmplitude;   // Amplitude of small-scale features (detail)
    float roughness;        // Overall terrain roughness (0.0 = smooth, 1.0 = rough)
};

// Default ocean floor parameters
OceanFloorParams createDefaultOceanFloor() {
    OceanFloorParams params;
    params.baseDepth = -105.0;        // Base depth at -105m
    params.heightVariation = 25.0;    // ±25m variation
    params.largeScale = 0.02;          // Large features every ~50m
    params.mediumScale = 0.08;         // Medium features every ~12.5m
    params.smallScale = 0.3;           // Small features every ~3.3m
    params.largeAmplitude = 0.6;       // Large features contribute 60%
    params.mediumAmplitude = 0.3;      // Medium features contribute 30%
    params.smallAmplitude = 0.1;       // Small features contribute 10%
    params.roughness = 0.5;            // Moderate roughness
    return params;
}

// Get ocean floor height at position (x, z)
// Returns the Y coordinate of the ocean floor
float getOceanFloorHeight(vec2 pos, OceanFloorParams params) {
    // Large-scale terrain (hills, valleys)
    float largeNoise = fractalNoise(pos, params.largeScale, 3, 0.5);
    float largeHeight = (largeNoise - 0.5) * 2.0; // [-1, 1]
    
    // Medium-scale terrain (ridges, slopes)
    float mediumNoise = fractalNoise(pos + vec2(100.0, 100.0), params.mediumScale, 2, 0.6);
    float mediumHeight = (mediumNoise - 0.5) * 2.0; // [-1, 1]
    
    // Small-scale terrain (detail, bumps)
    float smallNoise = fractalNoise(pos + vec2(200.0, 200.0), params.smallScale, 2, 0.7);
    float smallHeight = (smallNoise - 0.5) * 2.0; // [-1, 1]
    
    // Combine all scales with their amplitudes
    float heightVariation = largeHeight * params.largeAmplitude +
                           mediumHeight * params.mediumAmplitude +
                           smallHeight * params.smallAmplitude;
    
    // Apply roughness (adds more variation)
    heightVariation *= (1.0 + params.roughness * 0.5);
    
    // Scale by height variation parameter and add to base depth
    float floorHeight = params.baseDepth + heightVariation * params.heightVariation;
    
    return floorHeight;
}

// ============================================================================
// GERSTNER WAVE FUNCTIONS
// ============================================================================

// Gerstner Wave Function
// Based on: Tessendorf "Simulating Ocean Water"
// Properly models wave motion with horizontal displacement
vec3 gerstnerWave(vec2 pos, vec2 dir, float amplitude, float frequency, float speed, float time, float steepness) {
    float k = frequency;
    float w = speed; // Wave speed from dispersion
    float phase = dot(pos, dir) * k + time * w;
    float s = sin(phase);
    float c = cos(phase);
    
    // Horizontal displacement (choppy waves)
    float q = steepness / (k * amplitude);
    vec2 displacement = dir * q * amplitude * c;
    
    // Vertical displacement
    float height = amplitude * s;
    
    return vec3(displacement.x, height, displacement.y);
}

vec3 getWaveDisplacement(vec2 pos, float time) {
    vec3 displacement = vec3(0.0);
    
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        
        // Steepness varies by wave - follows realistic ocean physics
        float steepness;
        if (i == 0) steepness = 0.04;      // Primary swell - very gentle
        else if (i == 1) steepness = 0.06; // Secondary swell
        else if (i == 2) steepness = 0.07; // Tertiary swell
        else if (i == 3) steepness = 0.08; // Cross swell
        else if (i == 4) steepness = 0.10; // Detail wave 1
        else if (i == 5) steepness = 0.12; // Detail wave 2
        else if (i == 6) steepness = 0.14; // Detail wave 3
        else if (i == 7) steepness = 0.16; // Detail wave 4
        else if (i == 8) steepness = 0.18; // Detail wave 5
        else steepness = 0.20;            // Detail wave 6 - choppiest
        
        displacement += gerstnerWave(pos, dir, waveAmps[i], k, w, time, steepness);
    }
    
    return displacement;
}

float getWaveHeight(vec2 pos, float time) {
    vec3 disp = getWaveDisplacement(pos, time);
    return disp.y;
}

// Compute wave height and gradient analytically (much faster than finite differences)
// Returns vec3(height, grad.x, grad.y)
// Uses temporally stable phase calculation to reduce precision issues
vec3 getWaveHeightAndGradient(vec2 pos, float time) {
    float height = 0.0;
    vec2 grad = vec2(0.0);
    
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        // Calculate phase with improved precision
        // Split calculation to reduce precision loss
        float spatialPhase = dot(pos, dir) * k;
        float temporalPhase = time * w;
        float phase = spatialPhase + temporalPhase;
        
        float s = sin(phase);
        float c = cos(phase);
        float A = waveAmps[i];
        
        // Height: sum of vertical displacements
        height += A * s;
        
        // Analytical gradient: ∂h/∂pos = amplitude * k * dir * cos(phase)
        grad += A * k * dir * c;
    }
    
    return vec3(height, grad.x, grad.y);
}

vec2 getWaveGradient(vec2 pos, float time) {
    vec3 hg = getWaveHeightAndGradient(pos, time);
    return hg.yz; // Return gradient components
}

// Enhanced normal calculation with analytical derivatives
// Uses temporally stable smoothing to reduce jittering
vec3 getNormal(vec2 pos, float time, out vec2 gradient) {
    // Get base gradient analytically (fast and accurate)
    vec2 grad = getWaveGradient(pos, time);
    
    // Temporally stable smoothing using rotated offsets to reduce aliasing
    // Use a small rotation based on position to break up patterns
    float angle = dot(pos, vec2(0.7071, 0.7071)) * 0.5; // Stable rotation
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec2 rotX = vec2(cosA, sinA);
    vec2 rotY = vec2(-sinA, cosA);
    
    const float smoothingRadius = 0.01;
    vec2 gradSmooth = grad;
    gradSmooth += getWaveGradient(pos + rotX * smoothingRadius, time) * 0.15;
    gradSmooth += getWaveGradient(pos - rotX * smoothingRadius, time) * 0.15;
    gradSmooth += getWaveGradient(pos + rotY * smoothingRadius, time) * 0.15;
    gradSmooth += getWaveGradient(pos - rotY * smoothingRadius, time) * 0.15;
    grad = mix(grad, gradSmooth / 1.6, 0.2); // Very gentle smoothing
    
    gradient = grad;
    
    // Build normal from gradient (analytical, no finite differences needed)
    vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));
    
    // Add subtle micro-detail only where needed (reduces banding)
    // Use temporally stable offsets
    float waveHeight = getWaveHeight(pos, time);
    float crestFactor = smoothstep(-0.2, 0.3, waveHeight);
    
    if (crestFactor > 0.1) {
        const float microDetail = 0.02;
        vec2 microX = rotX * microDetail;
        vec2 microY = rotY * microDetail;
        vec2 gradX = getWaveGradient(pos + microX, time);
        vec2 gradY = getWaveGradient(pos + microY, time);
        
        vec3 microNormal = normalize(vec3(-(gradX.x + grad.x) * 0.5, 1.0, -(gradY.y + grad.y) * 0.5));
        normal = normalize(mix(normal, microNormal, crestFactor * 0.08)); // Very subtle
    }
    
    return normal;
}

// ============================================================================
// FRESNEL FUNCTIONS
// ============================================================================

// Modern Fresnel (Schlick's Approximation)
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    return F;
}

// Wavelength-dependent Fresnel F0 for water-air interface
vec3 getWaterF0() {
    vec3 waterIOR = vec3(1.331, 1.333, 1.335);
    vec3 airIOR = vec3(1.0);
    
    vec3 ratio = (airIOR - waterIOR) / (airIOR + waterIOR);
    vec3 F0 = ratio * ratio;
    
    return clamp(F0, vec3(0.018), vec3(0.022));
}

// Proper Fresnel calculation for water surface
vec3 getFresnel(vec3 viewDir, vec3 normal) {
    float cosTheta = abs(dot(viewDir, normal));
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    
    vec3 F0 = getWaterF0();
    vec3 F = fresnelSchlick(cosTheta, F0);
    
    return clamp(F, F0, vec3(1.0));
}

// Fresnel for specular highlights (uses half-vector for microfacet model)
vec3 getFresnelSpecular(vec3 viewDir, vec3 lightDir, vec3 normal) {
    vec3 halfVec = normalize(viewDir + lightDir);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    vec3 F0 = getWaterF0();
    return fresnelSchlick(VdotH, F0);
}

// ============================================================================
// PBR SHADING MODELS
// ============================================================================

// Modern GGX Distribution (Trowbridge-Reitz)
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / max(denom, EPSILON);
}

// Improved Geometry Function (Smith-GGX)
float G_SchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    float denom = NdotV * (1.0 - k) + k;
    return NdotV / max(denom, EPSILON);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    float ggx1 = G_SchlickGGX(NdotV, roughness);
    float ggx2 = G_SchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// Multi-Scattering Compensation
vec3 getMultiScatteringCompensation(vec3 F, vec3 F0, float roughness) {
    vec3 E = vec3(1.0) - F0;
    vec3 Eavg = E;
    
    float roughness2 = roughness * roughness;
    vec3 Fms = (vec3(1.0) - Eavg) / (vec3(1.0) - Eavg * (1.0 - roughness2));
    
    vec3 Fadd = Fms * (vec3(1.0) - F);
    
    return F + Fadd;
}

// Modern Specular BRDF with Multi-Scattering
vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness, vec3 skyReflectionColor) {
    vec3 halfVec = normalize(viewDir + lightDir);
    
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0.0);
    
    float clampedRoughness = max(roughness, 0.01);
    
    float D = D_GGX(NdotH, clampedRoughness);
    float G = G_Smith(NdotV, NdotL, clampedRoughness);
    
    vec3 F0 = getWaterF0();
    vec3 F = fresnelSchlick(VdotH, F0);
    
    F = getMultiScatteringCompensation(F, F0, clampedRoughness);
    
    vec3 numerator = (D * G) * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    vec3 specularColor = mix(lightColor, skyReflectionColor, 0.7);
    
    return (numerator / denominator) * specularColor * NdotL;
}

// Physically-Based Subsurface Scattering
vec3 getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth) {
    vec3 backLight = -lightDir;
    
    const float g = 0.9;
    float cosTheta = dot(normalize(viewDir), backLight);
    float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);
    phase /= 4.0 * PI;
    
    vec3 scatteringCoeff = vec3(0.0015, 0.003, 0.005);
    vec3 absorptionCoeff = waterAbsorption;
    
    vec3 transmittance = exp(-absorptionCoeff * depth);
    vec3 singleScatter = scatteringCoeff * phase * transmittance;
    
    float NdotL = max(dot(normal, backLight), 0.0);
    
    float shallowBoost = 1.0 - smoothstep(0.5, 10.0, depth);
    
    vec3 multipleTransmittance = exp(-absorptionCoeff * depth * 0.5);
    vec3 multipleScatter = scatteringCoeff * 0.4 * NdotL * multipleTransmittance;
    multipleScatter *= (1.0 + shallowBoost * 2.5);
    
    vec3 totalScatter = singleScatter + multipleScatter;
    
    vec3 shallowTint = shallowWaterColor;
    vec3 deepTint = vec3(0.0, 0.3, 0.5);
    
    float depthTintFactor = 1.0 - smoothstep(0.5, 15.0, depth);
    vec3 scatterColor = mix(deepTint, shallowTint, depthTintFactor);
    
    vec3 result = totalScatter * scatterColor * 1.5;
    
    return result;
}

// Wave Energy Calculation
// Fixed to avoid temporal discontinuities
float calculateWaveEnergy(vec2 pos, float time) {
    vec2 grad = getWaveGradient(pos, time);
    float slope = length(grad);
    float height = getWaveHeight(pos, time);
    
    float kineticEnergy = slope * slope * 2.5;
    float potentialEnergy = height * height * 0.6;
    
    // Use analytical velocity instead of finite difference to avoid temporal jitter
    // Velocity is the time derivative: dh/dt = sum(A * w * cos(phase))
    float velocity = 0.0;
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(pos, dir) * k + time * w;
        velocity += waveAmps[i] * w * cos(phase);
    }
    float velocityEnergy = abs(velocity) * abs(velocity) * 1.5;
    
    float energy = kineticEnergy + potentialEnergy + velocityEnergy;
    
    energy = smoothstep(0.15, 2.0, energy);
    
    float energyDetail = 0.0;
    for (int i = 0; i < min(NUM_WAVES, 4); i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(pos, dir) * k + time * w;
        float waveContrib = abs(sin(phase)) * waveAmps[i];
        energyDetail += waveContrib;
    }
    energyDetail = smoothstep(0.2, 1.5, energyDetail * 0.3);
    energy = max(energy, energyDetail * 0.4);
    
    return energy;
}

// ============================================================================
// WATER TRANSLUCENCY & CAUSTICS
// ============================================================================

// Raymarch through water to find the ocean floor
vec3 raymarchThroughWater(vec3 startPos, vec3 rayDir, float time, OceanFloorParams floorParams) {
    float t = 0.0;
    const float MAX_WATER_DEPTH = 200.0;
    const float WATER_STEP_SIZE = 0.5;
    
    for (int i = 0; i < 200; i++) {
        vec3 pos = startPos + rayDir * t;
        
        float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
        float distToFloor = pos.y - floorHeight;
        
        if (distToFloor < MIN_DIST) {
            return vec3(1.0, t, 0.0);
        }
        
        if (t > MAX_WATER_DEPTH || distToFloor > 50.0) {
            break;
        }
        
        float stepSize = clamp(distToFloor * 0.3, WATER_STEP_SIZE, 2.0);
        t += stepSize;
    }
    
    return vec3(0.0, t, 0.0);
}

// Calculate refracted ray direction using Snell's law
vec3 refractRay(vec3 incident, vec3 normal, float eta) {
    float cosI = -dot(incident, normal);
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    
    if (sinT2 > 1.0) {
        return reflect(incident, normal);
    }
    
    float cosT = sqrt(1.0 - sinT2);
    return eta * incident + (eta * cosI - cosT) * normal;
}

// Get ocean floor normal (for shading)
vec3 getOceanFloorNormal(vec3 pos, OceanFloorParams floorParams) {
    const float eps = 0.5;
    
    float hL = getOceanFloorHeight(pos.xz - vec2(eps, 0.0), floorParams);
    float hR = getOceanFloorHeight(pos.xz + vec2(eps, 0.0), floorParams);
    float hD = getOceanFloorHeight(pos.xz - vec2(0.0, eps), floorParams);
    float hU = getOceanFloorHeight(pos.xz + vec2(0.0, eps), floorParams);
    
    vec3 normal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
    return normal;
}

// Realistic Caustics Calculation
vec3 calculateCaustics(vec3 floorPos, vec3 waterSurfacePos, vec3 waterNormal, vec3 sunDir, float time, OceanFloorParams floorParams) {
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedSunDir = refractRay(-sunDir, waterNormal, eta);
    
    if (dot(refractedSunDir, -waterNormal) < 0.0) {
        return vec3(0.0);
    }
    
    vec2 surfacePos = waterSurfacePos.xz;
    float depth = max(waterSurfacePos.y - floorPos.y, 0.1);
    
    const int numSamples = 5;
    float causticsIntensity = 0.0;
    
    float sampleRadius = depth * 0.15;
    
    // Add temporal jitter to reduce aliasing - use stable hash based on position
    float jitter = fract(dot(surfacePos, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * TAU;
    
    for (int i = 0; i < numSamples; i++) {
        float angle = float(i) * TAU / float(numSamples) + jitter;
        float radius = sampleRadius * (0.5 + float(i) * 0.1);
        vec2 sampleOffset = vec2(cos(angle), sin(angle)) * radius;
        vec2 samplePos = surfacePos + sampleOffset;
        
        vec2 grad = getWaveGradient(samplePos, time);
        float slope = length(grad);
        float focus = smoothstep(0.2, 0.6, slope);
        
        float waveHeight = getWaveHeight(samplePos, time);
        float crestFactor = smoothstep(-0.1, 0.2, waveHeight);
        
        float sampleIntensity = focus * (0.7 + crestFactor * 0.3);
        
        float dist = length(sampleOffset);
        float gaussian = exp(-dist * dist / (sampleRadius * sampleRadius * 0.5));
        causticsIntensity += sampleIntensity * gaussian;
    }
    
    causticsIntensity /= float(numSamples);
    
    float largeScalePattern = 0.0;
    for (int i = 0; i < min(NUM_WAVES, 5); i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(surfacePos, dir) * k + time * w;
        largeScalePattern += sin(phase) * waveAmps[i] * 0.15;
    }
    largeScalePattern = abs(largeScalePattern);
    causticsIntensity += largeScalePattern * 0.3;
    
    float depthFalloff = exp(-depth * 0.05);
    float diffusionFactor = 1.0 - exp(-depth * 0.02);
    causticsIntensity *= depthFalloff;
    
    causticsIntensity = pow(causticsIntensity, 0.5);
    causticsIntensity = smoothstep(0.1, 0.8, causticsIntensity);
    
    causticsIntensity = mix(causticsIntensity, causticsIntensity * 0.7, diffusionFactor);
    
    float angleFalloff = max(dot(refractedSunDir, vec3(0.0, -1.0, 0.0)), 0.4);
    causticsIntensity *= angleFalloff;
    
    vec3 causticsColor = vec3(0.98, 0.99, 1.0);
    
    float depthColorShift = 1.0 - exp(-depth * 0.03);
    causticsColor = mix(causticsColor, vec3(0.92, 0.95, 1.0), depthColorShift * 0.3);
    
    return causticsColor * causticsIntensity * 0.8;
}

// Shade the ocean floor with caustics
vec3 shadeOceanFloor(vec3 floorPos, vec3 viewDir, vec3 normal, float time, OceanFloorParams floorParams, SkyAtmosphere sky, vec3 waterSurfacePos, vec3 waterNormal) {
    LightingInfo light = evaluateLighting(sky, time);
    vec3 sunDir = light.sunDirection;
    vec3 sunColor = light.sunColor;
    float sunIntensity = light.sunIntensity;
    
    const vec3 floorColorBase = vec3(0.3, 0.25, 0.2);
    const float floorRoughness = 0.8;
    
    float floorHeight = getOceanFloorHeight(floorPos.xz, floorParams);
    float depthVariation = (floorHeight - floorParams.baseDepth) / floorParams.heightVariation;
    vec3 floorColor = mix(floorColorBase * 0.7, floorColorBase * 1.3, depthVariation * 0.5 + 0.5);
    
    float textureNoise = smoothNoise(floorPos.xz * 0.5) * 0.1;
    floorColor += textureNoise;
    
    float NdotL = max(dot(normal, sunDir), 0.0);
    
    vec3 ambient = floorColor * 0.1;
    vec3 diffuse = floorColor * sunColor * sunIntensity * NdotL;
    
    vec3 halfVec = normalize(viewDir + sunDir);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float specularPower = pow(NdotH, 32.0) * (1.0 - floorRoughness);
    vec3 specular = sunColor * sunIntensity * specularPower * 0.2;
    
    vec3 caustics = vec3(0.0);
    if (sunDir.y > 0.0 && waterSurfacePos.y > floorPos.y) {
        caustics = calculateCaustics(floorPos, waterSurfacePos, waterNormal, sunDir, time, floorParams);
        caustics *= sunIntensity * sunColor;
    }
    
    return ambient + diffuse + specular + caustics;
}

// ============================================================================
// WATER ROUGHNESS & REFLECTION DISTORTION
// ============================================================================

float calculateWaterRoughness(vec2 gradient, float waveHeight) {
    float slope = length(gradient);
    float steepnessFactor = smoothstep(0.2, 0.85, slope);
    
    float heightVariation = abs(waveHeight) * 0.6;
    float crestFactor = smoothstep(-0.2, 0.4, waveHeight);
    
    float curvatureProxy = slope * 1.5;
    
    float roughness = mix(baseRoughness, maxRoughness, 
                         steepnessFactor * 0.6 + 
                         heightVariation * 0.25 + 
                         curvatureProxy * 0.15);
    
    float microRoughness = slope * 0.4;
    roughness += microRoughness * 0.2;
    
    return clamp(roughness, baseRoughness, maxRoughness * 1.2);
}

vec3 getDistortedReflectionDir(vec3 reflectedDir, vec3 normal, float roughness, vec2 pos, float time) {
    const float distortionScale = 0.3;
    // Use rotated offsets for more stable sampling
    float angle = dot(pos, vec2(0.7071, 0.7071)) * 0.5;
    vec2 offset1 = vec2(cos(angle), sin(angle)) * 0.1;
    vec2 offset2 = vec2(-sin(angle), cos(angle)) * 0.1;
    vec2 distortion = getWaveGradient(pos + offset1, time) * 0.02 +
                      getWaveGradient(pos + offset2, time) * 0.02;
    
    distortion *= roughness * distortionScale;
    
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 tangent = normalize(cross(worldUp, normal));
    if (length(tangent) < 0.001) {
        tangent = normalize(cross(vec3(1.0, 0.0, 0.0), normal));
    }
    vec3 bitangent = cross(normal, tangent);
    
    vec3 distortedDir = reflectedDir + tangent * distortion.x + bitangent * distortion.y;
    return normalize(distortedDir);
}

// ============================================================================
// MAIN OCEAN SHADING FUNCTION
// ============================================================================

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky) {
    LightingInfo light = evaluateLighting(sky, time);
    vec3 sunDir = light.sunDirection;
    vec3 sunColor = light.sunColor;
    float sunIntensity = light.sunIntensity;
    
    OceanFloorParams floorParams = createDefaultOceanFloor();
    
    float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
    float depth = max(pos.y - floorHeight, 0.1);
    
    float depthFactor = 1.0 - exp(-depth * 0.05);
    vec3 waterColor = mix(shallowWaterColor, deepWaterColor, depthFactor);
    
    float viewAngle = 1.0 - max(dot(viewDir, normal), 0.0);
    vec3 angleTint = mix(vec3(1.0), vec3(0.95, 0.97, 1.0), viewAngle * 0.3);
    waterColor *= angleTint;
    
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedDir = refractRay(-viewDir, normal, eta);
    
    vec3 refractedColor = vec3(0.0);
    float translucencyFactor = 1.0 - smoothstep(3.0, 25.0, depth);
    
    if (dot(refractedDir, normal) < 0.0 && translucencyFactor > 0.01) {
        vec3 rayResult = raymarchThroughWater(pos, refractedDir, time, floorParams);
        float hitFloor = rayResult.x;
        float waterPathLength = rayResult.y;
        
        if (hitFloor > 0.5) {
            vec3 floorPos = pos + refractedDir * waterPathLength;
            vec3 floorNormal = getOceanFloorNormal(floorPos, floorParams);
            
            vec3 floorColor = shadeOceanFloor(floorPos, -refractedDir, floorNormal, time, floorParams, sky, pos, normal);
            
            vec3 absorption = exp(-waterAbsorption * waterPathLength);
            refractedColor = floorColor * absorption;
            
            vec3 waterTint = mix(shallowWaterColor, deepWaterColor, 1.0 - exp(-waterPathLength * 0.04));
            refractedColor = mix(refractedColor, waterTint, 0.25);
        } else {
            vec3 absorption = exp(-waterAbsorption * depth);
            refractedColor = waterColor * absorption;
        }
    } else {
        vec3 absorption = exp(-waterAbsorption * depth);
        refractedColor = waterColor * absorption;
    }
    
    if (translucencyFactor < 1.0) {
        vec3 baseWaterRefracted = waterColor * exp(-waterAbsorption * depth);
        refractedColor = mix(baseWaterRefracted, refractedColor, translucencyFactor);
    }
    
    float waveHeight = getWaveHeight(pos.xz, time);
    float dynamicRoughness = calculateWaterRoughness(gradient, waveHeight);
    
    vec3 F = getFresnel(viewDir, normal);
    
    vec3 incidentDir = -viewDir;
    vec3 reflectedDir = reflect(incidentDir, normal);
    vec3 distortedReflectedDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz, time);
    
    float reflectionElevation = distortedReflectedDir.y;
    if (reflectionElevation < 0.0) {
        float horizonBlend = smoothstep(-0.1, 0.0, reflectionElevation);
        distortedReflectedDir = normalize(mix(
            vec3(distortedReflectedDir.x, 0.01, distortedReflectedDir.z),
            distortedReflectedDir,
            horizonBlend
        ));
    }
    
    vec3 reflectedColor = skyColor(distortedReflectedDir, sky, time);
    
    float roughnessFactor = smoothstep(baseRoughness, maxRoughness, dynamicRoughness);
    // Use consistent sample count to avoid temporal flickering
    int numSamples = int(mix(1.0, 3.0, roughnessFactor));
    numSamples = max(1, min(3, numSamples)); // Clamp to avoid jumps
    
    if (numSamples > 1 && dynamicRoughness > baseRoughness * 1.5) {
        vec3 sampleSum = reflectedColor;
        float sampleWeight = 1.0;
        
        const float goldenAngle = 2.399963229728653;
        // Add temporal jitter to reduce aliasing - use stable hash based on position
        float jitter = fract(dot(pos.xz, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * 0.1;
        
        for (int i = 1; i < numSamples; i++) {
            float angle = float(i) * goldenAngle + jitter;
            float radius = dynamicRoughness * 0.08 * sqrt(float(i) / float(numSamples));
            
            vec2 offset = vec2(cos(angle), sin(angle)) * radius;
            vec3 sampleDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz + offset, time);
            
            if (sampleDir.y > 0.0) {
                vec3 sampleColor = skyColor(sampleDir, sky, time);
                float weight = 1.0 / (1.0 + float(i) * 0.3);
                sampleSum += sampleColor * weight;
                sampleWeight += weight;
            }
        }
        
        reflectedColor = sampleSum / sampleWeight;
    }
    
    vec3 lightDir = sunDir;
    vec3 lightColor = sunColor * sunIntensity;
    
    vec3 kS = F;
    vec3 kT = vec3(1.0) - F;
    vec3 kD = (1.0 - kS) * 0.1;
    
    vec3 baseColor = mix(refractedColor, reflectedColor, F);
    
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    vec3 specularReflectionDir = reflect(-viewDir, normal);
    vec3 skySpecularColor = skyColor(specularReflectionDir, sky, time);
    
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness, skySpecularColor);
    specular *= 1.2;
    
    vec3 waterAlbedo = mix(shallowWaterColor, deepWaterColor, depthFactor * 0.5);
    waterAlbedo *= 0.3;
    vec3 diffuse = kD * waterAlbedo * lightColor * NdotL / PI;
    
    vec3 subsurface = getSubsurfaceScattering(normal, viewDir, lightDir, depth);
    
    vec3 ambientDiffuse = vec3(0.0);
    vec3 ambientSpecular = vec3(0.0);
    
    vec3 skyUp = vec3(0.0, 1.0, 0.0);
    vec3 skyUpColor = skyColor(skyUp, sky, time);
    float skyUpWeight = max(dot(normal, skyUp), 0.0);
    
    vec3 hemisphereAvg = skyUpColor * 0.5;
    ambientDiffuse += hemisphereAvg * kD * waterAlbedo * skyUpWeight;
    
    vec3 normalReflected = reflect(-viewDir, normal);
    vec3 normalReflectedColor = vec3(0.0);
    
    if (normalReflected.y > 0.0) {
        normalReflectedColor = skyColor(normalReflected, sky, time);
        
        if (dynamicRoughness > baseRoughness * 1.2) {
            const int numIBLSamples = 3;
            vec3 sampleSum = normalReflectedColor;
            float sampleWeight = 1.0;
            
            // Add temporal jitter to reduce aliasing
            float jitter = fract(dot(pos.xz, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * TAU;
            
            for (int i = 0; i < numIBLSamples; i++) {
                float angle = float(i) * TAU / float(numIBLSamples) + jitter;
                vec3 offset = vec3(cos(angle), 0.0, sin(angle)) * dynamicRoughness * 0.1;
                vec3 sampleDir = normalize(normalReflected + offset);
                if (sampleDir.y > 0.0) {
                    vec3 sampleColor = skyColor(sampleDir, sky, time);
                    sampleSum += sampleColor;
                    sampleWeight += 1.0;
                }
            }
            normalReflectedColor = sampleSum / sampleWeight;
        }
        
        ambientSpecular += normalReflectedColor * F;
    }
    
    vec3 ambient = ambientDiffuse + ambientSpecular * 0.3;
    
    vec3 waterBase = baseColor + diffuse + subsurface + ambient;
    
    if (sunDir.y > 0.0 && NdotL > 0.0) {
        vec3 toSun = normalize(sunDir);
        float cosTheta = dot(viewDir, toSun);
        float phase = (1.0 - 0.9 * 0.9) / pow(1.0 + 0.9 * 0.9 - 2.0 * 0.9 * cosTheta, 1.5);
        phase /= 4.0 * PI;
        
        float volumetricFactor = phase * NdotL * (1.0 - exp(-depth * 0.02));
        vec3 volumetricLight = sunColor * sunIntensity * volumetricFactor * 0.05;
        
        volumetricLight *= mix(vec3(1.0), shallowWaterColor, 1.0 - depthFactor);
        waterBase += volumetricLight;
    }
    
    vec3 color = waterBase + specular;
    
    return color;
}

// ============================================================================
// RAYMARCHING
// ============================================================================

vec3 raymarchOcean(vec3 ro, vec3 rd, float time) {
    float t = 0.0;
    float prevH = 1e10;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos = ro + rd * t;
        float h = pos.y - getWaveHeight(pos.xz, time);
        
        // More stable convergence check with small bias
        if (abs(h) < MIN_DIST * 1.5) {
            // Refine position for better precision
            vec3 refinedPos = pos;
            if (abs(h) > MIN_DIST * 0.5) {
                // Take a small step back and forward to find better position
                float refineStep = h * 0.3;
                refinedPos = ro + rd * (t - refineStep);
                float hRefined = refinedPos.y - getWaveHeight(refinedPos.xz, time);
                if (abs(hRefined) < abs(h)) {
                    pos = refinedPos;
                }
            }
            return pos;
        }
        
        if (t > MAX_DIST) break;
        
        // More stable stepping - avoid oscillation
        float stepSize = clamp(h * 0.4, MIN_DIST * 0.5, 1.0);
        
        // Prevent oscillation by checking if we're getting closer
        if (abs(h) > abs(prevH) * 1.1 && i > 2) {
            // We're moving away, take smaller step
            stepSize = MIN_DIST;
        }
        
        prevH = h;
        t += stepSize;
    }
    
    return ro + rd * MAX_DIST;
}

#endif // OCEAN_SYSTEM_FRAG

