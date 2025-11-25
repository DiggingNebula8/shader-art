// ============================================================================
// OBJECT SYSTEM
// ============================================================================
// Generic procedural object generation using Signed Distance Functions (SDFs)
// Provides SDF primitives and operations for building objects
// ============================================================================

#ifndef OBJECT_SYSTEM_FRAG
#define OBJECT_SYSTEM_FRAG

#include "../CoreSystems/Common.frag"
#include "../CoreSystems/VolumeRaymarching.frag"

// ============================================================================
// SDF PRIMITIVES
// ============================================================================

// Sphere SDF
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// Cylinder SDF (vertical)
float sdCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Box SDF
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// ============================================================================
// SDF OPERATIONS
// ============================================================================

// Union
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

// Smooth union
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Subtraction
float opSubtraction(float d1, float d2) {
    // Standard CSG difference: A - B
    return max(d1, -d2);
}


#endif // OBJECT_SYSTEM_FRAG

