// ============================================================================
// TERRAIN SHADING SYSTEM
// ============================================================================
// Terrain material properties and shading functions
// Includes caustics calculation for underwater terrain
// ============================================================================
// This system shades terrain surfaces, especially ocean floor with caustics
// ============================================================================

#ifndef TERRAIN_SHADING_FRAG
#define TERRAIN_SHADING_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"
#include "TerrainSystem.frag"
#include "WaveSystem.frag"

// ============================================================================
// TERRAIN SHADING PARAMETERS STRUCT
// ============================================================================

struct TerrainShadingParams {
    vec3 pos;                    // Terrain position
    vec3 normal;                 // Terrain normal
    vec3 viewDir;                // View direction
    float time;                  // Time for animation
    TerrainParams terrainParams; // Terrain configuration
    LightingInfo light;           // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration
    vec3 waterSurfacePos;        // Water surface position (for caustics)
    vec3 waterNormal;            // Water surface normal (for caustics)
    TerrainMaterial material;    // Terrain material properties (art-directable)
    // Optional water interaction parameters
    float waterDepth;            // Depth below water surface (0.0 = at surface, >0 = underwater)
    bool isWet;                  // Whether surface is wet (near water line)
    WaterMaterial waterMaterial; // Water material (for underwater effects)
};

// ============================================================================
// CAUSTICS CALCULATION
// ============================================================================

// Realistic Caustics Calculation
// Note: floorParams parameter reserved for future use (e.g., material-based caustics modulation)
vec3 calculateCaustics(vec3 floorPos, vec3 waterSurfacePos, vec3 waterNormal, vec3 sunDir, float time, TerrainParams floorParams) {
    float eta = AIR_IOR / WATER_IOR;
    vec3 refractedSunDir = refractRay(-sunDir, waterNormal, eta);
    
    if (dot(refractedSunDir, -waterNormal) < 0.0) {
        return vec3(0.0);
    }
    
    vec2 surfacePos = waterSurfacePos.xz;
    float depth = max(waterSurfacePos.y - floorPos.y, 0.1);
    
    // Adaptive sampling: more samples for shallow water (where caustics are more visible)
    // and fewer samples for deep water (where caustics fade out)
    float depthFactor = 1.0 - smoothstep(5.0, 30.0, depth);
    int numSamples = depthFactor > 0.7 ? 7 : (depthFactor > 0.3 ? 5 : 3);
    
    float causticsIntensity = 0.0;
    
    float sampleRadius = depth * 0.15;
    
    // Add temporal jitter to reduce aliasing - use stable hash based on position
    float jitter = fract(dot(surfacePos, vec2(0.7548776662466928, 0.5698402909980532)) + time * 0.001) * TAU;
    
    // Use golden angle spiral for better sample distribution
    const float goldenAngle = 2.399963229728653;
    
    for (int i = 0; i < numSamples; i++) {
        // Use golden angle for better coverage
        float angle = float(i) * goldenAngle + jitter;
        float radius = sampleRadius * sqrt(float(i) / float(numSamples));
        vec2 sampleOffset = vec2(cos(angle), sin(angle)) * radius;
        vec2 samplePos = surfacePos + sampleOffset;
        
        vec2 grad = getWaveGradient(samplePos, time);
        float slope = length(grad);
        float focus = smoothstep(0.2, 0.6, slope);
        
        float waveHeight = getWaveHeight(samplePos, time);
        float crestFactor = smoothstep(-0.1, 0.2, waveHeight);
        
        float sampleIntensity = focus * (0.7 + crestFactor * 0.3);
        
        float dist = length(sampleOffset);
        float gaussian = exp(-dist * dist / (sampleRadius * sampleRadius * 0.5));
        
        // Weight samples by distance (center samples more important)
        float weight = 1.0 / (1.0 + float(i) * 0.2);
        causticsIntensity += sampleIntensity * gaussian * weight;
    }
    
    // Normalize by effective sample weight
    float totalWeight = 0.0;
    for (int i = 0; i < numSamples; i++) {
        totalWeight += 1.0 / (1.0 + float(i) * 0.2);
    }
    causticsIntensity /= max(totalWeight, 1.0);
    
    // Optimized: reuse wave height calculation for large scale pattern
    float largeScalePattern = abs(getWaveHeight(surfacePos, time)) * 0.15;
    causticsIntensity += largeScalePattern * 0.3;
    
    float depthFalloff = exp(-depth * 0.05);
    float diffusionFactor = 1.0 - exp(-depth * 0.02);
    causticsIntensity *= depthFalloff;
    
    causticsIntensity = pow(causticsIntensity, 0.5);
    causticsIntensity = smoothstep(0.1, 0.8, causticsIntensity);
    
    causticsIntensity = mix(causticsIntensity, causticsIntensity * 0.7, diffusionFactor);
    
    float angleFalloff = max(dot(refractedSunDir, vec3(0.0, -1.0, 0.0)), 0.4);
    causticsIntensity *= angleFalloff;
    
    vec3 causticsColor = vec3(0.98, 0.99, 1.0);
    
    float depthColorShift = 1.0 - exp(-depth * 0.03);
    causticsColor = mix(causticsColor, vec3(0.92, 0.95, 1.0), depthColorShift * 0.3);
    
    return causticsColor * causticsIntensity * 0.8;
}

