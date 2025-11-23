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

// Include common constants and utilities first
#include "Common.frag"

// Include camera system (Common.frag already included, guards prevent redefinition)
#include "CameraSystem.frag"

// Include sky and atmosphere system (Common.frag already included, guards prevent redefinition)
#include "SkySystem.frag"

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

// Hash and noise functions are provided by Common.frag

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

// Atmospheric scattering functions are provided by SkySystem.frag

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
    
    // Final color is water base with specular
    vec3 color = waterBase + specular;
    
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
