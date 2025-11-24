// ============================================================================
// WAVE SYSTEM
// ============================================================================
// Pure wave geometry system - provides wave height, normals, and SDF functions
// Based on: Tessendorf "Simulating Ocean Water" (SIGGRAPH 2001)
// ============================================================================
// This system has NO dependencies on Sky, Terrain, or Shading systems
// It provides pure geometry functions for wave generation
// ============================================================================

#ifndef WAVE_SYSTEM_FRAG
#define WAVE_SYSTEM_FRAG

#include "Common.frag"

// ============================================================================
// WAVE PARAMETERS
// ============================================================================

// Wave Parameters - Weta Digital quality ocean with proper spectrum distribution
// Increased wave count for more realistic detail and interaction
const int NUM_WAVES = 10;

// Primary swell direction (dominant wind direction) - pre-normalized
// vec2(1.0, 0.3) normalized = approximately vec2(0.9578, 0.2873)
const vec2 PRIMARY_SWELL_DIR = vec2(0.9578, 0.2873);

// Get wave direction for a given wave index
// Uses proper angular distribution around primary swell for realistic wave interaction
vec2 getWaveDir(int i) {
    if (i == 0) return PRIMARY_SWELL_DIR;                                    // Primary swell
    if (i == 1) return normalize(PRIMARY_SWELL_DIR + vec2(0.15, 0.08));      // Secondary swell
    if (i == 2) return normalize(PRIMARY_SWELL_DIR + vec2(-0.12, 0.15));     // Tertiary swell
    if (i == 3) return normalize(vec2(PRIMARY_SWELL_DIR.y, -PRIMARY_SWELL_DIR.x)); // Cross swell
    if (i == 4) return normalize(PRIMARY_SWELL_DIR + vec2(0.08, -0.25));    // Detail wave 1
    if (i == 5) return normalize(PRIMARY_SWELL_DIR + vec2(-0.18, -0.08));   // Detail wave 2
    if (i == 6) return normalize(PRIMARY_SWELL_DIR + vec2(0.25, 0.12));     // Detail wave 3
    if (i == 7) return normalize(PRIMARY_SWELL_DIR + vec2(-0.22, 0.18));   // Detail wave 4
    if (i == 8) return normalize(PRIMARY_SWELL_DIR + vec2(0.12, -0.2));     // Detail wave 5
    return normalize(PRIMARY_SWELL_DIR + vec2(-0.15, -0.12));                // Detail wave 6
}

// Wave amplitudes (m) - follows realistic ocean spectrum (Phillips-like distribution)
// Primary swell dominates, with proper falloff for detail waves
const float waveAmps[NUM_WAVES] = float[](
    1.4,  // Primary swell - largest
    0.55, // Secondary swell
    0.35, // Tertiary swell
    0.22, // Cross swell
    0.14, // Detail wave 1
    0.09, // Detail wave 2
    0.06, // Detail wave 3
    0.04, // Detail wave 4
    0.025, // Detail wave 5
    0.015  // Detail wave 6
);

// Wave frequencies (rad/m) - proper spectrum distribution
// Lower frequencies (longer waves) have more energy, following ocean physics
const float waveFreqs[NUM_WAVES] = float[](
    0.12, // Primary swell - very long wavelength (~52m)
    0.20, // Secondary swell
    0.32, // Tertiary swell
    0.50, // Cross swell
    0.85, // Detail wave 1
    1.4,  // Detail wave 2
    2.2,  // Detail wave 3
    3.5,  // Detail wave 4
    5.5,  // Detail wave 5
    8.5   // Detail wave 6
);

// Wave speeds computed from dispersion: w = sqrt(g*k) for deep water
// Time scaling factor to slow down wave motion for more realistic appearance
const float TIME_SCALE = 1.0; 

// Compute wave speed from wave number using dispersion relation
// w = sqrt(g*k) for deep water waves, scaled by TIME_SCALE
// This ensures speeds are always computed from frequencies, preventing drift
float getWaveSpeed(float k) {
    return sqrt(GRAVITY * k) * TIME_SCALE;
}

// ============================================================================
// WAVE GEOMETRY FUNCTIONS
// ============================================================================

// Optimized: directly calculate height without full displacement
// Computes wave speeds on-the-fly from frequencies to prevent drift
float getWaveHeight(vec2 pos, float time) {
    float height = 0.0;
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k); // Compute speed from frequency
        float spatialPhase = dot(pos, dir) * k;
        float temporalPhase = time * w;
        float phase = spatialPhase + temporalPhase;
        height += waveAmps[i] * sin(phase);
    }
    return height;
}

