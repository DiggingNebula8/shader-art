// ============================================================================
// SKY & ATMOSPHERE SYSTEM
// ============================================================================
// Comprehensive abstraction for lighting, sky, and atmospheric rendering
// See SKY_SYSTEM.md for documentation and usage examples
// ============================================================================

#ifndef SKY_SYSTEM_FRAG
#define SKY_SYSTEM_FRAG

#include "Common.frag"

// --- Lighting Information Structure ---
struct LightingInfo {
    vec3 sunDirection;      // Normalized sun direction
    vec3 sunColor;          // Sun color (tinted by atmosphere)
    float sunIntensity;     // Sun light intensity
    vec3 moonDirection;     // Normalized moon direction
    vec3 moonColor;         // Moon color
    float moonIntensity;    // Moon light intensity
    float sunElevation;     // Sun elevation angle (-1 to 1)
    float moonElevation;    // Moon elevation angle (-1 to 1)
};

// --- Sky & Atmosphere Configuration Sub-Structs ---

struct SunMoonConfig {
    // Sun Configuration
    float sunRotation;      // Sun rotation angle (0 = east, 0.5 = noon, 1 = west)
    float sunElevation;     // Sun elevation (-1 = below horizon, 1 = zenith)
    vec3 sunColor;          // Base sun color (before atmospheric effects)
    float sunSize;          // Sun angular size (radians)
    float sunIntensity;     // Sun light intensity multiplier
    float sunPower;         // Sun disk brightness power
    
    // Moon Configuration
    bool enableMoon;        // Enable moon rendering
    float moonRotation;     // Moon rotation (typically opposite to sun)
    float moonElevation;    // Moon elevation
    vec3 moonColor;         // Moon color
    float moonSize;         // Moon angular size
    float moonIntensity;    // Moon light intensity
};

struct ScatteringConfig {
    float rayleighCoefficient;    // Rayleigh scattering strength
    float rayleighScaleHeight;    // Rayleigh scale height (meters)
    float mieCoefficient;         // Mie scattering strength
    float mieScaleHeight;         // Mie scale height (meters)
    float mieG;                   // Mie asymmetry parameter (0.0-1.0)
    float scatteringScale;        // Overall scattering intensity scale
};

struct ColorConfig {
    vec3 zenithColor;       // Sky color at zenith (top)
    vec3 horizonColor;      // Sky color at horizon
    vec3 nightColor;        // Night sky base color
    vec3 twilightColor;     // Twilight/sunset base color
    
    // Horizon Glow
    vec3 horizonGlowColor;  // Horizon glow color
    float horizonGlowIntensity;  // Horizon glow strength
    float horizonGlowPower;      // Horizon glow falloff power
};

struct CloudConfig {
    bool enableClouds;      // Enable volumetric clouds
    float cloudDensity;     // Overall cloud density (0.0-1.0)
    float cloudHeight;      // Cloud layer height (meters)
    float cloudThickness;   // Cloud layer thickness (meters)
    float cloudCoverage;    // Cloud coverage amount (0.0-1.0)
    vec3 cloudColorDay;     // Cloud color during day
    vec3 cloudColorSunset;  // Cloud color during sunset
    vec3 cloudColorNight;   // Cloud color during night
    float cloudWindSpeed;   // Cloud animation speed
};

struct FogConfig {
    bool enableFog;         // Enable atmospheric fog
    float fogDensity;       // Fog density (higher = more fog)
    float fogDistance;      // Fog start distance
    float fogHeightFalloff; // Fog height falloff rate
    float fogDistanceFalloff; // Fog distance falloff (0 = constant, higher = more fog at distance)
    float fogHorizonBoost;   // Additional fog density boost at horizon (0-1)
    vec3 fogColor;          // Base fog color
};

// --- Sky & Atmosphere Configuration ---
struct SkyAtmosphere {
    SunMoonConfig sunMoon;
    ScatteringConfig scattering;
    ColorConfig colors;
    CloudConfig clouds;
    FogConfig fog;
    
    // Stars
    bool enableStars;       // Enable star field
    float starDensity;      // Star field density (0.0-1.0)
    float starBrightness;   // Star brightness multiplier
    float starTwinkle;      // Star twinkle amount (0.0-1.0)
    
    // Advanced Controls
    float exposure;         // Overall sky exposure adjustment
    float contrast;         // Sky contrast (1.0 = default)
    float saturation;       // Sky color saturation (1.0 = default)
    float horizonOffset;    // Horizon line offset (0.0 = sea level)
};

