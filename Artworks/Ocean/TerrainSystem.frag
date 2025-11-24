// ============================================================================
// TERRAIN SYSTEM
// ============================================================================
// Advanced procedural terrain generation system
// Based on techniques from:
//   - Perlin & Hoffert "Hypertexture" (SIGGRAPH 1989)
//   - Musgrave et al. "The Synthesis and Rendering of Eroded Fractal Terrains" (SIGGRAPH 1989)
//   - Ebert et al. "Texturing & Modeling: A Procedural Approach"
//   - Domain Warping techniques for natural-looking terrain
// ============================================================================

#ifndef TERRAIN_SYSTEM_FRAG
#define TERRAIN_SYSTEM_FRAG

#include "Common.frag"

// ============================================================================
// CONSTANTS
// ============================================================================

const float MIN_AMPLITUDE_THRESHOLD = 0.001;
const float DOMAIN_WARP_SCALE = 10.0;
const float ROUGHNESS_MULTIPLIER = 0.3;
const float EROSION_MULTIPLIER = 0.5;
const float EROSION_REDUCTION = 0.7;
const float DEFAULT_LACUNARITY = 2.0;
const float NOISE_NORMALIZATION_EPSILON = 1e-6;
const int MAX_OCTAVES = 8;

// ============================================================================
// TERRAIN PARAMETERS
// ============================================================================

struct TerrainParams {
    // Base terrain properties
    float baseHeight;       // Base height of the terrain
    float heightVariation;  // Maximum height variation from base height
    
    // Multi-scale noise parameters
    float largeScale;       // Large-scale terrain feature size
    float mediumScale;      // Medium-scale terrain feature size
    float smallScale;       // Small-scale terrain feature size (detail)
    
    // Amplitude weights for each scale
    float largeAmplitude;   // Amplitude of large-scale features
    float mediumAmplitude;  // Amplitude of medium-scale features
    float smallAmplitude;   // Amplitude of small-scale features
    
    // Advanced terrain features
    float roughness;        // Overall terrain roughness (0.0 = smooth, 1.0 = rough)
    float ridgedness;      // Ridged multifractal influence (0.0 = none, 1.0 = full)
    float domainWarp;      // Domain warping strength (0.0 = none, 1.0 = strong)
    float erosion;         // Erosion-like smoothing (0.0 = none, 1.0 = heavy)
    
    // Terrain type modifiers
    float mountainness;    // Mountain-like features (0.0 = flat, 1.0 = mountains)
    float valleyness;      // Valley/canyon features (0.0 = none, 1.0 = deep valleys)
    
    // Noise function parameters
    int octaves;           // Number of octaves for fractal noise
    float persistence;     // Amplitude falloff between octaves
    float lacunarity;      // Frequency multiplier between octaves (reserved for future use)
};

// ============================================================================
// ADVANCED NOISE FUNCTIONS
// ============================================================================

// Ridged multifractal noise - creates sharp ridges like mountain ranges
// Based on Musgrave's ridged multifractal algorithm
float ridgedNoise(vec2 p, float scale, int octaves, float persistence) {
    int steps = clamp(octaves, 0, MAX_OCTAVES);
    
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    for (int i = 0; i < MAX_OCTAVES; i++) {
        if (i >= steps) break;
        
        float n = smoothNoise(p * frequency);
        // Create ridges by taking absolute value and inverting
        n = abs(n);
        n = 1.0 - n;
        // Square to sharpen ridges
        n = n * n;
        
        value += n * amplitude;
        maxValue += amplitude;
        
        amplitude *= persistence;
        frequency *= DEFAULT_LACUNARITY;
    }
    
    return value / max(maxValue, NOISE_NORMALIZATION_EPSILON);
}

// Domain warping - warps the domain before sampling noise for more natural patterns
// Creates flowing, organic terrain features
vec2 domainWarp(vec2 p, float strength) {
    if (strength < MIN_AMPLITUDE_THRESHOLD) return p;
    
    const float warpScale1 = 0.5;
    const float warpScale2 = 0.25;
    const vec2 offset1 = vec2(100.0, 100.0);
    const vec2 offset2 = vec2(50.0, 50.0);
    
    // First warp layer
    vec2 warp1 = vec2(
        smoothNoise(p * warpScale1) * 2.0 - 1.0,
        smoothNoise((p + offset1) * warpScale1) * 2.0 - 1.0
    );
    
    // Second warp layer (refined)
    vec2 warp2 = vec2(
        smoothNoise((p + warp1 * 2.0) * warpScale2) * 2.0 - 1.0,
        smoothNoise((p + warp1 * 2.0 + offset2) * warpScale2) * 2.0 - 1.0
    );
    
    return p + (warp1 + warp2 * 0.5) * strength * DOMAIN_WARP_SCALE;
}

