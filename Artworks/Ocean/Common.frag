// ============================================================================
// COMMON CONSTANTS AND UTILITIES
// ============================================================================
// Shared constants and utility functions used across all shader systems
// ============================================================================
//
// CONSTANTS DOCUMENTATION:
//
// Mathematical Constants:
//   - PI: 3.14159265359 - Pi constant
//   - TAU: 6.28318530718 - 2*PI constant
//   - EPSILON: 0.0001 - Small epsilon value for floating point comparisons
//
// Raymarching Constants:
//   - MAX_STEPS: 1000 - Maximum iterations for raymarching
//   - MIN_DIST: 0.001 - Minimum distance threshold for surface intersection
//   - MAX_DIST: 150.0 - Maximum raymarching distance
//   - MAX_WATER_DEPTH: 200.0 - Maximum depth for raymarching through water
//
// Physical Constants:
//   - GRAVITY: 9.81 - Gravitational acceleration (m/s^2)
//
// Index of Refraction Constants:
//   - WATER_IOR: 1.33 - Index of refraction for water
//   - AIR_IOR: 1.0 - Index of refraction for air
//
// Physical Material Constants:
//   - WATER_F0: vec3(0.018, 0.019, 0.020) - Wavelength-dependent Fresnel F0 (physical constant)
//
// Note: Art-directable materials (WaterMaterial, etc.) are defined in MaterialSystem.frag
//
// ============================================================================

#ifndef COMMON_FRAG
#define COMMON_FRAG

// Mathematical Constants
const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.0001;

// Raymarching Constants
const int MAX_STEPS = 1000;
const float MIN_DIST = 0.001;
const float MAX_DIST = 150.0;
const float MAX_WATER_DEPTH = 200.0;

// Physical Constants
const float GRAVITY = 9.81;

// Index of Refraction Constants
const float WATER_IOR = 1.33;
const float AIR_IOR = 1.0;

// Physical constant (not art-directable - based on IOR)
const vec3 WATER_F0 = vec3(0.018, 0.019, 0.020);

// Simple hash function for pseudo-random noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Hash function for 3D random values (for star field)
float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Smooth noise function (value noise)
float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal noise (fBm - fractional Brownian motion)
// Uses fixed loop bound for portability and better compiler optimization
// Note: octaves parameter is effectively clamped to MAX_FBM_OCTAVES (8).
// Values above 8 are truncated - only the first 8 octaves will be computed.
float fractalNoise(vec2 p, float scale, int octaves, float persistence, float lacunarity) {
    if (octaves <= 0) {
        return 0.0;
    }
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    const int MAX_FBM_OCTAVES = 8;
    for (int i = 0; i < MAX_FBM_OCTAVES; i++) {
        if (i >= octaves) break;
        value += smoothNoise(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    return value / max(maxValue, 1e-6); // Normalize to [0, 1]
}

// ============================================================================
// REFRACTION UTILITIES
// ============================================================================

// Calculate refracted ray direction using Snell's law
// 
// Parameters:
//   - incident: Incident ray direction (must be normalized)
//   - normal: Surface normal (must be normalized)
//   - eta: Ratio of IORs (n1/n2, where n1 is incident medium, n2 is transmitted medium)
//
// Returns:
//   - Refracted ray direction (normalized), or reflected ray direction if TIR occurs
//
// Note: Unlike GLSL's built-in refract(), this function returns the reflected ray
//       when Total Internal Reflection (TIR) occurs, rather than a zero vector.
//       This is intentional for water rendering where TIR should reflect the ray.
vec3 refractRay(vec3 incident, vec3 normal, float eta) {
    float cosI = clamp(-dot(incident, normal), -1.0, 1.0);
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    
    if (sinT2 > 1.0) {
        // Total Internal Reflection (TIR) - return reflected ray
        return reflect(incident, normal);
    }
    
    float cosT = sqrt(1.0 - sinT2);
    return eta * incident + (eta * cosI - cosT) * normal;
}

#endif // COMMON_FRAG

