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
// Note: Refraction and reflection are handled by WaterShading system
// (see calculateRefractedColor() and calculateReflectedColor() in WaterShading.frag)
// RenderPipeline orchestrates the systems but delegates refraction/reflection to WaterShading

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
// Uses ctx.cameraPos, ctx.rayDir, and ctx.time for all ray operations
RenderResult renderScene(RenderContext ctx) {
    // Raymarch to water surface using WaveSystem
    VolumeHit waterHit = raymarchWaveSurface(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    
    SurfaceHit surfaceHit;
    surfaceHit.hit = waterHit.hit && waterHit.valid;
    surfaceHit.position = waterHit.position;
    surfaceHit.distance = waterHit.distance;
    surfaceHit.surfaceType = SURFACE_WATER;  // Water surface
    
    // Calculate normal and gradient for water shading
    // Note: raymarchWaveSurface does NOT compute normal/gradient to avoid redundant computation
    // We compute them here once after position stabilization
    if (surfaceHit.hit) {
        // Stabilize position to reduce jittering
        // Use a small snap grid for XZ to ensure consistent sampling
        // Recalculate Y from the snapped XZ to maintain accuracy
        const float positionSnap = 0.0005;
        vec2 snappedXZ = floor(surfaceHit.position.xz / positionSnap + 0.5) * positionSnap;
        float stableY = getWaveHeight(snappedXZ, ctx.time);
        vec3 stablePos = vec3(snappedXZ.x, stableY, snappedXZ.y);
        
        // Compute normal and gradient from stabilized position (single computation)
        // This is the only place we compute getNormal, avoiding redundant computation
        vec2 gradient;
        surfaceHit.normal = getNormal(stablePos.xz, ctx.time, gradient);
        surfaceHit.gradient = gradient;
        
        // Update position to stabilized version for consistent shading
        surfaceHit.position = stablePos;
    } else {
        // No hit - set defaults
        surfaceHit.normal = vec3(0.0);
        surfaceHit.gradient = vec2(0.0);
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

