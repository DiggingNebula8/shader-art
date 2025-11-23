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

// --- Sky & Atmosphere Configuration ---
struct SkyAtmosphere {
    // Sun/Moon Configuration
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
    
    // Atmospheric Scattering (Rayleigh/Mie)
    float rayleighCoefficient;    // Rayleigh scattering strength
    float rayleighScaleHeight;    // Rayleigh scale height (meters)
    float mieCoefficient;         // Mie scattering strength
    float mieScaleHeight;         // Mie scale height (meters)
    float mieG;                   // Mie asymmetry parameter (0.0-1.0)
    float scatteringScale;        // Overall scattering intensity scale
    
    // Sky Colors & Gradients
    vec3 zenithColor;       // Sky color at zenith (top)
    vec3 horizonColor;      // Sky color at horizon
    vec3 nightColor;        // Night sky base color
    vec3 twilightColor;     // Twilight/sunset base color
    
    // Horizon Glow
    vec3 horizonGlowColor;  // Horizon glow color
    float horizonGlowIntensity;  // Horizon glow strength
    float horizonGlowPower;      // Horizon glow falloff power
    
    // Stars
    bool enableStars;       // Enable star field
    float starDensity;      // Star field density (0.0-1.0)
    float starBrightness;   // Star brightness multiplier
    float starTwinkle;      // Star twinkle amount (0.0-1.0)
    
    // Clouds
    bool enableClouds;      // Enable volumetric clouds
    float cloudDensity;     // Overall cloud density (0.0-1.0)
    float cloudHeight;      // Cloud layer height (meters)
    float cloudThickness;   // Cloud layer thickness (meters)
    float cloudCoverage;    // Cloud coverage amount (0.0-1.0)
    vec3 cloudColorDay;     // Cloud color during day
    vec3 cloudColorSunset;  // Cloud color during sunset
    vec3 cloudColorNight;   // Cloud color during night
    float cloudWindSpeed;   // Cloud animation speed
    
    // Fog/Atmospheric Perspective
    bool enableFog;         // Enable atmospheric fog
    float fogDensity;       // Fog density (higher = more fog)
    float fogDistance;      // Fog start distance
    float fogHeightFalloff; // Fog height falloff rate
    vec3 fogColor;          // Base fog color
    
    // Advanced Controls
    float exposure;         // Overall sky exposure adjustment
    float contrast;         // Sky contrast (1.0 = default)
    float saturation;       // Sky color saturation (1.0 = default)
    float horizonOffset;    // Horizon line offset (0.0 = sea level)
};

