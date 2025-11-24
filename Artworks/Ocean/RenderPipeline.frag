// ============================================================================
// RENDER PIPELINE
// ============================================================================
// High-level orchestration layer that coordinates all rendering systems
// Provides integration functions and main rendering pipeline
// ============================================================================
// This is the main entry point for rendering - coordinates:
// - WaveSystem (geometry)
// - TerrainSystem (geometry)
// - WaterShading (water material)
// - TerrainShading (terrain material)
// - SkySystem (atmosphere)
// - VolumeRaymarching (unified raymarching)
// ============================================================================

#ifndef RENDER_PIPELINE_FRAG
#define RENDER_PIPELINE_FRAG

#include "Common.frag"
#include "CameraSystem.frag"
#include "SkySystem.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"
#include "TerrainSystem.frag"
#include "WaterShading.frag"    // Water shading functions and constants
#include "TerrainShading.frag"  // Terrain shading (defines its own IOR constants to avoid conflicts)

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // 0 = water, 1 = terrain, etc.
};

struct RenderContext {
    vec3 cameraPos;
    vec3 rayDir;
    float time;
    SkyAtmosphere sky;
    TerrainParams terrainParams;
    Camera camera;
};

// ============================================================================
// INTEGRATION FUNCTIONS
// ============================================================================

// Calculate refraction through water to terrain floor
// Uses VolumeRaymarching + TerrainSDF to find floor
// Uses TerrainShading to shade the floor
vec3 calculateRefraction(vec3 pos, vec3 normal, vec3 viewDir, RenderContext ctx) {
    // Use IOR constants from WaterShading (included above)
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedDir = refractRay(-viewDir, normal, eta);
    
    // Calculate water depth info
    WaterDepthInfo depthInfo = calculateWaterDepthAndColor(pos, normal, viewDir, ctx.terrainParams);
    
    // Note: Water constants (waterAbsorption, shallowWaterColor, deepWaterColor) are defined in Common.frag
    vec3 baseAbsorption = exp(-waterAbsorption * depthInfo.depth);
    vec3 refractedColor = depthInfo.waterColor * baseAbsorption;
    float translucencyFactor = 1.0 - smoothstep(3.0, 25.0, depthInfo.depth);
    
    if (dot(refractedDir, normal) < 0.0 && translucencyFactor > 0.01) {
        // Use VolumeRaymarching to find floor
        // MAX_WATER_DEPTH is defined in Common.frag
        VolumeHit hit = raymarchTerrain(pos, refractedDir, MAX_WATER_DEPTH, ctx.time, ctx.terrainParams);
        
        if (hit.hit && hit.valid) {
            vec3 floorPos = hit.position;
            vec3 floorNormal = hit.normal;
            
            // Shade floor using TerrainShading
            TerrainShadingParams terrainParams;
            terrainParams.pos = floorPos;
            terrainParams.normal = floorNormal;
            terrainParams.viewDir = -refractedDir;
            terrainParams.time = ctx.time;
            terrainParams.terrainParams = ctx.terrainParams;
            terrainParams.light = evaluateLighting(ctx.sky, ctx.time);
            terrainParams.sky = ctx.sky;
            terrainParams.waterSurfacePos = pos;
            terrainParams.waterNormal = normal;
            
            vec3 floorColor = shadeTerrain(terrainParams);
            
            // Apply water absorption
            vec3 absorption = exp(-waterAbsorption * hit.distance);
            refractedColor = floorColor * absorption;
            
            // Add water tint
            vec3 waterTint = mix(shallowWaterColor, deepWaterColor, 1.0 - exp(-hit.distance * 0.04));
            refractedColor = mix(refractedColor, waterTint, 0.25);
        }
    }
    
    // Blend with base water color based on translucency
    if (translucencyFactor < 1.0) {
        vec3 baseWaterRefracted = depthInfo.waterColor * baseAbsorption;
        refractedColor = mix(baseWaterRefracted, refractedColor, translucencyFactor);
    }
    
    return refractedColor;
}

// Calculate reflection from water surface
// Uses VolumeRaymarching + WaveSDF for surface intersection
// Uses WaterShading for reflection calculation
vec3 calculateReflection(vec3 pos, vec3 normal, vec3 viewDir, vec2 gradient, RenderContext ctx) {
    // Use WaterShading's reflection calculation
    return calculateReflectedColor(pos, normal, viewDir, ctx.time, gradient, ctx.sky);
}

// Compose final color from all contributions
// Combines water shading, refraction, reflection, and lighting
vec3 composeFinalColor(SurfaceHit hit, RenderContext ctx) {
    if (!hit.hit) {
        // No hit - return sky color
        return skyColor(ctx.rayDir, ctx.sky, ctx.time);
    }
    
    if (hit.surfaceType == 0) {
        // Water surface
        vec3 viewDir = -ctx.rayDir;
        
        // Prepare WaterShading parameters
        WaterShadingParams waterParams;
        waterParams.pos = hit.position;
        waterParams.normal = hit.normal;
        waterParams.viewDir = viewDir;
        waterParams.gradient = hit.gradient;
        waterParams.time = ctx.time;
        waterParams.light = evaluateLighting(ctx.sky, ctx.time);
        waterParams.sky = ctx.sky;
        waterParams.floorParams = ctx.terrainParams;
        
        // Shade water using WaterShading system
        WaterShadingResult waterResult = shadeWater(waterParams);
        
        return waterResult.color;
    } else if (hit.surfaceType == 1) {
        // Terrain surface (not currently used, but available for future)
        vec3 viewDir = -ctx.rayDir;
        
        TerrainShadingParams terrainParams;
        terrainParams.pos = hit.position;
        terrainParams.normal = hit.normal;
        terrainParams.viewDir = viewDir;
        terrainParams.time = ctx.time;
        terrainParams.terrainParams = ctx.terrainParams;
        terrainParams.light = evaluateLighting(ctx.sky, ctx.time);
        terrainParams.sky = ctx.sky;
        terrainParams.waterSurfacePos = hit.position;  // No water above
        terrainParams.waterNormal = vec3(0.0, 1.0, 0.0);
        
        return shadeTerrain(terrainParams);
    }
    
    return vec3(0.0);
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

// Main scene rendering function
// Raymarches to find surface, then shades it
vec3 renderScene(vec3 ro, vec3 rd, float time, RenderContext ctx) {
    // Raymarch to water surface using WaveSystem
    VolumeHit waterHit = raymarchWaveSurface(ro, rd, MAX_DIST, time);
    
    SurfaceHit surfaceHit;
    surfaceHit.hit = waterHit.hit && waterHit.valid;
    surfaceHit.position = waterHit.position;
    surfaceHit.normal = waterHit.normal;
    surfaceHit.distance = waterHit.distance;
    surfaceHit.surfaceType = 0;  // Water surface
    
    // Calculate gradient for water shading
    if (surfaceHit.hit) {
        vec2 gradient;
        surfaceHit.normal = getNormal(surfaceHit.position.xz, time, gradient);
        surfaceHit.gradient = gradient;
    }
    
    // Compose final color
    return composeFinalColor(surfaceHit, ctx);
}

#endif // RENDER_PIPELINE_FRAG

