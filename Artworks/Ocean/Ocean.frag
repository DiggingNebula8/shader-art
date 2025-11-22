// --- Parameters ---

// Mathematical constants
const float PI = 3.14159265;

// Raymarching
const int MAX_STEPS = 100;
const float MIN_DIST = 0.01;
const float MAX_DIST = 100.0;

// Wave settings
const int NUM_WAVES = 6;
vec2 waveDirs[NUM_WAVES] = vec2[](
    vec2(0.8, 0.6), vec2(-0.6, 1.0),
    vec2(1.0, -0.7), vec2(-0.9, -0.4),
    vec2(0.7, 0.7), vec2(-0.8, 0.5)
);
float waveAmps[NUM_WAVES] = float[](0.6, 0.4, 0.2, 0.15, 0.05, 0.03);
float waveFreqs[NUM_WAVES] = float[](0.8, 1.0, 2.5, 3.0, 8.0, 10.0);
float waveSpeeds[NUM_WAVES] = float[](0.4, 0.3, 0.8, 0.9, 1.5, 1.7);
float choppyStrength = 0.3;

// Surface detail
float normalEps = 0.1;
float rippleStrength = 0.2;
float rippleFreq = 10.0;

// Lighting
vec3 sunDirection = normalize(vec3(0.8, 1.0, 0.6));
vec3 sunColor = vec3(1.2, 1.0, 0.8);
float sunIntensity = .1;

// PBR Material Properties
const float waterIOR = 1.33;              // Index of refraction (water)
const float airIOR = 1.0;                 // Index of refraction (air)
const vec3 waterAbsorption = vec3(0.45, 0.03, 0.015);  // Absorption coefficient (red absorbs most, blue least)
const float roughness = 0.02;             // Surface roughness (0=smooth, 1=rough)
const float metallic = 0.0;               // Not metallic (dielectric)
const vec3 albedo = vec3(0.0, 0.3, 0.5);  // Base color
const vec3 F0_dielectric = vec3(0.02);    // Fresnel F0 for dielectrics (water)

// Foam
float foamSlopeMin = 0.5;
float foamSlopeMax = 1.0;
float foamIntensity = 0.7;

// Water Color
vec3 baseWaterColor = vec3(0.0, 0.3, 0.5);
vec3 shallowWaterColor = vec3(0.0, 0.5, 0.7);
// Depth range: with oceanFloorDepth=-10.0 and wave heights ~±1.43, depth ranges ~8.5-11.5
// Use wave height variation to create depth-based color transitions
// Base depth (at mean wave height) and depth variation range
const float baseDepth = 10.0;  // Approximate mean depth
const float depthVariationRange = 3.0;  // Range of depth variation from waves

// Ocean floor depth (Y coordinate of ocean floor, negative = below surface)
const float oceanFloorDepth = -10.0;

// Camera
vec3 camPos = vec3(0.0, 3.0, 5.0);
vec3 camLookAt = vec3(0.0, 0.0, 0.0);
float camFov = 1.5;

// --- Noise Functions ---

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); float a = hash(i); float b = hash(i + vec2(1, 0)); float c = hash(i + vec2(0, 1)); float d = hash(i + vec2(1, 1)); vec2 u = f*f*(3.0-2.0*f); return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y; }
float fbm(vec2 p) { float t=0.0,a=0.5; for(int i=0;i<4;i++){t+=noise(p)*a;p*=2.0;a*=0.5;} return t; }

// --- Ocean Functions ---

float getWaveHeight(vec2 pos, float time)
{
    float height = 0.0;
    for (int i = 0; i < NUM_WAVES; i++)
    {
        vec2 dir = normalize(waveDirs[i]);
        vec2 displacedPos = pos + dir * (sin(dot(pos, dir)*waveFreqs[i] + time*waveSpeeds[i]) * waveAmps[i] * choppyStrength);
        height += waveAmps[i] * sin(dot(displacedPos, dir) * waveFreqs[i] + time * waveSpeeds[i]);
    }
    return height;
}

// Optimized: Returns wave gradient, avoiding redundant calculations
// Only computes the 4 samples needed for gradient (center height not needed)
vec2 getWaveGradient(vec2 pos, float time)
{
    float eps = normalEps;
    
    // Compute wave heights at 4 sample points for gradient calculation
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    // Compute gradient from finite differences
    vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * eps);
    
    return grad;
}

