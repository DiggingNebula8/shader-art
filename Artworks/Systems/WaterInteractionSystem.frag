// ============================================================================
// WATER INTERACTION SYSTEM
// ============================================================================
// Generic water interaction utilities for surfaces (objects, terrain, etc.)
// Provides common functions for wet surfaces, underwater effects, and contact lines
//
// Architecture:
//   - This is a UTILITY SYSTEM (like Common.frag) - provides functions, not state
//   - Shading systems can use these utilities but customize behavior
//   - No coupling: systems include this but don't depend on each other
//   - Extensible: can add other interaction types (fire, snow, etc.) later
//
// Usage:
//   #include "WaterInteractionSystem.frag"
//   vec3 wetColor = applyWetSurfaceEffect(baseColor, params...);
// ============================================================================

#ifndef WATER_INTERACTION_SYSTEM_FRAG
#define WATER_INTERACTION_SYSTEM_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"

// ============================================================================
// WATER INTERACTION PARAMETERS
// ============================================================================

struct WaterInteractionParams {
    vec3 pos;                    // Surface position
    vec3 normal;                 // Surface normal
    vec3 waterSurfacePos;        // Water surface position
    vec3 waterNormal;            // Water surface normal
    float waterDepth;            // Depth below water (0 = at surface, >0 = underwater)
    float time;                  // Time for animation
    vec3 viewDir;                // View direction
    vec3 sunDir;                 // Sun direction
    vec3 sunColor;               // Sun color
    float sunIntensity;          // Sun intensity
    WaterMaterial waterMaterial; // Water material properties
    // Customization parameters
    float wetDarkness;           // How dark surfaces get when wet (0.6-0.8 typical)
    float wetSpecularPower;      // Specular power for wet reflections (32-128 typical)
    float contactLineIntensity;  // Contact line intensity multiplier
    vec3 contactLineColor;       // Contact line color (typically white/off-white)
};

// ============================================================================
// WATER CONTACT LINE CALCULATION
// ============================================================================

// Calculate water contact line intensity (where water meets surface)
// Returns: 0.0 (no contact) to 1.0 (strong contact line)
float calculateWaterContactLine(vec3 pos, vec3 waterSurfacePos, float time, float contactLineIntensity) {
    float verticalDist = abs(pos.y - waterSurfacePos.y);
    float horizontalDist = length((pos - waterSurfacePos).xz);
    
    // Contact line is strongest at water level
    float contactFactor = 1.0 - smoothstep(0.0, 0.2, verticalDist);
    
    // Add wave-based variation for dynamic contact line
    float wavePhase = dot(pos.xz, vec2(0.5, 0.866)) * 3.0 + time * 2.0;
    float waveVariation = sin(wavePhase) * 0.15 + 0.85;
    contactFactor *= waveVariation;
    
    // Foam spreads slightly above water line
    float foamSpread = 1.0 - smoothstep(0.0, 0.5, verticalDist);
    contactFactor = max(contactFactor, foamSpread * 0.3);
    
    // Fade with horizontal distance
    contactFactor *= 1.0 - smoothstep(0.0, 2.0, horizontalDist);
    
    return contactFactor * contactLineIntensity;
}

// ============================================================================
// WET SURFACE EFFECTS
// ============================================================================

// Apply wet surface effect (darkening, reflections, droplets)
// Customizable via WaterInteractionParams
vec3 applyWetSurfaceEffect(vec3 baseColor, WaterInteractionParams params) {
    float verticalDist = abs(params.pos.y - params.waterSurfacePos.y);
    
    // Wetness factor: stronger near water line
    float wetnessFactor = 1.0 - smoothstep(0.0, 1.5, verticalDist);
    
    // Water contact line effect
    float contactLine = calculateWaterContactLine(params.pos, params.waterSurfacePos, params.time, params.contactLineIntensity);
    vec3 contactLineColor = params.contactLineColor * contactLine;
    
    // Enhanced wet surface appearance
    vec3 wetColor = baseColor * params.wetDarkness;
    
    // Add realistic wet reflection (specular highlight)
    float NdotL = max(dot(params.normal, params.sunDir), 0.0);
    
    if (params.sunDir.y > 0.0 && NdotL > 0.0) {
        vec3 halfDir = normalize(params.viewDir + params.sunDir);
        float NdotH = max(dot(params.normal, halfDir), 0.0);
        float wetSpecular = pow(NdotH, params.wetSpecularPower) * wetnessFactor * 0.5;
        wetColor += params.sunColor * params.sunIntensity * wetSpecular;
    }
    
    // Add water droplet effect (small highlights)
    float dropletNoise = smoothNoise(params.pos.xz * 5.0 + params.time * 0.1);
    float dropletFactor = smoothstep(0.6, 0.9, dropletNoise) * wetnessFactor * 0.2;
    wetColor += vec3(dropletFactor);
    
    // Blend between dry and wet color
    vec3 finalColor = mix(baseColor, wetColor, wetnessFactor * 0.7);
    
    // Add contact line
    finalColor += contactLineColor;
    
    return finalColor;
}

