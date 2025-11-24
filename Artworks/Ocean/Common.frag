// Common Constants and Utilities
// Shared across all shader systems

#ifndef COMMON_FRAG
#define COMMON_FRAG

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.0001;

// Raymarching
const int MAX_STEPS = 1000;
const float MIN_DIST = .001;
const float MAX_DIST = 150.0;

// Physical Constants
const float GRAVITY = 9.81;

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
float fractalNoise(vec2 p, float scale, int octaves, float persistence) {
    if (octaves <= 0) {
        return 0.0;
    }
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = scale;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        value += smoothNoise(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2.0;
    }
    
    return value / max(maxValue, 1e-6); // Normalize to [0, 1]
}

#endif // COMMON_FRAG