// Compute wave height and gradient analytically (much faster than finite differences)
// Returns vec3(height, grad.x, grad.y)
// Uses temporally stable phase calculation to reduce precision issues
// Optimized: compute height and gradient together when both needed
vec3 getWaveHeightAndGradient(vec2 pos, float time) {
    float height = 0.0;
    vec2 grad = vec2(0.0);
    
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k); // Compute speed from frequency
        // Calculate phase with improved precision
        float spatialPhase = dot(pos, dir) * k;
        float temporalPhase = time * w;
        float phase = spatialPhase + temporalPhase;
        
        float s = sin(phase);
        float c = cos(phase);
        float A = waveAmps[i];
        
        height += A * s;
        grad += A * k * dir * c;
    }
    
    return vec3(height, grad.x, grad.y);
}

// Optimized: return gradient directly without full vec3
// Computes wave speeds on-the-fly from frequencies to prevent drift
vec2 getWaveGradient(vec2 pos, float time) {
    vec2 grad = vec2(0.0);
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k); // Compute speed from frequency
        float spatialPhase = dot(pos, dir) * k;
        float temporalPhase = time * w;
        float phase = spatialPhase + temporalPhase;
        grad += waveAmps[i] * k * dir * cos(phase);
    }
    return grad;
}

// Enhanced normal calculation with analytical derivatives
// Optimized: computes height and gradient together to minimize redundant calculations
vec3 getNormal(vec2 pos, float time, out vec2 gradient) {
    // Compute base height and gradient together (single wave loop)
    vec3 hg = getWaveHeightAndGradient(pos, time);
    vec2 grad = hg.yz;
    float waveHeight = hg.x;
    
    // Temporally stable smoothing using rotated offsets to reduce aliasing
    float angle = dot(pos, vec2(0.7071, 0.7071)) * 0.5; // Stable rotation
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec2 rotX = vec2(cosA, sinA) * 0.01; // Pre-multiply smoothing radius
    vec2 rotY = vec2(-sinA, cosA) * 0.01;
    
    // Optimized: compute smoothing samples efficiently (unrolled for better performance)
    vec2 gradSmooth = grad;
    gradSmooth += getWaveGradient(pos + rotX, time) * 0.15;
    gradSmooth += getWaveGradient(pos - rotX, time) * 0.15;
    gradSmooth += getWaveGradient(pos + rotY, time) * 0.15;
    gradSmooth += getWaveGradient(pos - rotY, time) * 0.15;
    grad = mix(grad, gradSmooth / 1.6, 0.2); // Very gentle smoothing
    
    gradient = grad;
    
    // Build normal from gradient
    vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));
    
    // Add subtle micro-detail only where needed (reduces banding)
    float crestFactor = smoothstep(-0.2, 0.3, waveHeight);
    
    if (crestFactor > 0.1) {
        // Pre-multiply micro detail with rotation vectors
        vec2 microX = rotX * 2.0; // 0.01 * 2.0 = 0.02
        vec2 microY = rotY * 2.0;
        vec2 gradX = getWaveGradient(pos + microX, time);
        vec2 gradY = getWaveGradient(pos + microY, time);
        
        vec3 microNormal = normalize(vec3(-(gradX.x + grad.x) * 0.5, 1.0, -(gradY.y + grad.y) * 0.5));
        normal = normalize(mix(normal, microNormal, crestFactor * 0.08)); // Very subtle
    }
    
    return normal;
}

// ============================================================================
// SDF FUNCTION FOR VOLUME RAYMARCHING
// ============================================================================

// Signed Distance Function for wave surface
// Returns positive if above surface, negative if below
// Used by VolumeRaymarching system for raymarching
float getWaveSDF(vec3 pos, float time) {
    return pos.y - getWaveHeight(pos.xz, time);
}

// ============================================================================
// RAYMARCHING WRAPPER
// ============================================================================

// Include VolumeRaymarching for VolumeHit struct and core algorithms
// Note: The core functions use getSDF() which must be defined via macro
// before calling them. We define it in the wrapper function.
#include "VolumeRaymarching.frag"

// System-specific raymarch wrapper for wave surface
// Uses VolumeRaymarching core algorithm with getWaveSDF
VolumeHit raymarchWaveSurface(vec3 start, vec3 dir, float maxDist, float time) {
    // Define SDF function macro for raymarching algorithm
    #define getSDF(pos, time) getWaveSDF(pos, time)
    
    // Use raymarching algorithm macro
    VolumeHit hit;
    RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);
    
    // Note: Normal and gradient are NOT computed here to avoid redundant computation
    // RenderPipeline.renderScene() will recompute them after position stabilization
    // This avoids computing getNormal twice (once here, once after stabilization)
    // The gradient field is initialized to vec2(0.0) by RAYMARCH_SURFACE_CORE
    // and normal is set to a placeholder vec3(0.0, 1.0, 0.0) or vec3(0.0)
    
    #undef getSDF
    return hit;
}

#endif // WAVE_SYSTEM_FRAG