// --- Default Sky Configuration ---
SkyAtmosphere createDefaultSky() {
    SkyAtmosphere sky;
    
    // Sun
    sky.sunRotation = 0.5;          // Noon position
    sky.sunElevation = 0.7;         // High in sky
    sky.sunColor = vec3(1.0, 0.98, 0.95);
    sky.sunSize = 0.0093;           // ~0.53 degrees
    sky.sunIntensity = 2.5;
    sky.sunPower = 30.0;
    
    // Moon
    sky.enableMoon = true;
    sky.moonRotation = 0.0;         // Opposite to sun
    sky.moonElevation = -0.5;       // Below horizon
    sky.moonColor = vec3(0.9, 0.92, 0.95);
    sky.moonSize = 0.0093;
    sky.moonIntensity = 0.3;
    
    // Atmosphere
    sky.rayleighCoefficient = 0.8;
    sky.rayleighScaleHeight = 8000.0;
    sky.mieCoefficient = 1.0;
    sky.mieScaleHeight = 1200.0;
    sky.mieG = 0.76;
    sky.scatteringScale = 80000.0;
    
    // Sky Colors
    sky.zenithColor = vec3(0.3, 0.5, 0.8);
    sky.horizonColor = vec3(0.6, 0.7, 0.8);
    sky.nightColor = vec3(0.02, 0.03, 0.05);
    sky.twilightColor = vec3(0.4, 0.5, 0.6);
    
    // Horizon Glow
    sky.horizonGlowColor = vec3(1.0, 0.85, 0.7);
    sky.horizonGlowIntensity = 0.3;
    sky.horizonGlowPower = 1.5;
    
    // Stars
    sky.enableStars = true;
    sky.starDensity = 1.0;
    sky.starBrightness = 0.8;
    sky.starTwinkle = 0.5;
    
    // Clouds
    sky.enableClouds = true;
    sky.cloudDensity = 0.5;
    sky.cloudHeight = 800.0;
    sky.cloudThickness = 400.0;
    sky.cloudCoverage = 0.4;
    sky.cloudColorDay = vec3(0.95, 0.95, 1.0);
    sky.cloudColorSunset = vec3(0.9, 0.6, 0.4);
    sky.cloudColorNight = vec3(0.15, 0.15, 0.18);
    sky.cloudWindSpeed = 0.02;
    
    // Fog
    sky.enableFog = true;
    sky.fogDensity = 0.02;
    sky.fogDistance = 50.0;
    sky.fogHeightFalloff = 2.0;
    sky.fogColor = vec3(0.5, 0.6, 0.7);
    
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
    sky.sunElevation = 0.7;
    sky.sunIntensity = 2.5;
    sky.cloudDensity = 0.2;
    sky.cloudCoverage = 0.2;
    sky.fogDensity = 0.01;
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Sunset() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunElevation = 0.1;
    sky.sunRotation = 0.75;  // West
    sky.sunColor = vec3(1.0, 0.6, 0.3);
    sky.sunIntensity = 1.5;
    sky.zenithColor = vec3(0.2, 0.3, 0.5);
    sky.horizonColor = vec3(1.0, 0.6, 0.3);
    sky.horizonGlowColor = vec3(1.0, 0.5, 0.2);
    sky.horizonGlowIntensity = 0.8;
    sky.cloudDensity = 0.6;
    sky.cloudCoverage = 0.5;
    sky.fogDensity = 0.03;
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Night() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunElevation = -0.3;
    sky.sunIntensity = 0.1;
    sky.enableMoon = true;
    sky.moonElevation = 0.5;
    sky.moonIntensity = 0.5;
    sky.enableStars = true;
    sky.starDensity = 1.0;
    sky.starBrightness = 1.0;
    sky.cloudDensity = 0.3;
    sky.cloudCoverage = 0.3;
    sky.fogDensity = 0.015;
    sky.zenithColor = vec3(0.01, 0.015, 0.02);
    sky.horizonColor = vec3(0.05, 0.08, 0.12);
    return sky;
}

SkyAtmosphere createSkyPreset_CloudyDay() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunElevation = 0.6;
    sky.sunIntensity = 1.8;
    sky.cloudDensity = 0.8;
    sky.cloudCoverage = 0.9;
    sky.zenithColor = vec3(0.4, 0.45, 0.5);
    sky.horizonColor = vec3(0.5, 0.5, 0.5);
    sky.fogDensity = 0.025;
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Stormy() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunElevation = 0.3;
    sky.sunIntensity = 0.8;
    sky.sunColor = vec3(0.7, 0.7, 0.75);
    sky.cloudDensity = 1.0;
    sky.cloudCoverage = 1.0;
    sky.cloudColorDay = vec3(0.3, 0.3, 0.35);
    sky.zenithColor = vec3(0.2, 0.22, 0.25);
    sky.horizonColor = vec3(0.3, 0.3, 0.35);
    sky.fogDensity = 0.04;
    sky.enableStars = false;
    return sky;
}

