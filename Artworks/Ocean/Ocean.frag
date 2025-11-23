// Physically-Based Ocean Shader with Modern Shading Models
// Based on: Tessendorf "Simulating Ocean Water" (SIGGRAPH 2001)
//          Jensen et al. "A Practical Model for Subsurface Light Transport"
//          Filament PBR Engine
//          Unreal Engine 4/5 Water Shading
//          "Multiple-Scattering Microfacet BSDFs with the Smith Model"
//
// MODERN SHADING FEATURES:
// - Multi-scattering GGX BRDF (accounts for light bouncing between microfacets)
// - Improved Image-Based Lighting (IBL) with proper hemisphere sampling
// - Filament-style PBR with better energy conservation
// - Enhanced subsurface scattering with improved phase functions
// - Wavelength-dependent Fresnel with dispersion
// - Realistic caustics with proper light diffusion
// - Sky-colored specular reflections (not white)
// - Proper volumetric light scattering

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.0001;

// Raymarching
const int MAX_STEPS = 1000;
const float MIN_DIST = .001;
const float MAX_DIST = 150.0;

// Physical Constants
const float GRAVITY = 9.81;
const vec3 F0_WATER = vec3(0.02);

// ============================================================================
// SKY & ATMOSPHERE SYSTEM
// ============================================================================
// Comprehensive abstraction for lighting, sky, and atmospheric rendering
//
// USAGE:
//   SkyAtmosphere sky = createSkyPreset_ClearDay();
//   vec3 skyColor = evaluateSky(sky, dir, time);
//   LightingInfo light = evaluateLighting(sky, time);
//   vec3 fogColor = applyAtmosphericFog(color, pos, camPos, rayDir, sky, time);
//
// PRESETS:
//   - createSkyPreset_ClearDay()      // Bright sunny day
//   - createSkyPreset_Sunset()        // Warm sunset/sunrise
//   - createSkyPreset_Night()         // Starlit night with moon
//   - createSkyPreset_CloudyDay()     // Overcast day
//   - createSkyPreset_Stormy()        // Dark stormy sky
//   - createSkyPreset_Foggy()         // Foggy/hazy atmosphere
// ============================================================================

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
float waveAmps[NUM_WAVES] = float[](
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
float waveFreqs[NUM_WAVES] = float[](
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
const float TIME_SCALE = 0.3; // Slower, more contemplative motion

float getWaveSpeed(float k) {
    return sqrt(GRAVITY * k) * TIME_SCALE;
}

// --- Time of Day System ---
// Controls sun position and sky appearance throughout the day
// timeOfDay: 0.0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1.0 = midnight

// Get time of day from iTime (24-hour cycle, adjustable)
// Use iTime directly or create a cycle: mod(iTime / 60.0, 1.0) for 60-second day cycle
float getTimeOfDay(float time) {
    // Create a day cycle (adjust divisor to change speed)
    // 120.0 = 2 minute day cycle, 60.0 = 1 minute, etc.
    return mod(time / 120.0, 1.0);
}

// Calculate sun position based on time of day
// Returns normalized sun direction (y-component is elevation)
vec3 getSunDirection(float timeOfDay) {
    // Sun path: rises in east (x=-1), sets in west (x=+1)
    // Elevation: -1 (below horizon) to 1 (zenith)
    float sunAngle = timeOfDay * TAU - PI * 0.5; // Start at -90° (sunrise)
    float elevation = sin(sunAngle); // -1 to 1
    float azimuth = cos(sunAngle); // East to West
    
    // Sun moves from east (-1) to west (+1) as time progresses
    // At noon (timeOfDay=0.5), sun is at zenith (elevation=1, azimuth=0)
    vec3 sunDir = normalize(vec3(azimuth * 0.8, elevation, -azimuth * 0.6));
    
    return sunDir;
}

// Get sun color based on elevation (redder at horizon due to atmospheric scattering)
// Smooth transitions throughout
vec3 getSunColorFromElevation(float sunElevation) {
    // Base sun color (white/yellow)
    vec3 baseColor = vec3(1.0, 0.98, 0.95);
    
    // Sunset/sunrise colors (red/orange)
    vec3 sunsetColor = vec3(1.0, 0.6, 0.3);
    
    // Night color (blue/magenta for moon)
    vec3 nightColor = vec3(0.3, 0.4, 0.6);
    
    // Smooth blending factors
    float nightToSunset = smoothstep(-0.3, 0.0, sunElevation); // 0.0 to 1.0 from deep night to horizon
    float sunsetToDay = smoothstep(0.0, 0.3, sunElevation); // 0.0 to 1.0 from horizon to day
    
    // Blend night -> sunset -> day
    vec3 color = mix(nightColor, sunsetColor, nightToSunset);
    color = mix(color, baseColor, sunsetToDay);
    
    return color;
}

// Get sun intensity based on elevation (smooth transitions)
float getSunIntensityFromElevation(float sunElevation) {
    // Below horizon - very dim (moonlight), smoothly fade to zero
    float nightIntensity = 0.1 * smoothstep(-0.3, 0.0, sunElevation);
    
    // Near horizon - dim (sunrise/sunset), smooth transition
    float twilightIntensity = mix(1.0, 2.5, smoothstep(0.0, 0.1, sunElevation));
    
    // Above horizon - full intensity
    float dayIntensity = 2.5;
    
    // Smoothly blend between night, twilight, and day
    float nightFactor = smoothstep(0.0, -0.1, sunElevation); // 1.0 when below horizon
    float dayFactor = smoothstep(0.1, 0.15, sunElevation); // 1.0 when well above horizon
    
    float intensity = mix(nightIntensity, twilightIntensity, 1.0 - nightFactor);
    intensity = mix(intensity, dayIntensity, dayFactor);
    
    return intensity;
}

// Lighting Configuration - now uses SkyAtmosphere passed as parameter
// These helper functions are deprecated - use evaluateLighting() directly instead

// Water Properties
const vec3 waterAbsorption = vec3(0.15, 0.045, 0.015); // m^-1 (realistic values)
const float baseRoughness = 0.03; // Base roughness for calm water (very smooth)
const float maxRoughness = 0.12;  // Maximum roughness for choppy water
const float WATER_IOR = 1.33; // Index of refraction for water
const float AIR_IOR = 1.0;    // Index of refraction for air

// Water Colors - Realistic ocean colors
// Shallow: Bright turquoise/cyan (tropical water)
// Deep: Darker blue but still vibrant (not too dark)
const vec3 deepWaterColor = vec3(0.0, 0.2, 0.4);   // Darker blue, more vibrant
const vec3 shallowWaterColor = vec3(0.0, 0.5, 0.75); // Bright turquoise

// --- Ocean Floor Terrain Parameters ---
// Controls the shape and variation of the ocean floor
struct OceanFloorParams {
    float baseDepth;        // Base depth of the ocean floor (negative Y value)
    float heightVariation;  // Maximum height variation from base depth
    float largeScale;       // Large-scale terrain feature size
    float mediumScale;      // Medium-scale terrain feature size
    float smallScale;       // Small-scale terrain feature size (detail)
    float largeAmplitude;   // Amplitude of large-scale features
    float mediumAmplitude;  // Amplitude of medium-scale features
    float smallAmplitude;   // Amplitude of small-scale features (detail)
    float roughness;        // Overall terrain roughness (0.0 = smooth, 1.0 = rough)
};

// Default ocean floor parameters
OceanFloorParams createDefaultOceanFloor() {
    OceanFloorParams params;
    params.baseDepth = -105.0;        // Base depth at -105m
    params.heightVariation = 25.0;    // ±25m variation
    params.largeScale = 0.02;          // Large features every ~50m
    params.mediumScale = 0.08;         // Medium features every ~12.5m
    params.smallScale = 0.3;           // Small features every ~3.3m
    params.largeAmplitude = 0.6;       // Large features contribute 60%
    params.mediumAmplitude = 0.3;      // Medium features contribute 30%
    params.smallAmplitude = 0.1;       // Small features contribute 10%
    params.roughness = 0.5;            // Moderate roughness
    return params;
}

// Simple hash function for pseudo-random noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
    
    return value / maxValue; // Normalize to [0, 1]
}

// Get ocean floor height at position (x, z)
// Returns the Y coordinate of the ocean floor
float getOceanFloorHeight(vec2 pos, OceanFloorParams params) {
    // Large-scale terrain (hills, valleys)
    float largeNoise = fractalNoise(pos, params.largeScale, 3, 0.5);
    float largeHeight = (largeNoise - 0.5) * 2.0; // [-1, 1]
    
    // Medium-scale terrain (ridges, slopes)
    float mediumNoise = fractalNoise(pos + vec2(100.0, 100.0), params.mediumScale, 2, 0.6);
    float mediumHeight = (mediumNoise - 0.5) * 2.0; // [-1, 1]
    
    // Small-scale terrain (detail, bumps)
    float smallNoise = fractalNoise(pos + vec2(200.0, 200.0), params.smallScale, 2, 0.7);
    float smallHeight = (smallNoise - 0.5) * 2.0; // [-1, 1]
    
    // Combine all scales with their amplitudes
    float heightVariation = largeHeight * params.largeAmplitude +
                           mediumHeight * params.mediumAmplitude +
                           smallHeight * params.smallAmplitude;
    
    // Apply roughness (adds more variation)
    heightVariation *= (1.0 + params.roughness * 0.5);
    
    // Scale by height variation parameter and add to base depth
    float floorHeight = params.baseDepth + heightVariation * params.heightVariation;
    
    return floorHeight;
}

// --- Modular Physically-Based Camera System ---
// Implements real camera parameters: shutter speed, f-stop, ISO, focal length
//
// USAGE:
//   1. Create a camera: Camera cam = createDefaultCamera();
//   2. Configure settings: cam.fStop = 2.8; cam.shutterSpeed = 1.0/60.0; cam.iso = 100.0;
//   3. Use presets: Camera cam = createSunnyDayCamera(); // or createLowLightCamera(), etc.
//   4. Generate rays: vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
//   5. Apply exposure: color = applyExposure(color, cam);
//
// CAMERA PARAMETERS:
//   - focalLength: Lens focal length in mm (24mm wide, 50mm standard, 85mm portrait, 200mm telephoto)
//   - fStop: Aperture f-number (1.4 wide open, 2.8, 5.6, 8, 11, 16, 22 narrow)
//   - shutterSpeed: Exposure time in seconds (1/60 = 0.0167, 1/250 = 0.004)
//   - iso: ISO sensitivity (100 low, 400 medium, 800 high, 1600+ very high)
//   - focusDistance: Distance to focus plane in meters (for depth of field)
//   - enableDOF: Enable/disable depth of field (performance impact)
//
// EXPOSURE RELATIONSHIP:
//   - Lower f-stop (wider aperture) = brighter image, less depth of field
//   - Slower shutter = brighter image, more motion blur
//   - Higher ISO = brighter image, more noise
//   - Standard exposure: f/2.8, 1/60s, ISO 100

struct Camera {
    // Position and orientation
    vec3 position;
    vec3 target;
    vec3 up;
    
    // Physical camera parameters
    float focalLength;      // mm (e.g., 24mm, 50mm, 85mm)
    float fStop;            // Aperture f-number (e.g., 1.4, 2.8, 5.6, 11)
    float shutterSpeed;     // seconds (e.g., 1/60 = 0.0167, 1/250 = 0.004)
    float iso;              // ISO sensitivity (e.g., 100, 400, 1600)
    
    // Depth of field (optional)
    float focusDistance;    // meters - distance to focus plane
    bool enableDOF;         // Enable depth of field
    
    // Sensor properties
    float sensorWidth;      // mm (full frame = 36mm, APS-C = 23.6mm)
    float sensorHeight;     // mm (full frame = 24mm, APS-C = 15.7mm)
};

// Default camera configuration
Camera createDefaultCamera() {
    Camera cam;
    
    // Position and orientation
    cam.position = vec3(0.0, 4.0, 8.0);
    cam.target = vec3(0.0, 0.0, 0.0);
    cam.up = vec3(0.0, 1.0, 0.0);
    
    // Physical parameters (realistic values)
    cam.focalLength = 50.0;        // 50mm lens (standard)
    cam.fStop = 2.8;               // f/2.8 (moderate aperture)
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100 (low sensitivity)
    
    // Depth of field
    cam.focusDistance = 10.0;      // Focus at 10 meters
    cam.enableDOF = false;         // Disable by default (performance)
    
    // Sensor (full frame 35mm)
    cam.sensorWidth = 36.0;
    cam.sensorHeight = 24.0;
    
    return cam;
}

// Camera presets for common scenarios
Camera createSunnyDayCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 8.0;               // f/8 (smaller aperture for bright scenes)
    cam.shutterSpeed = 1.0 / 250.0; // 1/250s (fast shutter)
    cam.iso = 100.0;               // ISO 100 (low sensitivity)
    return cam;
}

