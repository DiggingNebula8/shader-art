// ============================================================================
// WATER SHADING SYSTEM
// ============================================================================
// Pure water material properties and shading functions
// Based on: Filament PBR Engine, Unreal Engine 4/5 Water Shading
//          Jensen et al. "A Practical Model for Subsurface Light Transport"
//          "Multiple-Scattering Microfacet BSDFs with the Smith Model"
// ============================================================================
// Dependencies:
//   - WaveSystem: For wave height/gradient queries (getWaveHeight, getWaveGradient)
//   - VolumeRaymarching: For terrain raymarching (raymarchTerrain)
//   - DistanceFieldSystem: For distance field algorithms and macros
//     Note: This file uses DISTANCE_FIELD_RAYMARCH macro which requires getSDF(pos, time) macro
//           to be defined. Scenes should define getSceneSDF() and use it via macro.
//   - Terrain height queries: Uses macro WATER_TERRAIN_HEIGHT(pos, params) instead of direct include
//     Scenes must define this macro before including WaterShading.frag
// ============================================================================

#ifndef WATER_SHADING_FRAG
#define WATER_SHADING_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"
#include "DistanceFieldSystem.frag"
// Include TerrainSystem only for TerrainParams type definition (not for function calls)
// Functions are accessed via WATER_TERRAIN_HEIGHT macro instead
#include "TerrainSystem.frag"

// Terrain height query macro - scenes must define this before including WaterShading.frag
// Default: returns 0.0 if not defined (for scenes without terrain)
// Note: Even with TerrainSystem included for types, we use this macro to avoid tight coupling
#ifndef WATER_TERRAIN_HEIGHT
#define WATER_TERRAIN_HEIGHT(pos, params) 0.0
#endif

// Note: sampleTranslucency() uses DISTANCE_FIELD_RAYMARCH macro which requires
// getSDF(pos, time) macro to be defined. Scenes should define getSceneSDF() and
// create a macro wrapper before calling sampleTranslucency().

// ============================================================================
// WATER PROPERTIES
// ============================================================================


// ============================================================================
// FRESNEL FUNCTIONS
// ============================================================================

vec3 getWaterF0() {
    return WATER_F0;
}

// Modern Fresnel (Schlick's Approximation)
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    return F;
}

// Proper Fresnel calculation for water surface
vec3 getFresnel(vec3 viewDir, vec3 normal) {
    float cosTheta = abs(dot(viewDir, normal));
    cosTheta = clamp(cosTheta, 0.0, 1.0);
    
    vec3 F0 = getWaterF0();
    vec3 F = fresnelSchlick(cosTheta, F0);
    
    return clamp(F, F0, vec3(1.0));
}

// ============================================================================
// PBR SHADING MODELS
// ============================================================================

// Modern GGX Distribution (Trowbridge-Reitz)
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / max(denom, EPSILON);
}

// Improved Geometry Function (Smith-GGX)
float G_SchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    float denom = NdotV * (1.0 - k) + k;
    return NdotV / max(denom, EPSILON);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    float ggx1 = G_SchlickGGX(NdotV, roughness);
    float ggx2 = G_SchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// Multi-Scattering Compensation
vec3 getMultiScatteringCompensation(vec3 F, vec3 F0, float roughness) {
    vec3 E = vec3(1.0) - F0;
    vec3 Eavg = E;
    
    float roughness2 = roughness * roughness;
    vec3 Fms = (vec3(1.0) - Eavg) / (vec3(1.0) - Eavg * (1.0 - roughness2));
    
    vec3 Fadd = Fms * (vec3(1.0) - F);
    
    return F + Fadd;
}

// Modern Specular BRDF with Multi-Scattering
vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness, vec3 skyReflectionColor) {
    vec3 halfVec = normalize(viewDir + lightDir);
    
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0.0);
    
    float clampedRoughness = max(roughness, 0.01);
    
    float D = D_GGX(NdotH, clampedRoughness);
    float G = G_Smith(NdotV, NdotL, clampedRoughness);
    
    vec3 F0 = getWaterF0();
    vec3 F = fresnelSchlick(VdotH, F0);
    
    F = getMultiScatteringCompensation(F, F0, clampedRoughness);
    
    vec3 numerator = (D * G) * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    vec3 specularColor = mix(lightColor, skyReflectionColor, 0.7);
    
    return (numerator / denominator) * specularColor * NdotL;
}

