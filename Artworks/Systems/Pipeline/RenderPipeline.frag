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
//   - WaterShading (primary surface material properties)
//   - TerrainShading (secondary surface material properties)
//   - ObjectShading (object material properties)
//   - SkySystem (atmosphere and lighting)
//
// Note: Scene-specific rendering logic (raymarching, surface detection, etc.)
//       should be implemented in scene files, not in this generic pipeline.
// ============================================================================

#ifndef RENDER_PIPELINE_FRAG
#define RENDER_PIPELINE_FRAG

#include "../CoreSystems/Common.frag"
#include "../MaterialShading/MaterialSystem.frag"
#include "../CoreSystems/CameraSystem.frag"
#include "../CoreSystems/SkySystem.frag"
#include "../MaterialShading/WaterShading.frag"
#include "../MaterialShading/TerrainShading.frag"
#include "../MaterialShading/ObjectShading.frag"

// ============================================================================
// RENDER CONTEXT STRUCTURES
// ============================================================================

// Generic surface type constants (scenes can extend with their own types)
// Base types that work for any scene:
const int SURFACE_NONE = -1;      // No surface hit
const int SURFACE_PRIMARY = 0;    // Main surface
const int SURFACE_SECONDARY = 1;  // Secondary surface
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
// EXTENSION MAPPING CONVENTION:
//   Scene extensions use a clever even/odd convention to map to shading systems:
//   - Even offsets (0, 2, 4, ...) map to secondary surface shading
//   - Odd offsets (1, 3, 5, ...) map to object shading
//
//   This convention allows the system to automatically route surface types to
//   the correct shading system without explicit per-type checks.
//
// Usage:
//   SURFACE_TERRAIN_TYPE(0)  // Creates extension type = 4 (even = secondary surface shading)
//   SURFACE_OBJECT_TYPE(1)   // Creates extension type = 5 (odd = object shading)
//
// Example:
//   const int SURFACE_MY_SECONDARY_VARIANT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);
//   const int SURFACE_MY_OBJECT_VARIANT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(1);
// ============================================================================

// Helper macro: Define secondary surface-type extension (even offset)
// Usage: const int SURFACE_MY_SECONDARY_VARIANT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(offset);
// Note: offset must be even (0, 2, 4, ...) to map to secondary surface shading
#define SURFACE_TERRAIN_TYPE(offset) ((offset) * 2)

// Helper macro: Define object-type surface extension (odd offset)
// Usage: const int SURFACE_MY_OBJECT_VARIANT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(offset);
// Note: offset must be odd (1, 3, 5, ...) to map to object shading
#define SURFACE_OBJECT_TYPE(offset) ((offset) * 2 + 1)

struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // SURFACE_PRIMARY, SURFACE_SECONDARY, SURFACE_OBJECT, SURFACE_VOLUME, or scene-specific extensions
    // Optional primary surface interaction information (for secondary/object surface effects)
    // Scenes should set these when rendering secondary/object surfaces that may interact with primary surfaces
    vec3 waterSurfacePos;  // Primary surface position (default: position if no interaction)
    vec3 waterNormal;      // Primary surface normal (default: vec3(0,1,0) if no interaction)
    float waterDepth;      // Depth below primary surface (0.0 = at surface, >0 = below surface)
    bool isWet;            // Whether surface is wet (near primary surface line)
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
// SURFACE TYPE MAPPING HELPERS
// ============================================================================
// Helper functions to map surface types to shading systems
// These functions encapsulate the surface type extension convention

// Check if surface type uses secondary surface shading
// Includes SURFACE_SECONDARY and even-numbered scene extensions
// Scene extensions use SURFACE_TERRAIN_TYPE() helper macro
bool shouldUseTerrainShading(int surfaceType) {
    // Generic secondary surface type
    if (surfaceType == SURFACE_SECONDARY) {
        return true;
    }
    
    // Scene-specific extensions: even offsets map to secondary surface shading
    if (surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        return (extensionOffset % 2 == 0);  // Even offset = secondary surface variant
    }
    
    return false;
}

