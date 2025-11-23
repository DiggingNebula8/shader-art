// Physically-Based Ocean Shader
// Based on: Tessendorf "Simulating Ocean Water" (SIGGRAPH 2001)
//          Gerstner Wave Model
//          Proper Fresnel and Subsurface Scattering

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.0001;

// Raymarching
const int MAX_STEPS = 600;
const float MIN_DIST = .1;
const float MAX_DIST = 150.0;

// Physical Constants
const float GRAVITY = 9.81;
const vec3 F0_WATER = vec3(0.02);

// Wave Parameters - Realistic ocean with dominant swell direction
const int NUM_WAVES = 6;

// Primary swell direction (dominant wind direction) - pre-normalized
// vec2(1.0, 0.3) normalized = approximately vec2(0.9578, 0.2873)
const vec2 PRIMARY_SWELL_DIR = vec2(0.9578, 0.2873);

// Get wave direction for a given wave index
vec2 getWaveDir(int i) {
    if (i == 0) return PRIMARY_SWELL_DIR;                                    // Primary swell
    if (i == 1) return normalize(PRIMARY_SWELL_DIR + vec2(0.2, 0.1));       // Secondary swell
    if (i == 2) return normalize(PRIMARY_SWELL_DIR + vec2(-0.15, 0.2));     // Tertiary swell
    if (i == 3) return normalize(vec2(PRIMARY_SWELL_DIR.y, -PRIMARY_SWELL_DIR.x)); // Cross swell
    if (i == 4) return normalize(PRIMARY_SWELL_DIR + vec2(0.1, -0.3));      // Detail wave 1
    return normalize(PRIMARY_SWELL_DIR + vec2(-0.2, -0.1));                  // Detail wave 2
}

// Wave amplitudes (m) - primary swell dominates, others add detail
float waveAmps[NUM_WAVES] = float[](
    1.2,  // Primary swell - largest
    0.4,  // Secondary swell
    0.25, // Tertiary swell
    0.15, // Cross swell
    0.08, // Detail wave 1
    0.05  // Detail wave 2
);

