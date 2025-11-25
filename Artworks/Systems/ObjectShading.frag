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
#include "WaterInteractionSystem.frag"

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
// Uses WaterInteractionSystem for common water interaction effects
// Object-specific customization is handled via WaterInteractionParams

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
    
    // Apply water interaction effects using WaterInteractionSystem
    if (params.isWet || params.waterDepth > 0.0) {
        WaterInteractionParams interactionParams = createObjectWaterInteractionParams();
        interactionParams.pos = params.pos;
        interactionParams.normal = params.normal;
        interactionParams.waterSurfacePos = params.waterSurfacePos;
        interactionParams.waterNormal = params.waterNormal;
        interactionParams.waterDepth = params.waterDepth;
        interactionParams.time = params.time;
        interactionParams.viewDir = params.viewDir;
        interactionParams.sunDir = lightDir;
        interactionParams.sunColor = lightColor;
        interactionParams.sunIntensity = params.light.sunIntensity;
        interactionParams.waterMaterial = params.waterMaterial;
        
        if (params.isWet) {
            color = applyWetSurfaceEffect(color, interactionParams);
        }
        
        if (params.waterDepth > 0.0) {
            color = applyUnderwaterEffect(color, interactionParams);
        }
    }
    
    return color;
}

#endif // OBJECT_SHADING_FRAG