// --- Default Sky Configuration ---
SkyAtmosphere createDefaultSky() {
    SkyAtmosphere sky;
    
    // Sun/Moon
    sky.sunMoon.sunRotation = 0.5;          // Noon position
    sky.sunMoon.sunElevation = 0.7;         // High in sky
    sky.sunMoon.sunColor = vec3(1.0, 0.98, 0.95);
    sky.sunMoon.sunSize = 0.0093;           // ~0.53 degrees
    sky.sunMoon.sunIntensity = 2.5;
    sky.sunMoon.sunPower = 30.0;
    sky.sunMoon.enableMoon = true;
    sky.sunMoon.moonRotation = 0.0;         // Opposite to sun
    sky.sunMoon.moonElevation = -0.5;       // Below horizon
    sky.sunMoon.moonColor = vec3(0.9, 0.92, 0.95);
    sky.sunMoon.moonSize = 0.0093;
    sky.sunMoon.moonIntensity = 0.3;
    
    // Scattering
    sky.scattering.rayleighCoefficient = 0.8;
    sky.scattering.rayleighScaleHeight = 8000.0;
    sky.scattering.mieCoefficient = 1.0;
    sky.scattering.mieScaleHeight = 1200.0;
    sky.scattering.mieG = 0.76;
    sky.scattering.scatteringScale = 80000.0;
    
    // Colors
    sky.colors.zenithColor = vec3(0.3, 0.5, 0.8);
    sky.colors.horizonColor = vec3(0.6, 0.7, 0.8);
    sky.colors.nightColor = vec3(0.02, 0.03, 0.05);
    sky.colors.twilightColor = vec3(0.4, 0.5, 0.6);
    sky.colors.horizonGlowColor = vec3(1.0, 0.85, 0.7);
    sky.colors.horizonGlowIntensity = 0.3;
    sky.colors.horizonGlowPower = 1.5;
    
    // Stars
    sky.enableStars = true;
    sky.starDensity = 1.0;
    sky.starBrightness = 0.8;
    sky.starTwinkle = 0.5;
    
    // Clouds
    sky.clouds.enableClouds = true;
    sky.clouds.cloudDensity = 0.5;
    sky.clouds.cloudHeight = 800.0;
    sky.clouds.cloudThickness = 400.0;
    sky.clouds.cloudCoverage = 0.4;
    sky.clouds.cloudColorDay = vec3(0.95, 0.95, 1.0);
    sky.clouds.cloudColorSunset = vec3(0.9, 0.6, 0.4);
    sky.clouds.cloudColorNight = vec3(0.15, 0.15, 0.18);
    sky.clouds.cloudWindSpeed = 0.02;
    
    // Fog
    sky.fog.enableFog = true;
    sky.fog.fogDensity = 0.005;        // Further reduced for very subtle fog
    sky.fog.fogDistance = 0.0;          // Start immediately (smooth fade-in handled in function)
    sky.fog.fogHeightFalloff = 8.0;    // Increased further for very smooth height transition
    sky.fog.fogDistanceFalloff = 0.0008; // Distance-based density increase (more fog at horizon)
    sky.fog.fogHorizonBoost = 0.3;      // Additional density boost at horizon (30%)
    sky.fog.fogColor = vec3(0.5, 0.6, 0.7);
    
    // Advanced
    sky.exposure = 1.0;
    sky.contrast = 1.0;
    sky.saturation = 1.0;
    sky.horizonOffset = 0.0;
    
    return sky;
}

// --- Sky Presets ---
SkyAtmosphere createSkyPreset_ClearDay() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = 0.7;
    sky.sunMoon.sunIntensity = 2.5;
    sky.clouds.cloudDensity = 0.2;
    sky.clouds.cloudCoverage = 0.2;
    sky.fog.fogDensity = 0.004;        // Very subtle fog for clear day
    sky.fog.fogHeightFalloff = 8.0;    // Smooth falloff
    sky.fog.fogDistanceFalloff = 0.0006; // Subtle distance increase
    sky.fog.fogHorizonBoost = 0.2;      // Small horizon boost
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Sunset() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = 0.1;
    sky.sunMoon.sunRotation = 0.75;  // West
    sky.sunMoon.sunColor = vec3(1.0, 0.6, 0.3);
    sky.sunMoon.sunIntensity = 1.5;
    sky.colors.zenithColor = vec3(0.2, 0.3, 0.5);
    sky.colors.horizonColor = vec3(1.0, 0.6, 0.3);
    sky.colors.horizonGlowColor = vec3(1.0, 0.5, 0.2);
    sky.colors.horizonGlowIntensity = 0.8;
    sky.clouds.cloudDensity = 0.6;
    sky.clouds.cloudCoverage = 0.5;
    sky.fog.fogDensity = 0.01;        // Moderate fog for sunset
    sky.fog.fogHeightFalloff = 5.0;
    sky.fog.fogDistanceFalloff = 0.001; // More fog at distance for sunset
    sky.fog.fogHorizonBoost = 0.4;      // Strong horizon boost for sunset
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Night() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = -0.3;
    sky.sunMoon.sunIntensity = 0.1;
    sky.sunMoon.enableMoon = true;
    sky.sunMoon.moonElevation = 0.5;
    sky.sunMoon.moonIntensity = 0.5;
    sky.enableStars = true;
    sky.starDensity = 1.0;
    sky.starBrightness = 1.0;
    sky.clouds.cloudDensity = 0.3;
    sky.clouds.cloudCoverage = 0.3;
    sky.fog.fogDensity = 0.006;        // Subtle fog for night
    sky.fog.fogHeightFalloff = 7.0;
    sky.fog.fogDistanceFalloff = 0.0005; // Subtle distance increase
    sky.fog.fogHorizonBoost = 0.15;      // Small horizon boost
    sky.colors.zenithColor = vec3(0.01, 0.015, 0.02);
    sky.colors.horizonColor = vec3(0.05, 0.08, 0.12);
    return sky;
}

