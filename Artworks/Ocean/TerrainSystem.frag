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
    float persistence;     // Persistence (lacunarity) for fractal noise
    float lacunarity;      // Frequency multiplier between octaves
};

// ============================================================================
// ADVANCED NOISE FUNCTIONS
// ============================================================================

// Ridged multifractal noise - creates sharp ridges like mountain ranges
// Based on Musgrave's ridged multifractal algorithm
float ridgedNoise(vec2 p, float scale, int octaves, float persistence) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = smoothNoise(p * frequency);
        // Create ridges by taking absolute value and inverting
        n = abs(n);
        n = 1.0 - n;
        // Square to sharpen ridges
        n = n * n;
        
        value += n * amplitude;
        maxValue += amplitude;
        
        amplitude *= persistence;
        frequency *= 2.0;
    }
    
    return value / max(maxValue, 1e-6);
}

// Domain warping - warps the domain before sampling noise for more natural patterns
// Creates flowing, organic terrain features
vec2 domainWarp(vec2 p, float strength) {
    if (strength < 0.001) return p;
    
    // Use noise to warp the domain
    vec2 warp1 = vec2(
        smoothNoise(p * 0.5) * 2.0 - 1.0,
        smoothNoise((p + vec2(100.0, 100.0)) * 0.5) * 2.0 - 1.0
    );
    
    vec2 warp2 = vec2(
        smoothNoise((p + warp1 * 2.0) * 0.25) * 2.0 - 1.0,
        smoothNoise((p + warp1 * 2.0 + vec2(50.0, 50.0)) * 0.25) * 2.0 - 1.0
    );
    
    return p + (warp1 + warp2 * 0.5) * strength * 10.0;
}

// Billow noise - creates billowy, cloud-like patterns
float billowNoise(vec2 p, float scale, int octaves, float persistence) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = smoothNoise(p * frequency);
        // Make it billowy by taking absolute value
        n = abs(n * 2.0 - 1.0);
        
        value += n * amplitude;
        maxValue += amplitude;
        
        amplitude *= persistence;
        frequency *= 2.0;
    }
    
    return value / max(maxValue, 1e-6);
}

// ============================================================================
// TERRAIN GENERATION FUNCTIONS
// ============================================================================

// Create default terrain parameters
TerrainParams createDefaultTerrain() {
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
    params.lacunarity = 2.0;
    return params;
}

// Create ocean floor terrain parameters (backward compatibility)
TerrainParams createDefaultOceanFloor() {
    TerrainParams params;
    params.baseHeight = -105.0;
    params.heightVariation = 25.0;
    params.largeScale = 0.02;
    params.mediumScale = 0.08;
    params.smallScale = 0.3;
    params.largeAmplitude = 0.6;
    params.mediumAmplitude = 0.3;
    params.smallAmplitude = 0.1;
    params.roughness = 0.5;
    params.ridgedness = 0.0;
    params.domainWarp = 0.1;
    params.erosion = 0.2;
    params.mountainness = 0.0;
    params.valleyness = 0.3;
    params.octaves = 3;
    params.persistence = 0.5;
    params.lacunarity = 2.0;
    return params;
}

// Create mountainous terrain preset
TerrainParams createMountainTerrain() {
    TerrainParams params;
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
    params.lacunarity = 2.0;
    return params;
}

// Create hilly terrain preset
TerrainParams createHillyTerrain() {
    TerrainParams params;
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
    params.lacunarity = 2.0;
    return params;
}

// Create plains/flat terrain preset
TerrainParams createPlainsTerrain() {
    TerrainParams params;
    params.baseHeight = 0.0;
    params.heightVariation = 10.0;
    params.largeScale = 0.02;
    params.mediumScale = 0.1;
    params.smallScale = 0.4;
    params.largeAmplitude = 0.4;
    params.mediumAmplitude = 0.4;
    params.smallAmplitude = 0.2;
    params.roughness = 0.2;
    params.ridgedness = 0.0;
    params.domainWarp = 0.1;
    params.erosion = 0.5;
    params.mountainness = 0.0;
    params.valleyness = 0.0;
    params.octaves = 3;
    params.persistence = 0.4;
    params.lacunarity = 2.0;
    return params;
}