// Physically-Based Subsurface Scattering
vec3 getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth, WaterMaterial material) {
    vec3 backLight = -lightDir;
    
    const float g = 0.9;
    float cosTheta = dot(normalize(viewDir), backLight);
    float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);
    phase /= 4.0 * PI;
    
    vec3 scatteringCoeff = vec3(0.0015, 0.003, 0.005);
    vec3 absorptionCoeff = material.absorption;
    
    vec3 transmittance = exp(-absorptionCoeff * depth);
    vec3 singleScatter = scatteringCoeff * phase * transmittance;
    
    float NdotL = max(dot(normal, backLight), 0.0);
    
    float shallowBoost = 1.0 - smoothstep(0.5, 10.0, depth);
    
    vec3 multipleTransmittance = exp(-absorptionCoeff * depth * 0.5);
    vec3 multipleScatter = scatteringCoeff * 0.4 * NdotL * multipleTransmittance;
    multipleScatter *= (1.0 + shallowBoost * 2.5);
    
    vec3 totalScatter = singleScatter + multipleScatter;
    
    vec3 shallowTint = material.shallowWaterColor;
    vec3 deepTint = material.deepWaterColor;
    
    float depthTintFactor = 1.0 - smoothstep(0.5, 15.0, depth);
    vec3 scatterColor = mix(deepTint, shallowTint, depthTintFactor);
    
    vec3 result = totalScatter * scatterColor * 1.5;
    
    return result;
}

// ============================================================================
// WATER ROUGHNESS & REFLECTION DISTORTION
// ============================================================================

float calculateWaterRoughness(vec2 gradient, float waveHeight, WaterMaterial material) {
    float slope = length(gradient);
    float steepnessFactor = smoothstep(0.2, 0.85, slope);
    
    float heightVariation = abs(waveHeight) * 0.6;
    float crestFactor = smoothstep(-0.2, 0.4, waveHeight);
    
    float curvatureProxy = slope * 1.5;
    
    float roughness = mix(material.baseRoughness, material.maxRoughness, 
                         steepnessFactor * 0.6 + 
                         heightVariation * 0.25 + 
                         curvatureProxy * 0.15);
    
    float microRoughness = slope * 0.4;
    roughness += microRoughness * 0.2;
    
    return clamp(roughness, material.baseRoughness, material.maxRoughness * 1.2);
}

vec3 getDistortedReflectionDir(vec3 reflectedDir, vec3 normal, float roughness, vec2 pos, float time) {
    const float distortionScale = 0.3;
    // Use rotated offsets for more stable sampling
    float angle = dot(pos, vec2(0.7071, 0.7071)) * 0.5;
    vec2 offset1 = vec2(cos(angle), sin(angle)) * 0.1;
    vec2 offset2 = vec2(-sin(angle), cos(angle)) * 0.1;
    vec2 distortion = getWaveGradient(pos + offset1, time) * 0.02 +
                      getWaveGradient(pos + offset2, time) * 0.02;
    
    distortion *= roughness * distortionScale;
    
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 tangent = cross(worldUp, normal);
    if (length(tangent) < 0.001) {
        tangent = cross(vec3(1.0, 0.0, 0.0), normal);
    }
    tangent = normalize(tangent);
    vec3 bitangent = normalize(cross(normal, tangent));
    
    vec3 distortedDir = reflectedDir + tangent * distortion.x + bitangent * distortion.y;
    return normalize(distortedDir);
}

// ============================================================================
// WATER DEPTH & COLOR CALCULATION
// ============================================================================

struct WaterDepthInfo {
    float depth;
    float depthFactor;
    vec3 waterColor;
};

// ============================================================================
// UNDERWATER FOG/VOLUMETRIC SCATTERING
// ============================================================================

// Calculate underwater fog/volumetric scattering
// Adds realistic underwater haze that increases with depth
vec3 calculateUnderwaterFog(vec3 color, float depth, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity, WaterMaterial material) {
    // Underwater fog density increases with depth
    float fogDensity = 1.0 - exp(-depth * 0.02);
    
    // Fog color is tinted by water color
    vec3 fogColor = mix(material.shallowWaterColor, material.deepWaterColor, fogDensity);
    fogColor *= 0.3; // Darker underwater
    
    // Add sun rays contribution (god rays effect)
    if (sunDir.y > 0.0) {
        float sunRayFactor = max(dot(-viewDir, sunDir), 0.0);
        sunRayFactor = pow(sunRayFactor, 8.0); // Tight cone
        vec3 sunRays = sunColor * sunIntensity * sunRayFactor * 0.1;
        fogColor += sunRays * (1.0 - exp(-depth * 0.01));
    }
    
    // Blend original color with fog
    float fogFactor = smoothstep(0.0, 1.0, fogDensity);
    return mix(color, fogColor, fogFactor * 0.4); // 40% max fog contribution
}


