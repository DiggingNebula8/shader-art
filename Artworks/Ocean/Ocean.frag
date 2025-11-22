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
const float WATER_IOR = 1.33;
const float AIR_IOR = 1.0;
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

// Lighting
vec3 sunDir = normalize(vec3(0.2, 0.8, 0.4));
vec3 sunColor = vec3(1.0, 0.98, 0.95);
float sunIntensity = 2.5;

// Water Properties
const vec3 waterAbsorption = vec3(0.15, 0.045, 0.015); // m^-1 (realistic values)
const vec3 waterScattering = vec3(0.001, 0.001, 0.001);
const float roughness = 0.005; // Very smooth ocean surface

// Colors
vec3 deepWaterColor = vec3(0.0, 0.15, 0.3);
vec3 shallowWaterColor = vec3(0.0, 0.4, 0.6);
const float oceanFloorDepth = -15.0;

// Camera
vec3 camPos = vec3(0.0, 4.0, 8.0);
vec3 camLookAt = vec3(0.0, 0.0, 0.0);
float camFov = 1.0;

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
    float q = steepness / (k * amplitude * float(NUM_WAVES));
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
        float steepness;
        if (i == 0) steepness = 0.3;      // Primary swell - gentle
        else if (i == 1) steepness = 0.4; // Secondary swell
        else if (i == 2) steepness = 0.45;// Tertiary swell
        else if (i == 3) steepness = 0.5; // Cross swell
        else if (i == 4) steepness = 0.6; // Detail wave 1 - choppier
        else steepness = 0.7;             // Detail wave 2 - choppiest
        
        displacement += gerstnerWave(pos, dir, waveAmps[i], k, w, time, steepness);
    }
    
    return displacement;
}

float getWaveHeight(vec2 pos, float time) {
    vec3 disp = getWaveDisplacement(pos, time);
    return disp.y;
}

vec2 getWaveGradient(vec2 pos, float time) {
    float eps = 0.01;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    return vec2(hR - hL, hU - hD) / (2.0 * eps);
}

vec3 getNormal(vec2 pos, float time) {
    vec2 grad = getWaveGradient(pos, time);
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}

// --- Noise Functions ---
float hash(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < octaves; i++) {
        value += noise(p) * amplitude;
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
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

// --- Sky ---
vec3 skyColor(vec3 dir) {
    float sunDot = max(dot(dir, sunDir), 0.0);
    vec3 sky = mix(vec3(0.4, 0.6, 1.0), vec3(0.1, 0.2, 0.4), dir.y * 0.5 + 0.5);
    vec3 sun = sunColor * pow(sunDot, 128.0) * 3.0;
    return sky + sun;
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
float getFoam(vec2 pos, vec3 normal, float time) {
    // Wave gradient for steepness
    vec2 grad = getWaveGradient(pos, time);
    float slope = length(grad);
    
    // Wave height to identify crests
    float height = getWaveHeight(pos, time);
    
    // Curvature calculation (Laplacian approximation) - waves break where curvature is high
    // More efficient: compute Laplacian using height differences
    float eps = 0.08;
    float h0 = getWaveHeight(pos, time);
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    // Laplacian: second derivative approximation
    float curvature = abs((hL + hR + hD + hU - 4.0 * h0) / (eps * eps));
    
    // Foam appears where:
    // 1. Waves are steep (slope > threshold)
    // 2. Waves are breaking (high curvature)
    // 3. At wave crests (positive height)
    
    float steepnessFoam = smoothstep(0.4, 0.8, slope);
    float curvatureFoam = smoothstep(0.3, 0.6, curvature);
    float crestFoam = smoothstep(-0.1, 0.3, height); // Foam at crests
    
    // Combine foam factors - all contribute
    float foam = steepnessFoam * 0.5 + curvatureFoam * 0.3 + crestFoam * 0.2;
    
    // Add subtle wave-based variation (not noise texture)
    // Use wave height pattern itself for organic variation
    float wavePattern = sin(dot(pos, vec2(0.7, 0.3)) * 2.0 + time * 0.5) * 0.5 + 0.5;
    foam *= (0.7 + 0.3 * wavePattern); // Subtle variation, not dominant
    
    // Smooth transitions
    foam = smoothstep(0.2, 0.6, foam);
    
    return foam;
}

// --- Main Shading Function ---
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time) {
    // Fresnel
    vec3 F = getFresnel(viewDir, normal);
    float fresnelFactor = dot(F, vec3(1.0/3.0));
    
    // Depth calculation
    float depth = max(pos.y - oceanFloorDepth, 0.1);
    
    // Water color based on depth
    float depthFactor = 1.0 - exp(-depth * 0.1);
    vec3 waterColor = mix(shallowWaterColor, deepWaterColor, depthFactor);
    
    // Absorption (Beer-Lambert law)
    vec3 absorption = exp(-waterAbsorption * depth);
    vec3 refractedColor = waterColor * absorption;
    
    // Reflection
    vec3 reflectedDir = reflect(-viewDir, normal);
    vec3 reflectedColor = skyColor(reflectedDir);
    
    // Mix reflection and refraction based on Fresnel
    vec3 baseColor = mix(refractedColor, reflectedColor, fresnelFactor);
    
    // Direct lighting
    vec3 lightDir = sunDir;
    vec3 lightColor = sunColor * sunIntensity;
    
    // Specular highlight
    float dynamicRoughness = roughness;
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness);
    
    // Subsurface scattering
    vec3 subsurface = getSubsurfaceScattering(normal, viewDir, lightDir, depth);
    
    // Ambient (simplified IBL)
    vec3 ambient = skyColor(normal) * 0.15;
    
    // Combine
    vec3 color = baseColor + specular + subsurface + ambient;
    
    // Foam - realistic appearance
    float foam = getFoam(pos.xz, normal, time);
    
    // Foam color: slightly off-white with subtle blue tint
    vec3 foamColor = vec3(0.95, 0.98, 1.0);
    
    // Foam reduces specular (foam is more diffuse than water)
    vec3 foamSpecular = specular * (1.0 - foam * 0.8);
    
    // Blend foam: foam appears on top, mixing with water color
    // Use smooth blending - foam is semi-transparent
    float foamOpacity = foam * 0.85;
    color = mix(color, foamColor, foamOpacity);
    
    // Reduce specular where foam is present
    color = color - specular + foamSpecular;
    
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

// --- Main ---
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Camera setup
    vec3 forward = normalize(camLookAt - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + camFov * forward);
    
    // Raymarch
    vec3 pos = raymarchOcean(camPos, rd, iTime);
    
    // Background
    if (length(pos - camPos) > MAX_DIST * 0.95) {
        fragColor = vec4(skyColor(rd), 1.0);
        return;
    }
    
    // Compute normal
    vec3 normal = getNormal(pos.xz, iTime);
    vec3 viewDir = -rd;
    
    // Shade
    vec3 color = shadeOcean(pos, normal, viewDir, iTime);
    
    // Tone mapping
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
