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
// Use helper macros below to define scene-specific surface types safely
const int SURFACE_SCENE_EXTENSION_BASE = 4;

// ============================================================================
// SURFACE TYPE EXTENSION HELPERS
// ============================================================================
// Use these macros to define scene-specific surface types safely
// They ensure correct mapping to shading systems
//
// Usage:
//   SURFACE_TERRAIN_TYPE(0)  // Defines SURFACE_UNDERWATER_TERRAIN = 4 (even = terrain)
//   SURFACE_OBJECT_TYPE(1)   // Defines SURFACE_UNDERWATER_OBJECT = 5 (odd = object)
//
// Example:
//   const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);
//   const int SURFACE_UNDERWATER_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(1);
// ============================================================================

// Helper macro: Define terrain-type surface extension (even offset)
// Usage: const int SURFACE_MY_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(offset);
// Note: offset must be even (0, 2, 4, ...) to map to terrain shading
#define SURFACE_TERRAIN_TYPE(offset) ((offset) * 2)

// Helper macro: Define object-type surface extension (odd offset)
// Usage: const int SURFACE_MY_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(offset);
// Note: offset must be odd (1, 3, 5, ...) to map to object shading
#define SURFACE_OBJECT_TYPE(offset) ((offset) * 2 + 1)

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
    // Scene-specific extensions (>= SURFACE_SCENE_EXTENSION_BASE) use helper macros:
    //   - SURFACE_TERRAIN_TYPE(offset) creates even offsets → terrain shading
    //   - SURFACE_OBJECT_TYPE(offset) creates odd offsets → object shading
    
    // Helper: Check if surface type uses terrain shading
    // Includes SURFACE_SECONDARY and even-numbered scene extensions
    bool usesTerrainShading = (hit.surfaceType == SURFACE_SECONDARY || hit.surfaceType == SURFACE_TERRAIN);
    if (hit.surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = hit.surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        if (extensionOffset % 2 == 0) {  // Even offset = terrain variant (from SURFACE_TERRAIN_TYPE)
            usesTerrainShading = true;
        }
    }
    
    // Helper: Check if surface type uses object shading  
    // Includes SURFACE_OBJECT and odd-numbered scene extensions
    bool usesObjectShading = (hit.surfaceType == SURFACE_OBJECT);
    if (hit.surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = hit.surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        if (extensionOffset % 2 == 1) {  // Odd offset = object variant (from SURFACE_OBJECT_TYPE)
            usesObjectShading = true;
        }
    }
    
    if (hit.surfaceType == SURFACE_PRIMARY || hit.surfaceType == SURFACE_WATER) {
        // Primary surface (typically water for Ocean scene, but can be any main surface)
        WaterShadingParams waterParams;
        
        // Core fields
        waterParams.pos = hit.position;
        waterParams.normal = hit.normal;
        waterParams.viewDir = viewDir;
        waterParams.gradient = hit.gradient;
        waterParams.time = ctx.time;
        
        // System configuration
        waterParams.floorParams = ctx.terrainParams;
        
        // Lighting
        waterParams.light = light;
        waterParams.sky = ctx.sky;
        
        // Material
        waterParams.material = ctx.waterMaterial;
        
        // Shade water using WaterShading system
        WaterShadingResult waterResult = shadeWater(waterParams);
        
        return waterResult.color;
    } else if (usesTerrainShading) {
        // Secondary surface (typically terrain for Ocean scene, but can be any secondary surface)
        // Also handles scene-specific extensions that map to terrain (e.g., underwater terrain)
        TerrainShadingParams terrainParams;
        
        // Core fields
        terrainParams.pos = hit.position;
        terrainParams.normal = hit.normal;
        terrainParams.viewDir = viewDir;
        terrainParams.time = ctx.time;
        
        // System configuration
        terrainParams.terrainParams = ctx.terrainParams;
        
        // Lighting
        terrainParams.light = light;
        terrainParams.sky = ctx.sky;
        
        // Material
        terrainParams.material = ctx.terrainMaterial;
        
        // Water interaction (pre-computed by scene's rendering function)
        // For scenes without water, these will be set to default values in the scene's render function
        terrainParams.waterSurfacePos = hit.waterSurfacePos;
        terrainParams.waterNormal = hit.waterNormal;
        terrainParams.waterDepth = hit.waterDepth;
        terrainParams.isWet = hit.isWet;
        terrainParams.waterMaterial = ctx.waterMaterial;
        
        // TerrainShading system handles its own water interactions internally
        return shadeTerrain(terrainParams);
    } else if (usesObjectShading) {
        // Object surface (above-water or underwater)
        ObjectShadingParams objectParams;
        
        // Core fields
        objectParams.pos = hit.position;
        objectParams.normal = hit.normal;
        objectParams.viewDir = viewDir;
        objectParams.time = ctx.time;
        
        // System configuration (none - objects don't have system-level config)
        
        // Lighting
        objectParams.light = light;
        objectParams.sky = ctx.sky;
        
        // Material
        objectParams.material = ctx.objectMaterial;
        
        // Water interaction (pre-computed by scene's rendering function)
        // For scenes without water, these will be set to default values in the scene's render function
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