// Billow noise - creates billowy, cloud-like patterns
float billowNoise(vec2 p, float scale, int octaves, float persistence) {
    int steps = clamp(octaves, 0, MAX_OCTAVES);
    
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    for (int i = 0; i < MAX_OCTAVES; i++) {
        if (i >= steps) break;
        
        float n = smoothNoise(p * frequency);
        // Make it billowy by taking absolute value
        n = abs(n * 2.0 - 1.0);
        
        value += n * amplitude;
        maxValue += amplitude;
        
        amplitude *= persistence;
        frequency *= DEFAULT_LACUNARITY;
    }
    
    return value / max(maxValue, NOISE_NORMALIZATION_EPSILON);
}

// ============================================================================
// TERRAIN PRESET HELPERS
// ============================================================================

// Initialize terrain parameters with default values
TerrainParams initTerrainParams() {
    TerrainParams params;
    params.baseHeight = 0.0;
    params.heightVariation = 50.0;
    params.largeScale = 0.01;
    params.mediumScale = 0.05;
    params.smallScale = 0.2;
    params.largeAmplitude = 0.5;
    params.mediumAmplitude = 0.3;
    params.smallAmplitude = 0.2;
    params.roughness = 0.4;
    params.ridgedness = 0.0;
    params.domainWarp = 0.0;
    params.erosion = 0.0;
    params.mountainness = 0.0;
    params.valleyness = 0.0;
    params.octaves = 4;
    params.persistence = 0.5;
    params.lacunarity = DEFAULT_LACUNARITY; // Reserved for future use - currently DEFAULT_LACUNARITY is used directly
    return params;
}

// ============================================================================
// TERRAIN PRESETS
// ============================================================================

TerrainParams createDefaultTerrain() {
    return initTerrainParams();
}

// Low-poly, flat terrain optimized for ocean floor
TerrainParams createDefaultOceanFloor() {
    TerrainParams params = initTerrainParams();
    params.baseHeight = -105.0;
    params.heightVariation = 2.0;
    params.largeScale = 0.005;
    params.mediumScale = 0.02;
    params.smallScale = 0.1;
    params.largeAmplitude = 1.0;
    params.mediumAmplitude = 0.0;
    params.smallAmplitude = 0.0;
    params.roughness = 0.0;
    params.octaves = 1;
    return params;
}

TerrainParams createMountainTerrain() {
    TerrainParams params = initTerrainParams();
    params.baseHeight = 100.0;
    params.heightVariation = 200.0;
    params.largeScale = 0.005;
    params.mediumScale = 0.02;
    params.smallScale = 0.1;
    params.largeAmplitude = 0.6;
    params.mediumAmplitude = 0.3;
    params.smallAmplitude = 0.1;
    params.roughness = 0.7;
    params.ridgedness = 0.8;
    params.domainWarp = 0.3;
    params.erosion = 0.4;
    params.mountainness = 1.0;
    params.valleyness = 0.5;
    params.octaves = 6;
    params.persistence = 0.6;
    return params;
}

TerrainParams createHillyTerrain() {
    TerrainParams params = initTerrainParams();
    params.baseHeight = 20.0;
    params.heightVariation = 80.0;
    params.largeScale = 0.01;
    params.mediumScale = 0.04;
    params.smallScale = 0.15;
    params.largeAmplitude = 0.5;
    params.mediumAmplitude = 0.35;
    params.smallAmplitude = 0.15;
    params.roughness = 0.5;
    params.ridgedness = 0.2;
    params.domainWarp = 0.2;
    params.erosion = 0.3;
    params.mountainness = 0.3;
    params.valleyness = 0.2;
    params.octaves = 5;
    params.persistence = 0.55;
    return params;
}

TerrainParams createPlainsTerrain() {
    TerrainParams params = initTerrainParams();
    params.baseHeight = 0.0;
    params.heightVariation = 10.0;
    params.largeScale = 0.02;
    params.mediumScale = 0.1;
    params.smallScale = 0.4;
    params.largeAmplitude = 0.4;
    params.mediumAmplitude = 0.4;
    params.smallAmplitude = 0.2;
    params.roughness = 0.2;
    params.domainWarp = 0.1;
    params.erosion = 0.5;
    params.octaves = 3;
    params.persistence = 0.4;
    return params;
}

// ============================================================================
// TERRAIN GENERATION CORE FUNCTIONS
// ============================================================================

// Sample noise at a specific scale with optional offset
float sampleScaleNoise(vec2 pos, float scale, int octaves, float persistence, vec2 offset) {
    return fractalNoise(pos + offset, scale, octaves, persistence);
}

