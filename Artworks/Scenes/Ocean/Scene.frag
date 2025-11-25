// ============================================================================
// OCEAN SCENE - SHADER ENTRY POINT
// ============================================================================
// This is the ACTUAL entry point for the shader (contains mainImage())
// 
// Architecture:
//   Scene.frag (THIS FILE)
//     ├─ mainImage() - Shader entry point (called by Shadertoy/GLSL runtime)
//     ├─ Camera setup and configuration
//     ├─ Calls RenderPipeline.renderScene() - Core rendering logic
//     └─ Post-processing (fog, exposure, DOF, tone mapping, gamma)
//
//   RenderPipeline.frag
//     ├─ renderScene() - Orchestrates all rendering systems
//     └─ composeFinalColor() - Combines all contributions
//
//   Systems (called by RenderPipeline):
//     ├─ WaveSystem - Wave geometry
//     ├─ TerrainSystem - Terrain geometry
//     ├─ WaterShading - Water material properties
//     ├─ TerrainShading - Terrain material properties
//     └─ SkySystem - Atmosphere and lighting
// ============================================================================

#include "../../Systems/Common.frag"
#include "../../Systems/MaterialSystem.frag"
#include "../../Systems/CameraSystem.frag"
#include "../../Systems/WaveSystem.frag"
#include "../../Systems/TerrainSystem.frag"
#include "../../Systems/ObjectSystem.frag"
#include "../../Systems/DistanceFieldSystem.frag"
#include "../../Systems/VolumeRaymarching.frag"

// ============================================================================
// OCEAN SCENE-SPECIFIC DEFINITIONS
// ============================================================================
// These functions define the Ocean scene geometry and are scene-specific
// Must be defined before including WaterShading.frag (which uses getDistanceToSurface)
// ============================================================================

// ============================================================================
// BUOY OBJECT (Ocean Scene-Specific)
// ============================================================================

// Create a buoy object at position (0, 0, 0) with optional animation
float getBuoySDF(vec3 p, float time) {
    // Buoy floats on water, so we need to account for wave height
    // Position buoy at origin, floating on water surface
    vec2 buoyBasePos = vec2(0.0, 0.0);
    float waterHeight = getWaveHeight(buoyBasePos, time);
    
    // Offset by water height so buoy sits on water
    p.y -= waterHeight;
    
    // Main cylindrical body (scaled up ~2.5x)
    vec3 bodyP = p;
    bodyP.y += 0.75; // Center the body
    float body = sdCylinder(bodyP, 0.75, 0.375);
    
    // Top sphere (navigation marker)
    vec3 topP = p;
    topP.y += 1.75;
    float top = sdSphere(topP, 0.3);
    
    // Small flag pole
    vec3 poleP = p;
    poleP.y += 2.125;
    float pole = sdCylinder(poleP, 0.375, 0.025);
    
    // Small flag (simplified as a box)
    vec3 flagP = p;
    flagP.y += 2.5;
    flagP.x += 0.125; // Offset flag to one side
    float flag = sdBox(flagP, vec3(0.2, 0.125, 0.025));
    
    // Combine all parts
    float buoy = opSmoothUnion(body, top, 0.125);
    buoy = opUnion(buoy, pole);
    buoy = opUnion(buoy, flag);
    
    return buoy;
}

// Get buoy normal using finite differences
vec3 getBuoyNormal(vec3 pos, float time) {
    const float eps = 0.001;  // Smaller epsilon for better accuracy
    float d = getBuoySDF(pos, time);
    vec3 n = vec3(
        getBuoySDF(pos + vec3(eps, 0.0, 0.0), time) - d,
        getBuoySDF(pos + vec3(0.0, eps, 0.0), time) - d,
        getBuoySDF(pos + vec3(0.0, 0.0, eps), time) - d
    );
    return normalize(n);
}

// Raymarch to buoy object
VolumeHit raymarchBuoy(vec3 start, vec3 dir, float maxDist, float time) {
    // Define SDF function macro
    #define getSDF(pos, t) getBuoySDF(pos, t)
    
    // Use raymarching algorithm macro
    VolumeHit hit;
    RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);
    
    // Calculate normal using system-specific function
    if (hit.hit && hit.valid) {
        hit.normal = getBuoyNormal(hit.position, time);
    }
    
    #undef getSDF
    return hit;
}