SkyAtmosphere createSkyPreset_CloudyDay() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = 0.6;
    sky.sunMoon.sunIntensity = 1.8;
    sky.clouds.cloudDensity = 0.8;
    sky.clouds.cloudCoverage = 0.9;
    sky.colors.zenithColor = vec3(0.4, 0.45, 0.5);
    sky.colors.horizonColor = vec3(0.5, 0.5, 0.5);
    sky.fog.fogDensity = 0.01;        // Moderate fog for cloudy day
    sky.fog.fogHeightFalloff = 6.0;
    sky.fog.fogDistanceFalloff = 0.0009; // More fog at distance
    sky.fog.fogHorizonBoost = 0.35;      // Good horizon boost
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Stormy() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = 0.3;
    sky.sunMoon.sunIntensity = 0.8;
    sky.sunMoon.sunColor = vec3(0.7, 0.7, 0.75);
    sky.clouds.cloudDensity = 1.0;
    sky.clouds.cloudCoverage = 1.0;
    sky.clouds.cloudColorDay = vec3(0.3, 0.3, 0.35);
    sky.colors.zenithColor = vec3(0.2, 0.22, 0.25);
    sky.colors.horizonColor = vec3(0.3, 0.3, 0.35);
    sky.fog.fogDensity = 0.015;        // Reduced but still noticeable for stormy
    sky.fog.fogHeightFalloff = 4.0;    // Lower falloff for more atmospheric effect
    sky.fog.fogDistanceFalloff = 0.0012; // Strong distance increase for stormy
    sky.fog.fogHorizonBoost = 0.5;      // Strong horizon boost for dramatic effect
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Foggy() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunMoon.sunElevation = 0.5;
    sky.sunMoon.sunIntensity = 1.2;
    sky.fog.fogDensity = 0.012;        // Reduced for smoother appearance
    sky.fog.fogDistance = 0.0;          // Start immediately with smooth fade
    sky.fog.fogHeightFalloff = 6.0;    // Increased for smoother height transition
    sky.fog.fogDistanceFalloff = 0.0015; // Strong distance increase for foggy preset
    sky.fog.fogHorizonBoost = 0.6;      // Strong horizon boost for foggy effect
    sky.fog.fogColor = vec3(0.7, 0.7, 0.75);
    sky.colors.zenithColor = vec3(0.5, 0.55, 0.6);
    sky.colors.horizonColor = vec3(0.6, 0.6, 0.65);
    sky.clouds.cloudDensity = 0.4;
    return sky;
}

// --- Helper Functions for Sky System ---
vec3 calculateSunDirection(float rotation, float elevation) {
    float azimuth = rotation * TAU - PI * 0.5;
    float elev = elevation;
    return normalize(vec3(cos(azimuth) * 0.8, elev, -cos(azimuth) * 0.6));
}

LightingInfo evaluateLighting(SkyAtmosphere sky, float time) {
    LightingInfo light;
    
    // Calculate sun direction from sky configuration
    // If using time-based system, convert time to rotation/elevation
    float sunRot = sky.sunMoon.sunRotation;
    float sunElev = sky.sunMoon.sunElevation;
    
    light.sunDirection = calculateSunDirection(sunRot, sunElev);
    light.sunElevation = sunElev;
    light.sunColor = sky.sunMoon.sunColor;
    light.sunIntensity = sky.sunMoon.sunIntensity;
    
    // Moon direction (typically opposite to sun)
    if (sky.sunMoon.enableMoon) {
        float moonRot = sky.sunMoon.moonRotation;
        float moonElev = sky.sunMoon.moonElevation;
        light.moonDirection = calculateSunDirection(moonRot, moonElev);
        light.moonElevation = moonElev;
        light.moonColor = sky.sunMoon.moonColor;
        light.moonIntensity = sky.sunMoon.moonIntensity;
    } else {
        light.moonDirection = vec3(0.0);
        light.moonElevation = -1.0;
        light.moonColor = vec3(0.0);
        light.moonIntensity = 0.0;
    }
    
    return light;
}

// ============================================================================
// UTILITY FUNCTIONS FOR SKY SYSTEM
// ============================================================================
// Hash and noise functions are provided by Common.frag

// ============================================================================
// PHYSICALLY-BASED ATMOSPHERIC SCATTERING
// ============================================================================
// Based on: Preetham et al. "A Practical Analytic Model for Daylight"
//          and Rayleigh/Mie scattering theory

// Atmospheric Parameters
const float RAYLEIGH_SCALE_HEIGHT = 8000.0; // meters
const float MIE_SCALE_HEIGHT = 1200.0;     // meters

// Scattering Coefficients (per meter)
// Rayleigh: wavelength-dependent, blue scatters more (Red, Green, Blue)
const vec3 BETA_R = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 0.8;
// Mie: wavelength-independent (aerosols) - less than Rayleigh for clear sky
const float BETA_M = 4e-6;