Camera createLowLightCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8 (wide aperture)
    cam.shutterSpeed = 1.0 / 60.0; // 1/60s (slower shutter)
    cam.iso = 800.0;               // ISO 800 (higher sensitivity)
    return cam;
}

Camera createMotionBlurCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8
    cam.shutterSpeed = 1.0 / 30.0; // 1/30s (slow shutter for motion blur)
    cam.iso = 200.0;               // ISO 200
    return cam;
}

Camera createHighSpeedCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8
    cam.shutterSpeed = 1.0 / 1000.0; // 1/1000s (very fast shutter)
    cam.iso = 400.0;               // ISO 400
    return cam;
}

Camera createCinematicCamera() {
    Camera cam = createDefaultCamera();
    cam.focalLength = 85.0;        // 85mm (portrait lens)
    cam.fStop = 1.4;               // f/1.4 (very wide aperture)
    cam.shutterSpeed = 1.0 / 48.0; // 1/48s (cinematic 24fps with 180° shutter)
    cam.iso = 100.0;               // ISO 100
    cam.enableDOF = true;          // Enable depth of field
    cam.focusDistance = 8.0;       // Focus at 8 meters
    return cam;
}

// log2 implementation (fallback for older GLSL versions)
float log2_impl(float x) {
    return log(x) / log(2.0);
}

// Calculate exposure value (EV) from camera settings
// Uses the standard photographic exposure formula
// Each f-stop change doubles/halves light (f/1.4, f/2, f/2.8, f/4, f/5.6, f/8, f/11, f/16, f/22)
// Each shutter speed change doubles/halves light (1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15)
// Each ISO change doubles/halves sensitivity (100, 200, 400, 800, 1600)
float calculateExposure(Camera cam) {
    // Exposure is inversely proportional to f-stop squared
    // Lower f-stop number = larger aperture = more light
    // Formula: Exposure ∝ 1 / (fStop^2) * shutterSpeed * ISO
    
    // Calculate relative exposure compared to standard
    // Standard: f/2.8, 1/60s, ISO 100
    
    // F-stop contribution (inverse relationship - lower f-stop = more light)
    // f/1.4 = 4x brighter than f/2.8, f/5.6 = 4x darker than f/2.8
    float fStopFactor = (2.8 * 2.8) / (cam.fStop * cam.fStop);
    
    // Shutter speed contribution (longer = more light)
    // 1/30s = 2x brighter than 1/60s, 1/125s = 2x darker than 1/60s
    float shutterFactor = (1.0 / 60.0) / cam.shutterSpeed;
    
    // ISO contribution (higher = more sensitive = brighter)
    // ISO 200 = 2x brighter than ISO 100, ISO 50 = 2x darker than ISO 100
    float isoFactor = cam.iso / 100.0;
    
    // Combined exposure multiplier
    float exposureMultiplier = fStopFactor * shutterFactor * isoFactor;
    
    // Clamp to reasonable range
    // This allows for dramatic changes: 0.1x to 10x brightness
    return clamp(exposureMultiplier, 0.1, 10.0);
}

// Calculate field of view from focal length and sensor size
// FOV = 2 * atan(sensorSize / (2 * focalLength))
float calculateFOV(Camera cam) {
    // Use sensor width for horizontal FOV
    float fovRadians = 2.0 * atan(cam.sensorWidth / (2.0 * cam.focalLength));
    return fovRadians;
}

// Calculate depth of field parameters
// Returns circle of confusion radius in meters
float calculateCircleOfConfusion(Camera cam, float distance) {
    if (!cam.enableDOF) return 0.0;
    
    // Circle of confusion based on sensor size
    // CoC = (sensorWidth / 1500) for acceptable sharpness
    float cocDiameter = cam.sensorWidth / 1500.0; // mm
    
    // Convert to meters
    float cocRadius = cocDiameter * 0.0005; // mm to meters (approximate)
    
    // Calculate blur based on focus distance
    float focusDist = cam.focusDistance;
    float blurAmount = abs(distance - focusDist) / focusDist;
    
    // Aperture affects depth of field
    // Larger f-stop (smaller aperture) = more depth of field
    float dofFactor = cam.fStop / 2.8; // Normalize to f/2.8
    
    return cocRadius * blurAmount * dofFactor;
}

// Build camera coordinate system
// Returns: (right, up, forward) basis vectors
mat3 buildCameraBasis(Camera cam) {
    vec3 forward = normalize(cam.target - cam.position);
    vec3 right = normalize(cross(cam.up, forward));
    vec3 up = normalize(cross(forward, right));
    
    // Handle degenerate case (looking straight up/down)
    if (length(right) < 0.001) {
        right = vec3(1.0, 0.0, 0.0);
        up = normalize(cross(forward, right));
    }
    
    return mat3(right, up, forward);
}

// Generate camera ray with proper FOV
vec3 generateCameraRay(Camera cam, vec2 uv, vec2 resolution) {
    mat3 basis = buildCameraBasis(cam);
    
    // Calculate aspect ratio
    float aspect = resolution.x / resolution.y;
    
    // Calculate FOV
    float fov = calculateFOV(cam);
    float tanHalfFov = tan(fov * 0.5);
    
    // Convert UV to camera space (-1 to 1)
    vec2 screenUV = (uv - 0.5) * 2.0;
    screenUV.x *= aspect;
    
    // Scale by FOV
    screenUV *= tanHalfFov;
    
    // Generate ray direction in camera space
    vec3 rayDir = normalize(vec3(screenUV, 1.0));
    
    // Transform to world space
    return basis * rayDir;
}

// Apply exposure to color
// Exposure should be applied before tone mapping for proper HDR handling
vec3 applyExposure(vec3 color, Camera cam) {
    float exposure = calculateExposure(cam);
    
    // Apply exposure multiplier
    // This directly affects brightness before tone mapping
    vec3 exposedColor = color * exposure;
    
    return exposedColor;
}