// ============================================================================
// SCENE SDF DEFINITIONS (Ocean Scene-Specific)
// ============================================================================

// Forward declaration for macro expansion (helps linters/compilers)
float getSceneSDF(vec3 pos, float time, TerrainParams terrainParams);

// Unified scene SDF - combines terrain and objects into a single distance field
float getSceneSDF(vec3 pos, float time, TerrainParams terrainParams) {
    // Get terrain distance
    float terrainDist = getTerrainSDF(pos, terrainParams);
    
    // Get object distance
    float objectDist = getBuoySDF(pos, time);
    
    // Use smooth minimum for better blending between surfaces
    const float smoothK = 2.0;
    return smoothMinSDF(terrainDist, objectDist, smoothK);
}

// Scene normal function for more accurate surface queries
vec3 getSceneNormal(vec3 pos, float time, TerrainParams terrainParams) {
    float terrainDist = getTerrainSDF(pos, terrainParams);
    float objectDist = getBuoySDF(pos, time);
    
    // Return normal of closest surface (choose based on actual distance, not abs)
    if (terrainDist < objectDist) {
        return getTerrainNormal(pos, terrainParams);
    } else {
        return getBuoyNormal(pos, time);
    }
}

// ============================================================================
// DISTANCE FIELD API FUNCTIONS (Ocean Scene-Specific)
// ============================================================================
// These functions provide a complete API for distance field queries
// They use getSceneSDF and getSceneNormal defined above
// ============================================================================

// Get distance to nearest surface along a ray
// Uses the unified scene SDF
float getDistanceToSurface(vec3 start, vec3 dir, float maxDist, TerrainParams terrainParams, float time) {
    #define getSDF(pos, t) getSceneSDF(pos, t, terrainParams)
    float dist;
    DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist);
    #undef getSDF
    return dist;
}

// Get distance field information at a point
DistanceFieldInfo getDistanceFieldInfo(vec3 pos, TerrainParams terrainParams, float time) {
    DistanceFieldInfo info;
    
    float dist = getSceneSDF(pos, time, terrainParams);
    info.distance = dist;
    
    // Use getSceneNormal for accurate surface position
    vec3 normal = getSceneNormal(pos, time, terrainParams);
    info.surfacePos = pos - normal * dist;
    
    return info;
}

// Get depth along a direction
float getDepthAlongDirection(vec3 start, vec3 dir, float maxDepth, TerrainParams terrainParams, float time) {
    return getDistanceToSurface(start, dir, maxDepth, terrainParams, time);
}

// ============================================================================
// MACRO DEFINITIONS FOR SHADING SYSTEMS
// ============================================================================
// Ocean scene provides macro implementations for shading systems to enable
// dependency injection and avoid tight coupling.
//
// These macros MUST be defined before including the corresponding shading systems.
// ============================================================================

// WaterShading macros:
//   WATER_SHADING_GET_SDF - Scene SDF for translucency calculation
//   WATER_TERRAIN_HEIGHT - Terrain height for water depth calculation
#define WATER_SHADING_GET_SDF(pos, t, params) getSceneSDF(pos, t, params)
#define WATER_TERRAIN_HEIGHT(pos, params) getTerrainHeight(pos, params)

// TerrainShading macros:
//   TERRAIN_WAVE_HEIGHT - Wave height for caustics calculation
//   TERRAIN_WAVE_GRADIENT - Wave gradient for caustics focus calculation
#define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
#define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)

// Now include shading systems (they can use the distance field functions and macros defined above)
#include "../../Systems/WaterShading.frag"
#include "../../Systems/TerrainShading.frag"
#include "../../Systems/ObjectShading.frag"
#include "../../Systems/SkySystem.frag"
#include "../../Systems/RenderPipeline.frag"

// ============================================================================
// OCEAN SCENE-SPECIFIC SURFACE TYPES
// ============================================================================
// Ocean scene extends generic surface types with underwater variants
// 
// Generic surface type mappings for Ocean scene:
//   SURFACE_PRIMARY = water surface
//   SURFACE_SECONDARY = terrain surface
//   SURFACE_OBJECT = object surface
//
// Ocean-specific extensions using helper macros from RenderPipeline:
const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);  // Terrain below water surface
const int SURFACE_UNDERWATER_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(0);    // Object below water surface