// ============================================================================
// WATER SHADING PARAMETERS STRUCT
// ============================================================================

struct WaterShadingParams {
    vec3 pos;                    // Surface position
    vec3 normal;                 // Surface normal
    vec3 viewDir;                // View direction
    vec2 gradient;               // Wave gradient
    float time;                  // Time for animation
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration (for reflections)
    TerrainParams floorParams;   // Terrain params (for depth calculation)
    WaterMaterial material;      // Water material properties (art-directable)
};

struct WaterShadingResult {
    vec3 color;                  // Final shaded color
    float dynamicRoughness;      // Computed roughness
    vec3 reflectedDir;           // Reflection direction
};

// ============================================================================
// WATER DEPTH CALCULATION
// ============================================================================

WaterDepthInfo calculateWaterDepthAndColor(vec3 pos, vec3 normal, vec3 viewDir, TerrainParams floorParams, WaterMaterial material) {
    WaterDepthInfo info;
    
    // Currently depth uses a simple height-based calculation; distance fields are
    // used for translucency in calculateRefractedColor().
    float floorHeight = WATER_TERRAIN_HEIGHT(pos.xz, floorParams);
    float heightBasedDepth = max(pos.y - floorHeight, 0.1);
    
    // Use height-based depth as primary (distance field is used for translucency)
    info.depth = heightBasedDepth;
    
    info.depthFactor = 1.0 - exp(-info.depth * 0.05);
    info.waterColor = mix(material.shallowWaterColor, material.deepWaterColor, info.depthFactor);
    
    float viewAngle = 1.0 - max(dot(viewDir, normal), 0.0);
    vec3 angleTint = mix(vec3(1.0), vec3(0.95, 0.97, 1.0), viewAngle * 0.3);
    info.waterColor *= angleTint;
    
    return info;
}

// ============================================================================
// TRANSLUCENCY CALCULATION
// ============================================================================

// Translucency result structure
struct TranslucencyResult {
    vec3 color;           // Final transmitted color
    vec3 transmittance;    // Transmittance factor
    float pathLength;     // Total path length through water
};

