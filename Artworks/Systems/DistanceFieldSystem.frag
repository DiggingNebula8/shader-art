// ============================================================================
// DISTANCE FIELD SYSTEM
// ============================================================================
// Generic distance field algorithms and utilities
// Provides macros and helper functions for working with Signed Distance Functions (SDFs)
// ============================================================================
// This file contains:
//   - Generic distance field algorithms and macros
//   - Multi-SDF combination helpers (union, intersection, smooth min, etc.)
//   - DistanceFieldInfo structure
//
// Usage:
//   #include "DistanceFieldSystem.frag"
//   // Define your scene SDF as a macro:
//   #define getSDF(pos, t) length(pos) - 1.0
//   // Use the macros:
//   float dist;
//   DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist);
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
                /* Handle both outside (d > 0) and inside (d < 0) geometry cases */ \
                float offset = clamp(abs(d), MIN_DIST, REFINEMENT_THRESHOLD); \
                float tMin = max(0.0, t - offset); \
                float tMax = t + offset; \
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
        /* Initialize distance when raymarch loop exhausts steps */ \
        /* If we didn't find a hit, set dist to the actual distance traveled */ \
        if (!foundHit) { \
            dist = min(t, maxDist); \
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

// Subtraction (A - B): keeps region of A that is not inside B
float subtractionSDF(float dA, float dB) {
    return max(dA, -dB);
}


#endif // DISTANCE_FIELD_SYSTEM_FRAG