// ============================================================================
// TERRAIN WATER INTERACTION EFFECTS
// ============================================================================

// Calculate water contact line for terrain (beach/water edge)
float calculateTerrainWaterContactLine(vec3 pos, vec3 waterSurfacePos, float time) {
    float verticalDist = abs(pos.y - waterSurfacePos.y);
    float horizontalDist = length((pos - waterSurfacePos).xz);
    
    // Contact line is strongest at water level
    float contactFactor = 1.0 - smoothstep(0.0, 0.2, verticalDist);
    
    // Add wave-based foam variation
    float wavePhase = dot(pos.xz, vec2(0.5, 0.866)) * 3.0 + time * 2.0;
    float waveVariation = sin(wavePhase) * 0.15 + 0.85;
    contactFactor *= waveVariation;
    
    // Foam spreads slightly above water line
    float foamSpread = 1.0 - smoothstep(0.0, 0.5, verticalDist);
    contactFactor = max(contactFactor, foamSpread * 0.3);
    
    // Fade with horizontal distance
    contactFactor *= 1.0 - smoothstep(0.0, 2.0, horizontalDist);
    
    return contactFactor;
}

// Apply enhanced wet surface effect to terrain near water line
vec3 applyTerrainWetEffect(vec3 baseColor, vec3 pos, vec3 normal, vec3 waterSurfacePos, vec3 waterNormal, float time, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity) {
    float verticalDist = abs(pos.y - waterSurfacePos.y);
    float horizontalDist = length((pos - waterSurfacePos).xz);
    
    // Wetness factor: stronger near water line
    float wetnessFactor = 1.0 - smoothstep(0.0, 1.5, verticalDist);
    
    // Water contact line (foam/white edge where water meets terrain)
    float contactLine = calculateTerrainWaterContactLine(pos, waterSurfacePos, time);
    vec3 contactLineColor = vec3(0.95, 0.98, 1.0) * contactLine * 0.5;
    
    // Enhanced wet terrain appearance
    vec3 wetColor = baseColor * 0.7; // Darker when wet
    
    // Add realistic wet reflection
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, sunDir), 0.0);
    
    if (sunDir.y > 0.0 && NdotL > 0.0) {
        vec3 halfDir = normalize(viewDir + sunDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float wetSpecular = pow(NdotH, 32.0) * wetnessFactor * 0.4;
        wetColor += sunColor * sunIntensity * wetSpecular;
    }
    
    // Add sand/soil texture variation when wet
    float textureNoise = smoothNoise(pos.xz * 2.0 + time * 0.05);
    float textureVariation = textureNoise * wetnessFactor * 0.1;
    wetColor += vec3(textureVariation);
    
    // Blend between dry and wet color
    vec3 finalColor = mix(baseColor, wetColor, wetnessFactor * 0.7);
    
    // Add contact line (foam)
    finalColor += contactLineColor;
    
    return finalColor;
}

