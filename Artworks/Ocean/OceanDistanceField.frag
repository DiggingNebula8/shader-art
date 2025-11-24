// ============================================================================
// OCEAN SCENE DISTANCE FIELD WRAPPER
// ============================================================================
// Scene-specific distance field implementation for Ocean scene
// Uses the generic DistanceFieldSystem with Ocean-specific SDF functions
// ============================================================================

#ifndef OCEAN_DISTANCE_FIELD_FRAG
#define OCEAN_DISTANCE_FIELD_FRAG

#include "Common.frag"
#include "TerrainSystem.frag"
#include "ObjectSystem.frag"

// Include DistanceFieldSystem early to get structures and helper functions
#include "DistanceFieldSystem.frag"

// ============================================================================
// OCEAN SCENE SDF DEFINITION
// ============================================================================
// This defines the unified scene SDF for the Ocean scene
// Combines terrain and objects into a single distance field
// Uses smoothMinSDF from DistanceFieldSystem.frag
// ============================================================================

// Unified scene SDF - combines terrain and objects
// This function is used by the generic DistanceFieldSystem
float getSceneSDF(vec3 pos, float time) {
    // Get terrain distance
    TerrainParams defaultTerrain = createDefaultOceanFloor();
    float terrainDist = getTerrainSDF(pos, defaultTerrain);
    
    // Get object distance
    float objectDist = getBuoySDF(pos, time);
    
    // Use smooth minimum for better blending
    // smoothMinSDF is defined in DistanceFieldSystem.frag
    const float smoothK = 2.0;
    return smoothMinSDF(terrainDist, objectDist, smoothK);
}

// Optional: Scene-specific normal function for more accurate surface queries
vec3 getSceneNormal(vec3 pos, float time) {
    TerrainParams defaultTerrain = createDefaultOceanFloor();
    float terrainDist = getTerrainSDF(pos, defaultTerrain);
    float objectDist = getBuoySDF(pos, time);
    
    // Return normal of closest surface
    if (abs(terrainDist) < abs(objectDist)) {
        return getTerrainNormal(pos, defaultTerrain);
    } else {
        return getBuoyNormal(pos, time);
    }
}

// ============================================================================
// GENERIC DISTANCE FIELD FUNCTION IMPLEMENTATIONS
// ============================================================================
// Implement the generic API functions using our scene SDF
// These functions are required by DistanceFieldSystem.frag
// ============================================================================

// Get distance to nearest surface along a ray (generic API)
// Required by DistanceFieldSystem - uses getSceneSDF defined above
float getDistanceToSurface(vec3 start, vec3 dir, float maxDist, float time) {
    #define getSDF(pos, t) getSceneSDF(pos, t)
    float dist;
    DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist);
    #undef getSDF
    return dist;
}

// Get distance field information at a point (generic API)
// Required by DistanceFieldSystem - uses getSceneSDF and getSceneNormal defined above
DistanceFieldInfo getDistanceFieldInfo(vec3 pos, float time) {
    DistanceFieldInfo info;
    
    float dist = getSceneSDF(pos, time);
    info.distance = dist;
    
    // Use getSceneNormal (defined above) for accurate surface position
    vec3 normal = getSceneNormal(pos, time);
    info.surfacePos = pos - normal * dist;
    
    return info;
}

// Get depth along a direction (generic API)
float getDepthAlongDirection(vec3 start, vec3 dir, float maxDepth, float time) {
    return getDistanceToSurface(start, dir, maxDepth, time);
}

// ============================================================================
// OCEAN-SPECIFIC DISTANCE FIELD FUNCTIONS
// ============================================================================
// These functions provide Ocean-specific interfaces while using the generic system
// ============================================================================

// Get distance to nearest terrain surface
// Returns positive if above terrain, negative if below
float getTerrainDistance(vec3 pos, TerrainParams terrainParams) {
    return getTerrainSDF(pos, terrainParams);
}

// Get distance to nearest object surface
// Returns positive if outside object, negative if inside
float getObjectDistance(vec3 pos, float time) {
    return getBuoySDF(pos, time);
}

// Unified distance field - returns distance to nearest surface (terrain or object)
// Uses smooth minimum for better blending between surfaces
float getSceneDistance(vec3 pos, TerrainParams terrainParams, float time) {
    float terrainDist = getTerrainDistance(pos, terrainParams);
    float objectDist = getObjectDistance(pos, time);
    
    // Use smooth minimum for better blending
    const float smoothK = 2.0;
    return smoothMinSDF(terrainDist, objectDist, smoothK);
}

// Get distance to nearest surface along a ray (with TerrainParams)
// Ocean-specific wrapper - delegates to generic function
// Note: getSceneSDF uses defaultTerrain internally, but this maintains API compatibility
float getDistanceToSurface(vec3 start, vec3 dir, float maxDist, TerrainParams terrainParams, float time) {
    // Delegate to generic function (getSceneSDF handles terrain+object combination)
    return getDistanceToSurface(start, dir, maxDist, time);
}

// Get distance field information (with TerrainParams)
DistanceFieldInfo getDistanceFieldInfo(vec3 pos, TerrainParams terrainParams, float time) {
    return getDistanceFieldInfo(pos, time);
}

// Get water depth using distance field
// More accurate than simple height difference - accounts for objects underwater
float getWaterDepthWithDistanceField(vec3 waterSurfacePos, vec3 downDir, TerrainParams terrainParams, float time, float maxDepth) {
    return getDepthAlongDirection(waterSurfacePos, downDir, maxDepth, time);
}

#endif // OCEAN_DISTANCE_FIELD_FRAG