// Apply depth of field blur (simplified - uses distance-based blur)
vec3 applyDepthOfField(vec3 color, float distance, Camera cam) {
    if (!cam.enableDOF) return color;
    
    float coc = calculateCircleOfConfusion(cam, distance);
    // Simplified: just darken/blur based on CoC
    // In a full implementation, this would sample multiple rays
    float blurFactor = 1.0 - min(coc * 10.0, 0.5);
    return color * blurFactor;
}

// --- Gerstner Wave Function ---
// Based on: Tessendorf "Simulating Ocean Water"
// Properly models wave motion with horizontal displacement

vec3 gerstnerWave(vec2 pos, vec2 dir, float amplitude, float frequency, float speed, float time, float steepness) {
    float k = frequency;
    float w = speed; // Wave speed from dispersion
    float phase = dot(pos, dir) * k + time * w;
    float s = sin(phase);
    float c = cos(phase);
    
    // Horizontal displacement (choppy waves)
    // Normalize steepness by wave parameters to make it dimensionless
    // Standard Gerstner uses Q directly; we divide by (k * amplitude) so
    // the input 'steepness' values (0.05-0.15) produce Q values in valid range
    // Each wave's steepness is independent of total wave count
    float q = steepness / (k * amplitude);
    vec2 displacement = dir * q * amplitude * c;
    
    // Vertical displacement
    float height = amplitude * s;
    
    return vec3(displacement.x, height, displacement.y);
}

vec3 getWaveDisplacement(vec2 pos, float time) {
    vec3 displacement = vec3(0.0);
    
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        
        // Steepness varies by wave - follows realistic ocean physics
        // Primary swells are gentler, detail waves are choppier
        // Steepness values are carefully tuned for realistic appearance
        float steepness;
        if (i == 0) steepness = 0.04;      // Primary swell - very gentle
        else if (i == 1) steepness = 0.06; // Secondary swell
        else if (i == 2) steepness = 0.07; // Tertiary swell
        else if (i == 3) steepness = 0.08; // Cross swell
        else if (i == 4) steepness = 0.10; // Detail wave 1
        else if (i == 5) steepness = 0.12; // Detail wave 2
        else if (i == 6) steepness = 0.14; // Detail wave 3
        else if (i == 7) steepness = 0.16; // Detail wave 4
        else if (i == 8) steepness = 0.18; // Detail wave 5
        else steepness = 0.20;            // Detail wave 6 - choppiest
        
        displacement += gerstnerWave(pos, dir, waveAmps[i], k, w, time, steepness);
    }
    
    return displacement;
}

float getWaveHeight(vec2 pos, float time) {
    vec3 disp = getWaveDisplacement(pos, time);
    return disp.y;
}

// Compute wave height and gradient analytically (much faster than finite differences)
// Returns vec3(height, grad.x, grad.y)
// For Gerstner waves: h = amplitude * sin(phase), so ∂h/∂pos = amplitude * k * dir * cos(phase)
vec3 getWaveHeightAndGradient(vec2 pos, float time) {
    float height = 0.0;
    vec2 grad = vec2(0.0);
    
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(pos, dir) * k + time * w;
        float s = sin(phase);
        float c = cos(phase);
        float A = waveAmps[i];
        
        // Height: sum of vertical displacements
        height += A * s;
        
        // Analytical gradient: ∂h/∂pos = amplitude * k * dir * cos(phase)
        grad += A * k * dir * c;
    }
    
    return vec3(height, grad.x, grad.y);
}

vec2 getWaveGradient(vec2 pos, float time) {
    vec3 hg = getWaveHeightAndGradient(pos, time);
    return hg.yz; // Return gradient components
}

// Enhanced normal calculation with analytical derivatives
// Clean normals without banding artifacts
vec3 getNormal(vec2 pos, float time, out vec2 gradient) {
    // Get base gradient analytically (fast and accurate)
    vec2 grad = getWaveGradient(pos, time);
    
    // Very light smoothing to reduce banding - only at small scale
    const float smoothingRadius = 0.01;
    vec2 gradSmooth = grad;
    gradSmooth += getWaveGradient(pos + vec2(smoothingRadius, 0.0), time) * 0.15;
    gradSmooth += getWaveGradient(pos - vec2(smoothingRadius, 0.0), time) * 0.15;
    gradSmooth += getWaveGradient(pos + vec2(0.0, smoothingRadius), time) * 0.15;
    gradSmooth += getWaveGradient(pos - vec2(0.0, smoothingRadius), time) * 0.15;
    grad = mix(grad, gradSmooth / 1.6, 0.2); // Very gentle smoothing
    
    gradient = grad;
    
    // Build normal from gradient (analytical, no finite differences needed)
    // Normal = (-dh/dx, 1, -dh/dz) normalized
    vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));
    
    // Add subtle micro-detail only where needed (reduces banding)
    // Only add detail at wave crests where it matters
    float waveHeight = getWaveHeight(pos, time);
    float crestFactor = smoothstep(-0.2, 0.3, waveHeight);
    
    if (crestFactor > 0.1) {
        const float microDetail = 0.02;
        vec2 gradX = getWaveGradient(pos + vec2(microDetail, 0.0), time);
        vec2 gradY = getWaveGradient(pos + vec2(0.0, microDetail), time);
        
        vec3 microNormal = normalize(vec3(-(gradX.x + grad.x) * 0.5, 1.0, -(gradY.y + grad.y) * 0.5));
        normal = normalize(mix(normal, microNormal, crestFactor * 0.08)); // Very subtle
    }
    
    return normal;
}


// --- Physically-Based Fresnel ---
// Based on: Schlick's approximation with proper angle of incidence
// Water-air interface Fresnel with wavelength-dependent IOR (dispersion)
// Properly handles grazing angle reflections and perpendicular transparency

// --- Modern Fresnel (Schlick's Approximation) ---
// Clamps cosTheta to prevent issues at grazing angles
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    // Clamp cosTheta to prevent issues at grazing angles
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    // Standard Schlick approximation
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    return F;
}

// Wavelength-dependent Fresnel F0 for water-air interface
// F0 = ((n1 - n2) / (n1 + n2))^2 where n1=air, n2=water
// Water has dispersion - slightly different IOR per wavelength
vec3 getWaterF0() {
    // Realistic IOR values for water at visible wavelengths (at 20°C)
    // Red (650nm): ~1.331, Green (550nm): ~1.333, Blue (450nm): ~1.335
    vec3 waterIOR = vec3(1.331, 1.333, 1.335);
    vec3 airIOR = vec3(1.0);
    
    // F0 = ((n1 - n2) / (n1 + n2))^2
    // For air to water: n1=1.0 (air), n2=waterIOR
    // This gives the reflectance at perpendicular incidence (normal incidence)
    vec3 ratio = (airIOR - waterIOR) / (airIOR + waterIOR);
    vec3 F0 = ratio * ratio; // Square the ratio
    
    // Verify: For n_water = 1.33, F0 = ((1.0 - 1.33) / (1.0 + 1.33))^2 = (-0.33/2.33)^2 ≈ 0.02
    // The result should be around 0.02 for all wavelengths
    // Clamp to ensure realistic values
    return clamp(F0, vec3(0.018), vec3(0.022));
}


// Proper Fresnel calculation for water surface
// viewDir: direction FROM surface TO camera (normalized, = -rd where rd is ray direction)
// normal: surface normal (pointing up, normalized)
// Returns: Fresnel reflectance (0 = transparent, 1 = reflective)
vec3 getFresnel(vec3 viewDir, vec3 normal) {
    // For Fresnel, we need the cosine of the angle between the view direction and the normal
    // In graphics, Fresnel is typically calculated using the angle between the direction TO the viewer
    // and the normal. Since viewDir points FROM surface TO camera, we can use it directly.
    // However, we need the absolute value to get the angle (0 to 90 degrees).
    
    // When looking straight down: viewDir points up, normal points up → dot is positive
    // When looking at grazing angle: viewDir is nearly horizontal, normal is up → dot is small
    // So: cosTheta = abs(dot(viewDir, normal)) gives us the correct angle
    
    float cosTheta = abs(dot(viewDir, normal));
    
    // Clamp to valid range [0, 1]
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    
    // For realistic water-air interface, F0 ≈ 0.02 at perpendicular incidence
    vec3 F0 = getWaterF0();
    
    // Schlick's Fresnel approximation
    // F(cosTheta) = F0 + (1 - F0) * (1 - cosTheta)^5
    // At perpendicular (cosTheta = 1.0): F = F0 ≈ 0.02 (2% reflection, 98% transmission)
    // At grazing (cosTheta = 0.0): F = 1.0 (100% reflection, 0% transmission)
    vec3 F = fresnelSchlick(cosTheta, F0);
    
    // Ensure realistic range
    return clamp(F, F0, vec3(1.0));
}

// Fresnel for specular highlights (uses half-vector for microfacet model)
// viewDir: FROM surface TO camera
// lightDir: FROM surface TO light
vec3 getFresnelSpecular(vec3 viewDir, vec3 lightDir, vec3 normal) {
    // For microfacet BRDF, we use the half-vector
    // Both viewDir and lightDir point FROM surface, so half-vector is correct
    vec3 halfVec = normalize(viewDir + lightDir);
    
    // VdotH for Fresnel: angle between view direction and half-vector
    // viewDir points FROM surface TO camera, so we use it directly
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    vec3 F0 = getWaterF0();
    return fresnelSchlick(VdotH, F0);
}