// Wave frequencies (rad/m) - primary swell is longer wavelength
float waveFreqs[NUM_WAVES] = float[](
    0.15, // Primary swell - long wavelength
    0.25, // Secondary swell
    0.4,  // Tertiary swell
    0.6,  // Cross swell
    1.2,  // Detail wave 1
    2.0   // Detail wave 2
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
vec3 getSunColorFromElevation(float sunElevation) {
    // Base sun color (white/yellow)
    vec3 baseColor = vec3(1.0, 0.98, 0.95);
    
    // Sunset/sunrise colors (red/orange)
    vec3 sunsetColor = vec3(1.0, 0.6, 0.3);
    
    // Night color (blue/magenta for moon)
    vec3 nightColor = vec3(0.3, 0.4, 0.6);
    
    // Blend based on elevation
    if (sunElevation < 0.0) {
        // Below horizon - night time
        float nightFactor = smoothstep(-0.3, 0.0, sunElevation);
        return mix(nightColor, sunsetColor, nightFactor);
    } else if (sunElevation < 0.3) {
        // Near horizon - sunset/sunrise
        float sunsetFactor = smoothstep(0.3, 0.0, sunElevation);
        return mix(baseColor, sunsetColor, sunsetFactor);
    } else {
        // Above horizon - day time
        return baseColor;
    }
}

// Get sun intensity based on elevation
float getSunIntensityFromElevation(float sunElevation) {
    if (sunElevation < 0.0) {
        // Below horizon - very dim (moonlight)
        return 0.1 * smoothstep(-0.3, 0.0, sunElevation);
    } else if (sunElevation < 0.1) {
        // Near horizon - dim (sunrise/sunset)
        return 1.0 + sunElevation * 15.0;
    } else {
        // Above horizon - full intensity
        return 2.5;
    }
}

// Lighting Configuration (now dynamic)
vec3 getSunDir(float time) {
    float tod = getTimeOfDay(time);
    return getSunDirection(tod);
}

vec3 getSunColor(float time) {
    float tod = getTimeOfDay(time);
    vec3 sunDir = getSunDirection(tod);
    return getSunColorFromElevation(sunDir.y);
}

float getSunIntensity(float time) {
    float tod = getTimeOfDay(time);
    vec3 sunDir = getSunDirection(tod);
    return getSunIntensityFromElevation(sunDir.y);
}

// Water Properties
const vec3 waterAbsorption = vec3(0.15, 0.045, 0.015); // m^-1 (realistic values)
const float roughness = 0.02; // Very smooth ocean surface
const float WATER_IOR = 1.33; // Index of refraction for water
const float AIR_IOR = 1.0;    // Index of refraction for air

// Water Colors
const vec3 deepWaterColor = vec3(0.0, 0.15, 0.3);
const vec3 shallowWaterColor = vec3(0.0, 0.4, 0.6);

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
        
        // Steepness varies by wave - primary swell is gentler, detail waves are choppier
        // Values adjusted for standard Gerstner formulation (independent of NUM_WAVES)
        float steepness;
        if (i == 0) steepness = 0.05;      // Primary swell - gentle
        else if (i == 1) steepness = 0.07; // Secondary swell
        else if (i == 2) steepness = 0.08;// Tertiary swell
        else if (i == 3) steepness = 0.09; // Cross swell
        else if (i == 4) steepness = 0.12; // Detail wave 1 - choppier
        else steepness = 0.15;            // Detail wave 2 - choppiest
        
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

vec3 getNormal(vec2 pos, float time, out vec2 gradient) {
    vec2 grad = getWaveGradient(pos, time);
    gradient = grad;
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}


// --- Fresnel ---
// Proper Fresnel calculation using IOR
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 getFresnel(vec3 viewDir, vec3 normal) {
    float cosTheta = max(dot(viewDir, normal), 0.0);
    return fresnelSchlick(cosTheta, F0_WATER);
}

// --- Cook-Torrance BRDF ---
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

float G_SchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
}

vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness) {
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0.0);
    
    float D = D_GGX(NdotH, roughness);
    float G = G_Smith(NdotV, NdotL, roughness);
    vec3 F = fresnelSchlick(VdotH, F0_WATER);
    
    vec3 numerator = (D * G) * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    return (numerator / denominator) * lightColor * NdotL;
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