// Wet surface detection threshold (units from water surface)
const float WET_SURFACE_THRESHOLD = 1.5;

// ============================================================================
// OCEAN SCENE RENDERING FUNCTION
// ============================================================================
// Ocean-specific rendering logic that orchestrates all systems
// This replaces the generic renderScene() from RenderPipeline for Ocean scene
// Note: Generic surface types are defined in RenderPipeline.frag
//       Ocean-specific underwater types are defined above
// ============================================================================

// Ocean scene rendering function
RenderResult renderOceanScene(RenderContext ctx) {
    // Optimized raymarching: ray march surfaces in order of likely visibility
    // Water is most likely to be hit first, so check it first for early exit optimization
    
    VolumeHit waterHit = raymarchWaveSurface(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    
    // Early exit optimization: if water is very close, skip other surfaces
    // (they won't be visible behind water)
    float earlyExitThreshold = 5.0; // Skip other surfaces if water is within 5 units
    bool skipOtherSurfaces = waterHit.hit && waterHit.valid && waterHit.distance < earlyExitThreshold;
    
    VolumeHit objectHit;
    VolumeHit terrainHit;
    
    if (!skipOtherSurfaces) {
        // Only raymarch other surfaces if water is not blocking them
        objectHit = raymarchBuoy(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
        terrainHit = raymarchTerrain(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time, ctx.terrainParams);
    } else {
        // Initialize with no-hit values
        objectHit.hit = false;
        objectHit.valid = false;
        objectHit.distance = MAX_DIST;
        terrainHit.hit = false;
        terrainHit.valid = false;
        terrainHit.distance = MAX_DIST;
    }
    
    SurfaceHit surfaceHit;
    
    // Determine which surface was hit first (closest)
    // Check all hits and find the closest valid one
    float closestDist = MAX_DIST;
    int closestType = SURFACE_NONE;
    
    // Helper function to check if position is underwater and compute water info
    // Returns: (isUnderwater, waterHeight, waterNormal, waterSurfacePos)
    // This is computed once per surface type for efficiency
    
    // Check object hit
    if (objectHit.hit && objectHit.valid && objectHit.distance < closestDist) {
        float objectWaterHeight = getWaveHeight(objectHit.position.xz, ctx.time);
        bool objectUnderwater = objectHit.position.y < objectWaterHeight;
        
        if (!objectUnderwater || waterHit.distance > objectHit.distance) {
            // Object is above water, or object is closer than water surface
            closestDist = objectHit.distance;
            closestType = objectUnderwater ? SURFACE_UNDERWATER_OBJECT : SURFACE_OBJECT;
        }
    }
    
    // Check water hit
    if (waterHit.hit && waterHit.valid && waterHit.distance < closestDist) {
        closestDist = waterHit.distance;
        closestType = SURFACE_PRIMARY;  // Primary surface = water in Ocean scene
    }
    
    // Check terrain hit
    if (terrainHit.hit && terrainHit.valid && terrainHit.distance < closestDist) {
        float terrainWaterHeight = getWaveHeight(terrainHit.position.xz, ctx.time);
        bool terrainUnderwater = terrainHit.position.y < terrainWaterHeight;
        
        // Consider terrain if it's above water, or if it's underwater and closer than water surface
        if (!terrainUnderwater || waterHit.distance > terrainHit.distance) {
            closestDist = terrainHit.distance;
            closestType = terrainUnderwater ? SURFACE_UNDERWATER_TERRAIN : SURFACE_SECONDARY;  // Secondary surface = terrain in Ocean scene
        }
    }
    
    // Set up surface hit based on closest surface
    if (closestType == SURFACE_OBJECT || closestType == SURFACE_UNDERWATER_OBJECT) {
        // Object hit (above or below water)
        surfaceHit.hit = true;
        surfaceHit.position = objectHit.position;
        surfaceHit.distance = objectHit.distance;
        surfaceHit.normal = objectHit.normal;
        surfaceHit.surfaceType = closestType;
        surfaceHit.gradient = vec2(0.0);
        
        // Compute water surface info for wet/underwater effects
        float waterHeight = getWaveHeight(objectHit.position.xz, ctx.time);
        vec2 gradient;
        vec3 waterNormal = getNormal(objectHit.position.xz, ctx.time, gradient);
        vec3 waterSurfacePos = vec3(objectHit.position.x, waterHeight, objectHit.position.z);
        float waterDepth = max(waterHeight - objectHit.position.y, 0.0);
        
        // Check if surface is wet (near water line)
        float distToWater = abs(objectHit.position.y - waterHeight);
        bool isWet = distToWater < WET_SURFACE_THRESHOLD;
        
        surfaceHit.waterSurfacePos = waterSurfacePos;
        surfaceHit.waterNormal = waterNormal;
        surfaceHit.waterDepth = waterDepth;
        surfaceHit.isWet = isWet;
    } else if (closestType == SURFACE_PRIMARY) {
        // Water surface hit (primary surface in Ocean scene)
        surfaceHit.hit = true;
        surfaceHit.position = waterHit.position;
        surfaceHit.distance = waterHit.distance;
        surfaceHit.surfaceType = SURFACE_PRIMARY;
        
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
        // Water surface info is the same as the hit position for water surfaces
        surfaceHit.waterSurfacePos = stablePos;
        surfaceHit.waterNormal = surfaceHit.normal;
        surfaceHit.waterDepth = 0.0; // At water surface
        surfaceHit.isWet = false; // Water surface itself is not "wet"
    } else if (closestType == SURFACE_SECONDARY || closestType == SURFACE_UNDERWATER_TERRAIN) {
        // Terrain hit (above or below water) - secondary surface in Ocean scene
        surfaceHit.hit = true;
        surfaceHit.position = terrainHit.position;
        surfaceHit.distance = terrainHit.distance;
        surfaceHit.normal = terrainHit.normal;
        surfaceHit.surfaceType = closestType;
        surfaceHit.gradient = vec2(0.0);
        
        // Compute water surface information for caustics and wet/underwater effects
        float waterHeight = getWaveHeight(terrainHit.position.xz, ctx.time);
        vec2 gradient;
        vec3 waterNormal = getNormal(terrainHit.position.xz, ctx.time, gradient);
        vec3 waterSurfacePos = vec3(terrainHit.position.x, waterHeight, terrainHit.position.z);
        float waterDepth = max(waterHeight - terrainHit.position.y, 0.0);
        
        // Check if surface is wet (near water line)
        float distToWater = abs(terrainHit.position.y - waterHeight);
        bool isWet = distToWater < WET_SURFACE_THRESHOLD;
        
        surfaceHit.waterSurfacePos = waterSurfacePos;
        surfaceHit.waterNormal = waterNormal;
        surfaceHit.waterDepth = waterDepth;
        surfaceHit.isWet = isWet;
    } else {
        // No hit
        surfaceHit.hit = false;
        surfaceHit.position = ctx.cameraPos + ctx.rayDir * MAX_DIST;
        surfaceHit.distance = MAX_DIST;
        surfaceHit.normal = vec3(0.0);
        surfaceHit.gradient = vec2(0.0);
        surfaceHit.surfaceType = SURFACE_NONE;
        surfaceHit.waterSurfacePos = vec3(0.0);
        surfaceHit.waterNormal = vec3(0.0, 1.0, 0.0);
        surfaceHit.waterDepth = 0.0;
        surfaceHit.isWet = false;
    }
    
    // Compose final color (uses ctx.rayDir for shading calculations)
    // Note: composeFinalColor will compute water surface info for terrain if needed
    // (Ocean-specific logic is handled in composeFinalColor via WaveSystem includes)
    vec3 color = composeFinalColor(surfaceHit, ctx);
    
    // Return both color and hit data
    RenderResult result;
    result.color = color;
    result.hit = surfaceHit.hit;
    result.hitPosition = surfaceHit.position;
    result.distance = surfaceHit.distance;
    
    return result;
}

// ============================================================================
// TONE MAPPING
// ============================================================================

// Reinhard-Jodie tone mapping
// Blends luminance-based and per-channel Reinhard approaches to balance color accuracy
// and dynamic range compression. Formula: mix(color/(1+L), color/(1+color), color/(1+color))
vec3 toneMapReinhardJodie(vec3 color) {
    // Calculate luminance
    float L = dot(color, vec3(0.2126, 0.7152, 0.0722));
    
    // Luminance-based Reinhard: applies tone mapping uniformly based on luminance
    vec3 luminanceBased = color / (1.0 + L);
    
    // Per-channel Reinhard: applies tone mapping independently to each channel
    vec3 perChannel = color / (1.0 + color);
    
    // Mix factor: use per-channel result as the blend factor (per-channel mixing)
    // This blends between luminance-based (preserves color relationships) and
    // per-channel (preserves saturation) approaches
    vec3 mixFactor = perChannel;
    vec3 result = mix(luminanceBased, perChannel, mixFactor);
    
    return clamp(result, 0.0, 1.0);
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Create and configure camera
    Camera cam = createDefaultCamera();
    
    // Camera position and orientation - Wide angle view showing ocean and sky
    // Lower camera position and angle up to capture more sky
    cam.position = vec3(0.0, 2.5, 6.0);  // Lower and closer for wide view
    cam.target = vec3(0.0, 0.5, 0.0);     // Look slightly up to see sky
    cam.up = vec3(0.0, 1.0, 0.0);
    
    // Camera settings - Wide angle lens to capture expansive view
    // Wide angle lens (20mm) for dramatic wide view showing ocean and sky
    cam.focalLength = 20.0;        // 20mm wide angle lens (very wide field of view)
    cam.fStop = 2.8;               // f/2.8 aperture
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100
    
    // Depth of field (optional - disable for performance)
    cam.focusDistance = 10.0;
    cam.enableDOF = true; // Set to true for depth of field effect
    
    // Generate camera ray using proper FOV calculation
    // UV coordinates in [0, 1] range
    vec2 uv = fragCoord / iResolution.xy;
    
    // Create sky and terrain configuration
    SkyAtmosphere sky = createSkyPreset_Stormy();
    TerrainParams terrainParams = createPlainsTerrain();
    
    // Create water material (art-directable - can be tweaked without recompilation)
    WaterMaterial waterMaterial = createClearTropicalWater();
    // Example: Uncomment to use different water presets
    // waterMaterial = createClearTropicalWater();
    //waterMaterial = createMurkyWater();
    // waterMaterial = createChoppyWater();
    
    // Create terrain material (art-directable - can be tweaked without recompilation)
    TerrainMaterial terrainMaterial = createDefaultTerrainMaterial();
    // Example: Uncomment to use different terrain presets
    // terrainMaterial = createSandyTerrainMaterial();
    // terrainMaterial = createRockyTerrainMaterial();
    
    // Create object material (art-directable - can be tweaked without recompilation)
    ObjectMaterial objectMaterial = createDefaultObjectMaterial();
    // Example: Uncomment to use different object presets
    // objectMaterial = createWhiteObjectMaterial();
    
    // Create render context
    RenderContext ctx;
    ctx.cameraPos = cam.position;
    ctx.rayDir = generateCameraRay(cam, uv, iResolution.xy);
    ctx.time = iTime;
    ctx.sky = sky;
    ctx.terrainParams = terrainParams;
    ctx.camera = cam;
    ctx.waterMaterial = waterMaterial;
    ctx.terrainMaterial = terrainMaterial;
    ctx.objectMaterial = objectMaterial;
    
    // Render Ocean scene using Ocean-specific rendering function
    // Returns both color and hit data (avoids duplicate raymarching)
    RenderResult renderResult = renderOceanScene(ctx);
    vec3 color = renderResult.color;
    
    // Use hit data from renderScene() instead of re-raymarching
    float distance = renderResult.hit ? renderResult.distance : MAX_DIST;
    vec3 hitPos = renderResult.hit ? renderResult.hitPosition : (ctx.cameraPos + ctx.rayDir * MAX_DIST);
    
    // Apply atmospheric fog/haze using the SkyAtmosphere system
    color = applyAtmosphericFog(color, hitPos, ctx.cameraPos, ctx.rayDir, sky, ctx.time);
    
    // Apply camera exposure (physically-based)
    // This multiplies the color by the exposure value
    // Changes to f-stop, shutter speed, or ISO will affect brightness here
    color = applyExposure(color, cam);
    
    // Apply depth of field (if enabled)
    color = applyDepthOfField(color, distance, cam);
    
    // Tone mapping (Reinhard-Jodie) - compresses HDR to LDR with better color preservation
    // Separates luminance and chrominance to preserve saturation better than basic Reinhard
    // Works well with existing exposure system and prevents over-compression
    color = toneMapReinhardJodie(color);
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}

