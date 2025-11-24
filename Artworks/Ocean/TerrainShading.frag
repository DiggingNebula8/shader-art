// ============================================================================
// TERRAIN SHADING SYSTEM
// ============================================================================
// Terrain material properties and shading functions
// Includes caustics calculation for underwater terrain
// ============================================================================
// This system shades terrain surfaces, especially ocean floor with caustics
// ============================================================================

#ifndef TERRAIN_SHADING_FRAG
#define TERRAIN_SHADING_FRAG

#include "Common.frag"
#include "SkySystem.frag"
#include "TerrainSystem.frag"
#include "WaveSystem.frag"

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
    
    // Optimized: reuse wave height calculation for large scale pattern
    float largeScalePattern = abs(getWaveHeight(surfacePos, time)) * 0.15;
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
// TERRAIN SHADING
// ============================================================================

// Shade the ocean floor with caustics
vec3 shadeTerrain(TerrainShadingParams params) {
    vec3 sunDir = params.light.sunDirection;
    vec3 sunColor = params.light.sunColor;
    float sunIntensity = params.light.sunIntensity;
    
    const vec3 floorColorBase = vec3(0.3, 0.25, 0.2);
    const float floorRoughness = 0.8;
    
    float floorHeight = getTerrainHeight(params.pos.xz, params.terrainParams);
    float depthVariation = (floorHeight - params.terrainParams.baseHeight) / max(params.terrainParams.heightVariation, 0.001);
    vec3 floorColor = mix(floorColorBase * 0.7, floorColorBase * 1.3, depthVariation * 0.5 + 0.5);
    
    float textureNoise = smoothNoise(params.pos.xz * 0.5) * 0.1;
    floorColor += textureNoise;
    
    float NdotL = max(dot(params.normal, sunDir), 0.0);
    
    vec3 ambient = floorColor * 0.1;
    vec3 diffuse = floorColor * sunColor * sunIntensity * NdotL;
    
    vec3 halfVec = normalize(params.viewDir + sunDir);
    float NdotH = max(dot(params.normal, halfVec), 0.0);
    float specularPower = pow(NdotH, 32.0) * (1.0 - floorRoughness);
    vec3 specular = sunColor * sunIntensity * specularPower * 0.2;
    
    vec3 caustics = vec3(0.0);
    if (sunDir.y > 0.0 && params.waterSurfacePos.y > params.pos.y) {
        caustics = calculateCaustics(params.pos, params.waterSurfacePos, params.waterNormal, sunDir, params.time, params.terrainParams);
        caustics *= sunIntensity * sunColor;
    }
    
    return ambient + diffuse + specular + caustics;
}

#endif // TERRAIN_SHADING_FRAG

