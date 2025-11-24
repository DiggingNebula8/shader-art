// ============================================================================
// DISTANCE FIELD SYSTEM
// ============================================================================
// Generic distance field system for scene geometry
// Provides distance queries that work with any SDF function
// ============================================================================
// Usage:
//   1. Define your scene SDF function: float getSceneSDF(vec3 pos, float time)
//   2. Use the distance field macros/functions provided below
//   3. Optionally define getSceneNormal(vec3 pos, float time) for normal queries
//
// Example:
//   #include "DistanceFieldSystem.frag"
//   float getSceneSDF(vec3 pos, float time) {
//       return length(pos) - 1.0; // Sphere SDF
//   }
//   float dist = getDistanceToSurface(start, dir, maxDist, time);
// ============================================================================

#ifndef DISTANCE_FIELD_SYSTEM_FRAG
#define DISTANCE_FIELD_SYSTEM_FRAG

#include "Common.frag"

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
        float t = 0.0; \
        const float MIN_STEP = 0.1; \
        const float MAX_STEP = 2.0; \
        const int MAX_STEPS = 150; \
        float prevDist = 1e10; \
        for (int i = 0; i < MAX_STEPS; i++) { \
            vec3 pos = start + dir * t; \
            float d = getSDF(pos, time); \
            if (d < MIN_DIST * 2.0) { \
                float refineT = t; \
                float refineStep = d * 0.5; \
                for (int j = 0; j < 3; j++) { \
                    refineT = max(0.0, refineT - refineStep); \
                    vec3 refinePos = start + dir * refineT; \
                    float refineD = getSDF(refinePos, time); \
                    if (refineD < MIN_DIST) { \
                        refineStep *= 0.5; \
                    } else { \
                        refineStep *= -0.5; \
                    } \
                } \
                dist = refineT; \
                break; \
            } \
            if (d > 100.0 || t > maxDist) { \
                dist = maxDist; \
                break; \
            } \
            float stepSize = clamp(d * 0.6, MIN_STEP, MAX_STEP); \
            if (d > prevDist * 1.5 && i > 2) { \
                stepSize = MIN_STEP; \
            } \
            prevDist = d; \
            t += stepSize; \
        } \
        if (t >= maxDist || prevDist > 100.0) { \
            dist = maxDist; \
        } \
    } while(false)

// ============================================================================
// FUNCTION-BASED API IMPLEMENTATIONS
// ============================================================================
// These functions are implemented in scene-specific wrappers
// The generic file only provides the structure and helper functions
// Scene wrappers should implement these using getSceneSDF
// ============================================================================

// ============================================================================
// MULTI-SDF COMBINATION HELPERS
// ============================================================================
// These helpers allow combining multiple SDFs into a unified scene SDF
// ============================================================================

// Smooth minimum - combines two SDFs with smooth blending
float smoothMinSDF(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Smooth maximum - combines two SDFs with smooth blending (for intersection)
float smoothMaxSDF(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
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

#endif // DISTANCE_FIELD_SYSTEM_FRAG
