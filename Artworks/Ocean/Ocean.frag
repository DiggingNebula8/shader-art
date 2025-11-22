// --- Parameters ---

// Mathematical constants
const float PI = 3.14159265;
const float EPSILON = 0.0001;

// Raymarching - High quality settings
const int MAX_STEPS = 256;
const float MIN_DIST = 0.0005;
const float MAX_DIST = 200.0;

// Wave settings - Production quality ocean waves
const int NUM_WAVES = 8;
vec2 waveDirs[NUM_WAVES] = vec2[](
    vec2(0.8, 0.6), vec2(-0.6, 0.8),
    vec2(0.9, -0.4), vec2(-0.7, -0.7),
    vec2(0.5, 0.9), vec2(-0.9, 0.3),
    vec2(0.3, -0.95), vec2(-0.4, 0.9)
);
float waveAmps[NUM_WAVES] = float[](1.0, 0.6, 0.4, 0.25, 0.15, 0.08, 0.04, 0.02);
float waveFreqs[NUM_WAVES] = float[](0.4, 0.6, 1.0, 1.5, 2.5, 4.0, 7.0, 12.0);
float waveSpeeds[NUM_WAVES] = float[](0.3, 0.37, 0.48, 0.59, 0.76, 0.96, 1.27, 1.65);
float choppyStrength = 0.5;

// Surface detail
float normalEps = 0.02;
float rippleStrength = 0.15;
float rippleFreq = 15.0;

// Lighting - Production quality
vec3 sunDirection = normalize(vec3(0.3, 0.8, 0.5));
vec3 sunColor = vec3(1.0, 0.95, 0.9);
float sunIntensity = 1.2;

// PBR Material Properties
const float waterIOR = 1.33;
const float airIOR = 1.0;
const vec3 F0_dielectric = vec3(pow((waterIOR - airIOR) / (waterIOR + airIOR), 2.0));
const vec3 waterAbsorption = vec3(0.8, 0.15, 0.05);  // Stronger absorption for realism
const float roughness = 0.01;  // Very smooth water
const float metallic = 0.0;
const vec3 albedo = vec3(0.0, 0.25, 0.4);

// Foam
float foamSlopeMin = 0.4;
float foamSlopeMax = 0.9;
float foamIntensity = 0.8;

// Water Color
vec3 baseWaterColor = vec3(0.0, 0.2, 0.4);
vec3 shallowWaterColor = vec3(0.0, 0.4, 0.6);
const float baseDepth = 10.0;
const float depthVariationRange = 4.0;
const float oceanFloorDepth = -10.0;

// Camera
vec3 camPos = vec3(0.0, 3.0, 5.0);
vec3 camLookAt = vec3(0.0, 0.0, 0.0);
float camFov = 1.2;

// --- Noise Functions ---

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
    float t = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        t += noise(p) * a;
        p *= 2.0;
        a *= 0.5;
    }
    return t;
}

// --- Ocean Functions ---

float getWaveHeight(vec2 pos, float time) {
    float height = 0.0;
    for (int i = 0; i < NUM_WAVES; i++) {
        vec2 dir = normalize(waveDirs[i]);
        float phase = dot(pos, dir) * waveFreqs[i] + time * waveSpeeds[i];
        vec2 displacedPos = pos + dir * (sin(phase) * waveAmps[i] * choppyStrength);
        height += waveAmps[i] * sin(dot(displacedPos, dir) * waveFreqs[i] + time * waveSpeeds[i]);
    }
    return height;
}

vec2 getWaveGradient(vec2 pos, float time) {
    float eps = normalEps;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    return vec2(hR - hL, hU - hD) / (2.0 * eps);
}

vec3 getNormalAndGradient(vec2 pos, float time, out vec2 waveGradient, out vec2 combinedGradient) {
    vec2 grad = getWaveGradient(pos, time);
    waveGradient = grad;
    
    float rippleEps = normalEps * 0.3;
    float rippleL = fbm((pos - vec2(rippleEps, 0.0)) * rippleFreq + time * 0.15) * rippleStrength;
    float rippleR = fbm((pos + vec2(rippleEps, 0.0)) * rippleFreq + time * 0.15) * rippleStrength;
    float rippleD = fbm((pos - vec2(0.0, rippleEps)) * rippleFreq + time * 0.15) * rippleStrength;
    float rippleU = fbm((pos + vec2(0.0, rippleEps)) * rippleFreq + time * 0.15) * rippleStrength;
    
    vec2 rippleGrad = vec2(rippleR - rippleL, rippleU - rippleD) / (2.0 * rippleEps);
    grad += rippleGrad;
    
    combinedGradient = grad;
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}

float animatedFoamNoise(vec2 p, float time) {
    return fbm(p * 4.0 + vec2(time * 0.3, time * 0.15));
}

float getFoam(vec2 pos, float time, vec2 gradient) {
    float slope = length(gradient);
    float foam = smoothstep(foamSlopeMin, foamSlopeMax, slope);
    float noiseMask = smoothstep(0.4, 0.8, animatedFoamNoise(pos * 2.5, time));
    foam *= noiseMask;
    return foam;
}

// PBR: Schlick's Fresnel Approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}

vec3 getFresnel(vec3 viewDir, vec3 normal) {
    float cosTheta = max(dot(viewDir, normal), 0.0);
    return fresnelSchlick(cosTheta, F0_dielectric);
}

