// ============================================================================
// TERRAIN SHADING SYSTEM
// ============================================================================
// Terrain material properties and shading functions
// Includes caustics calculation for underwater terrain
// ============================================================================
//
// MACRO CONTRACTS:
//
//   OPTIONAL MACROS (have defaults, can be omitted for scenes without water):
//
//     TERRAIN_WAVE_HEIGHT(pos, time)
//       Signature: float TERRAIN_WAVE_HEIGHT(vec2 pos, float time)
//       Purpose: Get wave height at position (for caustics calculation)
//       Default: Returns 0.0 if not defined (disables wave-based caustics)
//       Example: #define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
//       Note: Required for realistic underwater caustics effects
//
//     TERRAIN_WAVE_GRADIENT(pos, time)
//       Signature: vec2 TERRAIN_WAVE_GRADIENT(vec2 pos, float time)
//       Purpose: Get wave gradient at position (for caustics focus calculation)
//       Default: Returns vec2(0.0) if not defined (disables gradient-based caustics)
//       Example: #define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)
//       Note: Required for realistic underwater caustics effects
//
//   Usage:
//     - Scenes WITH water: Define both macros to enable caustics
//     - Scenes WITHOUT water: Omit macros (defaults will disable caustics)
//
// This system shades terrain surfaces, especially ocean floor with caustics
// ============================================================================

#ifndef TERRAIN_SHADING_FRAG
#define TERRAIN_SHADING_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"
#include "TerrainSystem.frag"
#include "WaterInteractionSystem.frag"

// Wave height/gradient query macros - optional, default to 0.0 for scenes without water
#ifndef TERRAIN_WAVE_HEIGHT
#define TERRAIN_WAVE_HEIGHT(pos, time) 0.0
#endif
#ifndef TERRAIN_WAVE_GRADIENT
#define TERRAIN_WAVE_GRADIENT(pos, time) vec2(0.0)
#endif

// ============================================================================
// TERRAIN SHADING PARAMETERS STRUCT
// ============================================================================

struct TerrainShadingParams {
    vec3 pos;                    // Terrain position
    vec3 normal;                 // Terrain normal
    vec3 viewDir;                // View direction
    float time;                  // Time for animation
    TerrainParams terrainParams; // Terrain configuration
    LightingInfo light;           // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration
    vec3 waterSurfacePos;        // Water surface position (for caustics)
    vec3 waterNormal;            // Water surface normal (for caustics)
    TerrainMaterial material;    // Terrain material properties (art-directable)
    // Optional water interaction parameters
    float waterDepth;            // Depth below water surface (0.0 = at surface, >0 = underwater)
    bool isWet;                  // Whether surface is wet (near water line)
    WaterMaterial waterMaterial; // Water material (for underwater effects)
};

// ============================================================================
// CAUSTICS CALCULATION
// ============================================================================

