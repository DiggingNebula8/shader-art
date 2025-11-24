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
//   - ObjectSystem (object geometry)
//   - WaterShading (water material properties, includes translucency via DistanceFieldSystem)
//   - TerrainShading (terrain material properties)
//   - SkySystem (atmosphere and lighting)
//   - VolumeRaymarching (unified raymarching algorithm)
//   - DistanceFieldSystem (distance field queries for translucency and other effects)
//
// Main Function:
//   - renderScene() - Called by Scene.frag to render the entire scene
// ============================================================================

#ifndef RENDER_PIPELINE_FRAG
#define RENDER_PIPELINE_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "CameraSystem.frag"
#include "SkySystem.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"
#include "TerrainSystem.frag"
#include "ObjectSystem.frag"
#include "WaterShading.frag"
#include "TerrainShading.frag"
#include "ObjectShading.frag"

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

// Surface type constants
const int SURFACE_WATER = 0;
const int SURFACE_TERRAIN = 1;
const int SURFACE_OBJECT = 2;

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
    WaterMaterial waterMaterial;  // Water material properties (art-directable)
    TerrainMaterial terrainMaterial;  // Terrain material properties (art-directable)
    ObjectMaterial objectMaterial;  // Object material properties (art-directable)
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
    
    // Evaluate lighting once (used by all shading systems)
    LightingInfo light = evaluateLighting(ctx.sky, ctx.time);
    vec3 viewDir = -ctx.rayDir;
    
    if (hit.surfaceType == SURFACE_WATER) {
        // Water surface
        // Prepare WaterShading parameters
        WaterShadingParams waterParams;
        waterParams.pos = hit.position;
        waterParams.normal = hit.normal;
        waterParams.viewDir = viewDir;
        waterParams.gradient = hit.gradient;
        waterParams.time = ctx.time;
        waterParams.light = light;
        waterParams.sky = ctx.sky;
        waterParams.floorParams = ctx.terrainParams;
        waterParams.material = ctx.waterMaterial;
        
        // Shade water using WaterShading system
        WaterShadingResult waterResult = shadeWater(waterParams);
        
        return waterResult.color;
    } else if (hit.surfaceType == SURFACE_TERRAIN) {
        // Terrain surface (above-water terrain)
        TerrainShadingParams terrainParams;
        terrainParams.pos = hit.position;
        terrainParams.normal = hit.normal;
        terrainParams.viewDir = viewDir;
        terrainParams.time = ctx.time;
        terrainParams.terrainParams = ctx.terrainParams;
        terrainParams.light = light;
        terrainParams.sky = ctx.sky;
        
        // Check if there's water above this terrain position
        float waterHeight = getWaveHeight(hit.position.xz, ctx.time);
        if (hit.position.y < waterHeight) {
            // Terrain is below water (shouldn't happen for above-water terrain, but handle gracefully)
            vec2 gradient;
            vec3 waterNormal = getNormal(hit.position.xz, ctx.time, gradient);
            vec3 waterSurfacePos = vec3(hit.position.x, waterHeight, hit.position.z);
            terrainParams.waterSurfacePos = waterSurfacePos;
            terrainParams.waterNormal = waterNormal;
        } else {
            // Above-water terrain - no water above
            terrainParams.waterSurfacePos = hit.position;
            terrainParams.waterNormal = vec3(0.0, 1.0, 0.0);
        }
        
        terrainParams.material = ctx.terrainMaterial;
        
        return shadeTerrain(terrainParams);
    } else if (hit.surfaceType == SURFACE_OBJECT) {
        // Object surface
        // Prepare ObjectShading parameters
        ObjectShadingParams objectParams;
        objectParams.pos = hit.position;
        objectParams.normal = hit.normal;
        objectParams.viewDir = viewDir;
        objectParams.time = ctx.time;
        objectParams.light = light;
        objectParams.sky = ctx.sky;
        objectParams.material = ctx.objectMaterial;
        
        // Shade object using ObjectShading system
        return shadeObject(objectParams);
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
    // Raymarch all surfaces
    VolumeHit objectHit = raymarchBuoy(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    VolumeHit waterHit = raymarchWaveSurface(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    VolumeHit terrainHit = raymarchTerrain(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time, ctx.terrainParams);
    
    SurfaceHit surfaceHit;
    
    // Determine which surface was hit first (closest)
    // Check all hits and find the closest valid one
    float closestDist = MAX_DIST;
    int closestType = -1;
    
    if (objectHit.hit && objectHit.valid && objectHit.distance < closestDist) {
        closestDist = objectHit.distance;
        closestType = SURFACE_OBJECT;
    }
    if (waterHit.hit && waterHit.valid && waterHit.distance < closestDist) {
        closestDist = waterHit.distance;
        closestType = SURFACE_WATER;
    }
    if (terrainHit.hit && terrainHit.valid && terrainHit.distance < closestDist) {
        // Only consider terrain if it's above water level (above-water terrain)
        float terrainWaterHeight = getWaveHeight(terrainHit.position.xz, ctx.time);
        if (terrainHit.position.y > terrainWaterHeight) {
            closestDist = terrainHit.distance;
            closestType = SURFACE_TERRAIN;
        }
    }
    
    // Set up surface hit based on closest surface
    if (closestType == SURFACE_OBJECT) {
        // Object hit
        surfaceHit.hit = true;
        surfaceHit.position = objectHit.position;
        surfaceHit.distance = objectHit.distance;
        surfaceHit.normal = objectHit.normal;
        surfaceHit.surfaceType = SURFACE_OBJECT;
        surfaceHit.gradient = vec2(0.0);
    } else if (closestType == SURFACE_WATER) {
        // Water surface hit
        surfaceHit.hit = true;
        surfaceHit.position = waterHit.position;
        surfaceHit.distance = waterHit.distance;
        surfaceHit.surfaceType = SURFACE_WATER;
        
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
    } else if (closestType == SURFACE_TERRAIN) {
        // Above-water terrain hit
        surfaceHit.hit = true;
        surfaceHit.position = terrainHit.position;
        surfaceHit.distance = terrainHit.distance;
        surfaceHit.normal = terrainHit.normal;
        surfaceHit.surfaceType = SURFACE_TERRAIN;
        surfaceHit.gradient = vec2(0.0);
    } else {
        // No hit
        surfaceHit.hit = false;
        surfaceHit.position = ctx.cameraPos + ctx.rayDir * MAX_DIST;
        surfaceHit.distance = MAX_DIST;
        surfaceHit.normal = vec3(0.0);
        surfaceHit.gradient = vec2(0.0);
        surfaceHit.surfaceType = SURFACE_WATER; // Default, won't be used
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

