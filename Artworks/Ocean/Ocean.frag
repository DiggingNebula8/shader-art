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
vec3 ambientLightColor = vec3(0.05, 0.1, 0.2);
vec3 sunDirection = normalize(vec3(0.8, 1.0, 0.6));
vec3 sunColor = vec3(1.2, 1.0, 0.8);
float sunIntensity = .1;
float fresnelPower = 5.0; // Legacy - will be replaced by PBR Fresnel
float refractionStrength = 0.5;

// PBR Material Properties
const float waterIOR = 1.33;              // Index of refraction (water)
const float airIOR = 1.0;                 // Index of refraction (air)
const vec3 waterAbsorption = vec3(0.1, 0.2, 0.3);  // Absorption coefficient
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
float shallowDepthRange = 2.0;

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

// Optimized: computes normal and combined gradient (wave + ripple) once
// Returns normal and outputs gradient via out parameter for reuse
vec3 getNormalAndGradient(vec2 pos, float time, out vec2 gradient)
{
    // Get wave gradient (only compute once)
    vec2 grad = getWaveGradient(pos, time);
    
    // Compute ripple gradient with smaller epsilon for fine detail
    float rippleEps = normalEps * 0.5;
    float rippleL = fbm((pos - vec2(rippleEps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleR = fbm((pos + vec2(rippleEps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleD = fbm((pos - vec2(0.0, rippleEps)) * rippleFreq + time*0.1) * rippleStrength;
    float rippleU = fbm((pos + vec2(0.0, rippleEps)) * rippleFreq + time*0.1) * rippleStrength;
    
    vec2 rippleGrad = vec2(rippleR - rippleL, rippleU - rippleD) / (2.0 * rippleEps);
    grad += rippleGrad;

    gradient = grad;
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

// Legacy Fresnel (kept for reference, will be replaced)
float fresnel_legacy(vec3 viewDir, vec3 normal)
{
    return pow(1.0 - max(dot(viewDir, normal), 0.0), fresnelPower);
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

vec3 skyColor(vec3 dir)
{
    return mix(vec3(0.6, 0.7, 0.9), vec3(0.1, 0.3, 0.6), dir.y * 0.5 + 0.5);
}

float sunSpecular(vec3 normal, vec3 viewDir)
{
    vec3 halfVec = normalize(sunDirection - viewDir);
    return pow(max(dot(normal, halfVec), 0.0), 64.0);
}

float sparkleNoise(vec2 p, float time)
{
    return fract(sin(dot(p * 50.0 + time * 2.0, vec2(12.9898,78.233))) * 43758.5453);
}

float computeSparkles(vec3 normal, vec3 viewDir, vec2 worldPos, float time)
{
    vec3 halfVec = normalize(sunDirection - viewDir);
    float ndoth = max(dot(normal, halfVec), 0.0);
    float sparkleBase = pow(ndoth, 256.0);
    float noiseMask = sparkleNoise(worldPos, time);
    return sparkleBase * smoothstep(0.5, 1.0, noiseMask);
}

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient)
{
    vec3 reflected = skyColor(reflect(-viewDir, normal));
    vec3 refracted = baseWaterColor;
    
    float sunDiffuse = max(dot(normal, sunDirection), 0.0);
    vec3 sunLight = sunColor * sunDiffuse * sunIntensity;
    
    float f = fresnel(viewDir, normal);
    // Reuse gradient from normal calculation for foam
    float foam = getFoam(pos.xz, time, gradient);
    
    // Calculate water depth: distance from surface to ocean floor
    // Since pos is at the surface (pos.y ≈ getWaveHeight), we compute depth as:
    // depth = surfaceHeight - oceanFloorDepth
    // This gives us the actual water depth at this location
    float surfaceHeight = getWaveHeight(pos.xz, time);
    float depth = max(0.0, surfaceHeight - oceanFloorDepth);
    float depthFactor = smoothstep(0.0, shallowDepthRange, depth);
    refracted = mix(shallowWaterColor, baseWaterColor, depthFactor);
    
    vec3 color = mix(refracted, reflected, f);
    color = color * 0.5 + ambientLightColor * 0.3 + sunLight;
    
    color += sunSpecular(normal, viewDir) * sunColor * 1.5;
    color += computeSparkles(normal, viewDir, pos.xz, time) * vec3(1.5, 1.4, 1.3);
    color = mix(color, vec3(1.0), foam * foamIntensity);
    
    return pow(color, vec3(0.95));
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
    
    // Compute normal and gradient together (optimized - only compute once)
    vec2 pos2d = pos.xz;
    vec2 grad;
    vec3 normal = getNormalAndGradient(pos2d, iTime, grad);

    // Reuse gradient for foam calculation
    vec3 color = shadeOcean(pos, normal, rd, iTime, grad);
    
    fragColor = vec4(color, 1.0);
}