// Scattering phase functions
// Rayleigh: symmetric, peaks at 90 degrees
float rayleighPhase(float cosTheta) {
    return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

// Mie: forward scattering (Henyey-Greenstein approximation)
float miePhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// ============================================================================
// ADVANCED SKY SPHERE SYSTEM
// ============================================================================
// Comprehensive sky rendering with volumetric clouds, stars, and enhanced atmospheric scattering

// Star field generation for night sky
float stars(vec3 dir) {
    // Project direction to sphere coordinates
    vec3 p = dir * 1000.0; // Scale for star density
    float star = hash3(floor(p));
    
    // Only show stars above certain brightness threshold
    star = smoothstep(0.98, 1.0, star);
    
    // Add twinkling effect
    float twinkle = sin(dot(p, vec3(12.9898, 78.233, 45.164)) * 0.1) * 0.5 + 0.5;
    star *= mix(0.5, 1.0, twinkle);
    
    return star;
}

// Volumetric cloud density using multi-octave noise
float cloudDensity(vec3 pos, float time) {
    // Cloud layer height (above sea level)
    const float CLOUD_HEIGHT = 800.0;
    const float CLOUD_THICKNESS = 400.0;
    
    // Check if we're in cloud layer
    if (pos.y < CLOUD_HEIGHT || pos.y > CLOUD_HEIGHT + CLOUD_THICKNESS) {
        return 0.0;
    }
    
    // Cloud position in cloud space
    vec3 cloudPos = pos;
    float cloudY = (pos.y - CLOUD_HEIGHT) / CLOUD_THICKNESS; // Normalize to [0, 1]
    
    // Wind effect (clouds drift)
    vec2 windOffset = vec2(time * 0.02, time * 0.015);
    vec2 cloudXY = cloudPos.xz * 0.001 + windOffset;
    
    // Vertical falloff (clouds are flatter, denser in middle)
    float verticalFalloff = 1.0 - abs(cloudY - 0.5) * 2.0;
    verticalFalloff = smoothstep(0.0, 1.0, verticalFalloff);
    
    // Multi-octave noise for cloud shape
    float density = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    // Base cloud shape (large scale)
    for (int i = 0; i < 4; i++) {
        vec2 p = cloudXY * frequency;
        float n = smoothNoise(p) * 0.6 + 
                  smoothNoise(p * 2.0 + vec2(100.0)) * 0.3 +
                  smoothNoise(p * 4.0 + vec2(200.0)) * 0.1;
        
        density += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    // Normalize density
    density = density / 1.875; // Sum of amplitudes: 1.0 + 0.5 + 0.25 + 0.125 = 1.875
    
    // Apply vertical falloff
    density *= verticalFalloff;
    
    // Shape the density (clouds have soft edges)
    density = smoothstep(0.35, 0.65, density);
    
    return density;
}

// Sample clouds along a ray (optimized for sky sphere)
float sampleClouds(vec3 rayStart, vec3 rayDir, float time, float maxDist) {
    const float CLOUD_HEIGHT = 800.0;
    const float CLOUD_THICKNESS = 400.0;
    
    // Find intersection with cloud layer
    if (rayDir.y <= 0.0) return 0.0; // Ray going down (below horizon)
    
    float t0 = (CLOUD_HEIGHT - rayStart.y) / rayDir.y;
    float t1 = ((CLOUD_HEIGHT + CLOUD_THICKNESS) - rayStart.y) / rayDir.y;
    
    // Ensure correct order
    if (t0 > t1) {
        float temp = t0;
        t0 = t1;
        t1 = temp;
    }
    
    if (t1 < 0.0 || t0 > maxDist) return 0.0;
    
    t0 = max(0.0, t0);
    t1 = min(maxDist, t1);
    
    if (t1 <= t0) return 0.0;
    
    // Sample clouds with adaptive step size
    float density = 0.0;
    float stepSize = 25.0;
    float t = t0;
    int maxSteps = 12;
    
    for (int i = 0; i < maxSteps; i++) {
        if (t >= t1) break;
        
        vec3 pos = rayStart + rayDir * t;
        float d = cloudDensity(pos, time);
        density += d * stepSize;
        
        t += stepSize;
    }
    
    // Transmittance (Beer's law) - clouds absorb and scatter light
    float extinction = density * 0.0008;
    return 1.0 - exp(-extinction);
}

// Cloud lighting with realistic scattering
vec3 cloudColor(vec3 dir, vec3 sunDir, float sunIntensity, float sunElevation, float time) {
    float sunDot = max(dot(dir, sunDir), 0.0);
    float elevation = max(dir.y, 0.0);
    
    // Base cloud color varies with time of day
    vec3 baseColor;
    if (sunElevation < 0.0) {
        // Night: dark gray clouds
        baseColor = vec3(0.15, 0.15, 0.18);
    } else if (sunElevation < 0.2) {
        // Sunrise/sunset: warm colored clouds
        float sunsetFactor = smoothstep(0.2, 0.0, sunElevation);
        baseColor = mix(vec3(0.85, 0.8, 0.75), vec3(0.9, 0.6, 0.4), sunsetFactor);
    } else {
        // Day: white/bright clouds
        baseColor = vec3(0.95, 0.95, 1.0);
    }
    
    // Sun lighting on clouds (forward scattering)
    float sunLighting = pow(sunDot, 0.3) * sunIntensity;
    vec3 sunLit = baseColor * sunLighting;
    
    // Ambient cloud color (scattered light from sky)
    vec3 ambient = baseColor * mix(0.2, 0.4, elevation);
    
    // Cloud shadowing (darker on bottom, brighter on top)
    float verticalGradient = pow(elevation, 0.3);
    vec3 gradient = mix(baseColor * 0.7, baseColor, verticalGradient);
    
    return (sunLit + ambient) * gradient;
}

// ============================================================================
// MODULAR SKY RENDERING FUNCTIONS
// ============================================================================

// Calculate optical depth through atmosphere (with configurable scale height)
float calculateOpticalDepth(vec3 dir, float scaleHeight) {
    float elevation = max(dir.y, 0.01);
    return scaleHeight / elevation;
}

// Evaluate atmospheric scattering using Rayleigh/Mie theory
vec3 evaluateAtmosphericScattering(SkyAtmosphere sky, vec3 dir, LightingInfo light) {
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    
    float sunDot = max(dot(safeDir, light.sunDirection), 0.0);
    float elevation = safeDir.y;
    
    // Optical depths
    float rayleighDepth = calculateOpticalDepth(safeDir, sky.scattering.rayleighScaleHeight);
    float mieDepth = calculateOpticalDepth(safeDir, sky.scattering.mieScaleHeight);
    float sunRayleighDepth = calculateOpticalDepth(light.sunDirection, sky.scattering.rayleighScaleHeight);
    float sunMieDepth = calculateOpticalDepth(light.sunDirection, sky.scattering.mieScaleHeight);
    
    // Base scattering coefficients (scaled by configuration)
    vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * sky.scattering.rayleighCoefficient;
    float betaM = 4e-6 * sky.scattering.mieCoefficient;
    
    // Transmittance (Beer's law)
    vec3 rayleighTransmittance = exp(-betaR * rayleighDepth);
    float mieTransmittance = exp(-betaM * mieDepth);
    vec3 sunRayleighTransmittance = exp(-betaR * sunRayleighDepth);
    float sunMieTransmittance = exp(-betaM * sunMieDepth);
    
    // Phase functions
    float rayleighPhaseValue = rayleighPhase(sunDot);
    float miePhaseValue = miePhase(sunDot, sky.scattering.mieG);
    
    // In-scattering
    vec3 rayleighInScatter = betaR * rayleighPhaseValue * sunRayleighTransmittance;
    float mieInScatter = betaM * miePhaseValue * sunMieTransmittance;
    
    // Scattered sunlight
    vec3 scattering = (rayleighInScatter + vec3(mieInScatter)) * 
                      light.sunColor * light.sunIntensity * sky.scattering.scatteringScale;
    
    return scattering;
}

// Evaluate sun/moon disk and halo
vec3 evaluateSunMoonDisk(SkyAtmosphere sky, vec3 dir, LightingInfo light) {
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    vec3 result = vec3(0.0);
    
    // Sun disk
    float sunDot = max(dot(safeDir, light.sunDirection), 0.0);
    float sunAngle = acos(clamp(sunDot, 0.0, 1.0));
    float sunDisk = 1.0 - smoothstep(0.0, sky.sunMoon.sunSize, sunAngle);
    
    // Sun brightness based on elevation
    float sunBrightness = sky.sunMoon.sunPower;
    if (light.sunElevation < 0.1) {
        sunBrightness = mix(sky.sunMoon.sunPower * 0.2, sunBrightness, 
                           smoothstep(-0.1, 0.1, light.sunElevation));
    }
    
    vec3 sun = light.sunColor * sunDisk * sunBrightness * light.sunIntensity;
    
    // Sun halo (Mie scattering glow)
    float sunHalo = pow(max(0.0, sunDot), 16.0);
    float elevation = safeDir.y;
    float haloIntensity = (1.0 - elevation * 0.3) * 
                          (1.0 - exp(-4e-6 * sky.scattering.mieCoefficient * 
                                    calculateOpticalDepth(light.sunDirection, sky.scattering.mieScaleHeight)));
    float haloBrightness = mix(sunBrightness * 0.1, sunBrightness * 0.3,
                              smoothstep(-0.1, 0.1, light.sunElevation));
    vec3 halo = light.sunColor * sunHalo * haloIntensity * haloBrightness * light.sunIntensity;
    
    result += sun + halo;
    
    // Moon disk (if enabled)
    if (sky.sunMoon.enableMoon && light.moonElevation > 0.0) {
        float moonDot = max(dot(safeDir, light.moonDirection), 0.0);
        float moonAngle = acos(clamp(moonDot, 0.0, 1.0));
        float moonDisk = 1.0 - smoothstep(0.0, sky.sunMoon.moonSize, moonAngle);
        
        // Moon fades as sun rises
        float moonFade = smoothstep(0.2, -0.2, light.sunElevation);
        vec3 moon = light.moonColor * moonDisk * light.moonElevation * 
                   2.0 * moonFade * light.moonIntensity;
        
        // Moon halo
        float moonHalo = pow(max(0.0, moonDot), 20.0);
        vec3 moonHaloColor = light.moonColor * moonHalo * light.moonElevation * 
                           0.3 * moonFade * light.moonIntensity;
        
        result += moon + moonHaloColor;
    }
    
    return result;
}

// Evaluate star field
vec3 evaluateStars(SkyAtmosphere sky, vec3 dir, LightingInfo light) {
    if (!sky.enableStars) return vec3(0.0);
    
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    float elevation = safeDir.y;
    
    if (elevation < 0.05) return vec3(0.0);
    
    // Generate stars
    vec3 p = safeDir * 1000.0 * sky.starDensity;
    float star = hash3(floor(p));
    star = smoothstep(0.98, 1.0, star);
    
    // Twinkling effect
    if (sky.starTwinkle > 0.0) {
        float twinkle = sin(dot(p, vec3(12.9898, 78.233, 45.164)) * 0.1) * 0.5 + 0.5;
        star *= mix(1.0 - sky.starTwinkle, 1.0, twinkle);
    }
    
    // Star visibility based on sun elevation (stars fade as sun rises)
    float starVisibility = smoothstep(0.2, -0.2, light.sunElevation);
    float horizonFade = smoothstep(0.0, 0.2, elevation);
    
    vec3 starColor = vec3(1.0, 0.98, 0.95) * star * starVisibility * 
                    horizonFade * sky.starBrightness;
    
    return starColor;
}

// Evaluate clouds with new configuration
float evaluateCloudDensity(SkyAtmosphere sky, vec3 pos, float time) {
    if (pos.y < sky.clouds.cloudHeight || pos.y > sky.clouds.cloudHeight + sky.clouds.cloudThickness) {
        return 0.0;
    }
    
    float cloudY = (pos.y - sky.clouds.cloudHeight) / sky.clouds.cloudThickness;
    float verticalFalloff = 1.0 - abs(cloudY - 0.5) * 2.0;
    verticalFalloff = smoothstep(0.0, 1.0, verticalFalloff);
    
    vec2 windOffset = vec2(time * sky.clouds.cloudWindSpeed, time * sky.clouds.cloudWindSpeed * 0.75);
    vec2 cloudXY = pos.xz * 0.001 + windOffset;
    
    float density = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    for (int i = 0; i < 4; i++) {
        vec2 p = cloudXY * frequency;
        float n = smoothNoise(p) * 0.6 + 
                  smoothNoise(p * 2.0 + vec2(100.0)) * 0.3 +
                  smoothNoise(p * 4.0 + vec2(200.0)) * 0.1;
        density += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    density = density / 1.875;
    density *= verticalFalloff;
    density = smoothstep(0.35, 0.65, density);
    density *= sky.clouds.cloudDensity * sky.clouds.cloudCoverage;
    
    return density;
}

float sampleClouds(SkyAtmosphere sky, vec3 rayStart, vec3 rayDir, float time, float maxDist) {
    if (!sky.clouds.enableClouds || rayDir.y <= 0.0) return 0.0;
    
    float t0 = (sky.clouds.cloudHeight - rayStart.y) / rayDir.y;
    float t1 = ((sky.clouds.cloudHeight + sky.clouds.cloudThickness) - rayStart.y) / rayDir.y;
    
    if (t0 > t1) {
        float temp = t0;
        t0 = t1;
        t1 = temp;
    }
    
    if (t1 < 0.0 || t0 > maxDist) return 0.0;
    
    t0 = max(0.0, t0);
    t1 = min(maxDist, t1);
    if (t1 <= t0) return 0.0;
    
    float density = 0.0;
    float stepSize = 25.0;
    float t = t0;
    int maxSteps = 12;
    
    for (int i = 0; i < maxSteps; i++) {
        if (t >= t1) break;
        vec3 pos = rayStart + rayDir * t;
        density += evaluateCloudDensity(sky, pos, time) * stepSize;
        t += stepSize;
    }
    
    float extinction = density * 0.0008;
    return 1.0 - exp(-extinction);
}

vec3 evaluateCloudColor(SkyAtmosphere sky, vec3 dir, LightingInfo light, float time) {
    float sunDot = max(dot(dir, light.sunDirection), 0.0);
    float elevation = max(dir.y, 0.0);
    
    // Cloud color based on time of day
    vec3 baseColor;
    if (light.sunElevation < 0.0) {
        baseColor = sky.clouds.cloudColorNight;
    } else if (light.sunElevation < 0.2) {
        float sunsetFactor = smoothstep(0.2, 0.0, light.sunElevation);
        baseColor = mix(sky.clouds.cloudColorDay, sky.clouds.cloudColorSunset, sunsetFactor);
    } else {
        baseColor = sky.clouds.cloudColorDay;
    }
    
    float sunLighting = pow(sunDot, 0.3) * light.sunIntensity;
    vec3 sunLit = baseColor * sunLighting;
    vec3 ambient = baseColor * mix(0.2, 0.4, elevation);
    float verticalGradient = pow(elevation, 0.3);
    vec3 gradient = mix(baseColor * 0.7, baseColor, verticalGradient);
    
    return (sunLit + ambient) * gradient;
}

// Main sky evaluation function
vec3 evaluateSky(SkyAtmosphere sky, vec3 dir, float time) {
    // Evaluate lighting
    LightingInfo light = evaluateLighting(sky, time);
    
    // Clamp direction to prevent sampling below horizon
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    float elevation = safeDir.y;
    
    // Atmospheric scattering
    vec3 skyColor = evaluateAtmosphericScattering(sky, safeDir, light);
    
    // Sun/Moon disk and halo
    vec3 diskColor = evaluateSunMoonDisk(sky, safeDir, light);
    
    // Base sky colors (time-of-day dependent)
    float deepNightFactor = smoothstep(-0.2, -0.3, light.sunElevation);
    float twilightProgress = smoothstep(-0.2, 0.2, light.sunElevation);
    float dayFactor = smoothstep(0.1, 0.2, light.sunElevation);
    
    // Night sky
    float moonBrightness = 0.0;
    if (sky.sunMoon.enableMoon && light.moonElevation > 0.0) {
        moonBrightness = pow(light.moonElevation, 0.5) * light.moonIntensity;
    }
    vec3 nightSkyBase = sky.colors.nightColor;
    vec3 moonlitSky = vec3(0.05, 0.06, 0.08) * moonBrightness;
    float nightGradient = mix(0.8, 1.2, pow(elevation, 0.3));
    vec3 nightSky = (nightSkyBase + moonlitSky) * nightGradient;
    
    // Twilight sky
    vec3 twilightSky = mix(sky.colors.nightColor * 2.5, sky.colors.twilightColor, twilightProgress);
    
    // Day sky
    vec3 daySky = mix(sky.colors.horizonColor, sky.colors.zenithColor, pow(elevation, 0.5));
    daySky *= light.sunIntensity * 0.5;
    
    // Blend sky states
    vec3 baseSky = mix(nightSky, twilightSky, 1.0 - deepNightFactor);
    baseSky = mix(baseSky, daySky, dayFactor);
    skyColor += baseSky;
    
    // Horizon glow
    float horizonFactor = pow(max(0.0, 1.0 - elevation), sky.colors.horizonGlowPower);
    float horizonIntensity = horizonFactor * sky.colors.horizonGlowIntensity;
    skyColor += sky.colors.horizonGlowColor * horizonIntensity;
    
    // Add sun/moon disk
    skyColor += diskColor;
    
    // Add stars
    skyColor += evaluateStars(sky, safeDir, light);
    
    // Add clouds
    if (sky.clouds.enableClouds && elevation > 0.0) {
        vec3 camPos = vec3(0.0, 0.0, 0.0);
        float cloudOpacity = sampleClouds(sky, camPos, safeDir, time, 2000.0);
        
        if (cloudOpacity > 0.01) {
            vec3 cloudCol = evaluateCloudColor(sky, safeDir, light, time);
            float cloudVisibility = smoothstep(-0.1, 0.1, light.sunElevation);
            cloudOpacity *= cloudVisibility;
            skyColor = mix(skyColor, cloudCol, cloudOpacity);
        }
    }
    
    // Apply exposure, contrast, and saturation
    skyColor *= sky.exposure;
    skyColor = mix(vec3(0.5), skyColor, sky.contrast);
    skyColor = mix(vec3(dot(skyColor, vec3(0.299, 0.587, 0.114))), skyColor, sky.saturation);
    
    // Minimum brightness
    float minBrightness = mix(0.02, 0.2, dayFactor);
    skyColor = max(skyColor, vec3(minBrightness));
    
    return skyColor;
}

// Enhanced physically-based sky color with volumetric clouds and stars
// Based on: Preetham et al. "A Practical Analytic Model for Daylight"
//          and improved atmospheric scattering with proper day/night transitions
// Sky color evaluation - takes SkyAtmosphere as parameter
vec3 skyColor(vec3 dir, SkyAtmosphere sky, float time) {
    return evaluateSky(sky, dir, time);
}

// ============================================================================
// EXPONENTIAL HEIGHT FOG
// ============================================================================
// Modern physically-based fog system with volumetric light scattering
// Based on: Unreal Engine 4/5 Exponential Height Fog
//          and volumetric fog rendering techniques
// ============================================================================

// Calculate exponential height fog density at a given world position
// Uses exponential falloff: density = baseDensity * exp(-(height - fogHeight) / falloff)
// Smooth and continuous for seamless blending
// Now includes distance-based density for horizon enhancement
float calculateFogDensity(vec3 worldPos, vec3 camPos, SkyAtmosphere sky) {
    if (!sky.fog.enableFog) return 0.0;
    
    // Reference height (typically sea level or ground level)
    const float FOG_HEIGHT = 0.0; // Sea level
    
    // Height above reference plane
    // Use smooth transition to avoid discontinuities
    float height = worldPos.y - FOG_HEIGHT;
    
    // Exponential height fog density
    // Density decreases exponentially as height increases
    // Add small offset to ensure smoothness at sea level
    float heightDensity = sky.fog.fogDensity * exp(-max(height, -1.0) / max(sky.fog.fogHeightFalloff, 0.1));
    
    // Smooth transition for heights below sea level (underwater/at ocean surface)
    if (height < 0.0) {
        float underwaterFactor = exp(height * 0.5); // Smooth fade below sea level
        heightDensity *= mix(0.3, 1.0, underwaterFactor); // Reduce fog density underwater
    }
    
    // Distance-based density increase (more fog at horizon/distance)
    float dist = length(worldPos - camPos);
    float distanceDensityBoost = 1.0 + min(dist * sky.fog.fogDistanceFalloff, 10.0);
    
    // Apply distance-based density boost
    heightDensity *= distanceDensityBoost;
    
    // Ensure minimum falloff to prevent division by zero
    return max(heightDensity, 0.0);
}

// Calculate volumetric fog transmittance along a ray
// Uses Beer-Lambert law: T = exp(-integral of density along ray)
// Optimized with adaptive sampling for smoother results
float calculateFogTransmittance(vec3 startPos, vec3 endPos, vec3 camPos, SkyAtmosphere sky) {
    if (!sky.fog.enableFog) return 1.0;
    
    vec3 rayDir = normalize(endPos - startPos);
    float rayLength = length(endPos - startPos);
    
    // Adaptive sampling: more samples for longer rays and near surface
    int numSamples = 8;
    float heightAtStart = startPos.y;
    float heightAtEnd = endPos.y;
    float minHeight = min(heightAtStart, heightAtEnd);
    
    // Increase samples near ocean surface for smoother transitions
    if (abs(minHeight) < 5.0) {
        numSamples = 12; // More samples near surface
    }
    
    float stepSize = rayLength / float(numSamples);
    
    float integratedDensity = 0.0;
    
    // Use trapezoidal integration for better accuracy
    float densityStart = calculateFogDensity(startPos, camPos, sky);
    float densityEnd = calculateFogDensity(endPos, camPos, sky);
    integratedDensity = (densityStart + densityEnd) * 0.5 * stepSize;
    
    // Sample interior points
    for (int i = 1; i < numSamples; i++) {
        float t = float(i) * stepSize;
        vec3 samplePos = startPos + rayDir * t;
        
        float density = calculateFogDensity(samplePos, camPos, sky);
        integratedDensity += density * stepSize;
    }
    
    // Transmittance (Beer-Lambert law)
    // Clamp to prevent numerical issues
    float transmittance = exp(-max(integratedDensity, 0.0));
    
    return clamp(transmittance, 0.0, 1.0);
}

// Calculate volumetric light scattering (god rays) through fog
// Approximates multiple scattering with single-scattering approximation
vec3 calculateVolumetricScattering(vec3 startPos, vec3 endPos, vec3 rayDir, vec3 camPos, SkyAtmosphere sky, float time) {
    if (!sky.fog.enableFog) return vec3(0.0);
    
    LightingInfo light = evaluateLighting(sky, time);
    vec3 sunDir = light.sunDirection;
    vec3 sunColor = light.sunColor;
    float sunIntensity = light.sunIntensity;
    
    // Only calculate scattering if sun is above horizon
    if (sunDir.y <= 0.0) return vec3(0.0);
    
    float rayLength = length(endPos - startPos);
    const int NUM_SAMPLES = 6;
    float stepSize = rayLength / float(NUM_SAMPLES);
    
    vec3 scattering = vec3(0.0);
    
    for (int i = 0; i < NUM_SAMPLES; i++) {
        float t = (float(i) + 0.5) * stepSize;
        vec3 samplePos = startPos + rayDir * t;
        
        // Fog density at sample point
        float density = calculateFogDensity(samplePos, camPos, sky);
        
        // Light direction to sun
        vec3 toSun = normalize(sunDir);
        float sunDot = max(dot(rayDir, toSun), 0.0);
        
        // Henyey-Greenstein phase function for forward scattering
        // g = 0.7 gives nice forward scattering (god rays)
        const float g = 0.7;
        float g2 = g * g;
        float phase = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * sunDot, 1.5);
        phase /= 4.0 * PI;
        
        // Transmittance from sun to sample point
        vec3 sunSamplePos = samplePos - toSun * 1000.0; // Approximate sun position
        float sunTransmittance = calculateFogTransmittance(sunSamplePos, samplePos, camPos, sky);
        
        // Transmittance from sample to camera
        float camTransmittance = calculateFogTransmittance(samplePos, startPos, camPos, sky);
        
        // In-scattering contribution
        vec3 inScatter = density * phase * sunTransmittance * camTransmittance * sunColor * sunIntensity;
        scattering += inScatter * stepSize;
    }
    
    // Scale scattering intensity
    scattering *= 0.15;
    
    return scattering;
}

// Modern Exponential Height Fog with volumetric scattering
vec3 applyAtmosphericFog(vec3 color, vec3 pos, vec3 camPos, vec3 rayDir, SkyAtmosphere sky, float time) {
    if (!sky.fog.enableFog) return color;
    
    float dist = length(pos - camPos);
    
    // Smooth fade-in for fog start distance
    // Creates gradual fog appearance instead of hard cutoff
    float fogStartDistance = sky.fog.fogDistance;
    float fogFadeDistance = 30.0; // Increased fade distance for smoother transition
    float distanceFade = 1.0;
    
    if (fogStartDistance > 0.0) {
        distanceFade = smoothstep(fogStartDistance, fogStartDistance + fogFadeDistance, dist);
    }
    
    // Early exit if fog hasn't started yet
    if (distanceFade <= 0.0) return color;
    
    // Calculate fog transmittance (how much light passes through fog)
    float transmittance = calculateFogTransmittance(camPos, pos, camPos, sky);
    
    // Fog factor (1.0 = fully fogged, 0.0 = no fog)
    float fogFactor = 1.0 - transmittance;
    
    // Apply distance fade to fog factor for smooth start
    fogFactor *= distanceFade;
    
    // Additional horizon boost for more fog at horizon
    float horizonAngle = 1.0 - max(rayDir.y, 0.0); // 0 at zenith, 1 at horizon
    float horizonBoost = pow(horizonAngle, 1.2) * sky.fog.fogHorizonBoost;
    fogFactor *= (1.0 + horizonBoost);
    
    // Base fog color from sky configuration
    vec3 fogColor = sky.fog.fogColor;
    
    // Blend fog color with sky color for better integration
    // More sky color influence near horizon
    float horizonFactor = pow(max(0.0, 1.0 - max(rayDir.y, 0.0)), 1.5);
    vec3 skyFogColor = evaluateSky(sky, rayDir, time);
    
    // Mix base fog color with sky color
    // Horizon gets more sky color, higher elevations get base fog color
    fogColor = mix(fogColor, skyFogColor, horizonFactor * 0.8);
    
    // Smooth transition near ocean surface to prevent seams
    // Ocean surface is typically around y=0 (with wave variations)
    // Create smooth blend zone around sea level
    float oceanHeight = pos.y;
    float seaLevelBlendZone = 5.0; // Increased height range for blending
    
    // Smooth blend factor: 1.0 at sea level, 0.0 far above/below
    // Use smoother falloff function
    float seaLevelDistance = abs(oceanHeight);
    float blendFactor = exp(-seaLevelDistance / seaLevelBlendZone);
    
    // Blend fog color towards original color near ocean surface
    // This prevents visible seams by matching fog to ocean color at the surface
    // Use a more gradual blend
    vec3 surfaceFogColor = mix(color, fogColor, 0.8); // Stronger blend with ocean color
    fogColor = mix(fogColor, surfaceFogColor, blendFactor * 0.5);
    
    // Additional smoothness: reduce fog intensity very close to ocean surface
    // Use smoother falloff
    float surfaceProximity = exp(-max(seaLevelDistance, 0.0) / 2.0);
    fogFactor *= mix(1.0, 0.7, surfaceProximity * 0.4); // More gradual reduction near surface
    
    // Add volumetric light scattering (god rays)
    vec3 volumetricScattering = calculateVolumetricScattering(camPos, pos, rayDir, camPos, sky, time);
    
    // Apply fog: mix between original color and fog color based on transmittance
    // Use smoothstep for even smoother blending
    float smoothFogFactor = smoothstep(0.0, 1.0, fogFactor);
    vec3 foggedColor = mix(color, fogColor, smoothFogFactor);
    foggedColor += volumetricScattering * smoothFogFactor * distanceFade;
    
    // Ensure we don't go below minimum brightness
    float minBrightness = 0.02;
    foggedColor = max(foggedColor, vec3(minBrightness));
    
    return foggedColor;
}

#endif // SKY_SYSTEM_FRAG

