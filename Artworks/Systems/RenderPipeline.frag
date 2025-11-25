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

// Generic surface type constants (scenes can extend with their own types)
// Base types that work for any scene:
const int SURFACE_PRIMARY = 0;    // Main surface (water, ground, floor, etc.)
const int SURFACE_SECONDARY = 1;  // Secondary surface (terrain, floor, etc.)
const int SURFACE_OBJECT = 2;     // Interactive objects
const int SURFACE_VOLUME = 3;     // Volumetric surfaces

// Scene extension base - scenes can define additional types starting from here
// Example: const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + 0;  // Ocean-specific
const int SURFACE_SCENE_EXTENSION_BASE = 4;

// Backward compatibility: Map old Ocean-specific names to generic types
// (Scenes can override these by defining them before including RenderPipeline)
// Note: In GLSL, redefining a const int with the same value is allowed, but different values will cause an error
const int SURFACE_WATER = SURFACE_PRIMARY;
const int SURFACE_TERRAIN = SURFACE_SECONDARY;
// Note: SURFACE_UNDERWATER_TERRAIN and SURFACE_UNDERWATER_OBJECT should be defined by scenes that need them
// They are not defined here as defaults to avoid forcing underwater types on scenes that don't need them

struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // SURFACE_PRIMARY, SURFACE_SECONDARY, SURFACE_OBJECT, SURFACE_VOLUME, or scene-specific extensions
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
    
    // Map surface types to shading systems
    // Generic types: SURFACE_PRIMARY, SURFACE_SECONDARY, SURFACE_OBJECT, SURFACE_VOLUME
    // Scene-specific extensions (>= SURFACE_SCENE_EXTENSION_BASE) are handled generically:
    //   - Even offsets from SURFACE_SCENE_EXTENSION_BASE map to terrain shading
    //   - Odd offsets from SURFACE_SCENE_EXTENSION_BASE map to object shading
    //   This convention allows scenes to define extensions without modifying RenderPipeline
    
    // Helper: Check if surface type uses terrain shading
    // Includes SURFACE_SECONDARY and even-numbered scene extensions (e.g., SURFACE_UNDERWATER_TERRAIN = 4)
    bool usesTerrainShading = (hit.surfaceType == SURFACE_SECONDARY || hit.surfaceType == SURFACE_TERRAIN);
    if (hit.surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = hit.surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        if (extensionOffset % 2 == 0) {  // Even offset = terrain variant
            usesTerrainShading = true;
        }
    }
    
    // Helper: Check if surface type uses object shading  
    // Includes SURFACE_OBJECT and odd-numbered scene extensions (e.g., SURFACE_UNDERWATER_OBJECT = 5)
    bool usesObjectShading = (hit.surfaceType == SURFACE_OBJECT);
    if (hit.surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = hit.surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        if (extensionOffset % 2 == 1) {  // Odd offset = object variant
            usesObjectShading = true;
        }
    }
    
    if (hit.surfaceType == SURFACE_PRIMARY || hit.surfaceType == SURFACE_WATER) {
        // Primary surface (typically water for Ocean scene, but can be any main surface)
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
    } else if (usesTerrainShading) {
        // Secondary surface (typically terrain for Ocean scene, but can be any secondary surface)
        // Also handles scene-specific extensions that map to terrain (e.g., underwater terrain)
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
    } else if (usesObjectShading) {
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