// Main terrain height function - generates terrain height at position (x, z)
// Returns the Y coordinate of the terrain
float getTerrainHeight(vec2 pos, TerrainParams params) {
    // Apply domain warping for more natural patterns
    vec2 warpedPos = domainWarp(pos, params.domainWarp);
    
    // Large-scale terrain (hills, valleys, major features)
    vec2 largePos = warpedPos;
    float largeNoise = fractalNoise(largePos, params.largeScale, params.octaves, params.persistence);
    
    // Add ridged noise for mountain-like features
    float largeRidged = 0.0;
    if (params.ridgedness > 0.001) {
        largeRidged = ridgedNoise(largePos, params.largeScale * 0.5, params.octaves, params.persistence);
        largeNoise = mix(largeNoise, largeRidged, params.ridgedness * params.mountainness);
    }
    
    float largeHeight = (largeNoise - 0.5) * 2.0; // [-1, 1]
    
    // Medium-scale terrain (ridges, slopes, secondary features)
    vec2 mediumPos = warpedPos + vec2(100.0, 100.0);
    float mediumNoise = fractalNoise(mediumPos, params.mediumScale, params.octaves - 1, params.persistence);
    
    // Add valley features using inverted noise
    if (params.valleyness > 0.001) {
        float valleyNoise = 1.0 - abs(fractalNoise(mediumPos + vec2(200.0, 200.0), 
                                                     params.mediumScale * 0.7, 2, 0.6));
        mediumNoise = mix(mediumNoise, valleyNoise, params.valleyness);
    }
    
    float mediumHeight = (mediumNoise - 0.5) * 2.0; // [-1, 1]
    
    // Small-scale terrain (detail, bumps, micro-features)
    vec2 smallPos = warpedPos + vec2(200.0, 200.0);
    float smallNoise = fractalNoise(smallPos, params.smallScale, params.octaves - 2, params.persistence);
    float smallHeight = (smallNoise - 0.5) * 2.0; // [-1, 1]
    
    // Combine all scales with their amplitudes
    float heightVariation = largeHeight * params.largeAmplitude +
                           mediumHeight * params.mediumAmplitude +
                           smallHeight * params.smallAmplitude;
    
    // Apply roughness (adds more variation and detail)
    if (params.roughness > 0.001) {
        float roughNoise = billowNoise(warpedPos + vec2(300.0, 300.0), 
                                      params.smallScale * 1.5, 2, 0.7);
        float roughHeight = (roughNoise - 0.5) * 2.0;
        heightVariation += roughHeight * params.roughness * 0.3;
    }
    
    // Apply erosion-like smoothing (reduces extreme peaks)
    if (params.erosion > 0.001) {
        heightVariation = mix(heightVariation, heightVariation * 0.7, params.erosion * 0.5);
    }
    
    // Scale by height variation parameter and add to base height
    float terrainHeight = params.baseHeight + heightVariation * params.heightVariation;
    
    return terrainHeight;
}

// Get terrain normal (for shading and lighting)
vec3 getTerrainNormal(vec3 pos, TerrainParams params) {
    const float eps = 0.5;
    
    float hL = getTerrainHeight(pos.xz - vec2(eps, 0.0), params);
    float hR = getTerrainHeight(pos.xz + vec2(eps, 0.0), params);
    float hD = getTerrainHeight(pos.xz - vec2(0.0, eps), params);
    float hU = getTerrainHeight(pos.xz + vec2(0.0, eps), params);
    
    vec3 normal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
    return normal;
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

// Alias for backward compatibility with ocean floor system
#define OceanFloorParams TerrainParams
#define getOceanFloorHeight getTerrainHeight
#define getOceanFloorNormal getTerrainNormal

#endif // TERRAIN_SYSTEM_FRAG