// PBR: Cook-Torrance BRDF Functions
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
    vec3 F = fresnelSchlick(VdotH, F0_dielectric);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    return (numerator / denominator) * lightColor * NdotL;
}

vec3 skyColor(vec3 dir) {
    float sunDot = max(dot(dir, sunDirection), 0.0);
    vec3 skyBase = mix(vec3(0.5, 0.7, 1.0), vec3(0.1, 0.2, 0.4), dir.y * 0.5 + 0.5);
    vec3 sunGlow = sunColor * pow(sunDot, 64.0) * 2.0;
    return skyBase + sunGlow;
}

void getEnvironmentLight(vec3 normal, vec3 viewDir, vec3 F, out vec3 ambientDiffuse, out vec3 ambientSpecular) {
    vec3 skyDirDiffuse = normalize(normal + vec3(0.0, 1.0, 0.0));
    vec3 skyColorDiffuse = skyColor(skyDirDiffuse) * 0.2;
    
    vec3 reflectedDir = reflect(-viewDir, normal);
    vec3 skyColorSpecular = skyColor(reflectedDir) * 0.3;
    
    vec3 kD = (1.0 - F) * (1.0 - metallic);
    ambientDiffuse = skyColorDiffuse * albedo * kD;
    ambientSpecular = skyColorSpecular * F;
}

vec3 toneMapReinhard(vec3 color) {
    return color / (color + vec3(1.0));
}

vec3 gammaCorrect(vec3 color, float gamma) {
    return pow(max(color, vec3(0.0)), vec3(1.0 / gamma));
}

float sparkleNoise(vec2 p, float time) {
    return fract(sin(dot(p * 60.0 + time * 3.0, vec2(12.9898, 78.233))) * 43758.5453);
}

float getRoughnessWithSparkles(vec2 worldPos, float time, float baseRoughness) {
    float sparkleMask = sparkleNoise(worldPos, time);
    float sparkleFactor = smoothstep(0.7, 1.0, sparkleMask);
    return mix(baseRoughness, baseRoughness * 0.05, sparkleFactor * 0.6);
}

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient) {
    vec3 F = getFresnel(viewDir, normal);
    float f = dot(F, vec3(1.0/3.0));
    
    float foam = getFoam(pos.xz, time, gradient);
    
    float surfaceHeight = getWaveHeight(pos.xz, time);
    float depth = max(surfaceHeight - oceanFloorDepth, 0.1);
    
    float depthOffset = depth - baseDepth;
    float depthFactor = smoothstep(-depthVariationRange * 0.5, depthVariationRange * 0.5, depthOffset);
    vec3 waterColor = mix(shallowWaterColor, baseWaterColor, depthFactor);
    
    vec3 absorption = exp(-waterAbsorption * depth);
    vec3 refracted = waterColor * absorption;
    
    vec3 reflected = skyColor(reflect(-viewDir, normal));
    vec3 baseColor = mix(refracted, reflected, f);
    
    vec3 lightDir = sunDirection;
    vec3 lightColor = sunColor * sunIntensity;
    
    float NdotL = max(dot(normal, lightDir), 0.0);
    float dynamicRoughness = getRoughnessWithSparkles(pos.xz, time, roughness);
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness);
    
    vec3 kS = F;
    vec3 kD = (1.0 - kS) * (1.0 - metallic) * 0.05;
    vec3 diffuse = kD * albedo * lightColor * NdotL / PI;
    
    vec3 ambientDiffuse, ambientSpecular;
    getEnvironmentLight(normal, viewDir, F, ambientDiffuse, ambientSpecular);
    vec3 ambient = ambientDiffuse + ambientSpecular;
    
    vec3 color = baseColor + specular + diffuse + ambient * 0.6;
    
    color = mix(color, vec3(1.0), foam * foamIntensity);
    
    color = min(color, vec3(20.0));
    color = toneMapReinhard(color);
    color = gammaCorrect(color, 2.2);
    
    return color;
}

vec3 raymarchOcean(vec3 ro, vec3 rd, float time) {
    float t = 0.0;
    float lastH = 1e20;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos = ro + rd * t;
        float h = pos.y - getWaveHeight(pos.xz, time);
        
        if (abs(h) < MIN_DIST) {
            return pos;
        }
        
        if (t > MAX_DIST) break;
        
        float stepSize = clamp(h * 0.3, MIN_DIST * 2.0, 0.5);
        t += stepSize;
        
        if (abs(h - lastH) < EPSILON && h > MIN_DIST * 5.0) break;
        lastH = h;
    }
    
    return ro + rd * MAX_DIST;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec3 forward = normalize(camLookAt - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + camFov * forward);
    
    vec3 pos = raymarchOcean(camPos, rd, iTime);
    
    if (length(pos - camPos) > MAX_DIST * 0.99) {
        fragColor = vec4(skyColor(rd), 1.0);
        return;
    }
    
    vec2 pos2d = pos.xz;
    vec2 waveGrad, combinedGrad;
    vec3 normal = getNormalAndGradient(pos2d, iTime, waveGrad, combinedGrad);
    
    vec3 viewDir = -rd;
    vec3 color = shadeOcean(pos, normal, viewDir, iTime, waveGrad);
    
    fragColor = vec4(color, 1.0);
}