// Enhanced physically-based sky color with time-of-day support
// Based on: Preetham et al. "A Practical Analytic Model for Daylight"
//          and improved atmospheric scattering with proper day/night transitions
vec3 skyColor(vec3 dir, float time) {
    // Get dynamic sun properties based on time
    vec3 sunDir = getSunDir(time);
    vec3 sunColor = getSunColor(time);
    float sunIntensity = getSunIntensity(time);
    
    // Clamp direction to prevent sampling below horizon
    vec3 safeDir = normalize(vec3(dir.x, max(dir.y, 0.01), dir.z));
    
    float sunDot = max(dot(safeDir, sunDir), 0.0);
    float sunElevation = sunDir.y;
    
    // Elevation angle (0 = horizon, 1 = zenith)
    float elevation = safeDir.y;
    
    // Enhanced optical depth calculation with better horizon handling
    float rayleighDepth = getOpticalDepth(safeDir, RAYLEIGH_SCALE_HEIGHT);
    float mieDepth = getOpticalDepth(safeDir, MIE_SCALE_HEIGHT);
    float sunRayleighDepth = getOpticalDepth(sunDir, RAYLEIGH_SCALE_HEIGHT);
    float sunMieDepth = getOpticalDepth(sunDir, MIE_SCALE_HEIGHT);
    
    // Transmittance (Beer's law) - how much light survives
    vec3 rayleighTransmittance = exp(-BETA_R * rayleighDepth);
    float mieTransmittance = exp(-BETA_M * mieDepth);
    
    // Sun transmittance (for in-scattering)
    vec3 sunRayleighTransmittance = exp(-BETA_R * sunRayleighDepth);
    float sunMieTransmittance = exp(-BETA_M * sunMieDepth);
    
    // Scattering phase functions
    const float MIE_G = 0.76; // Asymmetry parameter (forward scattering)
    float rayleighPhaseValue = rayleighPhase(sunDot);
    float miePhaseValue = miePhase(sunDot, MIE_G);
    
    // In-scattering: light from sun scattered toward viewer
    vec3 rayleighInScatter = BETA_R * rayleighPhaseValue * sunRayleighTransmittance;
    float mieInScatter = BETA_M * miePhaseValue * sunMieTransmittance;
    
    // Sky color from scattered sunlight (enhanced with time-of-day)
    vec3 sky = (rayleighInScatter + vec3(mieInScatter)) * sunColor * sunIntensity * 2.0;
    
    // Add ambient sky light (scattered from all directions)
    // Enhanced for night time with subtle blue glow
    vec3 ambientSky = BETA_R * 0.5 * (1.0 - rayleighTransmittance);
    if (sunElevation < 0.0) {
        // Night time: add subtle blue ambient from starlight/moonlight
        ambientSky += vec3(0.01, 0.02, 0.04) * (1.0 - rayleighTransmittance.b) * 0.5;
    }
    sky += ambientSky;
    
    // Enhanced horizon glow with time-of-day variation
    vec3 horizonGlowColor;
    float horizonGlowIntensity;
    
    if (sunElevation < 0.0) {
        // Night: subtle blue/purple glow
        horizonGlowColor = vec3(0.1, 0.15, 0.25);
        horizonGlowIntensity = 0.2;
    } else if (sunElevation < 0.2) {
        // Sunrise/sunset: warm orange/red glow
        float sunsetFactor = smoothstep(0.2, 0.0, sunElevation);
        horizonGlowColor = mix(vec3(1.0, 0.75, 0.6), vec3(1.0, 0.5, 0.2), sunsetFactor);
        horizonGlowIntensity = 0.6 * (1.0 - sunsetFactor * 0.5);
    } else {
        // Day: subtle warm glow
        horizonGlowColor = vec3(1.0, 0.85, 0.7);
        horizonGlowIntensity = 0.3;
    }
    
    float horizonFactor = pow(max(0.0, 1.0 - elevation), 1.5);
    float horizonIntensity = horizonFactor * (1.0 - rayleighTransmittance.r) * horizonGlowIntensity;
    sky += horizonGlowColor * horizonIntensity;
    
    // Apply transmittance for distance (atmospheric perspective)
    sky *= mix(vec3(1.0), rayleighTransmittance * mieTransmittance, 0.7);
    
    // Enhanced sun disk with time-of-day variation
    const float SUN_ANGULAR_SIZE = 0.0093; // ~0.53 degrees in radians
    const float SUN_DISK_BRIGHTNESS_DAY = 30.0;
    const float SUN_DISK_BRIGHTNESS_NIGHT = 5.0; // Moon
    const float SUN_HALO_POWER = 16.0;
    const float SUN_HALO_INTENSITY_DAY = 3.0;
    const float SUN_HALO_INTENSITY_NIGHT = 0.5;
    
    float sunAngle = acos(clamp(sunDot, 0.0, 1.0));
    float sunDisk = 1.0 - smoothstep(0.0, SUN_ANGULAR_SIZE, sunAngle);
    
    // Sun/moon disk brightness varies with time of day
    float sunDiskBrightness = mix(SUN_DISK_BRIGHTNESS_NIGHT, SUN_DISK_BRIGHTNESS_DAY, 
                                   smoothstep(-0.1, 0.1, sunElevation));
    vec3 sun = sunColor * sunDisk * sunDiskBrightness * sunIntensity;
    
    // Enhanced Mie scattering halo (atmospheric glow around sun/moon)
    float sunHalo = pow(max(0.0, sunDot), SUN_HALO_POWER);
    float haloIntensity = (1.0 - elevation * 0.3) * (1.0 - sunMieTransmittance);
    float haloBrightness = mix(SUN_HALO_INTENSITY_NIGHT, SUN_HALO_INTENSITY_DAY,
                                smoothstep(-0.1, 0.1, sunElevation));
    vec3 halo = sunColor * sunHalo * haloIntensity * haloBrightness * sunIntensity;
    
    // Combine all components
    vec3 finalSky = sky + sun + halo;
    
    // Time-of-day dependent minimum brightness
    vec3 minSkyBrightness;
    if (sunElevation < 0.0) {
        // Night: very dark but not black
        minSkyBrightness = vec3(0.005, 0.01, 0.02);
    } else if (sunElevation < 0.1) {
        // Twilight: dim
        float twilightFactor = smoothstep(0.0, 0.1, sunElevation);
        minSkyBrightness = mix(vec3(0.01, 0.02, 0.03), vec3(0.02, 0.05, 0.1), twilightFactor);
    } else {
        // Day: brighter minimum
        minSkyBrightness = vec3(0.02, 0.05, 0.1);
    }
    finalSky = max(finalSky, minSkyBrightness);
    
    // Add subtle gradient from horizon to zenith (more pronounced at night)
    if (sunElevation < 0.0) {
        float gradientFactor = pow(elevation, 0.5);
        finalSky = mix(finalSky * 0.3, finalSky, gradientFactor);
    }
    
    return finalSky;
}

