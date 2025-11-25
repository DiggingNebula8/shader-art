// ============================================================================
// MATERIAL SYSTEM
// ============================================================================
// Central material system for creating and managing material instances
// ============================================================================
// Materials define properties that configure shader behavior. Each material
// type can be instantiated with different presets or custom properties.
// ============================================================================
//
// Architecture:
//   MaterialSystem (THIS FILE)
//     ├─ WaterMaterial - Used for water/liquid surface rendering
//     ├─ TerrainMaterial - Used for terrain/floor rendering
//     └─ [Future materials can be added here]
//
// Usage:
//   WaterMaterial mat = createDefaultWaterMaterial();
//   // Use mat in WaterShading system
// ============================================================================

#ifndef MATERIAL_SYSTEM_FRAG
#define MATERIAL_SYSTEM_FRAG

#include "Common.frag"

// ============================================================================
// WATER MATERIAL
// ============================================================================
// Material type for ocean/water surfaces
// Used by: WaterShading system
// ============================================================================
//
// PERFORMANCE NOTE:
//   Material preset functions (createDefaultWaterMaterial(), etc.) are called
//   per-fragment and reconstruct the struct each time. If profiling reveals
//   this as a hot path, consider optimizing by:
//     - Promoting commonly used presets to global const structs
//     - Driving materials via uniforms (constructed once on CPU/host side)
//   This is a future optimization knob - not urgent unless profiling shows impact.
// ============================================================================

struct WaterMaterial {
    vec3 absorption;          // Water absorption coefficients (m^-1) - RGB channels
    vec3 deepWaterColor;     // Color for deep water (darker blue)
    vec3 shallowWaterColor;  // Color for shallow water (bright turquoise)
    float baseRoughness;     // Base roughness for calm water (very smooth)
    float maxRoughness;      // Maximum roughness for choppy water
    vec3 foamColor;          // Foam color (typically white/off-white)
    float foamIntensity;     // Foam intensity multiplier
    float foamThreshold;     // Wave height threshold for foam generation
};

// Create default water material instance (realistic ocean water)
WaterMaterial createDefaultWaterMaterial() {
    WaterMaterial mat;
    mat.absorption = vec3(0.15, 0.045, 0.015);  // Realistic absorption (red absorbed most)
    mat.deepWaterColor = vec3(0.0, 0.2, 0.4);    // Darker blue for deep water
    mat.shallowWaterColor = vec3(0.0, 0.5, 0.75); // Bright turquoise for shallow water
    mat.baseRoughness = 0.03;                     // Very smooth calm water
    mat.maxRoughness = 0.12;                      // Choppy water maximum
    mat.foamColor = vec3(0.95, 0.98, 1.0);        // Off-white foam
    mat.foamIntensity = 0.6;                      // Default foam intensity
    mat.foamThreshold = 0.1;                      // Wave height threshold for foam
    return mat;
}

// Create clear tropical water material instance
WaterMaterial createClearTropicalWater() {
    WaterMaterial mat = createDefaultWaterMaterial();
    mat.absorption = vec3(0.05, 0.02, 0.01);      // Less absorption (clearer water)
    mat.deepWaterColor = vec3(0.0, 0.3, 0.5);    // Brighter deep water
    mat.shallowWaterColor = vec3(0.0, 0.6, 0.8); // More cyan shallow water
    mat.foamIntensity = 0.2;                      // Less foam for calm tropical water
    return mat;
}

// Create murky/muddy water material instance
WaterMaterial createMurkyWater() {
    WaterMaterial mat = createDefaultWaterMaterial();
    mat.absorption = vec3(0.3, 0.2, 0.15);       // High absorption (murky)
    mat.deepWaterColor = vec3(0.1, 0.15, 0.2);  // Darker, brownish
    mat.shallowWaterColor = vec3(0.2, 0.25, 0.3); // Brownish shallow water
    return mat;
}