// ============================================================================
// MODERN PBR SHADING MODELS
// ============================================================================
// Based on: Filament PBR, Unreal Engine 4/5, and modern research
// Includes: Multi-scattering GGX, improved IBL, energy conservation

// --- Modern GGX Distribution (Trowbridge-Reitz) ---
// More accurate than basic GGX, handles edge cases better
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / max(denom, EPSILON);
}

// --- Improved Geometry Function (Smith-GGX) ---
// Filament-style with better handling of grazing angles
float G_SchlickGGX(float NdotV, float roughness) {
    // Direct roughness remapping for better visual results
    float r = roughness + 1.0;
    float k = (r * r) / 8.0; // Remapping for IBL
    float denom = NdotV * (1.0 - k) + k;
    return NdotV / max(denom, EPSILON);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    float ggx1 = G_SchlickGGX(NdotV, roughness);
    float ggx2 = G_SchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// --- Multi-Scattering Compensation ---
// Based on: "Multiple-Scattering Microfacet BSDFs with the Smith Model"
// Accounts for light bouncing multiple times between microfacets
// This makes rough surfaces brighter and more realistic
vec3 getMultiScatteringCompensation(vec3 F, vec3 F0, float roughness) {
    // Simplified multi-scattering approximation
    // Rough surfaces scatter light multiple times, increasing brightness
    vec3 E = vec3(1.0) - F0; // Average Fresnel (per channel)
    vec3 Eavg = E; // Already a vec3
    
    // Multi-scattering factor (simplified)
    float roughness2 = roughness * roughness;
    vec3 Fms = (vec3(1.0) - Eavg) / (vec3(1.0) - Eavg * (1.0 - roughness2));
    
    // Add multi-scattering contribution
    vec3 Fadd = Fms * (vec3(1.0) - F);
    
    return F + Fadd;
}

// --- Modern Specular BRDF with Multi-Scattering ---
// Based on: Filament PBR and modern microfacet models
// Includes multi-scattering compensation for realistic rough surfaces
// viewDir: FROM surface TO camera
// lightDir: FROM surface TO light
vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness, vec3 skyReflectionColor) {
    // Half-vector for microfacet model
    vec3 halfVec = normalize(viewDir + lightDir);
    
    // Dot products for BRDF
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0.0);
    
    // Clamp roughness to prevent division issues
    float clampedRoughness = max(roughness, 0.01);
    
    // Modern Cook-Torrance BRDF terms
    float D = D_GGX(NdotH, clampedRoughness);
    float G = G_Smith(NdotV, NdotL, clampedRoughness);
    
    // Fresnel term - uses VdotH (angle between view and half-vector)
    vec3 F0 = getWaterF0();
    vec3 F = fresnelSchlick(VdotH, F0);
    
    // Multi-scattering compensation for rough surfaces
    // Makes rough water surfaces brighter and more realistic
    F = getMultiScatteringCompensation(F, F0, clampedRoughness);
    
    // Cook-Torrance specular BRDF
    vec3 numerator = (D * G) * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    // Specular color should reflect the sky/environment, not just the sun
    // Mix sun color (direct highlight) with sky reflection (environment)
    vec3 specularColor = mix(lightColor, skyReflectionColor, 0.7);
    
    return (numerator / denominator) * specularColor * NdotL;
}

// --- Physically-Based Atmospheric Scattering ---
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

// --- Advanced Sky Sphere System ---
// Comprehensive sky rendering with volumetric clouds, stars, and enhanced atmospheric scattering

// Star field generation for night sky
float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

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

// --- Physically-Based Subsurface Scattering ---
// Based on: Jensen et al. "A Practical Model for Subsurface Light Transport"
//          Proper phase function and multiple scattering for realistic water appearance
vec3 getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth) {
    vec3 backLight = -lightDir;
    
    // Henyey-Greenstein phase function for water (forward scattering)
    // Water has strong forward scattering (g ≈ 0.9)
    const float g = 0.9; // Asymmetry parameter
    float cosTheta = dot(normalize(viewDir), backLight);
    float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);
    phase /= 4.0 * PI;
    
    // Realistic scattering coefficients (wavelength-dependent)
    // Blue scatters more than red (Rayleigh scattering in water)
    // Values from research: water scattering is wavelength-dependent
    vec3 scatteringCoeff = vec3(0.0015, 0.003, 0.005); // m^-1 (realistic values)
    
    // Absorption coefficients (wavelength-dependent)
    // Red is absorbed more than blue (why deep water is blue)
    vec3 absorptionCoeff = waterAbsorption;
    
    // Single scattering with proper absorption
    vec3 transmittance = exp(-absorptionCoeff * depth);
    vec3 singleScatter = scatteringCoeff * phase * transmittance;
    
    // Multiple scattering approximation (diffuse component)
    // This creates the characteristic shallow water turquoise glow
    float NdotL = max(dot(normal, backLight), 0.0);
    
    // Shallow water boost - multiple scattering is stronger in shallow water
    float shallowBoost = 1.0 - smoothstep(0.5, 10.0, depth);
    
    // Multiple scattering uses reduced absorption (light bounces around)
    vec3 multipleTransmittance = exp(-absorptionCoeff * depth * 0.5);
    vec3 multipleScatter = scatteringCoeff * 0.4 * NdotL * multipleTransmittance;
    multipleScatter *= (1.0 + shallowBoost * 2.5);
    
    // Combine single and multiple scattering
    vec3 totalScatter = singleScatter + multipleScatter;
    
    // Apply shallow water color tint (turquoise/cyan glow)
    // This is the characteristic color of shallow water
    vec3 shallowTint = shallowWaterColor;
    vec3 deepTint = vec3(0.0, 0.3, 0.5); // Deeper blue
    
    // Mix based on depth - shallow water has turquoise glow
    float depthTintFactor = 1.0 - smoothstep(0.5, 15.0, depth);
    vec3 scatterColor = mix(deepTint, shallowTint, depthTintFactor);
    
    // Final subsurface scattering
    vec3 result = totalScatter * scatterColor * 1.5;
    
    return result;
}

// --- Wave Energy Calculation ---
// Based on: Tessendorf "Simulating Ocean Water" and realistic ocean physics
// Wave energy = 0.5 * rho * g * amplitude^2 (properly calculated)
float calculateWaveEnergy(vec2 pos, float time) {
    // Calculate wave energy from gradient magnitude and height
    vec2 grad = getWaveGradient(pos, time);
    float slope = length(grad);
    float height = getWaveHeight(pos, time);
    
    // Energy is proportional to slope^2 and height^2
    // Slope energy (kinetic) and height energy (potential)
    float kineticEnergy = slope * slope * 2.5; // Increased for better foam
    float potentialEnergy = height * height * 0.6;
    
    // Add velocity component (wave motion energy)
    float hPrev = getWaveHeight(pos, time - 0.05);
    float velocity = abs(height - hPrev) / 0.05;
    float velocityEnergy = velocity * velocity * 1.5;
    
    // Combine energy components
    float energy = kineticEnergy + potentialEnergy + velocityEnergy;
    
    // Normalize and enhance with proper curve
    energy = smoothstep(0.15, 2.0, energy);
    
    // Add multi-scale energy detail
    float energyDetail = 0.0;
    for (int i = 0; i < min(NUM_WAVES, 4); i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(pos, dir) * k + time * w;
        float waveContrib = abs(sin(phase)) * waveAmps[i];
        energyDetail += waveContrib;
    }
    energyDetail = smoothstep(0.2, 1.5, energyDetail * 0.3);
    energy = max(energy, energyDetail * 0.4);
    
    return energy;
}

