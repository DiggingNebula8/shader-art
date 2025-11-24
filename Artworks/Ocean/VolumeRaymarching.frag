// ============================================================================
// VOLUME RAYMARCHING SYSTEM
// ============================================================================
// Unified raymarching system - single source of truth for all raymarching
// Based on: Sphere Tracing (Hart 1996), Distance Field Raymarching
// ============================================================================
// This file defines the VolumeHit struct and raymarching algorithm macros
// Systems define getSDF macro and use RAYMARCH_SURFACE_CORE or RAYMARCH_VOLUME_CORE
// ============================================================================

#ifndef VOLUME_RAYMARCHING_FRAG
#define VOLUME_RAYMARCHING_FRAG

#include "Common.frag"

// ============================================================================
// VOLUME HIT STRUCTURE
// ============================================================================

// Volume raymarching result
struct VolumeHit {
    bool hit;           // Did we hit something?
    float distance;     // Distance traveled
    vec3 position;      // Hit position
    vec3 normal;        // Surface normal (if surface hit)
    vec2 gradient;      // Surface gradient (for wave systems, etc.) - computed alongside normal
    bool valid;         // Is the result valid? (prevents NaN/Inf issues)
};

// ============================================================================
// RAYMARCHING ALGORITHM MACROS
// ============================================================================
// These macros expand to the raymarching algorithm code
// Requires: getSDF(pos, time) macro to be defined before use
// Usage: Define getSDF, then use the macro, then undefine getSDF
// ============================================================================

// Surface raymarching algorithm macro
// Expands to code that performs surface raymarching and stores result in 'hit' variable
// Input: start, dir, maxDist, time
// Output: VolumeHit hit (must be declared before macro)
#define RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit) \
    do { \
        hit.hit = false; \
        hit.valid = false; \
        float t = 0.0; \
        float prevH = 1e10; \
        for (int i = 0; i < MAX_STEPS; i++) { \
            vec3 pos = start + dir * t; \
            float h = getSDF(pos, time); \
            if (abs(h) < MIN_DIST * 1.5) { \
                vec3 refinedPos = pos; \
                if (abs(h) > MIN_DIST * 0.5) { \
                    float refineStep = h * 0.3; \
                    refinedPos = start + dir * (t - refineStep); \
                    float hRefined = getSDF(refinedPos, time); \
                    if (abs(hRefined) < abs(h)) { \
                        pos = refinedPos; \
                    } \
                } \
                hit.hit = true; \
                hit.distance = t; \
                hit.position = pos; \
                hit.valid = true; \
                hit.normal = vec3(0.0, 1.0, 0.0); \
                hit.gradient = vec2(0.0); \
                break; \
            } \
            if (t > maxDist) { \
                hit.hit = false; \
                hit.distance = maxDist; \
                hit.position = start + dir * maxDist; \
                hit.valid = true; \
                hit.normal = vec3(0.0); \
                hit.gradient = vec2(0.0); \
                break; \
            } \
            float stepSize = clamp(h * 0.4, MIN_DIST * 0.5, 1.0); \
            if (abs(h) > abs(prevH) * 1.1 && i > 2) { \
                stepSize = MIN_DIST; \
            } \
            prevH = h; \
            t += stepSize; \
        } \
        if (!hit.valid) { \
            hit.hit = false; \
            hit.distance = maxDist; \
            hit.position = start + dir * maxDist; \
            hit.valid = true; \
            hit.normal = vec3(0.0); \
            hit.gradient = vec2(0.0); \
        } \
    } while(false)

// Volume raymarching algorithm macro
// Expands to code that performs volume raymarching and stores result in 'hit' variable
// Input: start, dir, maxDist, time
// Output: VolumeHit hit (must be declared before macro)
#define RAYMARCH_VOLUME_CORE(start, dir, maxDist, time, hit) \
    do { \
        float t = 0.0; \
        const float STEP_SIZE = 0.5; \
        hit.hit = false; \
        hit.valid = false; \
        for (int i = 0; i < 200; i++) { \
            vec3 pos = start + dir * t; \
            float h = getSDF(pos, time); \
            if (h < MIN_DIST) { \
                hit.hit = true; \
                hit.distance = t; \
                hit.position = pos; \
                hit.valid = true; \
                hit.normal = vec3(0.0, 1.0, 0.0); \
                hit.gradient = vec2(0.0); \
                break; \
            } \
            if (t > maxDist || h > 50.0) { \
                break; \
            } \
            float stepSize = clamp(h * 0.3, STEP_SIZE, 2.0); \
            t += stepSize; \
        } \
        if (!hit.valid) { \
            hit.hit = false; \
            hit.distance = maxDist; \
            hit.position = start + dir * maxDist; \
            hit.valid = true; \
            hit.normal = vec3(0.0); \
            hit.gradient = vec2(0.0); \
        } \
    } while(false)

#endif // VOLUME_RAYMARCHING_FRAG

