// ============================================================================
// OBJECT SHADING SYSTEM
// ============================================================================
// Object material properties and shading functions
// PBR shading for objects in the scene
// ============================================================================

#ifndef OBJECT_SHADING_FRAG
#define OBJECT_SHADING_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"

// ============================================================================
// OBJECT SHADING PARAMETERS STRUCT
// ============================================================================

struct ObjectShadingParams {
    vec3 pos;                    // Object position
    vec3 normal;                 // Object normal
    vec3 viewDir;                // View direction
    float time;                  // Time for animation
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration
    ObjectMaterial material;     // Object material properties (art-directable)
    // Optional water interaction parameters
    vec3 waterSurfacePos;        // Water surface position (for wet/underwater effects)
    vec3 waterNormal;            // Water surface normal
    float waterDepth;            // Depth below water surface (0.0 = at surface, >0 = underwater)
    bool isWet;                  // Whether surface is wet (near water line)
    WaterMaterial waterMaterial; // Water material (for underwater effects)
};

// ============================================================================
// OBJECT SHADING
// ============================================================================

// ============================================================================
// OBJECT WATER INTERACTION EFFECTS
// ============================================================================

// Calculate water contact line intensity (where water meets object)
float calculateWaterContactLine(vec3 pos, vec3 normal, vec3 waterSurfacePos, vec3 waterNormal, float time) {
    // Distance to water surface
    float distToWater = length(pos - waterSurfacePos);
    
    // Check if point is near water line (vertical distance matters most)
    float verticalDist = abs(pos.y - waterSurfacePos.y);
    float horizontalDist = length((pos - waterSurfacePos).xz);
    
    // Contact line is strongest where vertical distance is small
    float contactFactor = 1.0 - smoothstep(0.0, 0.3, verticalDist);
    
    // Add wave-based variation for dynamic contact line
    float waveVariation = sin(dot(pos.xz, vec2(1.0, 0.5)) * 2.0 + time * 2.0) * 0.1 + 0.9;
    contactFactor *= waveVariation;
    
    // Fade out with horizontal distance (water spreads outward)
    contactFactor *= 1.0 - smoothstep(0.0, 1.5, horizontalDist);
    
    return contactFactor;
}

// Apply enhanced wet surface effect with realistic water interaction
vec3 applyObjectWetEffect(vec3 baseColor, vec3 pos, vec3 normal, vec3 waterSurfacePos, vec3 waterNormal, float time, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity) {
    float distToWater = length(pos - waterSurfacePos);
    float verticalDist = abs(pos.y - waterSurfacePos.y);
    
    // Wetness factor: stronger near water line, especially below it
    float wetnessFactor = 1.0 - smoothstep(0.0, 1.5, verticalDist);
    
    // Water contact line effect (foam/white line where water meets object)
    float contactLine = calculateWaterContactLine(pos, normal, waterSurfacePos, waterNormal, time);
    vec3 contactLineColor = vec3(0.95, 0.98, 1.0) * contactLine * 0.4;
    
    // Enhanced wet surface appearance
    // Wet surfaces are darker and more reflective
    vec3 wetColor = baseColor * 0.65; // Darker when wet
    
    // Add realistic wet reflection (specular highlight)
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, sunDir), 0.0);
    
    // Wet surfaces have stronger specular reflection
    if (sunDir.y > 0.0 && NdotL > 0.0) {
        vec3 halfDir = normalize(viewDir + sunDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float wetSpecular = pow(NdotH, 64.0) * wetnessFactor * 0.5;
        wetColor += sunColor * sunIntensity * wetSpecular;
    }
    
    // Add water droplet effect (small highlights)
    float dropletNoise = smoothNoise(pos.xz * 5.0 + time * 0.1);
    float dropletFactor = smoothstep(0.6, 0.9, dropletNoise) * wetnessFactor * 0.2;
    wetColor += vec3(dropletFactor);
    
    // Blend between dry and wet color
    vec3 finalColor = mix(baseColor, wetColor, wetnessFactor * 0.7);
    
    // Add contact line
    finalColor += contactLineColor;
    
    return finalColor;
}

// Apply enhanced underwater visual effects to objects
vec3 applyObjectUnderwaterEffect(vec3 baseColor, float waterDepth, vec3 viewDir, vec3 sunDir, vec3 sunColor, float sunIntensity, WaterMaterial waterMaterial) {
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
    
    // Add caustics-like light patterns (simplified - full caustics handled by terrain)
    if (sunDir.y > 0.0) {
        float causticPattern = sin(dot(viewDir.xz, vec2(1.0, 0.5)) * 5.0) * 0.5 + 0.5;
        float causticIntensity = pow(causticPattern, 2.0) * (1.0 - exp(-waterDepth * 0.1));
        vec3 causticLight = sunColor * sunIntensity * causticIntensity * 0.1;
        baseColor += causticLight * (1.0 - fogDensity * 0.5);
    }
    
    return baseColor;
}

// ============================================================================
// OBJECT SHADING
// ============================================================================

// Shade object with PBR lighting
vec3 shadeObject(ObjectShadingParams params) {
    // Get lighting
    vec3 lightDir = params.light.sunDirection;
    vec3 lightColor = params.light.sunColor * params.light.sunIntensity;
    
    // Ambient
    vec3 ambient = params.material.baseColor * 0.2;
    
    // Diffuse (Lambertian) - only if sun is above horizon
    vec3 diffuse = vec3(0.0);
    if (params.light.sunDirection.y > 0.0) {
        float NdotL = max(dot(params.normal, lightDir), 0.0);
        diffuse = params.material.baseColor * lightColor * NdotL;
    }
    
    // Specular (Blinn-Phong)
    vec3 specularColor = vec3(0.0);
    if (params.light.sunDirection.y > 0.0) {
        vec3 halfDir = normalize(lightDir + params.viewDir);
        float NdotH = max(dot(params.normal, halfDir), 0.0);
        float specularPower = mix(32.0, 256.0, 1.0 - params.material.roughness);
        float specular = pow(NdotH, specularPower) * params.material.specularIntensity;
        specularColor = lightColor * specular;
    }
    
    // Fresnel (simple approximation)
    float fresnel = pow(1.0 - max(dot(params.normal, params.viewDir), 0.0), 2.0);
    vec3 fresnelColor = mix(vec3(0.0), lightColor * 0.3, fresnel);
    
    // Combine
    vec3 color = ambient + diffuse + specularColor + fresnelColor;
    
    // Apply water interaction effects if applicable
    if (params.isWet) {
        color = applyObjectWetEffect(color, params.pos, params.normal, params.waterSurfacePos, 
                                     params.waterNormal, params.time, params.viewDir, 
                                     lightDir, lightColor, params.light.sunIntensity);
    }
    
    if (params.waterDepth > 0.0) {
        color = applyObjectUnderwaterEffect(color, params.waterDepth, params.viewDir, 
                                           lightDir, lightColor, params.light.sunIntensity, 
                                           params.waterMaterial);
    }
    
    return color;
}

#endif // OBJECT_SHADING_FRAG