// --- Advanced Foam Generation ---
// Based on: Weta Digital techniques and realistic wave breaking physics
// Uses proper wave energy, breaking criteria, and multi-scale foam patterns
float getFoam(vec2 pos, vec3 normal, float time, vec2 gradient) {
    // Wave gradient for steepness (passed as parameter to avoid redundant computation)
    vec2 grad = gradient;
    float slope = length(grad);
    
    // Wave height to identify crests
    float height = getWaveHeight(pos, time);
    
    // Calculate wave energy (key for realistic foam)
    float waveEnergy = calculateWaveEnergy(pos, time);
    
    // Enhanced curvature calculation (Laplacian) - waves break where curvature is high
    // Use multiple scales for accurate curvature measurement
    const float eps = 0.1;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    // Laplacian: second derivative approximation (curvature)
    float curvature = abs((hL + hR + hD + hU - 4.0 * height) / (eps * eps));
    
    // Multi-scale curvature for better foam detail
    float curvatureFine = 0.0;
    const float epsFine = 0.05;
    float hLF = getWaveHeight(pos - vec2(epsFine, 0.0), time);
    float hRF = getWaveHeight(pos + vec2(epsFine, 0.0), time);
    float hDF = getWaveHeight(pos - vec2(0.0, epsFine), time);
    float hUF = getWaveHeight(pos + vec2(0.0, epsFine), time);
    curvatureFine = abs((hLF + hRF + hDF + hUF - 4.0 * height) / (epsFine * epsFine));
    
    curvature = mix(curvature, curvatureFine, 0.4);
    
    // Wave breaking criterion: steepness approaching critical angle
    // Critical angle for wave breaking ≈ 30° (slope ≈ 0.58)
    // Realistic breaking happens when slope exceeds ~0.6
    float breakingFactor = smoothstep(0.55, 0.85, slope);
    
    // Enhanced foam calculation with proper physics
    // Foam appears where:
    // 1. High wave energy (primary factor)
    // 2. Waves are breaking (high steepness)
    // 3. High curvature (wave crests and breaking zones)
    // 4. At wave crests (positive height)
    // 5. High acceleration (wave is accelerating upward)
    
    float energyFoam = smoothstep(0.25, 0.95, waveEnergy);
    float steepnessFoam = smoothstep(0.45, 0.85, slope);
    float curvatureFoam = smoothstep(0.25, 0.8, curvature);
    float crestFoam = smoothstep(-0.15, 0.35, height);
    float breakingFoam = breakingFactor * smoothstep(0.5, 0.75, slope);
    
    // Calculate wave acceleration (second time derivative)
    // Waves breaking upward create more foam
    float hNow = height;
    float hPrev = getWaveHeight(pos, time - 0.1);
    float hNext = getWaveHeight(pos, time + 0.1);
    float acceleration = abs((hNext - 2.0 * hNow + hPrev) / 0.01);
    float accelerationFoam = smoothstep(0.5, 2.0, acceleration);
    
    // Combine foam factors with proper weighting (tuned for realism)
    // Foam should only appear where waves are actually breaking
    float foam = breakingFoam * 0.5 +           // Breaking is most important
                 energyFoam * 0.25 +            // High energy
                 steepnessFoam * 0.15 +          // Steep waves
                 curvatureFoam * 0.08 +         // High curvature
                 accelerationFoam * 0.02;        // Upward acceleration
    
    // Foam should only appear at wave crests where breaking occurs
    // Use crest factor as a mask to localize foam
    float crestMask = smoothstep(0.0, 0.4, height); // Only at crests
    foam *= crestMask;
    
    // Require minimum threshold - foam shouldn't be everywhere
    // Only show foam where multiple conditions are met
    float foamThreshold = max(breakingFoam, energyFoam * 0.7);
    foam *= smoothstep(0.3, 0.6, foamThreshold);
    
    // Wave-based pattern for organic appearance (only where foam exists)
    if (foam > 0.1) {
        // Use primary wave directions for foam streaks
        vec2 primaryDir = getWaveDir(0);
        float streakPhase = dot(pos, primaryDir) * 4.0 + time * 1.5;
        float streakPattern = sin(streakPhase) * 0.5 + 0.5;
        foam *= mix(0.6, 1.0, streakPattern);
        
        // Add secondary wave pattern for variation
        vec2 secondaryDir = getWaveDir(1);
        float secondaryPhase = dot(pos, secondaryDir) * 6.0 + time * 2.0;
        float secondaryPattern = sin(secondaryPhase) * 0.5 + 0.5;
        foam *= mix(0.8, 1.0, secondaryPattern);
    }
    
    // Smooth transitions with proper falloff (realistic foam distribution)
    // Higher threshold to prevent uniform distribution
    foam = smoothstep(0.25, 0.85, foam);
    
    // Only add subtle detail noise where foam already exists (not uniform)
    if (foam > 0.2) {
        // Use wave-based noise, not uniform noise
        float detailNoise = smoothNoise(pos * 12.0 + time * 0.3) * 0.08;
        foam = clamp(foam + detailNoise * foam, 0.0, 1.0);
    }
    
    return foam;
}

// --- Water Translucency ---
// Raymarch through water to find the ocean floor
// Returns: (hit, distance, floor position)
// hit = 1.0 if floor was found, 0.0 otherwise
vec3 raymarchThroughWater(vec3 startPos, vec3 rayDir, float time, OceanFloorParams floorParams) {
    float t = 0.0;
    const float MAX_WATER_DEPTH = 200.0; // Maximum depth to search
    const float WATER_STEP_SIZE = 0.5;   // Step size for underwater raymarching
    
    for (int i = 0; i < 200; i++) {
        vec3 pos = startPos + rayDir * t;
        
        // Get ocean floor height at this position
        float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
        
        // Check if we've hit the floor
        float distToFloor = pos.y - floorHeight;
        
        if (distToFloor < MIN_DIST) {
            // Hit the floor
            return vec3(1.0, t, 0.0); // (hit, distance, unused)
        }
        
        // Check if we've gone too deep or too far
        if (t > MAX_WATER_DEPTH || distToFloor > 50.0) {
            break;
        }
        
        // Adaptive step size based on distance to floor
        float stepSize = clamp(distToFloor * 0.3, WATER_STEP_SIZE, 2.0);
        t += stepSize;
    }
    
    return vec3(0.0, t, 0.0); // Didn't hit floor
}

// Calculate refracted ray direction using Snell's law
vec3 refractRay(vec3 incident, vec3 normal, float eta) {
    float cosI = -dot(incident, normal);
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    
    // Total internal reflection
    if (sinT2 > 1.0) {
        return reflect(incident, normal);
    }
    
    float cosT = sqrt(1.0 - sinT2);
    return eta * incident + (eta * cosI - cosT) * normal;
}

// Get ocean floor normal (for shading)
vec3 getOceanFloorNormal(vec3 pos, OceanFloorParams floorParams) {
    const float eps = 0.5;
    
    float hL = getOceanFloorHeight(pos.xz - vec2(eps, 0.0), floorParams);
    float hR = getOceanFloorHeight(pos.xz + vec2(eps, 0.0), floorParams);
    float hD = getOceanFloorHeight(pos.xz - vec2(0.0, eps), floorParams);
    float hU = getOceanFloorHeight(pos.xz + vec2(0.0, eps), floorParams);
    
    vec3 normal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
    return normal;
}

// --- Realistic Caustics Calculation ---
// Based on: Jensen et al. "A Practical Model for Subsurface Light Transport"
//          and proper light diffusion through water
// Uses proper light transport with diffusion to create soft, realistic caustics
// NOT laser-like sharp patterns, but soft, diffused underwater light
vec3 calculateCaustics(vec3 floorPos, vec3 waterSurfacePos, vec3 waterNormal, vec3 sunDir, float time, OceanFloorParams floorParams) {
    // Calculate refracted sun direction through water surface
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedSunDir = refractRay(-sunDir, waterNormal, eta);
    
    // If total internal reflection, no caustics
    if (dot(refractedSunDir, -waterNormal) < 0.0) {
        return vec3(0.0);
    }
    
    vec2 surfacePos = waterSurfacePos.xz;
    float depth = max(waterSurfacePos.y - floorPos.y, 0.1);
    
    // Sample multiple points on the surface to simulate light diffusion
    // This creates soft, realistic caustics instead of sharp laser-like patterns
    const int numSamples = 5; // Reduced samples for performance, but enough for diffusion
    float causticsIntensity = 0.0;
    
    // Use a small sampling radius to simulate light spread through water
    // Larger radius = more diffusion = softer caustics
    float sampleRadius = depth * 0.15; // Scale with depth for realistic diffusion
    
    for (int i = 0; i < numSamples; i++) {
        // Sample in a circular pattern around the surface point
        float angle = float(i) * TAU / float(numSamples);
        float radius = sampleRadius * (0.5 + float(i) * 0.1); // Varying radius
        vec2 sampleOffset = vec2(cos(angle), sin(angle)) * radius;
        vec2 samplePos = surfacePos + sampleOffset;
        
        // Calculate wave gradient at sample point
        vec2 grad = getWaveGradient(samplePos, time);
        float slope = length(grad);
        
        // Use wave slope to determine light focusing
        // But apply diffusion - not sharp focusing
        float focus = smoothstep(0.2, 0.6, slope);
        
        // Add wave pattern contribution
        float waveHeight = getWaveHeight(samplePos, time);
        float crestFactor = smoothstep(-0.1, 0.2, waveHeight);
        
        // Combine with proper weighting
        float sampleIntensity = focus * (0.7 + crestFactor * 0.3);
        
        // Apply Gaussian falloff for smooth diffusion
        float dist = length(sampleOffset);
        float gaussian = exp(-dist * dist / (sampleRadius * sampleRadius * 0.5));
        causticsIntensity += sampleIntensity * gaussian;
    }
    
    // Normalize by number of samples
    causticsIntensity /= float(numSamples);
    
    // Add large-scale wave pattern for organic caustics shape
    float largeScalePattern = 0.0;
    for (int i = 0; i < min(NUM_WAVES, 5); i++) {
        vec2 dir = getWaveDir(i);
        float k = waveFreqs[i];
        float w = getWaveSpeed(k);
        float phase = dot(surfacePos, dir) * k + time * w;
        largeScalePattern += sin(phase) * waveAmps[i] * 0.15;
    }
    largeScalePattern = abs(largeScalePattern);
    causticsIntensity += largeScalePattern * 0.3;
    
    // Apply proper depth falloff with diffusion
    // Deeper water = more diffusion = softer caustics
    float depthFalloff = exp(-depth * 0.05); // Slower falloff for softer appearance
    float diffusionFactor = 1.0 - exp(-depth * 0.02); // More diffusion at depth
    causticsIntensity *= depthFalloff;
    
    // Soften the intensity curve - no sharp peaks
    causticsIntensity = pow(causticsIntensity, 0.5); // Softer power curve
    causticsIntensity = smoothstep(0.1, 0.8, causticsIntensity); // Wider, softer range
    
    // Apply diffusion blur to intensity
    causticsIntensity = mix(causticsIntensity, causticsIntensity * 0.7, diffusionFactor);
    
    // Angle falloff - less intense at grazing angles
    float angleFalloff = max(dot(refractedSunDir, vec3(0.0, -1.0, 0.0)), 0.4);
    causticsIntensity *= angleFalloff;
    
    // Caustics color - warm sunlight filtered through water
    // Water absorbs red more than blue, so caustics are slightly blue-tinted
    vec3 causticsColor = vec3(0.98, 0.99, 1.0); // Slightly blue-tinted
    
    // Depth-based color shift (deeper = more blue)
    float depthColorShift = 1.0 - exp(-depth * 0.03);
    causticsColor = mix(causticsColor, vec3(0.92, 0.95, 1.0), depthColorShift * 0.3);
    
    // Final intensity - softer, more realistic
    return causticsColor * causticsIntensity * 0.8; // Reduced intensity for realism
}

