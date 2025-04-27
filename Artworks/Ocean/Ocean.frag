// --- Parameters ---

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
float fresnelPower = 5.0;
float refractionStrength = 0.5;

// Foam
float foamSlopeMin = 0.5;
float foamSlopeMax = 1.0;
float foamIntensity = 0.7;

// Water Color
vec3 baseWaterColor = vec3(0.0, 0.3, 0.5);
vec3 shallowWaterColor = vec3(0.0, 0.5, 0.7);
float shallowDepthRange = 2.0;

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

vec3 getNormal(vec2 pos, float time)
{
    float eps = normalEps;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time) + fbm((pos - vec2(eps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time) + fbm((pos + vec2(eps, 0.0)) * rippleFreq + time*0.1) * rippleStrength;
    float hD = getWaveHeight(pos - vec2(0.0, eps), time) + fbm((pos - vec2(0.0, eps)) * rippleFreq + time*0.1) * rippleStrength;
    float hU = getWaveHeight(pos + vec2(0.0, eps), time) + fbm((pos + vec2(0.0, eps)) * rippleFreq + time*0.1) * rippleStrength;
    return normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
}

float animatedFoamNoise(vec2 p, float time)
{
    return fbm(p * 3.0 + vec2(time*0.2, time*0.1));
}

float getFoam(vec2 pos, float time)
{
    float eps = normalEps;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * eps);
    float slope = length(grad);
    
    float foam = smoothstep(foamSlopeMin, foamSlopeMax, slope);
    foam *= smoothstep(0.3, 0.7, animatedFoamNoise(pos*2.0, time));
    return foam;
}

float fresnel(vec3 viewDir, vec3 normal)
{
    return pow(1.0 - max(dot(viewDir, normal), 0.0), fresnelPower);
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

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time)
{
    vec3 reflected = skyColor(reflect(-viewDir, normal));
    vec3 refracted = baseWaterColor;
    
    float sunDiffuse = max(dot(normal, sunDirection), 0.0);
    vec3 sunLight = sunColor * sunDiffuse * sunIntensity;
    
    float f = fresnel(viewDir, normal);
    float foam = getFoam(pos.xz, time);
    
    float depthFactor = smoothstep(0.0, shallowDepthRange, pos.y);
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
        t += clamp(h * 0.5, 0.01, 1.0);
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
    vec3 normal = getNormal(pos.xz, iTime);
    vec3 color = shadeOcean(pos, normal, rd, iTime);
    
    fragColor = vec4(color, 1.0);
}
