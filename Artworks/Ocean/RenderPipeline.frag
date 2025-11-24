// ============================================================================
// RENDER PIPELINE
// ============================================================================
// Scene.frag calls renderScene() from this file
//
// Responsibilities:
//   - Orchestrates all rendering systems
//   - Provides integration functions (refraction, reflection, composition)
//   - Coordinates geometry, shading, and lighting systems
//
// Systems Coordinated:
//   - WaveSystem (wave geometry)
//   - TerrainSystem (terrain geometry)
//   - WaterShading (water material properties)
//   - TerrainShading (terrain material properties)
//   - SkySystem (atmosphere and lighting)
//   - VolumeRaymarching (unified raymarching algorithm)
//
// Main Function:
//   - renderScene() - Called by Scene.frag to render the entire scene
// ============================================================================

#ifndef RENDER_PIPELINE_FRAG
#define RENDER_PIPELINE_FRAG

#include "Common.frag"
#include "CameraSystem.frag"
#include "SkySystem.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"
#include "TerrainSystem.frag"
#include "WaterShading.frag"
#include "TerrainShading.frag"

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

// Surface type constants
const int SURFACE_WATER = 0;
const int SURFACE_TERRAIN = 1;

struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // SURFACE_WATER, SURFACE_TERRAIN, etc.
};

struct RenderResult {
    vec3 color;        // Final rendered color
    bool hit;          // Whether a surface was hit
    vec3 hitPosition;  // Hit position (for fog calculation)
    float distance;    // Ray distance (for DOF and fog)
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
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedDir = refractRay(-viewDir, normal, eta);
    
    // Calculate water depth info
    WaterDepthInfo depthInfo = calculateWaterDepthAndColor(pos, normal, viewDir, ctx.terrainParams);
    
    vec3 baseAbsorption = exp(-waterAbsorption * depthInfo.depth);
    vec3 refractedColor = depthInfo.waterColor * baseAbsorption;
    float translucencyFactor = 1.0 - smoothstep(3.0, 25.0, depthInfo.depth);
    
    if (dot(refractedDir, normal) < 0.0 && translucencyFactor > 0.01) {
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
// Note: This helper is currently unused; shadeWater() handles reflection internally
vec3 calculateReflection(vec3 pos, vec3 normal, vec3 viewDir, vec2 gradient, RenderContext ctx) {
    // Use WaterShading's reflection calculation
    // Pass -1.0 for roughness to compute it internally
    return calculateReflectedColor(pos, normal, viewDir, ctx.time, gradient, ctx.sky, -1.0);
}

// Compose final color from all contributions
// Combines water shading, refraction, reflection, and lighting
vec3 composeFinalColor(SurfaceHit hit, RenderContext ctx) {
    if (!hit.hit) {
        // No hit - return sky color
        return skyColor(ctx.rayDir, ctx.sky, ctx.time);
    }
    
    if (hit.surfaceType == SURFACE_WATER) {
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
    } else if (hit.surfaceType == SURFACE_TERRAIN) {
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
// Called by Scene.frag (the actual shader entry point)
// Orchestrates all systems to render the complete scene
// ============================================================================

// Main scene rendering function
// Raymarches to find surface, then shades it
// Returns both color and hit data to avoid duplicate raymarching
// Uses ctx.cameraPos and ctx.rayDir for all ray operations
RenderResult renderScene(float time, RenderContext ctx) {
    // Raymarch to water surface using WaveSystem
    // Use ctx.time consistently to avoid divergence if time parameter differs
    VolumeHit waterHit = raymarchWaveSurface(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    
    SurfaceHit surfaceHit;
    surfaceHit.hit = waterHit.hit && waterHit.valid;
    surfaceHit.position = waterHit.position;
    surfaceHit.normal = waterHit.normal;
    surfaceHit.distance = waterHit.distance;
    surfaceHit.surfaceType = SURFACE_WATER;  // Water surface
    
    // Calculate gradient for water shading
    if (surfaceHit.hit) {
        // Stabilize position to reduce jittering
        // Use a small snap grid for XZ to ensure consistent sampling
        // Recalculate Y from the snapped XZ to maintain accuracy
        const float positionSnap = 0.0005;
        vec2 snappedXZ = floor(surfaceHit.position.xz / positionSnap + 0.5) * positionSnap;
        float stableY = getWaveHeight(snappedXZ, ctx.time);
        vec3 stablePos = vec3(snappedXZ.x, stableY, snappedXZ.y);
        
        // Calculate normal using stabilized position
        vec2 gradient;
        surfaceHit.normal = getNormal(stablePos.xz, ctx.time, gradient);
        surfaceHit.gradient = gradient;
        
        // Update position to stabilized version for consistent shading
        surfaceHit.position = stablePos;
    }
    
    // Compose final color (uses ctx.rayDir for shading calculations)
    vec3 color = composeFinalColor(surfaceHit, ctx);
    
    // Return both color and hit data
    RenderResult result;
    result.color = color;
    result.hit = surfaceHit.hit;
    result.hitPosition = surfaceHit.position;
    result.distance = surfaceHit.distance;
    
    return result;
}

#endif // RENDER_PIPELINE_FRAG