// Shade the ocean floor with caustics
vec3 shadeOceanFloor(vec3 floorPos, vec3 viewDir, vec3 normal, float time, OceanFloorParams floorParams, SkyAtmosphere sky, vec3 waterSurfacePos, vec3 waterNormal) {
    // Get sun properties from sky
    LightingInfo light = evaluateLighting(sky, time);
    vec3 sunDir = light.sunDirection;
    vec3 sunColor = light.sunColor;
    float sunIntensity = light.sunIntensity;
    
    // Ocean floor material properties
    const vec3 floorColorBase = vec3(0.3, 0.25, 0.2); // Sandy/brown ocean floor
    const float floorRoughness = 0.8; // Ocean floor is rough
    
    // Add some color variation based on depth/terrain
    float floorHeight = getOceanFloorHeight(floorPos.xz, floorParams);
    float depthVariation = (floorHeight - floorParams.baseDepth) / floorParams.heightVariation;
    vec3 floorColor = mix(floorColorBase * 0.7, floorColorBase * 1.3, depthVariation * 0.5 + 0.5);
    
    // Add subtle texture variation
    float textureNoise = smoothNoise(floorPos.xz * 0.5) * 0.1;
    floorColor += textureNoise;
    
    // Lighting
    float NdotL = max(dot(normal, sunDir), 0.0);
    
    // Ambient lighting (reduced underwater)
    vec3 ambient = floorColor * 0.1;
    
    // Diffuse lighting
    vec3 diffuse = floorColor * sunColor * sunIntensity * NdotL;
    
    // Simple specular (water-wet floor has some specular)
    vec3 halfVec = normalize(viewDir + sunDir);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float specularPower = pow(NdotH, 32.0) * (1.0 - floorRoughness);
    vec3 specular = sunColor * sunIntensity * specularPower * 0.2;
    
    // Add caustics (only if sun is above horizon)
    vec3 caustics = vec3(0.0);
    if (sunDir.y > 0.0 && waterSurfacePos.y > floorPos.y) {
        caustics = calculateCaustics(floorPos, waterSurfacePos, waterNormal, sunDir, time, floorParams);
        caustics *= sunIntensity * sunColor;
    }
    
    return ambient + diffuse + specular + caustics;
}

// Compute translucency: combine water surface color with visible floor
vec3 computeTranslucency(vec3 waterSurfacePos, vec3 waterNormal, vec3 viewDir, float time, vec3 waterColor, OceanFloorParams floorParams, SkyAtmosphere sky) {
    // Calculate refracted ray direction (entering water)
    float eta = AIR_IOR / WATER_IOR; // From air to water
    vec3 refractedDir = refractRay(-viewDir, waterNormal, eta);
    
    // If total internal reflection, no translucency
    if (dot(refractedDir, waterNormal) > 0.0) {
        return vec3(0.0); // No floor visible
    }
    
    // Raymarch through water to find floor
    vec3 rayResult = raymarchThroughWater(waterSurfacePos, refractedDir, time, floorParams);
    float hitFloor = rayResult.x;
    float waterPathLength = rayResult.y;
    
    if (hitFloor < 0.5) {
        return vec3(0.0); // Floor not visible
    }
    
    // Calculate floor position
    vec3 floorPos = waterSurfacePos + refractedDir * waterPathLength;
    
    // Get floor normal
    vec3 floorNormal = getOceanFloorNormal(floorPos, floorParams);
    
    // Shade the floor with caustics
    vec3 floorColor = shadeOceanFloor(floorPos, -refractedDir, floorNormal, time, floorParams, sky, waterSurfacePos, waterNormal);
    
    // Apply water absorption based on path length through water
    // Longer path = more absorption = darker floor
    vec3 absorption = exp(-waterAbsorption * waterPathLength);
    
    // Apply absorption to floor color
    vec3 visibleFloorColor = floorColor * absorption;
    
    // Add some water tinting (blue-green)
    vec3 waterTint = mix(shallowWaterColor, deepWaterColor, 1.0 - exp(-waterPathLength * 0.05));
    visibleFloorColor = mix(visibleFloorColor, waterTint, 0.3);
    
    return visibleFloorColor;
}

// Calculate dynamic roughness based on wave characteristics
// Weta-quality roughness calculation with proper wave interaction
float calculateWaterRoughness(vec2 gradient, float waveHeight) {
    // Wave steepness affects roughness
    float slope = length(gradient);
    float steepnessFactor = smoothstep(0.2, 0.85, slope);
    
    // Wave height variation (crests are rougher, troughs are smoother)
    float heightVariation = abs(waveHeight) * 0.6;
    float crestFactor = smoothstep(-0.2, 0.4, waveHeight);
    
    // Use gradient magnitude as proxy for curvature
    // Higher gradient = more curvature = rougher surface
    float curvatureProxy = slope * 1.5;
    
    // Combine factors with proper weighting
    // Steepness is primary, height variation adds detail, curvature adds breaking roughness
    float roughness = mix(baseRoughness, maxRoughness, 
                         steepnessFactor * 0.6 + 
                         heightVariation * 0.25 + 
                         curvatureProxy * 0.15);
    
    // Add micro-roughness based on gradient variation
    // High-frequency detail adds fine surface roughness
    float microRoughness = slope * 0.4; // Simplified but effective
    roughness += microRoughness * 0.2;
    
    // Clamp to valid range
    return clamp(roughness, baseRoughness, maxRoughness * 1.2);
}

// Add reflection distortion based on roughness
// Rough water distorts reflections more
vec3 getDistortedReflectionDir(vec3 reflectedDir, vec3 normal, float roughness, vec2 pos, float time) {
    // Add micro-faceting distortion based on roughness
    // Sample wave gradient at slightly offset positions for distortion
    const float distortionScale = 0.3;
    vec2 distortion = getWaveGradient(pos + vec2(0.1, 0.0), time) * 0.02 +
                      getWaveGradient(pos - vec2(0.1, 0.0), time) * 0.02;
    
    // Scale distortion by roughness (rougher = more distortion)
    distortion *= roughness * distortionScale;
    
    // Apply distortion to reflection direction
    // Build tangent space safely (avoid division by zero)
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 tangent = normalize(cross(worldUp, normal));
    if (length(tangent) < 0.001) {
        // Fallback if normal is parallel to world up
        tangent = normalize(cross(vec3(1.0, 0.0, 0.0), normal));
    }
    vec3 bitangent = cross(normal, tangent);
    
    vec3 distortedDir = reflectedDir + tangent * distortion.x + bitangent * distortion.y;
    return normalize(distortedDir);
}