// --- Subsurface Scattering ---
// Approximate subsurface scattering for water
vec3 getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth) {
    vec3 backLight = -lightDir;
    float scatter = max(dot(normal, backLight), 0.0);
    vec3 attenuation = exp(-waterAbsorption * depth);
    return shallowWaterColor * scatter * attenuation * 0.3;
}

// --- Foam ---
// Realistic foam based on wave physics: steepness, curvature, and crests
float getFoam(vec2 pos, vec3 normal, float time, vec2 gradient) {
    // Wave gradient for steepness (passed as parameter to avoid redundant computation)
    vec2 grad = gradient;
    float slope = length(grad);
    
    // Wave height to identify crests (cache for reuse)
    float height = getWaveHeight(pos, time);
    
    // Curvature calculation (Laplacian approximation) - waves break where curvature is high
    const float eps = 0.08;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    // Laplacian: second derivative approximation
    float curvature = abs((hL + hR + hD + hU - 4.0 * height) / (eps * eps));
    
    // Foam appears where:
    // 1. Waves are steep (slope > threshold)
    // 2. Waves are breaking (high curvature)
    // 3. At wave crests (positive height)
    
    float steepnessFoam = smoothstep(0.4, 0.8, slope);
    float curvatureFoam = smoothstep(0.3, 0.6, curvature);
    float crestFoam = smoothstep(-0.1, 0.3, height); // Foam at crests
    
    // Combine foam factors - all contribute
    float foam = steepnessFoam * 0.5 + curvatureFoam * 0.3 + crestFoam * 0.2;
    
    // Add subtle wave-based variation for organic appearance
    // Use wave height pattern itself for seamless variation
    const vec2 wavePatternDir = vec2(0.7, 0.3);
    const float wavePatternFreq = 2.0;
    const float wavePatternSpeed = 0.5;
    float wavePattern = sin(dot(pos, wavePatternDir) * wavePatternFreq + time * wavePatternSpeed) * 0.5 + 0.5;
    foam *= mix(0.7, 1.0, wavePattern); // Subtle variation, not dominant
    
    // Smooth transitions
    foam = smoothstep(0.2, 0.6, foam);
    
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

// Shade the ocean floor
vec3 shadeOceanFloor(vec3 floorPos, vec3 viewDir, vec3 normal, float time, OceanFloorParams floorParams) {
    // Get dynamic sun properties
    vec3 sunDir = getSunDir(time);
    vec3 sunColor = getSunColor(time);
    float sunIntensity = getSunIntensity(time);
    
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
    
    return ambient + diffuse + specular;
}

// Compute translucency: combine water surface color with visible floor
vec3 computeTranslucency(vec3 waterSurfacePos, vec3 waterNormal, vec3 viewDir, float time, vec3 waterColor, OceanFloorParams floorParams) {
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
    
    // Shade the floor
    vec3 floorColor = shadeOceanFloor(floorPos, -refractedDir, floorNormal, time, floorParams);
    
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

// --- Enhanced PBR Shading Function with Time-of-Day Support ---
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient) {
    // Get dynamic sun properties based on time
    vec3 sunDir = getSunDir(time);
    vec3 sunColor = getSunColor(time);
    float sunIntensity = getSunIntensity(time);
    
    // Fresnel - per-channel for energy conservation
    vec3 F = getFresnel(viewDir, normal);
    
    // Ocean floor terrain parameters
    OceanFloorParams floorParams = createDefaultOceanFloor();
    
    // Get ocean floor height at this position
    float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
    
    // Depth calculation: distance from water surface to ocean floor
    float depth = max(pos.y - floorHeight, 0.1);
    
    // Water color based on depth
    float depthFactor = 1.0 - exp(-depth * 0.1);
    vec3 waterColor = mix(shallowWaterColor, deepWaterColor, depthFactor);
    
    // Absorption (Beer-Lambert law)
    vec3 absorption = exp(-waterAbsorption * depth);
    vec3 refractedColor = waterColor * absorption;
    
    // Enhanced reflection with proper IBL sampling
    vec3 reflectedDir = reflect(-viewDir, normal);
    
    // Clamp reflected direction to prevent reflecting below horizon
    // This prevents blue artifacts near the horizon
    if (reflectedDir.y < 0.0) {
        // If reflection points down, use horizon color instead
        reflectedDir = normalize(vec3(reflectedDir.x, 0.01, reflectedDir.z));
    }
    
    // Sample sky with time-of-day support
    vec3 reflectedColor = skyColor(reflectedDir, time);
    
    // Mix reflection and refraction based on Fresnel (per-channel for energy conservation)
    // Energy conservation: refracted * (1 - F) + reflected * F
    vec3 baseColor = refractedColor * (1.0 - F) + reflectedColor * F;
    
    // Enhanced PBR direct lighting
    vec3 lightDir = sunDir;
    vec3 lightColor = sunColor * sunIntensity;
    
    // Specular highlight with Cook-Torrance BRDF
    float dynamicRoughness = roughness;
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness);
    
    // Energy-conserving diffuse term
    vec3 kS = F; // Specular contribution from Fresnel
    vec3 kD = (1.0 - kS); // Diffuse contribution (water is dielectric, metallic = 0)
    
    // Lambertian diffuse
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = kD * waterColor * lightColor * NdotL / PI;
    
    // Subsurface scattering (enhanced for shallow water)
    vec3 subsurface = getSubsurfaceScattering(normal, viewDir, lightDir, depth);
    
    // Enhanced ambient lighting with proper IBL
    // Sample environment in normal direction for diffuse ambient
    vec3 ambientDir = normalize(normal + vec3(0.0, 1.0, 0.0)); // Hemisphere sampling
    vec3 ambientDiffuse = skyColor(ambientDir, time) * kD * waterColor * 0.15;
    
    // Specular ambient (environment reflection for ambient)
    vec3 ambientSpecular = skyColor(reflectedDir, time) * F * 0.1;
    
    vec3 ambient = ambientDiffuse + ambientSpecular;
    
    // Build diffuse/volume term
    vec3 waterBase = baseColor + diffuse + subsurface + ambient;
    
    // Foam - realistic appearance (gradient passed to avoid redundant computation)
    float foam = getFoam(pos.xz, normal, time, gradient);
    
    // Foam appearance
    const vec3 FOAM_COLOR = vec3(0.95, 0.98, 1.0); // Slightly off-white with subtle blue tint
    const float FOAM_OPACITY = 0.85;
    const float FOAM_SPECULAR_REDUCTION = 0.8;
    
    // Foam-blend the diffuse term with FOAM_COLOR
    float foamOpacity = foam * FOAM_OPACITY;
    vec3 color = mix(waterBase, FOAM_COLOR, foamOpacity);
    
    // Compute foam-attenuated specular (foam is more diffuse than water)
    vec3 foamSpecular = specular * (1.0 - foam * FOAM_SPECULAR_REDUCTION);
    
    // Add foamSpecular once to the foam-blended diffuse (no subtraction needed)
    color += foamSpecular;
    
    // --- Water Translucency ---
    // Add visible ocean floor through the water
    // Only apply translucency where water is not too opaque (shallow areas or clear water)
    float translucencyFactor = 1.0 - smoothstep(5.0, 30.0, depth); // More visible in shallow water
    translucencyFactor *= (1.0 - foam * 0.8); // Less visible where there's foam
    
    if (translucencyFactor > 0.01) {
        vec3 floorColor = computeTranslucency(pos, normal, viewDir, time, waterBase, floorParams);
        
        // Blend floor color with water color based on translucency factor
        // Use Fresnel to determine how much floor is visible (more visible at grazing angles)
        float fresnelAvg = dot(F, vec3(1.0/3.0));
        float floorVisibility = translucencyFactor * (1.0 - fresnelAvg * 0.7); // More visible at grazing angles
        
        color = mix(color, floorColor, floorVisibility);
    }
    
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
// Adds realistic atmospheric perspective based on distance and time of day
vec3 applyAtmosphericFog(vec3 color, vec3 pos, vec3 camPos, vec3 rayDir, float time) {
    float dist = length(pos - camPos);
    
    // Fog density varies with time of day (more fog at sunrise/sunset)
    float tod = getTimeOfDay(time);
    vec3 sunDir = getSunDir(time);
    float sunElevation = sunDir.y;
    
    // Base fog density
    float fogDensity = 0.02;
    
    // Increase fog near horizon and during twilight
    if (sunElevation < 0.2) {
        float horizonFactor = pow(max(0.0, 1.0 - rayDir.y), 2.0);
        float twilightFactor = smoothstep(0.2, 0.0, sunElevation);
        fogDensity += horizonFactor * twilightFactor * 0.03;
    }
    
    // Fog falloff with distance
    float fogFactor = 1.0 - exp(-fogDensity * dist);
    
    // Fog color based on time of day
    vec3 fogColor;
    if (sunElevation < 0.0) {
        // Night: dark blue/purple fog
        fogColor = vec3(0.05, 0.08, 0.12);
    } else if (sunElevation < 0.2) {
        // Sunrise/sunset: warm orange/red fog
        float sunsetFactor = smoothstep(0.2, 0.0, sunElevation);
        fogColor = mix(vec3(0.3, 0.4, 0.5), vec3(0.6, 0.4, 0.2), sunsetFactor);
    } else {
        // Day: blue-white fog
        fogColor = vec3(0.5, 0.6, 0.7);
    }
    
    // Sample sky color for fog (atmospheric perspective)
    vec3 skyFogColor = skyColor(rayDir, time);
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
    
    // Generate camera ray using proper FOV calculation
    // UV coordinates in [0, 1] range
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
    
    // Raymarch
    vec3 pos = raymarchOcean(cam.position, rd, iTime);
    
    // Calculate distance for depth of field
    float distance = length(pos - cam.position);
    
    // Background
    if (distance > MAX_DIST * 0.95) {
        vec3 bgColor = skyColor(rd, iTime);
        bgColor = applyExposure(bgColor, cam);
        fragColor = vec4(bgColor, 1.0);
        return;
    }
    
    // Compute normal (gradient computed here and passed through to avoid redundant computation)
    vec2 gradient;
    vec3 normal = getNormal(pos.xz, iTime, gradient);
    vec3 viewDir = -rd;
    
    // Shade
    vec3 color = shadeOcean(pos, normal, viewDir, iTime, gradient);
    
    // Apply atmospheric fog/haze
    color = applyAtmosphericFog(color, pos, cam.position, rd, iTime);
    
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
