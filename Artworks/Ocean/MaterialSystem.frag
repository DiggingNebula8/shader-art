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
//     ├─ WaterMaterial - Used for Ocean rendering
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

struct WaterMaterial {
    vec3 absorption;          // Water absorption coefficients (m^-1) - RGB channels
    vec3 deepWaterColor;     // Color for deep water (darker blue)
    vec3 shallowWaterColor;  // Color for shallow water (bright turquoise)
    float baseRoughness;     // Base roughness for calm water (very smooth)
    float maxRoughness;      // Maximum roughness for choppy water
};

// Create default water material instance (realistic ocean water)
WaterMaterial createDefaultWaterMaterial() {
    WaterMaterial mat;
    mat.absorption = vec3(0.15, 0.045, 0.015);  // Realistic absorption (red absorbed most)
    mat.deepWaterColor = vec3(0.0, 0.2, 0.4);    // Darker blue for deep water
    mat.shallowWaterColor = vec3(0.0, 0.5, 0.75); // Bright turquoise for shallow water
    mat.baseRoughness = 0.03;                     // Very smooth calm water
    mat.maxRoughness = 0.12;                      // Choppy water maximum
    return mat;
}

// Create clear tropical water material instance
WaterMaterial createClearTropicalWater() {
    WaterMaterial mat = createDefaultWaterMaterial();
    mat.absorption = vec3(0.05, 0.02, 0.01);      // Less absorption (clearer water)
    mat.deepWaterColor = vec3(0.0, 0.3, 0.5);    // Brighter deep water
    mat.shallowWaterColor = vec3(0.0, 0.6, 0.8); // More cyan shallow water
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
    mat.maxRoughness = 0.2;                      // Higher max roughness
    return mat;
}

// ============================================================================
// TERRAIN MATERIAL
// ============================================================================
// Material type for terrain/floor surfaces
// Used by: TerrainShading system
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
// FUTURE MATERIAL TYPES
// ============================================================================
// Additional material types can be added here:
//   - SkyMaterial (for sky rendering)
//   - CloudMaterial (for volumetric clouds)
//   - etc.
// ============================================================================

#endif // MATERIAL_SYSTEM_FRAG