// Optimized: computes normal and gradients (wave-only and combined) once
// Returns normal and outputs gradients via out parameters for reuse
// waveGradient: wave-only gradient (for foam - excludes ripple detail)
// combinedGradient: wave + ripple gradient (for normal calculation)
vec3 getNormalAndGradient(vec2 pos, float time, out vec2 waveGradient, out vec2 combinedGradient)
{
    // Get wave gradient (only compute once)
    vec2 grad = getWaveGradient(pos, time);
    waveGradient = grad; // Store wave-only gradient for foam
    
    // Compute ripple gradient with smaller epsilon for fine detail
    float rippleEps = normalEps * 0.5;
    float rippleL = fbm((pos - vec2(rippleEps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleR = fbm((pos + vec2(rippleEps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleD = fbm((pos - vec2(0.0, rippleEps)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleU = fbm((pos + vec2(0.0, rippleEps)) * rippleFreq + time*0.1) * rippleStrength;
    
    vec2 rippleGrad = vec2(rippleR - rippleL, rippleU - rippleD) / (2.0 * rippleEps);
    grad += rippleGrad; // Combined gradient for normal

    combinedGradient = grad;
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}

float animatedFoamNoise(vec2 p, float time)
{
    return fbm(p * 3.0 + vec2(time*0.2, time*0.1));
}

// Optimized: Reuses gradient calculation from normal computation
float getFoam(vec2 pos, float time, vec2 gradient)
{
    // Reuse the gradient passed from normal calculation
    float slope = length(gradient);
    
    float foam = smoothstep(foamSlopeMin, foamSlopeMax, slope);
    foam *= smoothstep(0.3, 0.7, animatedFoamNoise(pos*2.0, time));
    return foam;
}

// PBR: Schlick's Fresnel Approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// PBR: Physically-based Fresnel for water
vec3 getFresnel(vec3 viewDir, vec3 normal)
{
    float cosTheta = max(dot(viewDir, normal), 0.0);
    return fresnelSchlick(cosTheta, F0_dielectric);
}

// Wrapper for backward compatibility (returns scalar average)
float fresnel(vec3 viewDir, vec3 normal)
{
    vec3 F = getFresnel(viewDir, normal);
    return dot(F, vec3(1.0/3.0)); // Return average for mixing
}

// PBR: Cook-Torrance BRDF Functions

// Normal Distribution Function (GGX/Trowbridge-Reitz)
float D_GGX(float NdotH, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

// Geometry Function (Smith with Schlick-GGX)
float G_SchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness)
{
    return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
}

// Cook-Torrance specular BRDF
vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness)
{
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    // Early exit if surface is facing away
    if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0.0);
    
    float D = D_GGX(NdotH, roughness);
    float G = G_Smith(NdotV, NdotL, roughness);
    vec3 F = fresnelSchlick(VdotH, F0_dielectric);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001; // Avoid division by zero
    
    return (numerator / denominator) * lightColor * NdotL;
}

vec3 skyColor(vec3 dir)
{
    return mix(vec3(0.6, 0.7, 0.9), vec3(0.1, 0.3, 0.6), dir.y * 0.5 + 0.5);
}

// PBR: Environment-based ambient lighting
// Samples sky color based on normal direction for more realistic ambient
vec3 getEnvironmentLight(vec3 normal)
{
    // Sample sky color in the direction of the normal (hemisphere sampling)
    // Bias towards upward direction for more realistic ambient
    vec3 skyDir = normalize(normal + vec3(0.0, 1.0, 0.0));
    return skyColor(skyDir) * 0.3; // Scale down for ambient contribution
}

// PBR: Tone mapping (Reinhard)
// Maps HDR colors to LDR display range while preserving detail
vec3 toneMapReinhard(vec3 color)
{
    return color / (color + vec3(1.0));
}

// PBR: Gamma correction
vec3 gammaCorrect(vec3 color, float gamma)
{
    return pow(max(color, vec3(0.0)), vec3(1.0 / gamma));
}

float sparkleNoise(vec2 p, float time)
{
    return fract(sin(dot(p * 50.0 + time * 2.0, vec2(12.9898,78.233))) * 43758.5453);
}

// PBR: Integrate sparkles into BRDF by modifying roughness
// Sparkles occur where surface is smoother (lower roughness)
float getRoughnessWithSparkles(vec2 worldPos, float time, float baseRoughness)
{
    float sparkleMask = sparkleNoise(worldPos, time);
    // Reduce roughness where sparkles occur (smoother surface = brighter highlights)
    // Only apply sparkle roughness reduction where noise is high
    float sparkleFactor = smoothstep(0.6, 1.0, sparkleMask);
    return mix(baseRoughness, baseRoughness * 0.1, sparkleFactor * 0.5);
}

// Legacy sparkle function (kept for reference, but sparkles now integrated into BRDF)
float computeSparkles(vec3 normal, vec3 viewDir, vec2 worldPos, float time)
{
    // viewDir is surface → camera, sunDirection is surface → light
    // Half vector: H = normalize(L + V) for Blinn-Phong
    vec3 halfVec = normalize(sunDirection + viewDir);
    float ndoth = max(dot(normal, halfVec), 0.0);
    float sparkleBase = pow(ndoth, 256.0);
    float noiseMask = sparkleNoise(worldPos, time);
    return sparkleBase * smoothstep(0.5, 1.0, noiseMask);
}

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient)
{
    // viewDir is now surface → camera (corrected convention)
    vec3 refracted = baseWaterColor;
    // PBR: Compute Fresnel for energy conservation
    vec3 F = getFresnel(viewDir, normal);
    float f = dot(F, vec3(1.0/3.0)); // Scalar Fresnel for reflection/refraction mixing
    
    // Use wave-only gradient for foam (excludes ripple detail to avoid foam on small ripples)
    float foam = getFoam(pos.xz, time, gradient);
    
    // Calculate water depth: distance from surface to ocean floor
    // Since pos is at the surface (pos.y ≈ getWaveHeight), we compute depth as:
    // depth = surfaceHeight - oceanFloorDepth
    // This gives us the actual water depth at this location
    float surfaceHeight = getWaveHeight(pos.xz, time);
    float depth = surfaceHeight - oceanFloorDepth;
    
    // Create depth-based color variation using wave height variation
    // Normalize depth relative to base depth, then use variation range for transition
    // This creates shallow color in wave troughs (lower surface = shallower) and deep color in peaks
    float depthOffset = depth - baseDepth;  // Offset from mean depth
    float depthFactor = smoothstep(-depthVariationRange * 0.5, depthVariationRange * 0.5, depthOffset);
    refracted = mix(shallowWaterColor, baseWaterColor, depthFactor);
    
    // PBR: Cook-Torrance lighting with energy conservation
    vec3 lightDir = sunDirection;
    vec3 lightColor = sunColor * sunIntensity;
    
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    // PBR: Dynamic roughness with sparkles integrated
    // Sparkles occur where surface is smoother (lower roughness)
    float dynamicRoughness = getRoughnessWithSparkles(pos.xz, time, roughness);
    
    // Specular (Cook-Torrance BRDF with sparkle-integrated roughness)
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness);
    
    // Energy-conserving diffuse (Lambertian)
    // kS = Fresnel (specular contribution)
    // kD = (1 - kS) * (1 - metallic) for dielectrics
    vec3 kS = F; // Specular contribution from Fresnel
    vec3 kD = (1.0 - kS) * (1.0 - metallic); // Diffuse contribution (energy conserving)
    
    // Lambertian diffuse: kD * albedo * lightColor * NdotL / PI
    vec3 diffuse = kD * albedo * lightColor * NdotL / PI;
    
    // Environment-based ambient (samples sky based on normal)
    vec3 ambient = getEnvironmentLight(normal) * albedo;
    
    // Reflection/refraction contribution (integrated into BRDF)
    // Reflection is already handled by specular BRDF, refraction contributes to base color
    // Mix reflection and refraction based on Fresnel
    // reflect() expects incident direction (toward surface), but viewDir is surface → camera
    vec3 reflected = skyColor(reflect(-viewDir, normal));
    vec3 baseColor = mix(refracted, reflected, f);
    
    // Combine: base color (reflection/refraction) + ambient + diffuse + specular
    // Base color contributes less since reflection is also in specular
    vec3 color = baseColor * 0.2 + ambient + diffuse + specular;
    
    // Sparkles are now integrated into BRDF via dynamic roughness
    // Optional: Add subtle extra sparkle highlights for visual enhancement
    // (reduced intensity since sparkles are already in specular)
    float sparkleHighlight = computeSparkles(normal, viewDir, pos.xz, time);
    color += sparkleHighlight * vec3(0.3, 0.25, 0.2); // Subtle enhancement
    
    // Foam overlay
    color = mix(color, vec3(1.0), foam * foamIntensity);
    
    // Apply absorption based on depth
    vec3 absorption = exp(-waterAbsorption * depth);
    color *= absorption;
    
    // PBR: Energy conservation - clamp to reasonable HDR range
    color = min(color, vec3(10.0)); // Max 10x brightness (HDR)
    
    // PBR: Tone mapping (Reinhard) - maps HDR to LDR
    color = toneMapReinhard(color);
    
    // PBR: Gamma correction for display
    color = gammaCorrect(color, 2.2);
    
    return color;
}

vec3 raymarchOcean(vec3 ro, vec3 rd, float time)
{
    float t = 0.0;
    for (int i = 0; i < MAX_STEPS; i++)
    {
        vec3 pos = ro + rd * t;
        float h = pos.y - getWaveHeight(pos.xz, time);
        if (abs(h) < MIN_DIST) return pos;
        if (t > MAX_DIST) break;
        // More conservative stepping: use smaller multiplier to prevent overshooting on steep waves
        // Clamp step size to ensure stability
        t += clamp(h * 0.3, 0.01, 0.8);
    }
    return ro + rd * MAX_DIST;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy) / iResolution.y;
    
    vec3 forward = normalize(camLookAt - camPos);
    vec3 right = normalize(cross(vec3(0.0,1.0,0.0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x*right + uv.y*up + camFov*forward);
    
    vec3 pos = raymarchOcean(camPos, rd, iTime);
    
    // Compute normal and gradients together (optimized - only compute once)
    vec2 pos2d = pos.xz;
    vec2 waveGrad, combinedGrad;
    vec3 normal = getNormalAndGradient(pos2d, iTime, waveGrad, combinedGrad);

    // Convert ray direction (camera → surface) to view direction (surface → camera)
    // Fresnel and specular functions expect surface → camera direction
    vec3 viewDir = -rd;
    
    // Use wave-only gradient for foam (excludes ripple detail)
    // Use combined gradient for normal (includes ripple detail for shading)
    vec3 color = shadeOcean(pos, normal, viewDir, iTime, waveGrad);
    
    fragColor = vec4(color, 1.0);
}
