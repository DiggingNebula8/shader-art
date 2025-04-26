// === Ocean Shader - Parameters ===

// Raymarching
const int MAX_STEPS = 100;
const float MIN_DIST = 0.01;
const float MAX_DIST = 100.0;

// Wave settings
const int NUM_WAVES = 6;
vec2 waveDirs[NUM_WAVES] = vec2[](
    vec2(0.8, 0.6),
    vec2(-0.6, 1.0),
    vec2(1.0, -0.7),
    vec2(-0.9, -0.4),
    vec2(0.7, 0.7),
    vec2(-0.8, 0.5)
);
float waveAmps[NUM_WAVES] = float[](0.6, 0.4, 0.2, 0.15, 0.05, 0.03);
float waveFreqs[NUM_WAVES] = float[](0.8, 1.0, 2.5, 3.0, 8.0, 10.0);
float waveSpeeds[NUM_WAVES] = float[](0.4, 0.3, 0.8, 0.9, 1.5, 1.7);

// Normals
float normalEps = 0.1;

// Foam
float foamSlopeMin = 0.5;
float foamSlopeMax = 1.0;
float foamIntensity = 0.7;

// Water Color
vec3 baseWaterColor = vec3(0.0, 0.3, 0.5);

// Fresnel
float fresnelPower = 5.0;

// Camera
vec3 camPos = vec3(0.0, 3.0, 5.0);
vec3 camLookAt = vec3(0.0, 0.0, 0.0);
float camFov = 1.5;

// === Ocean Shader - Functions ===

// Wave height function
float getWaveHeight(vec2 pos, float time)
{
    float height = 0.0;
    for (int i = 0; i < NUM_WAVES; i++)
    {
        vec2 dir = normalize(waveDirs[i]);
        height += waveAmps[i] * sin(dot(pos, dir) * waveFreqs[i] + time * waveSpeeds[i]);
    }
    return height;
}

// Surface normal
vec3 getNormal(vec2 pos, float time)
{
    float hL = getWaveHeight(pos - vec2(normalEps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(normalEps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, normalEps), time);
    float hU = getWaveHeight(pos + vec2(0.0, normalEps), time);
    
    return normalize(vec3(hL - hR, 2.0 * normalEps, hD - hU));
}

// Foam calculation
float getFoam(vec2 pos, float time)
{
    float hL = getWaveHeight(pos - vec2(normalEps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(normalEps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, normalEps), time);
    float hU = getWaveHeight(pos + vec2(0.0, normalEps), time);
    
    vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * normalEps);
    float slope = length(grad);
    
    return smoothstep(foamSlopeMin, foamSlopeMax, slope);
}

// Fresnel
float fresnel(vec3 viewDir, vec3 normal)
{
    return pow(1.0 - max(dot(viewDir, normal), 0.0), fresnelPower);
}

// Sky color
vec3 skyColor(vec3 dir)
{
    return mix(vec3(0.6, 0.7, 0.9), vec3(0.1, 0.3, 0.6), dir.y * 0.5 + 0.5);
}

// Final color grading
vec3 finalColor(vec3 color, float foam)
{
    color = mix(color, vec3(1.0), foam * foamIntensity);
    color = pow(color, vec3(0.95));
    return color;
}

// Ocean shading
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time)
{
    vec3 skyRef = skyColor(reflect(-viewDir, normal));
    float f = fresnel(viewDir, normal);
    float foam = getFoam(pos.xz, time);
    
    vec3 waterColor = mix(baseWaterColor, skyRef, f);
    return finalColor(waterColor, foam);
}

// Raymarching ocean
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

// Main image
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec3 forward = normalize(camLookAt - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + camFov * forward);
    
    vec3 pos = raymarchOcean(camPos, rd, iTime);
    vec3 normal = getNormal(pos.xz, iTime);
    vec3 color = shadeOcean(pos, normal, rd, iTime);
    
    fragColor = vec4(color, 1.0);
}
