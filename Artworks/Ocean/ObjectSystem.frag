// ============================================================================
// OBJECT SYSTEM
// ============================================================================
// Procedural object generation using Signed Distance Functions (SDFs)
// Creates objects that can be placed in the ocean scene
// ============================================================================

#ifndef OBJECT_SYSTEM_FRAG
#define OBJECT_SYSTEM_FRAG

#include "Common.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"

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

// ============================================================================
// BUOY OBJECT
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
    const float eps = 0.01;
    float d = getBuoySDF(pos, time);
    vec3 n = vec3(
        getBuoySDF(pos + vec3(eps, 0.0, 0.0), time) - d,
        getBuoySDF(pos + vec3(0.0, eps, 0.0), time) - d,
        getBuoySDF(pos + vec3(0.0, 0.0, eps), time) - d
    );
    return normalize(n);
}

// ============================================================================
// RAYMARCHING WRAPPER
// ============================================================================

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

#endif // OBJECT_SYSTEM_FRAG