SkyAtmosphere createSkyPreset_Foggy() {
    SkyAtmosphere sky = createDefaultSky();
    sky.sunElevation = 0.5;
    sky.sunIntensity = 1.2;
    sky.fogDensity = 0.05;
    sky.fogDistance = 30.0;
    sky.fogHeightFalloff = 1.5;
    sky.fogColor = vec3(0.7, 0.7, 0.75);
    sky.zenithColor = vec3(0.5, 0.55, 0.6);
    sky.horizonColor = vec3(0.6, 0.6, 0.65);
    sky.cloudDensity = 0.4;
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
    float sunRot = sky.sunRotation;
    float sunElev = sky.sunElevation;
    
    light.sunDirection = calculateSunDirection(sunRot, sunElev);
    light.sunElevation = sunElev;
    light.sunColor = sky.sunColor;
    light.sunIntensity = sky.sunIntensity;
    
    // Moon direction (typically opposite to sun)
    if (sky.enableMoon) {
        float moonRot = sky.moonRotation;
        float moonElev = sky.moonElevation;
        light.moonDirection = calculateSunDirection(moonRot, moonElev);
        light.moonElevation = moonElev;
        light.moonColor = sky.moonColor;
        light.moonIntensity = sky.moonIntensity;
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

// Calculate optical depth through atmosphere
// Simplified model: optical depth increases as elevation decreases
// (more atmosphere to travel through near horizon)
float getOpticalDepth(vec3 dir, float scaleHeight) {
    float elevation = max(dir.y, 0.01);
    // Inverse relationship: lower elevation = more atmosphere = higher optical depth
    return scaleHeight / elevation;
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
    float rayleighDepth = calculateOpticalDepth(safeDir, sky.rayleighScaleHeight);
    float mieDepth = calculateOpticalDepth(safeDir, sky.mieScaleHeight);
    float sunRayleighDepth = calculateOpticalDepth(light.sunDirection, sky.rayleighScaleHeight);
    float sunMieDepth = calculateOpticalDepth(light.sunDirection, sky.mieScaleHeight);
    
    // Base scattering coefficients (scaled by configuration)
    vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * sky.rayleighCoefficient;
    float betaM = 4e-6 * sky.mieCoefficient;
    
    // Transmittance (Beer's law)
    vec3 rayleighTransmittance = exp(-betaR * rayleighDepth);
    float mieTransmittance = exp(-betaM * mieDepth);
    vec3 sunRayleighTransmittance = exp(-betaR * sunRayleighDepth);
    float sunMieTransmittance = exp(-betaM * sunMieDepth);
    
    // Phase functions
    float rayleighPhaseValue = rayleighPhase(sunDot);
    float miePhaseValue = miePhase(sunDot, sky.mieG);
    
    // In-scattering
    vec3 rayleighInScatter = betaR * rayleighPhaseValue * sunRayleighTransmittance;
    float mieInScatter = betaM * miePhaseValue * sunMieTransmittance;
    
    // Scattered sunlight
    vec3 scattering = (rayleighInScatter + vec3(mieInScatter)) * 
                      light.sunColor * light.sunIntensity * sky.scatteringScale;
    
    return scattering;
}

// Evaluate sun/moon disk and halo
vec3 evaluateSunMoonDisk(SkyAtmosphere sky, vec3 dir, LightingInfo light) {
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    vec3 result = vec3(0.0);
    
    // Sun disk
    float sunDot = max(dot(safeDir, light.sunDirection), 0.0);
    float sunAngle = acos(clamp(sunDot, 0.0, 1.0));
    float sunDisk = 1.0 - smoothstep(0.0, sky.sunSize, sunAngle);
    
    // Sun brightness based on elevation
    float sunBrightness = sky.sunPower;
    if (light.sunElevation < 0.1) {
        sunBrightness = mix(sky.sunPower * 0.2, sunBrightness, 
                           smoothstep(-0.1, 0.1, light.sunElevation));
    }
    
    vec3 sun = light.sunColor * sunDisk * sunBrightness * light.sunIntensity;
    
    // Sun halo (Mie scattering glow)
    float sunHalo = pow(max(0.0, sunDot), 16.0);
    float elevation = safeDir.y;
    float haloIntensity = (1.0 - elevation * 0.3) * 
                          (1.0 - exp(-4e-6 * sky.mieCoefficient * 
                                    calculateOpticalDepth(light.sunDirection, sky.mieScaleHeight)));
    float haloBrightness = mix(sunBrightness * 0.1, sunBrightness * 0.3,
                              smoothstep(-0.1, 0.1, light.sunElevation));
    vec3 halo = light.sunColor * sunHalo * haloIntensity * haloBrightness * light.sunIntensity;
    
    result += sun + halo;
    
    // Moon disk (if enabled)
    if (sky.enableMoon && light.moonElevation > 0.0) {
        float moonDot = max(dot(safeDir, light.moonDirection), 0.0);
        float moonAngle = acos(clamp(moonDot, 0.0, 1.0));
        float moonDisk = 1.0 - smoothstep(0.0, sky.moonSize, moonAngle);
        
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
    if (pos.y < sky.cloudHeight || pos.y > sky.cloudHeight + sky.cloudThickness) {
        return 0.0;
    }
    
    float cloudY = (pos.y - sky.cloudHeight) / sky.cloudThickness;
    float verticalFalloff = 1.0 - abs(cloudY - 0.5) * 2.0;
    verticalFalloff = smoothstep(0.0, 1.0, verticalFalloff);
    
    vec2 windOffset = vec2(time * sky.cloudWindSpeed, time * sky.cloudWindSpeed * 0.75);
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
    density *= sky.cloudDensity * sky.cloudCoverage;
    
    return density;
}

float sampleClouds(SkyAtmosphere sky, vec3 rayStart, vec3 rayDir, float time, float maxDist) {
    if (!sky.enableClouds || rayDir.y <= 0.0) return 0.0;
    
    float t0 = (sky.cloudHeight - rayStart.y) / rayDir.y;
    float t1 = ((sky.cloudHeight + sky.cloudThickness) - rayStart.y) / rayDir.y;
    
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
        baseColor = sky.cloudColorNight;
    } else if (light.sunElevation < 0.2) {
        float sunsetFactor = smoothstep(0.2, 0.0, light.sunElevation);
        baseColor = mix(sky.cloudColorDay, sky.cloudColorSunset, sunsetFactor);
    } else {
        baseColor = sky.cloudColorDay;
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
    if (sky.enableMoon && light.moonElevation > 0.0) {
        moonBrightness = pow(light.moonElevation, 0.5) * light.moonIntensity;
    }
    vec3 nightSkyBase = sky.nightColor;
    vec3 moonlitSky = vec3(0.05, 0.06, 0.08) * moonBrightness;
    float nightGradient = mix(0.8, 1.2, pow(elevation, 0.3));
    vec3 nightSky = (nightSkyBase + moonlitSky) * nightGradient;
    
    // Twilight sky
    vec3 twilightSky = mix(sky.nightColor * 2.5, sky.twilightColor, twilightProgress);
    
    // Day sky
    vec3 daySky = mix(sky.horizonColor, sky.zenithColor, pow(elevation, 0.5));
    daySky *= light.sunIntensity * 0.5;
    
    // Blend sky states
    vec3 baseSky = mix(nightSky, twilightSky, 1.0 - deepNightFactor);
    baseSky = mix(baseSky, daySky, dayFactor);
    skyColor += baseSky;
    
    // Horizon glow
    float horizonFactor = pow(max(0.0, 1.0 - elevation), sky.horizonGlowPower);
    float horizonIntensity = horizonFactor * sky.horizonGlowIntensity;
    skyColor += sky.horizonGlowColor * horizonIntensity;
    
    // Add sun/moon disk
    skyColor += diskColor;
    
    // Add stars
    skyColor += evaluateStars(sky, safeDir, light);
    
    // Add clouds
    if (sky.enableClouds && elevation > 0.0) {
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

#endif // SKY_SYSTEM_FRAG