// Realistic Caustics Calculation
// Note: floorParams parameter reserved for future use (e.g., material-based caustics modulation)
vec3 calculateCaustics(vec3 floorPos, vec3 waterSurfacePos, vec3 waterNormal, vec3 sunDir, float time, TerrainParams floorParams) {
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedSunDir = refractRay(-sunDir, waterNormal, eta);
    
    if (dot(refractedSunDir, -waterNormal) < 0.0) {
        return vec3(0.0);
    }
    
    vec2 surfacePos = waterSurfacePos.xz;
    float depth = max(waterSurfacePos.y - floorPos.y, 0.1);
    
    // Adaptive sampling: more samples for shallow water (where caustics are more visible)
    // and fewer samples for deep water (where caustics fade out)
    float depthFactor = 1.0 - smoothstep(5.0, 30.0, depth);
    int numSamples = depthFactor > 0.7 ? 7 : (depthFactor > 0.3 ? 5 : 3);
    
    float causticsIntensity = 0.0;
    float totalWeight = 0.0;
    
    float sampleRadius = depth * 0.15;
    
    // Add temporal jitter to reduce aliasing - use stable hash based on position
    float jitter = fract(dot(surfacePos, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * TAU;
    
    // Use golden angle spiral for better sample distribution
    const float goldenAngle = 2.399963229728653;
    
    for (int i = 0; i < numSamples; i++) {
        // Use golden angle for better coverage
        float angle = float(i) * goldenAngle + jitter;
        float radius = sampleRadius * sqrt(float(i) / float(numSamples));
        vec2 sampleOffset = vec2(cos(angle), sin(angle)) * radius;
        vec2 samplePos = surfacePos + sampleOffset;
        
        vec2 grad = TERRAIN_WAVE_GRADIENT(samplePos, time);
        float slope = length(grad);
        float focus = smoothstep(0.2, 0.6, slope);
        
        float waveHeight = TERRAIN_WAVE_HEIGHT(samplePos, time);
        float crestFactor = smoothstep(-0.1, 0.2, waveHeight);
        
        float sampleIntensity = focus * (0.7 + crestFactor * 0.3);
        
        float dist = length(sampleOffset);
        float gaussian = exp(-dist * dist / (sampleRadius * sampleRadius * 0.5));
        
        // Weight samples by distance (center samples more important)
        float weight = 1.0 / (1.0 + float(i) * 0.2);
        causticsIntensity += sampleIntensity * gaussian * weight;
        totalWeight += weight;
    }
    
    // Normalize by effective sample weight
    causticsIntensity /= max(totalWeight, 1.0);
    
    // Optimized: reuse wave height calculation for large scale pattern
    float largeScalePattern = abs(TERRAIN_WAVE_HEIGHT(surfacePos, time)) * 0.15;
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

// ============================================================================
// TERRAIN WATER INTERACTION EFFECTS
// ============================================================================
// Uses WaterInteractionSystem for common water interaction effects
// Terrain-specific customization is handled via WaterInteractionParams
// Note: Caustics calculation remains terrain-specific (uses WaveSystem)

// ============================================================================
// TERRAIN SHADING
// ============================================================================

// Shade the ocean floor with caustics
vec3 shadeTerrain(TerrainShadingParams params) {
    vec3 sunDir = params.light.sunDirection;
    vec3 sunColor = params.light.sunColor;
    float sunIntensity = params.light.sunIntensity;
    
    float floorHeight = getTerrainHeight(params.pos.xz, params.terrainParams);
    float depthVariation = (floorHeight - params.terrainParams.baseHeight) / max(params.terrainParams.heightVariation, 0.001);
    float depthT = clamp(depthVariation * 0.5 + 0.5, 0.0, 1.0);
    vec3 floorColor = mix(params.material.baseColor * 0.7, params.material.baseColor * 1.3, depthT);
    
    // Blend with deep color based on depth
    floorColor = mix(params.material.deepColor, floorColor, depthT);
    
    float textureNoise = smoothNoise(params.pos.xz * 0.5) * 0.1;
    floorColor += textureNoise;
    
    float NdotL = max(dot(params.normal, sunDir), 0.0);
    
    vec3 ambient = floorColor * params.material.ambientFactor;
    vec3 diffuse = floorColor * sunColor * sunIntensity * NdotL;
    
    vec3 halfVec = normalize(params.viewDir + sunDir);
    float NdotH = max(dot(params.normal, halfVec), 0.0);
    float specularPower = pow(NdotH, params.material.specularPower) * (1.0 - params.material.roughness);
    vec3 specular = sunColor * sunIntensity * specularPower * params.material.specularIntensity;
    
    vec3 caustics = vec3(0.0);
    if (sunDir.y > 0.0 && params.waterSurfacePos.y > params.pos.y) {
        caustics = calculateCaustics(params.pos, params.waterSurfacePos, params.waterNormal, sunDir, params.time, params.terrainParams);
        caustics *= sunIntensity * sunColor;
    }
    
    vec3 color = ambient + diffuse + specular + caustics;
    
    // Apply water interaction effects using WaterInteractionSystem
    if (params.isWet || params.waterDepth > 0.0) {
        WaterInteractionParams interactionParams = createTerrainWaterInteractionParams();
        interactionParams.pos = params.pos;
        interactionParams.normal = params.normal;
        interactionParams.waterSurfacePos = params.waterSurfacePos;
        interactionParams.waterNormal = params.waterNormal;
        interactionParams.waterDepth = params.waterDepth;
        interactionParams.time = params.time;
        interactionParams.viewDir = params.viewDir;
        interactionParams.sunDir = sunDir;
        interactionParams.sunColor = sunColor;
        interactionParams.sunIntensity = sunIntensity;
        interactionParams.waterMaterial = params.waterMaterial;
        
        if (params.isWet) {
            color = applyWetSurfaceEffect(color, interactionParams);
        }
        
        if (params.waterDepth > 0.0) {
            color = applyUnderwaterEffect(color, interactionParams);
        }
    }
    
    return color;
}

#endif // TERRAIN_SHADING_FRAG

