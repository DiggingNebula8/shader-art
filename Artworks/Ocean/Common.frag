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
// Water Material Constants:
//   - waterAbsorption: vec3(0.15, 0.045, 0.015) - Water absorption coefficients (m^-1)
//   - deepWaterColor: vec3(0.0, 0.2, 0.4) - Color for deep water (darker blue)
//   - shallowWaterColor: vec3(0.0, 0.5, 0.75) - Color for shallow water (bright turquoise)
//   - baseRoughness: 0.03 - Base roughness for calm water (very smooth)
//   - maxRoughness: 0.12 - Maximum roughness for choppy water
//   - WATER_F0: vec3(0.018, 0.019, 0.020) - Wavelength-dependent Fresnel F0 for water-air interface
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

// Water Material Constants
const vec3 waterAbsorption = vec3(0.15, 0.045, 0.015);
const vec3 deepWaterColor = vec3(0.0, 0.2, 0.4);
const vec3 shallowWaterColor = vec3(0.0, 0.5, 0.75);
const float baseRoughness = 0.03;
const float maxRoughness = 0.12;
const vec3 WATER_F0 = vec3(0.018, 0.019, 0.020);

// log2 implementation (fallback for older GLSL versions)
float log2_impl(float x) {
    return log(x) / log(2.0);
}

// Simple hash function for pseudo-random noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Hash function for 2D random values (for bubble distribution)
float hash2(vec2 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * (p.x + p.y));
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
vec3 refractRay(vec3 incident, vec3 normal, float eta) {
    float cosI = -dot(incident, normal);
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    
    if (sinT2 > 1.0) {
        return reflect(incident, normal);
    }
    
    float cosT = sqrt(1.0 - sinT2);
    return eta * incident + (eta * cosI - cosT) * normal;
}

#endif // COMMON_FRAG

