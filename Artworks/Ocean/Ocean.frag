// Physically-Based Ocean Shader
// Based on: Tessendorf "Simulating Ocean Water" (SIGGRAPH 2001)
//          Gerstner Wave Model
//          Proper Fresnel and Subsurface Scattering

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.0001;

// Raymarching
const int MAX_STEPS = 200;
const float MIN_DIST = 0.001;
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

// Water Colors
const vec3 deepWaterColor = vec3(0.0, 0.15, 0.3);
const vec3 shallowWaterColor = vec3(0.0, 0.4, 0.6);
const float oceanFloorDepth = -15.0;

// Camera Configuration
const vec3 camPos = vec3(0.0, 4.0, 8.0);
const vec3 camLookAt = vec3(0.0, 0.0, 0.0);
const float camFov = 1.0;

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

// --- Enhanced PBR Shading Function with Time-of-Day Support ---
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient) {
    // Get dynamic sun properties based on time
    vec3 sunDir = getSunDir(time);
    vec3 sunColor = getSunColor(time);
    float sunIntensity = getSunIntensity(time);
    
    // Fresnel - per-channel for energy conservation
    vec3 F = getFresnel(viewDir, normal);
    
    // Depth calculation
    float depth = max(pos.y - oceanFloorDepth, 0.1);
    
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
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Camera setup
    vec3 forward = normalize(camLookAt - camPos);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = cross(worldUp, forward);
    // Handle degenerate case (looking straight up/down)
    if (length(right) < 0.001) {
        right = vec3(1.0, 0.0, 0.0);  // Fallback to x-axis
    } else {
        right = normalize(right);
    }
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + camFov * forward);
    
    // Raymarch
    vec3 pos = raymarchOcean(camPos, rd, iTime);
    
    // Background
    if (length(pos - camPos) > MAX_DIST * 0.95) {
        fragColor = vec4(skyColor(rd, iTime), 1.0);
        return;
    }
    
    // Compute normal (gradient computed here and passed through to avoid redundant computation)
    vec2 gradient;
    vec3 normal = getNormal(pos.xz, iTime, gradient);
    vec3 viewDir = -rd;
    
    // Shade
    vec3 color = shadeOcean(pos, normal, viewDir, iTime, gradient);
    
    // Apply atmospheric fog/haze
    color = applyAtmosphericFog(color, pos, camPos, rd, iTime);
    
    // Tone mapping
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
