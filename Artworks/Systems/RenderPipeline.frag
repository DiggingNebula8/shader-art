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

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

// Surface type constants (generic - can be extended by scenes)
const int SURFACE_WATER = 0;
const int SURFACE_TERRAIN = 1;
const int SURFACE_OBJECT = 2;
const int SURFACE_UNDERWATER_TERRAIN = 3;  // Terrain below water surface
const int SURFACE_UNDERWATER_OBJECT = 4;   // Object below water surface

struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // SURFACE_WATER, SURFACE_TERRAIN, etc.
    // Optional water surface information (for terrain caustics and wet surfaces)
    // Scenes should set these when rendering terrain/objects that may have water above them
    vec3 waterSurfacePos;  // Water surface position (default: position if no water)
    vec3 waterNormal;      // Water surface normal (default: vec3(0,1,0) if no water)
    float waterDepth;      // Depth below water surface (0.0 = at surface, >0 = underwater)
    bool isWet;            // Whether surface is wet (near water line)
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
    } else if (hit.surfaceType == SURFACE_TERRAIN || hit.surfaceType == SURFACE_UNDERWATER_TERRAIN) {
        // Terrain surface (above-water or underwater)
        TerrainShadingParams terrainParams;
        terrainParams.pos = hit.position;
        terrainParams.normal = hit.normal;
        terrainParams.viewDir = viewDir;
        terrainParams.time = ctx.time;
        terrainParams.terrainParams = ctx.terrainParams;
        terrainParams.light = light;
        terrainParams.sky = ctx.sky;
        
        // Water surface information is pre-computed by the scene's rendering function
        // and passed via SurfaceHit. For scenes without water, these will be set to
        // default values (no water above terrain) in the scene's render function.
        terrainParams.waterSurfacePos = hit.waterSurfacePos;
        terrainParams.waterNormal = hit.waterNormal;
        terrainParams.waterDepth = hit.waterDepth;
        terrainParams.isWet = hit.isWet;
        terrainParams.waterMaterial = ctx.waterMaterial;
        
        terrainParams.material = ctx.terrainMaterial;
        
        // TerrainShading system handles its own water interactions internally
        return shadeTerrain(terrainParams);
    } else if (hit.surfaceType == SURFACE_OBJECT || hit.surfaceType == SURFACE_UNDERWATER_OBJECT) {
        // Object surface (above-water or underwater)
        // Prepare ObjectShading parameters
        ObjectShadingParams objectParams;
        objectParams.pos = hit.position;
        objectParams.normal = hit.normal;
        objectParams.viewDir = viewDir;
        objectParams.time = ctx.time;
        objectParams.light = light;
        objectParams.sky = ctx.sky;
        objectParams.material = ctx.objectMaterial;
        objectParams.waterSurfacePos = hit.waterSurfacePos;
        objectParams.waterNormal = hit.waterNormal;
        objectParams.waterDepth = hit.waterDepth;
        objectParams.isWet = hit.isWet;
        objectParams.waterMaterial = ctx.waterMaterial;
        
        // ObjectShading system handles its own water interactions internally
        return shadeObject(objectParams);
    }
    
    return vec3(0.0);
}

// Note: Scene-specific rendering functions (like renderScene()) should be implemented
//       in scene files. This file provides only generic composition utilities.

#endif // RENDER_PIPELINE_FRAG