// --- Enhanced PBR Shading Function ---
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky) {
    // Get sun properties from sky
    LightingInfo light = evaluateLighting(sky, time);
    vec3 sunDir = light.sunDirection;
    vec3 sunColor = light.sunColor;
    float sunIntensity = light.sunIntensity;
    
    // Ocean floor terrain parameters
    OceanFloorParams floorParams = createDefaultOceanFloor();
    
    // Get ocean floor height at this position
    float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
    
    // Depth calculation: distance from water surface to ocean floor
    float depth = max(pos.y - floorHeight, 0.1);
    
    // Water color based on depth - realistic absorption
    // Water absorbs red more than blue, creating depth-dependent color
    float depthFactor = 1.0 - exp(-depth * 0.05); // Realistic absorption rate
    vec3 waterColor = mix(shallowWaterColor, deepWaterColor, depthFactor);
    
    // Add subtle color variation based on viewing angle
    // Water appears more blue at grazing angles due to Fresnel
    float viewAngle = 1.0 - max(dot(viewDir, normal), 0.0);
    vec3 angleTint = mix(vec3(1.0), vec3(0.95, 0.97, 1.0), viewAngle * 0.3);
    waterColor *= angleTint;
    
    // Calculate refracted ray to see what's underwater
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedDir = refractRay(-viewDir, normal, eta);
    
    // Compute what's visible through the water (ocean floor with caustics)
    vec3 refractedColor = vec3(0.0);
    float translucencyFactor = 1.0 - smoothstep(3.0, 25.0, depth); // More visible in shallow water
    
    if (dot(refractedDir, normal) < 0.0 && translucencyFactor > 0.01) {
        // Raymarch through water to find floor
        vec3 rayResult = raymarchThroughWater(pos, refractedDir, time, floorParams);
        float hitFloor = rayResult.x;
        float waterPathLength = rayResult.y;
        
        if (hitFloor > 0.5) {
            // Calculate floor position
            vec3 floorPos = pos + refractedDir * waterPathLength;
            vec3 floorNormal = getOceanFloorNormal(floorPos, floorParams);
            
            // Shade the floor with caustics
            vec3 floorColor = shadeOceanFloor(floorPos, -refractedDir, floorNormal, time, floorParams, sky, pos, normal);
            
            // Apply water absorption based on path length
            vec3 absorption = exp(-waterAbsorption * waterPathLength);
            refractedColor = floorColor * absorption;
            
            // Add water tinting based on depth
            vec3 waterTint = mix(shallowWaterColor, deepWaterColor, 1.0 - exp(-waterPathLength * 0.04));
            refractedColor = mix(refractedColor, waterTint, 0.25);
        } else {
            // Deep water - use base water color with absorption
            vec3 absorption = exp(-waterAbsorption * depth);
            refractedColor = waterColor * absorption;
        }
    } else {
        // Total internal reflection or too deep - use base water color
        vec3 absorption = exp(-waterAbsorption * depth);
        refractedColor = waterColor * absorption;
    }
    
    // For very shallow water or when floor is not visible, blend with base water color
    if (translucencyFactor < 1.0) {
        vec3 baseWaterRefracted = waterColor * exp(-waterAbsorption * depth);
        refractedColor = mix(baseWaterRefracted, refractedColor, translucencyFactor);
    }
    
    // Calculate dynamic roughness based on wave characteristics
    float waveHeight = getWaveHeight(pos.xz, time);
    float dynamicRoughness = calculateWaterRoughness(gradient, waveHeight);
    
    // Fresnel - per-channel for energy conservation
    // viewDir points FROM surface TO camera, so incident = -viewDir
    vec3 F = getFresnel(viewDir, normal);
    
    // Calculate reflection direction with distortion based on roughness
    // reflect() expects incident direction (FROM camera TO surface)
    // viewDir points FROM surface TO camera, so incident = -viewDir
    vec3 incidentDir = -viewDir; // FROM camera TO surface
    vec3 reflectedDir = reflect(incidentDir, normal); // FROM surface TO sky
    vec3 distortedReflectedDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz, time);
    
    // Clamp reflected direction to prevent reflecting below horizon
    // Use a smoother transition to prevent banding artifacts
    float reflectionElevation = distortedReflectedDir.y;
    if (reflectionElevation < 0.0) {
        // Smoothly blend to horizon color instead of hard clamp
        float horizonBlend = smoothstep(-0.1, 0.0, reflectionElevation);
        distortedReflectedDir = normalize(mix(
            vec3(distortedReflectedDir.x, 0.01, distortedReflectedDir.z),
            distortedReflectedDir,
            horizonBlend
        ));
    }
    
    // Sample sky with proper roughness-based filtering
    // For rough surfaces, use multiple samples for realistic blur
    vec3 reflectedColor = skyColor(distortedReflectedDir, sky, time);
    
    // Multi-sample reflection blur based on roughness
    // More samples for rougher surfaces, but limit to prevent banding
    float roughnessFactor = smoothstep(baseRoughness, maxRoughness, dynamicRoughness);
    int numSamples = int(mix(1.0, 3.0, roughnessFactor)); // Reduced max samples to prevent banding
    
    if (numSamples > 1 && dynamicRoughness > baseRoughness * 1.5) {
        vec3 sampleSum = reflectedColor;
        float sampleWeight = 1.0;
        
        // Sample in a pattern around the reflection direction
        // Use golden angle spiral for better distribution
        const float goldenAngle = 2.399963229728653; // Golden angle in radians
        
        for (int i = 1; i < numSamples; i++) {
            float angle = float(i) * goldenAngle;
            float radius = dynamicRoughness * 0.08 * sqrt(float(i) / float(numSamples));
            
            vec2 offset = vec2(cos(angle), sin(angle)) * radius;
            vec3 sampleDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz + offset, time);
            
            if (sampleDir.y > 0.0) {
                vec3 sampleColor = skyColor(sampleDir, sky, time);
                float weight = 1.0 / (1.0 + float(i) * 0.3); // Softer weight falloff
                sampleSum += sampleColor * weight;
                sampleWeight += weight;
            }
        }
        
        reflectedColor = sampleSum / sampleWeight;
    }
    
    // Enhanced PBR direct lighting
    vec3 lightDir = sunDir;
    vec3 lightColor = sunColor * sunIntensity;
    
    // Energy-conserving terms for water
    // F is the Fresnel reflectance (0 = transparent, 1 = reflective)
    // For water: kS = F (specular reflection), kT = 1 - F (transmission/refraction)
    // kD is minimal - water doesn't scatter much light diffusely
    vec3 kS = F; // Specular/reflection contribution
    vec3 kT = vec3(1.0) - F; // Transmission/refraction contribution
    vec3 kD = (1.0 - kS) * 0.1; // Minimal diffuse (water is mostly specular/transmissive)
    
    // Proper PBR: Mix reflection and refraction based on Fresnel
    // Water is more transparent at perpendicular angles, more reflective at grazing angles
    // F = 0.02 at perpendicular (mostly refraction/transparent)
    // F = 1.0 at grazing (mostly reflection)
    // NO additional tinting needed - F already has wavelength-dependent values
    vec3 baseColor = mix(refractedColor, reflectedColor, F);
    
    // Direct lighting calculations
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    // Specular highlight with Cook-Torrance BRDF
    // Water specular should reflect the sky color, not just white sun
    // Sample sky color in reflection direction for realistic colored specular
    vec3 specularReflectionDir = reflect(-viewDir, normal);
    vec3 skySpecularColor = skyColor(specularReflectionDir, sky, time);
    
    // Specular BRDF with sky-colored reflection
    // This creates realistic water reflections that aren't pure white
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness, skySpecularColor);
    
    // Water has strong specular, but not overly bright
    // The sky color already provides realistic coloring
    specular *= 1.2; // Slight boost, but not excessive
    
    // Lambertian diffuse (very subtle - water doesn't scatter much)
    // Use base water color (albedo) instead of refracted color for diffuse
    // Water has very low albedo - most light is reflected or transmitted
    vec3 waterAlbedo = mix(shallowWaterColor, deepWaterColor, depthFactor * 0.5);
    waterAlbedo *= 0.3; // Water has low albedo (dark)
    vec3 diffuse = kD * waterAlbedo * lightColor * NdotL / PI;
    
    // Advanced subsurface scattering with proper phase function
    // Enhanced for realistic shallow water glow (boost is built into the function)
    vec3 subsurface = getSubsurfaceScattering(normal, viewDir, lightDir, depth);
    
    // --- Modern Image-Based Lighting (IBL) ---
    // Based on: Filament PBR and modern IBL techniques
    // Proper hemisphere sampling for realistic ambient lighting
    
    // Sample multiple directions for better IBL approximation
    vec3 ambientDiffuse = vec3(0.0);
    vec3 ambientSpecular = vec3(0.0);
    
    // Simplified IBL: sample key directions
    // Up direction (sky) - primary ambient source
    vec3 skyUp = vec3(0.0, 1.0, 0.0);
    vec3 skyUpColor = skyColor(skyUp, sky, time);
    float skyUpWeight = max(dot(normal, skyUp), 0.0);
    
    // Hemisphere average approximation for diffuse
    vec3 hemisphereAvg = skyUpColor * 0.5; // Simplified hemisphere average
    ambientDiffuse += hemisphereAvg * kD * waterAlbedo * skyUpWeight;
    
    // Specular IBL: sample reflection direction
    vec3 normalReflected = reflect(-viewDir, normal);
    vec3 normalReflectedColor = vec3(0.0);
    
    if (normalReflected.y > 0.0) {
        normalReflectedColor = skyColor(normalReflected, sky, time);
        
        // For rough surfaces, blur the reflection with multiple samples
        if (dynamicRoughness > baseRoughness * 1.2) {
            // Sample additional directions for rough surface blur
            const int numIBLSamples = 3;
            vec3 sampleSum = normalReflectedColor;
            float sampleWeight = 1.0;
            
            for (int i = 0; i < numIBLSamples; i++) {
                float angle = float(i) * TAU / float(numIBLSamples);
                vec3 offset = vec3(cos(angle), 0.0, sin(angle)) * dynamicRoughness * 0.1;
                vec3 sampleDir = normalize(normalReflected + offset);
                if (sampleDir.y > 0.0) {
                    vec3 sampleColor = skyColor(sampleDir, sky, time);
                    sampleSum += sampleColor;
                    sampleWeight += 1.0;
                }
            }
            normalReflectedColor = sampleSum / sampleWeight;
        }
        
        // Apply Fresnel to specular IBL
        ambientSpecular += normalReflectedColor * F;
    }
    
    // Combine ambient contributions
    vec3 ambient = ambientDiffuse + ambientSpecular * 0.3; // Specular IBL is subtle
    
    // Build base color without specular (specular will be added after foam blending)
    // baseColor already contains reflection (via F) and refraction (via 1-F)
    vec3 waterBase = baseColor + diffuse + subsurface + ambient;
    
    // Add volumetric light scattering (god rays effect through water)
    // More visible in shallow water where light penetrates
    // Use proper scattering phase function for realistic appearance
    if (sunDir.y > 0.0 && NdotL > 0.0) {
        // Volumetric scattering uses forward scattering phase function
        vec3 toSun = normalize(sunDir);
        float cosTheta = dot(viewDir, toSun);
        float phase = (1.0 - 0.9 * 0.9) / pow(1.0 + 0.9 * 0.9 - 2.0 * 0.9 * cosTheta, 1.5);
        phase /= 4.0 * PI;
        
        float volumetricFactor = phase * NdotL * (1.0 - exp(-depth * 0.02));
        vec3 volumetricLight = sunColor * sunIntensity * volumetricFactor * 0.05;
        
        // Apply water color tinting to volumetric light
        volumetricLight *= mix(vec3(1.0), shallowWaterColor, 1.0 - depthFactor);
        waterBase += volumetricLight;
    }
    
    // Advanced foam - energy-based with proper physics
    float foam = getFoam(pos.xz, normal, time, gradient);
    
    // Foam appearance (Ubisoft-style: bright, slightly blue-tinted, with depth)
    const vec3 FOAM_COLOR_BRIGHT = vec3(0.98, 0.99, 1.0); // Bright white-blue
    const vec3 FOAM_COLOR_DARK = vec3(0.85, 0.88, 0.92);  // Darker foam in shadows
    const float FOAM_OPACITY = 0.9;
    const float FOAM_SPECULAR_REDUCTION = 0.85;
    
    // Foam color varies with lighting (brighter where lit)
    vec3 foamColor = mix(FOAM_COLOR_DARK, FOAM_COLOR_BRIGHT, NdotL * 0.7 + 0.3);
    
    // Foam has slight subsurface scattering (foam is translucent)
    float foamSubsurface = max(dot(normal, -viewDir), 0.0);
    foamColor = mix(foamColor, FOAM_COLOR_BRIGHT, foamSubsurface * 0.2);
    
    // Foam-blend with proper energy-based opacity
    float foamOpacity = foam * FOAM_OPACITY;
    
    // Foam affects both base color and adds its own contribution
    vec3 color = mix(waterBase, foamColor, foamOpacity);
    
    // Add foam's own contribution (foam is brighter than water)
    color += foamColor * foam * 0.1;
    
    // Specular handling: foam is more diffuse, water is more specular
    // Reduce water specular where foam exists (foam scatters light more)
    float foamSpecularFactor = 1.0 - foam * FOAM_SPECULAR_REDUCTION;
    
    // Apply reduced specular (foam areas have less specular)
    vec3 waterSpecular = specular * foamSpecularFactor;
    
    // Foam has its own subtle specular (different from water - more diffuse)
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotH = max(dot(normal, halfVec), 0.0);
    vec3 foamSpecularColor = foamColor * lightColor * pow(NdotH, 64.0) * 0.2 * foam;
    
    // Add specular contributions (water specular + foam specular)
    color += waterSpecular + foamSpecularColor;
    
    // Note: Translucency (ocean floor visibility) is now integrated into refractedColor
    // No need to add it separately here
    
    return color;
}

