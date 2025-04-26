// Full ShaderToy Ocean Water Shader 🌊
// Based on our modular design

// Constants
const int MAX_STEPS = 100;
const float MIN_DIST = 0.01;
const float MAX_DIST = 100.0;

// ---- Wave Simulation ----

// Multiple Gerstner-style waves
float getWaveHeight(vec2 pos, float time)
{
    float height = 0.0;
    
    // Large swells
    height += 0.6 * sin(dot(pos, normalize(vec2(0.8, 0.6))) * 0.8 + time * 0.4);
    height += 0.4 * sin(dot(pos, normalize(vec2(-0.6, 1.0))) * 1.0 + time * 0.3);
    
    // Medium waves
    height += 0.2 * sin(dot(pos, normalize(vec2(1.0, -0.7))) * 2.5 + time * 0.8);
    height += 0.15 * sin(dot(pos, normalize(vec2(-0.9, -0.4))) * 3.0 + time * 0.9);
    
    // Choppy small waves
    height += 0.05 * sin(dot(pos, normalize(vec2(0.7, 0.7))) * 8.0 + time * 1.5);
    height += 0.03 * sin(dot(pos, normalize(vec2(-0.8, 0.5))) * 10.0 + time * 1.7);
    
    return height;
}

// ---- Normals ----

vec3 getNormal(vec2 pos, float time)
{
    float eps = 0.1;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    vec3 normal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
    
    return normal;
}

// ---- Foam ----

float getFoam(vec2 pos, float time)
{
    float eps = 0.1;
    float hL = getWaveHeight(pos - vec2(eps, 0.0), time);
    float hR = getWaveHeight(pos + vec2(eps, 0.0), time);
    float hD = getWaveHeight(pos - vec2(0.0, eps), time);
    float hU = getWaveHeight(pos + vec2(0.0, eps), time);
    
    vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * eps);
    float slope = length(grad);
    
    float foam = smoothstep(0.5, 1.0, slope);
    return foam;
}

// ---- Lighting ----

float fresnel(vec3 viewDir, vec3 normal)
{
    return pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
}

vec3 skyColor(vec3 dir)
{
    return mix(vec3(0.6, 0.7, 0.9), vec3(0.1, 0.3, 0.6), dir.y * 0.5 + 0.5);
}

vec3 finalColor(vec3 color, float foam)
{
    color = mix(color, vec3(1.0), foam * 0.7);
    color = pow(color, vec3(0.95));
    return color;
}

vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time)
{
    vec3 baseColor = vec3(0.0, 0.3, 0.5);
    vec3 skyRef = skyColor(reflect(-viewDir, normal));
    
    float f = fresnel(viewDir, normal);
    float foam = getFoam(pos.xz, time);
    
    vec3 waterColor = mix(baseColor, skyRef, f);
    waterColor = finalColor(waterColor, foam);
    
    return waterColor;
}

// ---- Raymarching ----

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

// ---- Main ShaderToy Entry ----

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Normalized screen coordinates
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Camera setup
    vec3 ro = vec3(0.0, 3.0, 5.0); // Camera position
    vec3 lookAt = vec3(0.0, 0.0, 0.0);
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);
    
    // Raymarch ocean
    vec3 pos = raymarchOcean(ro, rd, iTime);
    vec3 normal = getNormal(pos.xz, iTime);
    
    // Shade
    vec3 color = shadeOcean(pos, normal, rd, iTime);
    
    fragColor = vec4(color, 1.0);
}