// ============================================================================
// UNDERWATER EFFECTS
// ============================================================================

// Apply underwater visual effects (color tinting, fog, reduced lighting)
// Common implementation used by both objects and terrain
vec3 applyUnderwaterEffect(vec3 baseColor, WaterInteractionParams params) {
    if (params.waterDepth <= 0.0) {
        return baseColor; // Not underwater
    }
    
    // Underwater color tinting (water absorbs red wavelengths more)
    vec3 underwaterTint = mix(params.waterMaterial.shallowWaterColor, 
                              params.waterMaterial.deepWaterColor, 
                              1.0 - exp(-params.waterDepth * 0.05));
    
    // Apply absorption (more depth = more absorption)
    vec3 absorption = exp(-params.waterMaterial.absorption * params.waterDepth);
    baseColor *= absorption;
    
    // Enhanced tinting - stronger color shift underwater
    baseColor = mix(baseColor, baseColor * underwaterTint, 0.5);
    
    // Reduce overall brightness underwater (more realistic falloff)
    float brightnessFactor = 1.0 - exp(-params.waterDepth * 0.02);
    baseColor *= (1.0 - brightnessFactor * 0.6);
    
    // Enhanced volumetric fog effect with depth variation
    float fogDensity = 1.0 - exp(-params.waterDepth * 0.03);
    vec3 fogColor = underwaterTint * 0.25;
    
    // Add depth-based fog variation (more fog at depth)
    float depthFogVariation = smoothstep(5.0, 30.0, params.waterDepth);
    fogDensity *= (0.7 + depthFogVariation * 0.3);
    
    baseColor = mix(baseColor, fogColor, fogDensity * 0.4);
    
    // Add subtle light scattering effect
    if (params.sunDir.y > 0.0) {
        float scatterPattern = sin(dot(params.viewDir.xz, vec2(0.707, 0.707)) * 4.0) * 0.5 + 0.5;
        float scatterIntensity = pow(scatterPattern, 1.5) * (1.0 - exp(-params.waterDepth * 0.08));
        vec3 scatterLight = params.sunColor * params.sunIntensity * scatterIntensity * 0.08;
        baseColor += scatterLight * (1.0 - fogDensity * 0.6);
    }
    
    return baseColor;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

// Create default water interaction parameters
WaterInteractionParams createDefaultWaterInteractionParams() {
    WaterInteractionParams params;
    params.wetDarkness = 0.7;
    params.wetSpecularPower = 64.0;
    params.contactLineIntensity = 0.4;
    params.contactLineColor = vec3(0.95, 0.98, 1.0);
    return params;
}

// Create terrain-specific water interaction parameters
WaterInteractionParams createTerrainWaterInteractionParams() {
    WaterInteractionParams params = createDefaultWaterInteractionParams();
    params.wetDarkness = 0.7;
    params.wetSpecularPower = 32.0; // Less specular for terrain
    params.contactLineIntensity = 0.5; // More foam for terrain
    return params;
}

// Create object-specific water interaction parameters
WaterInteractionParams createObjectWaterInteractionParams() {
    WaterInteractionParams params = createDefaultWaterInteractionParams();
    params.wetDarkness = 0.65;
    params.wetSpecularPower = 64.0; // More specular for objects
    params.contactLineIntensity = 0.4;
    return params;
}

#endif // WATER_INTERACTION_SYSTEM_FRAG