// --- Raymarching ---
vec3 raymarchOcean(vec3 ro, vec3 rd, float time) {
    float t = 0.0;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos = ro + rd * t;
        float h = pos.y - getWaveHeight(pos.xz, time);
        
        if (abs(h) < MIN_DIST) {
            return pos;
        }
        
        if (t > MAX_DIST) break;
        
        float stepSize = clamp(h * 0.5, MIN_DIST, 1.0);
        t += stepSize;
    }
    
    return ro + rd * MAX_DIST;
}

// --- Atmospheric Fog/Haze ---
// NEW: Atmospheric fog using SkyAtmosphere system
vec3 applyAtmosphericFog(vec3 color, vec3 pos, vec3 camPos, vec3 rayDir, SkyAtmosphere sky, float time) {
    if (!sky.enableFog) return color;
    
    float dist = length(pos - camPos);
    
    // Get lighting info for fog color calculation
    LightingInfo light = evaluateLighting(sky, time);
    
    // Calculate fog density (can vary with height)
    float heightFactor = 1.0;
    if (sky.fogHeightFalloff > 0.0) {
        float height = max(pos.y - camPos.y, 0.0);
        heightFactor = exp(-height / sky.fogHeightFalloff);
    }
    
    float fogDensity = sky.fogDensity * heightFactor;
    
    // Increase fog near horizon
    float horizonFactor = pow(max(0.0, 1.0 - max(rayDir.y, 0.0)), 2.0);
    fogDensity *= (1.0 + horizonFactor * 0.5);
    
    // Fog falloff with distance
    float fogFactor = 1.0 - exp(-fogDensity * max(dist - sky.fogDistance, 0.0));
    
    // Fog color from sky configuration
    vec3 fogColor = sky.fogColor;
    
    // Sample sky color for fog (atmospheric perspective)
    vec3 skyFogColor = evaluateSky(sky, rayDir, time);
    fogColor = mix(fogColor, skyFogColor, 0.3);
    
    // Apply fog
    return mix(color, fogColor, fogFactor);
}

// --- Main ---
// --- Main Rendering Function ---
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Create and configure camera
    Camera cam = createDefaultCamera();
    
    // Camera position and orientation - Wide angle view showing ocean and sky
    // Lower camera position and angle up to capture more sky
    cam.position = vec3(0.0, 2.5, 6.0);  // Lower and closer for wide view
    cam.target = vec3(0.0, 0.5, 0.0);     // Look slightly up to see sky
    cam.up = vec3(0.0, 1.0, 0.0);
    
    // Camera settings - Wide angle lens to capture expansive view
    // Wide angle lens (20mm) for dramatic wide view showing ocean and sky
    cam.focalLength = 20.0;        // 20mm wide angle lens (very wide field of view)
    cam.fStop = 2.8;               // f/2.8 aperture
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100
    
    // Depth of field (optional - disable for performance)
    cam.focusDistance = 10.0;
    cam.enableDOF = true; // Set to true for depth of field effect
    
    // TEST: Uncomment one of these to see dramatic changes:
    // cam.fStop = 1.4;        // Much brighter (wide aperture)
    // cam.fStop = 8.0;        // Much darker (narrow aperture)
    // cam.shutterSpeed = 1.0 / 30.0;  // Brighter (slow shutter)
    // cam.shutterSpeed = 1.0 / 1000.0; // Darker (fast shutter)
    // cam.iso = 800.0;        // Brighter (high ISO)
    // cam.focalLength = 24.0; // Wide angle (more visible)
    // cam.focalLength = 85.0; // Telephoto (zoomed in)
    
    // ============================================================================
    // SKY SYSTEM USAGE EXAMPLES
    // ============================================================================
    // To use custom sky presets, uncomment one of these and use evaluateSky() directly:
    //
    // SkyAtmosphere sky = createSkyPreset_ClearDay();      // Bright sunny day
    // SkyAtmosphere sky = createSkyPreset_Sunset();        // Warm sunset/sunrise
    // SkyAtmosphere sky = createSkyPreset_Night();         // Starlit night with moon
    // SkyAtmosphere sky = createSkyPreset_CloudyDay();     // Overcast day
    // SkyAtmosphere sky = createSkyPreset_Stormy();        // Dark stormy sky
    // SkyAtmosphere sky = createSkyPreset_Foggy();         // Foggy/hazy atmosphere
    //
    // You can also customize a preset:
    // SkyAtmosphere sky = createSkyPreset_ClearDay();
    // sky.sunElevation = 0.3;           // Lower sun
    // sky.cloudDensity = 0.8;           // More clouds
    // sky.fogDensity = 0.05;            // More fog
    // sky.horizonGlowIntensity = 1.0;   // Brighter horizon glow
    //
    // Then use: vec3 skyColor = evaluateSky(sky, dir, time);
    // ============================================================================
    
    // Generate camera ray using proper FOV calculation
    // UV coordinates in [0, 1] range
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
    
    // Raymarch
    vec3 pos = raymarchOcean(cam.position, rd, iTime);
    
    // Calculate distance for depth of field
    float distance = length(pos - cam.position);
    
    // Create sky once and reuse throughout
    SkyAtmosphere sky = createSkyPreset_Foggy();
    
    // Background
    if (distance > MAX_DIST * 0.95) {
        vec3 bgColor = skyColor(rd, sky, iTime);
        bgColor = applyExposure(bgColor, cam);
        fragColor = vec4(bgColor, 1.0);
        return;
    }
    
    // Compute normal (gradient computed here and passed through to avoid redundant computation)
    vec2 gradient;
    vec3 normal = getNormal(pos.xz, iTime, gradient);
    vec3 viewDir = -rd;
    
    // Shade ocean with sky configuration
    vec3 color = shadeOcean(pos, normal, viewDir, iTime, gradient, sky);
    
    // Apply atmospheric fog/haze using the new SkyAtmosphere system
    color = applyAtmosphericFog(color, pos, cam.position, rd, sky, iTime);
    
    // Apply camera exposure (physically-based)
    // This multiplies the color by the exposure value
    // Changes to f-stop, shutter speed, or ISO will affect brightness here
    color = applyExposure(color, cam);
    
    // Apply depth of field (if enabled)
    color = applyDepthOfField(color, distance, cam);
    
    // Tone mapping (Reinhard) - compresses HDR to LDR
    // Note: Very bright values will be compressed, but exposure changes should still be visible
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