// Photorealistic translucency sampling
// Uses distance field queries to raymarch through water and sample floor color
// Uses stochastic sampling to reduce banding artifacts
TranslucencyResult sampleTranslucency(vec3 start, vec3 dir, float maxDist, TerrainParams terrainParams, float time, vec3 absorptionCoeff, vec3 shallowColor, vec3 deepColor) {
    TranslucencyResult result;
    result.color = vec3(0.0);
    result.transmittance = vec3(1.0);
    result.pathLength = 0.0;
    
    if (maxDist <= 0.0) {
        return result;
    }
    
    // Use distance field to raymarch to find surface hit
    // Use scene-defined macro for SDF queries (must be defined before including WaterShading.frag)
    // Scene should define: #define WATER_SHADING_GET_SDF(pos, t, params) <scene_sdf_function>(pos, t, params)
    // Note: This check may trigger linter warnings when checking WaterShading.frag in isolation,
    //       but will work correctly when included after the macro is defined in scene files.
    #ifdef WATER_SHADING_GET_SDF
        #define getSDF(pos, t) WATER_SHADING_GET_SDF(pos, t, terrainParams)
        float surfaceDist;
        DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, surfaceDist);
        #undef getSDF
    #else
        // Fallback: if macro not defined, use a simple height-based approximation
        // This allows the file to compile for linting, but scenes MUST define the macro for correct behavior
        // Scenes should define: #define WATER_SHADING_GET_SDF(pos, t, params) getSceneSDF(pos, t, params)
        // before including WaterShading.frag
        float surfaceDist = maxDist;
    #endif
    
    if (surfaceDist >= maxDist) {
        // No surface hit - just apply absorption for full distance
        result.transmittance = exp(-absorptionCoeff * maxDist);
        float depthFactor = 1.0 - exp(-maxDist * 0.04);
        result.color = mix(shallowColor, deepColor, depthFactor) * result.transmittance;
        result.pathLength = maxDist;
        return result;
    }
    
    // Surface was hit - compute transmittance along path
    result.pathLength = surfaceDist;
    result.transmittance = exp(-absorptionCoeff * surfaceDist);
    
    // Get surface position with slight offset to ensure we're on the surface
    vec3 surfacePos = start + dir * surfaceDist;
    
    // Sample multiple points around the hit for smoother color (reduces banding)
    vec3 floorColorSum = vec3(0.0);
    float sampleWeight = 0.0;
    
    // Use a small sampling radius for anti-aliasing
    const float sampleRadius = 0.3;
    const int numColorSamples = 3;
    
    // Add temporal jitter to reduce temporal banding
    float jitter = hash(surfacePos.xz * 0.1 + time * 0.01) * TAU;
    
    for (int i = 0; i < numColorSamples; i++) {
        float angle = float(i) * TAU / float(numColorSamples) + jitter;
        vec2 offset = vec2(cos(angle), sin(angle)) * sampleRadius * (0.5 + float(i) * 0.3);
        vec2 samplePos = surfacePos.xz + offset;
        
        // Get terrain height for color variation
        float floorHeight = WATER_TERRAIN_HEIGHT(samplePos, terrainParams);
        float depthVariation = (floorHeight - terrainParams.baseHeight) / max(terrainParams.heightVariation, 0.001);
        float depthT = clamp(depthVariation * 0.5 + 0.5, 0.0, 1.0);
        
        // Approximate terrain color (matches TerrainShading logic)
        vec3 sampleColor = vec3(0.2, 0.25, 0.3); // Base ocean floor color
        sampleColor = mix(sampleColor * 0.7, sampleColor * 1.3, depthT);
        
        // Add texture variation with smooth noise
        float textureNoise = smoothNoise(samplePos * 0.5) * 0.1;
        sampleColor += textureNoise;
        
        // Weight samples by distance from center (gaussian-like)
        float dist = length(offset);
        float weight = exp(-dist * dist / (sampleRadius * sampleRadius * 0.5));
        
        floorColorSum += sampleColor * weight;
        sampleWeight += weight;
    }
    
    vec3 floorColor = floorColorSum / max(sampleWeight, 0.001);
    
    // Apply water tinting based on depth with smooth falloff
    float depthTintFactor = 1.0 - exp(-surfaceDist * 0.04);
    vec3 waterTint = mix(shallowColor, deepColor, depthTintFactor);
    
    // Combine floor color with water tint and transmittance
    result.color = floorColor * waterTint * result.transmittance;
    
    // Apply smooth filtering to reduce banding
    result.color = max(result.color, vec3(0.0));
    
    return result;
}