// Apply enhanced underwater visual effects to terrain
vec3 applyTerrainUnderwaterEffect(vec3 baseColor, float waterDepth, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity, WaterMaterial waterMaterial) {
    // Underwater color tinting (water absorbs red wavelengths more)
    vec3 underwaterTint = mix(waterMaterial.shallowWaterColor, waterMaterial.deepWaterColor, 
                              1.0 - exp(-waterDepth * 0.05));
    
    // Apply absorption (more depth = more absorption)
    vec3 absorption = exp(-waterMaterial.absorption * waterDepth);
    baseColor *= absorption;
    
    // Enhanced tinting - stronger color shift underwater
    baseColor = mix(baseColor, baseColor * underwaterTint, 0.5);
    
    // Reduce overall brightness underwater (more realistic falloff)
    float brightnessFactor = 1.0 - exp(-waterDepth * 0.02);
    baseColor *= (1.0 - brightnessFactor * 0.6);
    
    // Enhanced volumetric fog effect with depth variation
    float fogDensity = 1.0 - exp(-waterDepth * 0.03);
    vec3 fogColor = underwaterTint * 0.25;
    
    // Add depth-based fog variation (more fog at depth)
    float depthFogVariation = smoothstep(5.0, 30.0, waterDepth);
    fogDensity *= (0.7 + depthFogVariation * 0.3);
    
    baseColor = mix(baseColor, fogColor, fogDensity * 0.4);
    
    // Add subtle light scattering effect (caustics are handled separately)
    if (sunDir.y > 0.0) {
        float scatterPattern = sin(dot(viewDir.xz, vec2(0.707, 0.707)) * 4.0) * 0.5 + 0.5;
        float scatterIntensity = pow(scatterPattern, 1.5) * (1.0 - exp(-waterDepth * 0.08));
        vec3 scatterLight = sunColor * sunIntensity * scatterIntensity * 0.08;
        baseColor += scatterLight * (1.0 - fogDensity * 0.6);
    }
    
    return baseColor;
}

// ============================================================================
// TERRAIN SHADING
// ============================================================================

// Shade the ocean floor with caustics
vec3 shadeTerrain(TerrainShadingParams params) {
    vec3 sunDir = params.light.sunDirection;
    vec3 sunColor = params.light.sunColor;
    float sunIntensity = params.light.sunIntensity;
    
    float floorHeight = getTerrainHeight(params.pos.xz, params.terrainParams);
    float depthVariation = (floorHeight - params.terrainParams.baseHeight) / max(params.terrainParams.heightVariation, 0.001);
    float depthT = clamp(depthVariation * 0.5 + 0.5, 0.0, 1.0);
    vec3 floorColor = mix(params.material.baseColor * 0.7, params.material.baseColor * 1.3, depthT);
    
    // Blend with deep color based on depth
    floorColor = mix(params.material.deepColor, floorColor, depthT);
    
    float textureNoise = smoothNoise(params.pos.xz * 0.5) * 0.1;
    floorColor += textureNoise;
    
    float NdotL = max(dot(params.normal, sunDir), 0.0);
    
    vec3 ambient = floorColor * params.material.ambientFactor;
    vec3 diffuse = floorColor * sunColor * sunIntensity * NdotL;
    
    vec3 halfVec = normalize(params.viewDir + sunDir);
    float NdotH = max(dot(params.normal, halfVec), 0.0);
    float specularPower = pow(NdotH, params.material.specularPower) * (1.0 - params.material.roughness);
    vec3 specular = sunColor * sunIntensity * specularPower * params.material.specularIntensity;
    
    vec3 caustics = vec3(0.0);
    if (sunDir.y > 0.0 && params.waterSurfacePos.y > params.pos.y) {
        caustics = calculateCaustics(params.pos, params.waterSurfacePos, params.waterNormal, sunDir, params.time, params.terrainParams);
        caustics *= sunIntensity * sunColor;
    }
    
    vec3 color = ambient + diffuse + specular + caustics;
    
    // Apply water interaction effects if applicable
    if (params.isWet) {
        color = applyTerrainWetEffect(color, params.pos, params.normal, params.waterSurfacePos, 
                                     params.waterNormal, params.time, params.viewDir, 
                                     sunDir, sunColor, sunIntensity);
    }
    
    if (params.waterDepth > 0.0) {
        color = applyTerrainUnderwaterEffect(color, params.waterDepth, params.viewDir, 
                                            sunDir, sunColor, sunIntensity, params.waterMaterial);
    }
    
    return color;
}

#endif // TERRAIN_SHADING_FRAG

