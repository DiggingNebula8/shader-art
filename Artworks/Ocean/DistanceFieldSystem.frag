// ============================================================================
// DISTANCE FIELD SYSTEM
// ============================================================================
// Distance field system for Ocean scene geometry
// Provides unified scene SDF queries combining terrain and objects
// ============================================================================
// This file contains:
//   - Generic distance field algorithms and macros
//   - Ocean scene-specific SDF definitions (getSceneSDF, getSceneNormal)
//   - Distance field query functions (getDistanceToSurface, getDistanceFieldInfo, etc.)
//
// Usage:
//   #include "DistanceFieldSystem.frag"
//   float dist = getDistanceToSurface(start, dir, maxDist, terrainParams, time);
//   DistanceFieldInfo info = getDistanceFieldInfo(pos, terrainParams, time);
// ============================================================================

#ifndef DISTANCE_FIELD_SYSTEM_FRAG
#define DISTANCE_FIELD_SYSTEM_FRAG

#include "Common.frag"

// Include Ocean scene systems needed for scene SDF definition
#include "TerrainSystem.frag"
#include "ObjectSystem.frag"

// ============================================================================
// DISTANCE FIELD INFO STRUCTURE
// ============================================================================

struct DistanceFieldInfo {
    float distance;      // Distance to nearest surface (positive = outside, negative = inside)
    vec3 surfacePos;     // Position of nearest surface point (approximate)
};

// ============================================================================
// GENERIC DISTANCE FIELD ALGORITHMS (MACRO-BASED)
// ============================================================================
// These macros work with any SDF function provided via a macro
// Usage: Define getSDF(pos, time) macro, then use the macros below
// Example:
//   #define getSDF(pos, t) length(pos) - 1.0
//   float dist;
//   DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist);
// ============================================================================

// Macro for raymarching to find distance to surface
// Requires: getSDF(pos, time) macro to be defined before use
// Output: Stores result in 'dist' variable
#define DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist) \
    do { \
        dist = maxDist; /* default: no hit within maxDist */ \
        bool foundHit = false; \
        float t = 0.0; \
        const float MIN_STEP = 0.1; \
        const float MAX_STEP = 2.0; \
        const int MAX_STEPS = 150; \
        float prevDist = 1e10; \
        for (int i = 0; i < MAX_STEPS; i++) { \
            vec3 pos = start + dir * t; \
            float d = getSDF(pos, time); \
            if (d < REFINEMENT_THRESHOLD) { \
                /* Binary search refinement */ \
                float tMin = max(0.0, t - d); \
                float tMax = t; \
                for (int j = 0; j < 5; j++) { \
                    float tMid = (tMin + tMax) * 0.5; \
                    vec3 refinePos = start + dir * tMid; \
                    float dMid = getSDF(refinePos, time); \
                    if (dMid < MIN_DIST) { \
                        tMax = tMid; \
                    } else { \
                        tMin = tMid; \
                    } \
                } \
                dist = (tMin + tMax) * 0.5; \
                foundHit = true; \
                break; \
            } \
            if (d > DISTANCE_FIELD_MAX_DIST || t > maxDist) { \
                dist = maxDist; \
                foundHit = false; \
                break; \
            } \
            float stepSize = clamp(d * 0.8, MIN_STEP, MAX_STEP); \
            if (d > prevDist * DISTANCE_BACKTRACK_THRESHOLD && i > 2) { \
                stepSize = MIN_STEP; \
            } \
            prevDist = d; \
            t += stepSize; \
        } \
        /* Only overwrite dist if we didn't find a hit and loop ended naturally */ \
        if (!foundHit && (t >= maxDist || prevDist > DISTANCE_FIELD_MAX_DIST)) { \
            dist = maxDist; \
        } \
    } while(false)

// ============================================================================
// MULTI-SDF COMBINATION HELPERS
// ============================================================================
// These helpers allow combining multiple SDFs into a unified scene SDF
// Must be defined before getSceneSDF() uses them
// ============================================================================

// Smooth minimum - combines two SDFs with smooth blending
float smoothMinSDF(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Smooth maximum - combines two SDFs with smooth blending (for intersection)
// Uses identity: smoothMax(d1, d2, k) = -smoothMin(-d1, -d2, k)
float smoothMaxSDF(float d1, float d2, float k) {
    return -smoothMinSDF(-d1, -d2, k);
}

// Union - combines two SDFs (minimum)
float unionSDF(float d1, float d2) {
    return min(d1, d2);
}

// Intersection - combines two SDFs (maximum)
float intersectionSDF(float d1, float d2) {
    return max(d1, d2);
}

// Subtraction - subtracts d1 from d2
float subtractionSDF(float d1, float d2) {
    return max(-d1, d2);
}

// ============================================================================
// OCEAN SCENE DISTANCE FIELD DEFINITIONS
// ============================================================================
// Unified scene SDF - combines terrain and objects into a single distance field
// This is the core scene definition used by all distance field queries
// These functions are Ocean-scene-specific and use TerrainParams
// ============================================================================

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
// FUNCTION-BASED API IMPLEMENTATIONS
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

#endif // DISTANCE_FIELD_SYSTEM_FRAG