// ============================================================================
// REFRACTION & REFLECTION CALCULATION
// ============================================================================
vec3 calculateRefractedColor(vec3 pos, vec3 normal, vec3 viewDir, WaterDepthInfo depthInfo, float time, TerrainParams floorParams, SkyAtmosphere sky, WaterMaterial material) {
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedDir = refractRay(-viewDir, normal, eta);
    
    // Only compute translucency if ray goes into water (below surface)
    if (dot(refractedDir, normal) >= 0.0) {
        // Ray goes upward - just return water color with basic absorption
        vec3 baseAbsorption = exp(-material.absorption * depthInfo.depth);
        return depthInfo.waterColor * baseAbsorption;
    }
    
    // Ray goes into water - compute photorealistic translucency
    float maxRayDist = min(MAX_WATER_DEPTH, depthInfo.depth * 3.0);
    
    // Use photorealistic translucency sampling
    TranslucencyResult translucency = sampleTranslucency(
        pos, 
        refractedDir, 
        maxRayDist, 
        floorParams, 
        time, 
        material.absorption,
        material.shallowWaterColor,
        material.deepWaterColor
    );
    
    // Base water color (for areas without floor visibility)
    vec3 baseWaterColor = depthInfo.waterColor;
    vec3 baseAbsorption = exp(-material.absorption * depthInfo.depth);
    baseWaterColor *= baseAbsorption;
    
    // Determine translucency factor based on depth and viewing angle
    // Shallow water and steep viewing angles show more translucency
    // Use smooth, continuous functions to avoid banding
    float viewAngle = 1.0 - max(dot(viewDir, normal), 0.0);
    
    // Smooth depth factor with wider transition range
    float depthFactor = 1.0 - smoothstep(1.5, 35.0, depthInfo.depth);
    
    // Combine factors with smooth curve - increased base translucency for more visibility
    float translucencyFactor = depthFactor * (0.45 + viewAngle * 0.85);
    
    // Apply additional smoothing to prevent sharp transitions
    translucencyFactor = smoothstep(0.0, 1.0, translucencyFactor);
    
    // Blend between base water color and translucent floor color
    // Use smooth, non-linear blending to avoid banding
    // Lower start value allows more translucency to show through
    float smoothBlend = smoothstep(0.0, 0.85, translucencyFactor);
    
    // Use power curve for more natural blending - lower exponent increases translucency
    smoothBlend = pow(smoothBlend, 0.6);
    
    // Blend colors smoothly - increase blend strength slightly
    float finalBlend = clamp(smoothBlend * 1.1, 0.0, 1.0);
    vec3 refractedColor = mix(baseWaterColor, translucency.color, finalBlend);
    
    // Add subtle water tinting based on path length
    float pathTintFactor = 1.0 - exp(-translucency.pathLength * 0.03);
    vec3 pathTint = mix(material.shallowWaterColor, material.deepWaterColor, pathTintFactor);
    refractedColor = mix(refractedColor, refractedColor * pathTint, smoothBlend * 0.12);
    
    // Ensure smooth color transitions - clamp to prevent artifacts
    refractedColor = clamp(refractedColor, vec3(0.0), vec3(10.0));
    
    return refractedColor;
}