// Check if surface type uses object shading
// Includes SURFACE_OBJECT and odd-numbered scene extensions
// Scene extensions use SURFACE_OBJECT_TYPE() helper macro
bool shouldUseObjectShading(int surfaceType) {
    // Generic object type
    if (surfaceType == SURFACE_OBJECT) {
        return true;
    }
    
    // Scene-specific extensions: odd offsets map to object shading
    if (surfaceType >= SURFACE_SCENE_EXTENSION_BASE) {
        int extensionOffset = surfaceType - SURFACE_SCENE_EXTENSION_BASE;
        return (extensionOffset % 2 == 1);  // Odd offset = object variant
    }
    
    return false;
}

// Check if surface type uses primary surface shading
// Includes SURFACE_PRIMARY
bool shouldUsePrimaryShading(int surfaceType) {
    return (surfaceType == SURFACE_PRIMARY);
}

// ============================================================================
// INTEGRATION FUNCTIONS
// ============================================================================
// Note: Refraction and reflection are handled by WaterShading system
// (see calculateRefractedColor() and calculateReflectedColor() in WaterShading.frag)
// RenderPipeline orchestrates the systems but delegates refraction/reflection to WaterShading

// Compose final color from all contributions
// Combines primary surface shading, refraction, reflection, and lighting
vec3 composeFinalColor(SurfaceHit hit, RenderContext ctx) {
    if (!hit.hit) {
        // No hit - return sky color
        return skyColor(ctx.rayDir, ctx.sky, ctx.time);
    }
    
    // Evaluate lighting once (used by all shading systems)
    LightingInfo light = evaluateLighting(ctx.sky, ctx.time);
    vec3 viewDir = -ctx.rayDir;
    
    // Map surface types to shading systems using helper functions
    bool usesTerrainShading = shouldUseTerrainShading(hit.surfaceType);
    bool usesObjectShading = shouldUseObjectShading(hit.surfaceType);
    bool usesPrimaryShading = shouldUsePrimaryShading(hit.surfaceType);
    
    if (usesPrimaryShading) {
        // Primary surface
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
        
        // Shade primary surface using WaterShading system
        WaterShadingResult waterResult = shadeWater(waterParams);
        
        return waterResult.color;
    } else if (usesTerrainShading) {
        // Secondary surface
        // Also handles scene-specific extensions that map to secondary surface shading
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
        
        // Primary surface interaction (pre-computed by scene's rendering function)
        // For scenes without primary surface interaction, these will be set to default values in the scene's render function
        terrainParams.waterSurfacePos = hit.waterSurfacePos;
        terrainParams.waterNormal = hit.waterNormal;
        terrainParams.waterDepth = hit.waterDepth;
        terrainParams.isWet = hit.isWet;
        terrainParams.waterMaterial = ctx.waterMaterial;
        
        // TerrainShading system handles its own primary surface interactions internally
        return shadeTerrain(terrainParams);
    } else if (usesObjectShading) {
        // Object surface
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
        
        // Primary surface interaction (pre-computed by scene's rendering function)
        // For scenes without primary surface interaction, these will be set to default values in the scene's render function
        objectParams.waterSurfacePos = hit.waterSurfacePos;
        objectParams.waterNormal = hit.waterNormal;
        objectParams.waterDepth = hit.waterDepth;
        objectParams.isWet = hit.isWet;
        objectParams.waterMaterial = ctx.waterMaterial;
        
        // ObjectShading system handles its own primary surface interactions internally
        return shadeObject(objectParams);
    }
    
    return vec3(0.0);
}

// Note: Scene-specific rendering functions (like renderScene()) should be implemented
//       in scene files. This file provides only generic composition utilities.

#endif // RENDER_PIPELINE_FRAG

