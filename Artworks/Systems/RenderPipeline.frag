// ============================================================================
// RENDER PIPELINE
// ============================================================================
// Generic rendering pipeline utilities
//
// Responsibilities:
//   - Provides integration functions (refraction, reflection, composition)
//   - Coordinates shading and lighting systems
//
// Systems Coordinated:
//   - WaterShading (water material properties)
//   - TerrainShading (terrain material properties)
//   - ObjectShading (object material properties)
//   - SkySystem (atmosphere and lighting)
//
// Note: Scene-specific rendering logic (raymarching, surface detection, etc.)
//       should be implemented in scene files, not in this generic pipeline.
// ============================================================================

#ifndef RENDER_PIPELINE_FRAG
#define RENDER_PIPELINE_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "CameraSystem.frag"
#include "SkySystem.frag"
#include "WaterShading.frag"
#include "TerrainShading.frag"
#include "ObjectShading.frag"
// Note: WaveSystem is included for Ocean scene water surface computation in composeFinalColor
// Other scenes may need to override composeFinalColor or provide their own water surface computation
#include "WaveSystem.frag"

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

// Surface type constants (generic - can be extended by scenes)
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
        
        // Check if there's water above this terrain position (Ocean scene-specific)
        // Note: This uses WaveSystem functions - other scenes may need different logic
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

// Note: Scene-specific rendering functions (like renderScene()) should be implemented
//       in scene files. This file provides only generic composition utilities.

#endif // RENDER_PIPELINE_FRAG