// Calculate reflected color
// If dynamicRoughness < 0, it will be computed from gradient and waveHeight
// Adaptive quality: reduces samples for distant/less important reflections
vec3 calculateReflectedColor(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky, float dynamicRoughness, WaterMaterial material) {
    if (dynamicRoughness < 0.0) {
        // Compute roughness if not provided
        float waveHeight = getWaveHeight(pos.xz, time);
        dynamicRoughness = calculateWaterRoughness(gradient, waveHeight, material);
    }
    
    // Calculate reflection direction once and reuse
    vec3 reflectedDir = reflect(-viewDir, normal);
    vec3 distortedReflectedDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz, time);
    
    float reflectionElevation = distortedReflectedDir.y;
    if (reflectionElevation < 0.0) {
        float horizonBlend = smoothstep(-0.1, 0.0, reflectionElevation);
        distortedReflectedDir = normalize(mix(
            vec3(distortedReflectedDir.x, 0.01, distortedReflectedDir.z),
            distortedReflectedDir,
            horizonBlend
        ));
    }
    
    vec3 reflectedColor = skyColor(distortedReflectedDir, sky, time);
    
    float roughnessFactor = smoothstep(material.baseRoughness, material.maxRoughness, dynamicRoughness);
    
    // Adaptive quality: reduce samples based on roughness and view angle
    // High roughness and steep viewing angles get more samples
    float viewAngle = 1.0 - abs(dot(viewDir, normal));
    float qualityFactor = roughnessFactor * (0.5 + viewAngle * 0.5);
    
    // Determine sample count adaptively (1-3 samples)
    int numSamples = 1;
    if (dynamicRoughness > material.baseRoughness * 1.5 && qualityFactor > 0.3) {
        numSamples = qualityFactor > 0.7 ? 3 : 2;
    }
    
    if (numSamples > 1) {
        vec3 sampleSum = reflectedColor;
        float sampleWeight = 1.0;
        
        const float goldenAngle = 2.399963229728653;
        // Add temporal jitter to reduce aliasing - use stable hash based on position
        float jitter = fract(dot(pos.xz, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * 0.1;
        
        for (int i = 1; i < numSamples; i++) {
            float angle = float(i) * goldenAngle + jitter;
            float radius = dynamicRoughness * 0.08 * sqrt(float(i) / float(numSamples));
            
            vec2 offset = vec2(cos(angle), sin(angle)) * radius;
            vec3 sampleDir = getDistortedReflectionDir(reflectedDir, normal, dynamicRoughness, pos.xz + offset, time);
            
            if (sampleDir.y > 0.0) {
                vec3 sampleColor = skyColor(sampleDir, sky, time);
                float weight = 1.0 / (1.0 + float(i) * 0.3);
                sampleSum += sampleColor * weight;
                sampleWeight += weight;
            }
        }
        
        reflectedColor = sampleSum / sampleWeight;
    }
    
    return reflectedColor;
}

// ============================================================================
// FOAM CALCULATION
// ============================================================================

// Calculate foam intensity based on wave characteristics
// Foam appears on wave crests where water is turbulent
float calculateFoamIntensity(vec2 pos, vec2 gradient, float waveHeight, float time, WaterMaterial material) {
    // Foam appears where:
    // 1. Wave height is high (crests)
    // 2. Gradient is steep (turbulent areas)
    // 3. Wave curvature is high (breaking waves)
    
    float slope = length(gradient);
    float crestFactor = smoothstep(material.foamThreshold - 0.1, material.foamThreshold + 0.3, waveHeight);
    float steepnessFactor = smoothstep(0.3, 0.8, slope);
    
    // Sample nearby points to detect wave curvature/breaking
    const float sampleRadius = 0.15;
    float angle = dot(pos, vec2(0.7071, 0.7071)) * 0.5;
    vec2 offset1 = vec2(cos(angle), sin(angle)) * sampleRadius;
    vec2 offset2 = vec2(-sin(angle), cos(angle)) * sampleRadius;
    
    float h1 = getWaveHeight(pos + offset1, time);
    float h2 = getWaveHeight(pos + offset2, time);
    float hCenter = waveHeight;
    
    // Curvature approximation (second derivative)
    float curvature = abs((h1 + h2) * 0.5 - hCenter) / (sampleRadius * sampleRadius);
    float curvatureFactor = smoothstep(0.5, 2.0, curvature);
    
    // Combine factors
    float foam = crestFactor * (0.6 + steepnessFactor * 0.4) * (0.7 + curvatureFactor * 0.3);
    foam = pow(foam, 0.8); // Smooth falloff
    foam = smoothstep(0.1, 0.9, foam);
    
    return foam * material.foamIntensity;
}

// Calculate water spray effect (particles/droplets above water surface)
// Creates visual spray effect at wave crests and turbulent areas
vec3 calculateWaterSpray(vec2 pos, vec2 gradient, float waveHeight, float time, WaterMaterial material) {
    float slope = length(gradient);
    
    // Spray appears at wave crests with high gradient
    float sprayFactor = smoothstep(0.4, 1.0, slope);
    float crestFactor = smoothstep(material.foamThreshold, material.foamThreshold + 0.4, waveHeight);
    
    sprayFactor *= crestFactor;
    
    // Add temporal variation for dynamic spray
    float timeVariation = sin(dot(pos, vec2(0.5, 0.866)) * 3.0 + time * 4.0) * 0.5 + 0.5;
    sprayFactor *= timeVariation;
    
    // Spray color (white/transparent)
    vec3 sprayColor = vec3(0.98, 0.99, 1.0);
    
    // Spray intensity decreases with height above water
    // (spray particles fall back down)
    float heightFactor = 1.0 - smoothstep(0.0, 0.5, waveHeight);
    sprayFactor *= heightFactor;
    
    return sprayColor * sprayFactor * 0.15; // Subtle spray effect
}

// ============================================================================
// SUN GLINTS CALCULATION
// ============================================================================

// Calculate sun glints (specular highlights from sun reflection)
// Based on microfacet theory - glints appear when view direction aligns with reflected sun
vec3 calculateSunGlints(vec3 normal, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity, float roughness, float time, vec2 pos) {
    if (sunDir.y <= 0.0) {
        return vec3(0.0); // Sun below horizon
    }
    
    // Calculate reflected sun direction
    vec3 reflectedSun = reflect(-sunDir, normal);
    float viewSunAlignment = dot(normalize(viewDir), normalize(reflectedSun));
    
    // Glints appear when view aligns with reflected sun
    // Use tighter distribution for smoother water, wider for rough water
    float glintPower = mix(128.0, 32.0, roughness);
    float glintIntensity = pow(max(viewSunAlignment, 0.0), glintPower);
    
    // Add wave-based variation for more realistic glints
    // Sample wave height at multiple points for glint variation
    float waveVariation = 0.0;
    const int numGlintSamples = 2;
    float jitter = hash(pos * 0.1 + time * 0.01) * TAU;
    
    for (int i = 0; i < numGlintSamples; i++) {
        float angle = float(i) * TAU / float(numGlintSamples) + jitter;
        vec2 offset = vec2(cos(angle), sin(angle)) * 0.05;
        float h = getWaveHeight(pos + offset, time);
        waveVariation += abs(h) * 0.1;
    }
    waveVariation /= float(numGlintSamples);
    
    // Modulate glint intensity with wave variation
    glintIntensity *= (1.0 + waveVariation);
    
    // Color and intensity
    vec3 glintColor = sunColor * sunIntensity * glintIntensity * 2.0;
    
    // Fade out glints at grazing angles (Fresnel-like)
    float fresnelFactor = 1.0 - abs(dot(viewDir, normal));
    glintColor *= smoothstep(0.3, 1.0, fresnelFactor);
    
    return glintColor;
}

// ============================================================================
// WATER LIGHTING CALCULATION
// ============================================================================

struct WaterLightingResult {
    vec3 color;
    float dynamicRoughness;
    vec3 reflectedDir;
};

WaterLightingResult calculateWaterLighting(vec3 pos, vec3 normal, vec3 viewDir, vec3 refractedColor, vec3 reflectedColor, 
                                          WaterDepthInfo depthInfo, float time, vec2 gradient, SkyAtmosphere sky, LightingInfo light, float dynamicRoughness, WaterMaterial material) {
    WaterLightingResult result;
    
    result.dynamicRoughness = dynamicRoughness;
    
    vec3 F = getFresnel(viewDir, normal);
    result.reflectedDir = reflect(-viewDir, normal);
    
    vec3 kS = F;
    vec3 kT = vec3(1.0) - F;
    vec3 kD = (1.0 - kS) * 0.1;
    
    vec3 baseColor = mix(refractedColor, reflectedColor, F);
    
    vec3 lightDir = light.sunDirection;
    vec3 lightColor = light.sunColor * light.sunIntensity;
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    vec3 ambientDiffuse = vec3(0.0);
    vec3 ambientSpecular = vec3(0.0);
    
    vec3 skyUp = vec3(0.0, 1.0, 0.0);
    vec3 skyUpColor = skyColor(skyUp, sky, time);
    float skyUpWeight = max(dot(normal, skyUp), 0.0);
    
    vec3 hemisphereAvg = skyUpColor * 0.5;
    
    vec3 waterAlbedo = mix(material.shallowWaterColor, material.deepWaterColor, depthInfo.depthFactor * 0.5);
    waterAlbedo *= 0.3;
    ambientDiffuse += hemisphereAvg * kD * waterAlbedo * skyUpWeight;
    
    // Reuse reflectedDir calculated earlier for ambient IBL (avoid duplicate calculation)
    vec3 normalReflectedColor = vec3(0.0);
    
    if (result.reflectedDir.y > 0.0) {
        normalReflectedColor = skyColor(result.reflectedDir, sky, time);
        
        // Adaptive IBL sampling: reduce samples for low roughness or distant surfaces
        // Only use multiple samples when roughness is high enough to warrant it
        if (result.dynamicRoughness > material.baseRoughness * 1.2) {
            // Adaptive sample count based on roughness (1-3 samples)
            float roughnessFactor = smoothstep(material.baseRoughness * 1.2, material.maxRoughness, result.dynamicRoughness);
            int numIBLSamples = roughnessFactor > 0.5 ? 3 : 2;
            
            vec3 sampleSum = normalReflectedColor;
            float sampleWeight = 1.0;
            
            // Add temporal jitter to reduce aliasing
            float jitter = fract(dot(pos.xz, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * TAU;
            
            for (int i = 0; i < numIBLSamples; i++) {
                float angle = float(i) * TAU / float(numIBLSamples) + jitter;
                vec3 offset = vec3(cos(angle), 0.0, sin(angle)) * result.dynamicRoughness * 0.1;
                vec3 sampleDir = normalize(result.reflectedDir + offset);
                if (sampleDir.y > 0.0) {
                    vec3 sampleColor = skyColor(sampleDir, sky, time);
                    sampleSum += sampleColor;
                    sampleWeight += 1.0;
                }
            }
            normalReflectedColor = sampleSum / sampleWeight;
        }
        
        ambientSpecular += normalReflectedColor * F;
    }
    
    // Reuse normalReflectedColor for specular if available, otherwise compute
    vec3 skySpecularColor = (result.reflectedDir.y > 0.0 && length(normalReflectedColor) > 0.001) 
        ? normalReflectedColor 
        : skyColor(result.reflectedDir, sky, time);
    
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, result.dynamicRoughness, skySpecularColor);
    specular *= 1.2;
    
    vec3 diffuse = kD * waterAlbedo * lightColor * NdotL / PI;
    
    vec3 subsurface = getSubsurfaceScattering(normal, viewDir, lightDir, depthInfo.depth, material);
    
    vec3 ambient = ambientDiffuse + ambientSpecular * 0.3;
    
    vec3 waterBase = baseColor + diffuse + subsurface + ambient;
    
    if (light.sunDirection.y > 0.0 && NdotL > 0.0) {
        vec3 toSun = normalize(light.sunDirection);
        float cosTheta = dot(viewDir, toSun);
        float phase = (1.0 - 0.9 * 0.9) / pow(1.0 + 0.9 * 0.9 - 2.0 * 0.9 * cosTheta, 1.5);
        phase /= 4.0 * PI;
        
        float volumetricFactor = phase * NdotL * (1.0 - exp(-depthInfo.depth * 0.02));
        vec3 volumetricLight = light.sunColor * light.sunIntensity * volumetricFactor * 0.05;
        
        volumetricLight *= mix(vec3(1.0), material.shallowWaterColor, 1.0 - depthInfo.depthFactor);
        waterBase += volumetricLight;
    }
    
    // Add sun glints (specular highlights)
    vec3 sunGlints = calculateSunGlints(normal, viewDir, lightDir, lightColor, light.sunIntensity, result.dynamicRoughness, time, pos.xz);
    
    // Calculate and add foam
    float waveHeight = getWaveHeight(pos.xz, time);
    float foamIntensity = calculateFoamIntensity(pos.xz, gradient, waveHeight, time, material);
    vec3 foam = material.foamColor * foamIntensity;
    
    // Foam reduces water transparency
    float foamFactor = clamp(foamIntensity, 0.0, 1.0);
    waterBase = mix(waterBase, foam, foamFactor);
    
    // Add water spray effect (particles above surface)
    vec3 spray = calculateWaterSpray(pos.xz, gradient, waveHeight, time, material);
    
    vec3 finalColor = waterBase + specular + sunGlints + spray;
    
    // Apply underwater fog/volumetric scattering for realistic depth perception
    // Only apply if we're looking into water (view direction goes into water)
    if (dot(viewDir, normal) < 0.0) {
        finalColor = calculateUnderwaterFog(finalColor, depthInfo.depth, viewDir, lightDir, lightColor, light.sunIntensity, material);
    }
    
    result.color = finalColor;
    return result;
}

// ============================================================================
// MAIN WATER SHADING FUNCTION
// ============================================================================

WaterShadingResult shadeWater(WaterShadingParams params) {
    WaterShadingResult result;
    
    // Calculate water depth and base color
    WaterDepthInfo depthInfo = calculateWaterDepthAndColor(params.pos, params.normal, params.viewDir, params.floorParams, params.material);
    
    // Compute roughness once (used by both reflection and lighting)
    // Cache wave height calculation (used multiple times)
    float waveHeight = getWaveHeight(params.pos.xz, params.time);
    float dynamicRoughness = calculateWaterRoughness(params.gradient, waveHeight, params.material);
    
    // Calculate refracted color
    vec3 refractedColor = calculateRefractedColor(params.pos, params.normal, params.viewDir, depthInfo, params.time, params.floorParams, params.sky, params.material);
    
    // Calculate reflected color (pass precomputed roughness)
    vec3 reflectedColor = calculateReflectedColor(params.pos, params.normal, params.viewDir, params.time, params.gradient, params.sky, dynamicRoughness, params.material);
    
    // Calculate final lighting (pass precomputed roughness)
    // Note: calculateWaterLighting now handles foam and sun glints internally
    WaterLightingResult lighting = calculateWaterLighting(params.pos, params.normal, params.viewDir, refractedColor, reflectedColor, 
                                                          depthInfo, params.time, params.gradient, params.sky, params.light, dynamicRoughness, params.material);
    
    result.color = lighting.color;
    result.dynamicRoughness = lighting.dynamicRoughness;
    result.reflectedDir = lighting.reflectedDir;
    
    return result;
}

#endif // WATER_SHADING_FRAG