// Apply ridged noise mixing if needed
float applyRidgedNoise(vec2 pos, float baseNoise, float scale, int octaves, float persistence, float ridgedness, float mountainness) {
    if (ridgedness < MIN_AMPLITUDE_THRESHOLD || mountainness < MIN_AMPLITUDE_THRESHOLD) {
        return baseNoise;
    }
    
    float ridged = ridgedNoise(pos, scale * 0.5, octaves, persistence);
    return mix(baseNoise, ridged, ridgedness * mountainness);
}

// Apply valley noise mixing if needed
float applyValleyNoise(vec2 pos, float baseNoise, float scale, float valleyness) {
    if (valleyness < MIN_AMPLITUDE_THRESHOLD) {
        return baseNoise;
    }
    
    const vec2 valleyOffset = vec2(200.0, 200.0);
    float valleyNoise = 1.0 - abs(fractalNoise(pos + valleyOffset, scale * 0.7, 2, 0.6));
    return mix(baseNoise, valleyNoise, valleyness);
}

// Main terrain height function - generates terrain height at position (x, z)
// Note: For presets using all three scales (large, medium, small), octaves should be >= 3
// to ensure medium-scale uses at least 2 octaves and small-scale uses at least 1 octave.
// The code is protected by amplitude guards and fractalNoise's built-in octaves <= 0 check,
// but defensive guards ensure robustness if presets are modified in the future.
float getTerrainHeight(vec2 pos, TerrainParams params) {
    // Apply domain warping if enabled
    vec2 warpedPos = (params.domainWarp > MIN_AMPLITUDE_THRESHOLD) 
        ? domainWarp(pos, params.domainWarp) 
        : pos;
    
    float heightVariation = 0.0;
    
    // Large-scale terrain
    if (params.largeAmplitude > MIN_AMPLITUDE_THRESHOLD) {
        float largeNoise = sampleScaleNoise(warpedPos, params.largeScale, params.octaves, params.persistence, vec2(0.0));
        largeNoise = applyRidgedNoise(warpedPos, largeNoise, params.largeScale, params.octaves, params.persistence, params.ridgedness, params.mountainness);
        heightVariation += (largeNoise - 0.5) * 2.0 * params.largeAmplitude;
    }
    
    // Medium-scale terrain
    if (params.mediumAmplitude > MIN_AMPLITUDE_THRESHOLD) {
        const vec2 mediumOffset = vec2(100.0, 100.0);
        float mediumNoise = sampleScaleNoise(warpedPos, params.mediumScale, max(params.octaves - 1, 1), params.persistence, mediumOffset);
        mediumNoise = applyValleyNoise(warpedPos + mediumOffset, mediumNoise, params.mediumScale, params.valleyness);
        heightVariation += (mediumNoise - 0.5) * 2.0 * params.mediumAmplitude;
    }
    
    // Small-scale terrain (detail)
    if (params.smallAmplitude > MIN_AMPLITUDE_THRESHOLD) {
        const vec2 smallOffset = vec2(200.0, 200.0);
        float smallNoise = sampleScaleNoise(warpedPos, params.smallScale, max(params.octaves - 2, 1), params.persistence, smallOffset);
        heightVariation += (smallNoise - 0.5) * 2.0 * params.smallAmplitude;
    }
    
    // Apply roughness detail
    if (params.roughness > MIN_AMPLITUDE_THRESHOLD) {
        const vec2 roughOffset = vec2(300.0, 300.0);
        float roughNoise = billowNoise(warpedPos + roughOffset, params.smallScale * 1.5, 2, 0.7);
        heightVariation += (roughNoise - 0.5) * 2.0 * params.roughness * ROUGHNESS_MULTIPLIER;
    }
    
    // Apply erosion smoothing
    if (params.erosion > MIN_AMPLITUDE_THRESHOLD) {
        heightVariation = mix(heightVariation, heightVariation * EROSION_REDUCTION, params.erosion * EROSION_MULTIPLIER);
    }
    
    return params.baseHeight + heightVariation * params.heightVariation;
}

// Get terrain normal (for shading and lighting)
vec3 getTerrainNormal(vec3 pos, TerrainParams params) {
    const float epsilon = 0.1;
    
    float hL = getTerrainHeight(pos.xz - vec2(epsilon, 0.0), params);
    float hR = getTerrainHeight(pos.xz + vec2(epsilon, 0.0), params);
    float hD = getTerrainHeight(pos.xz - vec2(0.0, epsilon), params);
    float hU = getTerrainHeight(pos.xz + vec2(0.0, epsilon), params);
    
    // Calculate normal using central differences
    vec3 normal = normalize(vec3(hL - hR, 2.0 * epsilon, hD - hU));
    return normal;
}

#endif // TERRAIN_SYSTEM_FRAG