// Create rough/choppy water material instance
WaterMaterial createChoppyWater() {
    WaterMaterial mat = createDefaultWaterMaterial();
    mat.baseRoughness = 0.05;                    // Higher base roughness
    mat.maxRoughness = 0.2;                       // Higher max roughness
    mat.foamIntensity = 1.5;                      // More foam for choppy water
    mat.foamThreshold = 0.1;                     // Lower threshold for more foam
    return mat;
}

// ============================================================================
// TERRAIN MATERIAL
// ============================================================================
// Material type for terrain/floor surfaces
// Used by: TerrainShading system
// ============================================================================
//
// PERFORMANCE NOTE:
//   See WATER MATERIAL section above for performance optimization considerations.
//   Same applies to terrain material presets.
// ============================================================================

struct TerrainMaterial {
    vec3 baseColor;          // Base terrain color
    vec3 deepColor;          // Color for deeper areas
    float roughness;         // Surface roughness (0.0 = smooth, 1.0 = rough)
    float specularPower;     // Specular highlight power
    float ambientFactor;     // Ambient lighting factor
    float specularIntensity; // Specular highlight intensity
};

// Create default terrain material instance
TerrainMaterial createDefaultTerrainMaterial() {
    TerrainMaterial mat;
    mat.baseColor = vec3(0.3, 0.25, 0.2);  // Brownish terrain color
    mat.deepColor = vec3(0.2, 0.18, 0.15); // Darker for deep areas
    mat.roughness = 0.8;                    // Relatively rough surface
    mat.specularPower = 32.0;               // Phong specular power
    mat.ambientFactor = 0.1;                // Base ambient lighting
    mat.specularIntensity = 0.2;             // Specular highlight intensity
    return mat;
}

// Create sandy terrain material instance
TerrainMaterial createSandyTerrainMaterial() {
    TerrainMaterial mat = createDefaultTerrainMaterial();
    mat.baseColor = vec3(0.76, 0.70, 0.50);  // Sandy beige color
    mat.deepColor = vec3(0.65, 0.60, 0.45);  // Darker sand
    mat.roughness = 0.6;                      // Less rough than default
    return mat;
}

// Create rocky terrain material instance
TerrainMaterial createRockyTerrainMaterial() {
    TerrainMaterial mat = createDefaultTerrainMaterial();
    mat.baseColor = vec3(0.4, 0.4, 0.4);     // Grayish rock color
    mat.deepColor = vec3(0.25, 0.25, 0.25);  // Darker rock
    mat.roughness = 0.9;                     // Very rough surface
    mat.specularIntensity = 0.1;             // Less specular (dull rock)
    return mat;
}

// ============================================================================
// OBJECT MATERIAL
// ============================================================================
// Material type for objects/subjects in the scene
// Used by: ObjectSystem shading
// ============================================================================

struct ObjectMaterial {
    vec3 baseColor;          // Base object color
    float roughness;         // Surface roughness (0.0 = smooth, 1.0 = rough)
    float metallic;          // Metallic factor (0.0 = dielectric, 1.0 = metal)
    float specularIntensity; // Specular highlight intensity
};

// Create default object material (neutral gray)
ObjectMaterial createDefaultObjectMaterial() {
    ObjectMaterial mat;
    mat.baseColor = vec3(0.5, 0.5, 0.5);  // Neutral gray color
    mat.roughness = 0.3;                   // Moderately smooth
    mat.metallic = 0.0;                    // Non-metallic
    mat.specularIntensity = 0.5;           // Moderate specular
    return mat;
}

// Create white object material
ObjectMaterial createWhiteObjectMaterial() {
    ObjectMaterial mat = createDefaultObjectMaterial();
    mat.baseColor = vec3(0.9, 0.9, 0.9);  // White color
    return mat;
}

// ============================================================================
// FUTURE MATERIAL TYPES
// ============================================================================
// Additional material types can be added here:
//   - SkyMaterial (for sky rendering)
//   - CloudMaterial (for volumetric clouds)
//   - etc.
// ============================================================================

#endif // MATERIAL_SYSTEM_FRAG
