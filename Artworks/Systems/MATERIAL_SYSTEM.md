# Material System API Documentation

## Overview

The Material System provides a centralized registry for creating and managing material instances that configure shader behavior. Materials are art-directable properties that can be tweaked without shader recompilation. Each material type defines properties specific to its surface type and provides factory functions to create instances with different presets.

## Architecture

```
MaterialSystem
  ├─ WaterMaterial - Used for Ocean rendering
  ├─ TerrainMaterial - Used for terrain/floor rendering
  └─ [Future materials can be added here]
```

## Key Concepts

- **Material Types**: Each material type (WaterMaterial, TerrainMaterial) is a struct defining properties
- **Factory Functions**: Each material type has factory functions to create instances (e.g., `createDefaultWaterMaterial()`)
- **Presets**: Pre-configured material instances for common use cases
- **Art-Directable**: Materials can be modified at runtime without recompiling shaders
- **Shader Configuration**: Materials configure how shaders render surfaces

## Water Material

### Structure

```glsl
struct WaterMaterial {
    vec3 absorption;          // Water absorption coefficients (m^-1) - RGB channels
    vec3 deepWaterColor;     // Color for deep water (darker blue)
    vec3 shallowWaterColor;  // Color for shallow water (bright turquoise)
    float baseRoughness;     // Base roughness for calm water (very smooth)
    float maxRoughness;      // Maximum roughness for choppy water
};
```

### Factory Functions

#### `WaterMaterial createDefaultWaterMaterial()`
Creates realistic ocean water material with default values.

**Properties:**
- `absorption`: `vec3(0.15, 0.045, 0.015)` m⁻¹ - Realistic absorption (red absorbed most)
- `deepWaterColor`: `vec3(0.0, 0.2, 0.4)` - Darker blue for deep water
- `shallowWaterColor`: `vec3(0.0, 0.5, 0.75)` - Bright turquoise for shallow water
- `baseRoughness`: `0.03` - Very smooth calm water
- `maxRoughness`: `0.12` - Choppy water maximum

**Used by:** WaterShading system

---

#### `WaterMaterial createClearTropicalWater()`
Creates clear tropical water material preset.

**Properties:**
- Less absorption (clearer water)
- Brighter colors (more cyan)
- Suitable for tropical/caribbean scenes

**Example:**
```glsl
WaterMaterial mat = createClearTropicalWater();
```

---

#### `WaterMaterial createMurkyWater()`
Creates murky/muddy water material preset.

**Properties:**
- High absorption (murky water)
- Brownish colors
- Suitable for rivers, lakes, or polluted water

**Example:**
```glsl
WaterMaterial mat = createMurkyWater();
```

---

#### `WaterMaterial createChoppyWater()`
Creates rough/choppy water material preset.

**Properties:**
- Higher base and max roughness
- Suitable for stormy or windy conditions

**Example:**
```glsl
WaterMaterial mat = createChoppyWater();
```

---

## Terrain Material

### Structure

```glsl
struct TerrainMaterial {
    vec3 baseColor;          // Base terrain color
    vec3 deepColor;          // Color for deeper areas
    float roughness;         // Surface roughness (0.0 = smooth, 1.0 = rough)
    float specularPower;     // Specular highlight power
    float ambientFactor;     // Ambient lighting factor
    float specularIntensity; // Specular highlight intensity
};
```

### Factory Functions

#### `TerrainMaterial createDefaultTerrainMaterial()`
Creates default terrain material with realistic ocean floor properties.

**Properties:**
- `baseColor`: `vec3(0.3, 0.25, 0.2)` - Brownish terrain color
- `deepColor`: `vec3(0.2, 0.18, 0.15)` - Darker for deep areas
- `roughness`: `0.8` - Relatively rough surface
- `specularPower`: `32.0` - Phong specular power
- `ambientFactor`: `0.1` - Base ambient lighting
- `specularIntensity`: `0.2` - Specular highlight intensity

**Used by:** TerrainShading system

---

#### `TerrainMaterial createSandyTerrainMaterial()`
Creates sandy terrain material preset.

**Properties:**
- Sandy beige colors
- Less rough than default
- Suitable for beach/sandy ocean floor

**Example:**
```glsl
TerrainMaterial mat = createSandyTerrainMaterial();
```

---

#### `TerrainMaterial createRockyTerrainMaterial()`
Creates rocky terrain material preset.

**Properties:**
- Grayish rock colors
- Very rough surface
- Less specular (dull rock)
- Suitable for rocky ocean floor

**Example:**
```glsl
TerrainMaterial mat = createRockyTerrainMaterial();
```

---

## Usage Examples

### Basic Material Creation

```glsl
#include "MaterialSystem.frag"

// Create water material
WaterMaterial waterMat = createDefaultWaterMaterial();

// Create terrain material
TerrainMaterial terrainMat = createDefaultTerrainMaterial();
```

### Using Presets

```glsl
// Use preset materials
WaterMaterial tropicalWater = createClearTropicalWater();
TerrainMaterial sandyFloor = createSandyTerrainMaterial();
```

### Custom Material Properties

```glsl
// Create default and customize
WaterMaterial customWater = createDefaultWaterMaterial();
customWater.absorption = vec3(0.05, 0.02, 0.01);  // Clearer water
customWater.shallowWaterColor = vec3(0.0, 0.6, 0.8);  // More cyan

TerrainMaterial customTerrain = createDefaultTerrainMaterial();
customTerrain.baseColor = vec3(0.4, 0.3, 0.2);  // Custom color
customTerrain.roughness = 0.5;  // Less rough
```

### Using Materials in Shaders

```glsl
#include "MaterialSystem.frag"
#include "WaterShading.frag"

// Create material
WaterMaterial waterMat = createDefaultWaterMaterial();

// Use in shading
WaterShadingParams params;
params.material = waterMat;
// ... set other params ...
WaterShadingResult result = shadeWater(params);
```

### Using Materials in RenderPipeline

```glsl
#include "MaterialSystem.frag"
#include "RenderPipeline.frag"

// Create materials
WaterMaterial waterMat = createDefaultWaterMaterial();
TerrainMaterial terrainMat = createDefaultTerrainMaterial();

// Create render context
RenderContext ctx;
// ... set other context fields ...
ctx.waterMaterial = waterMat;
ctx.terrainMaterial = terrainMat;

// RenderPipeline will use the materials automatically
RenderResult result = renderScene(ctx);
```

---

## Integration with Shading Systems

### WaterShading Integration

The WaterShading system uses `WaterMaterial` to configure:
- Water absorption and color
- Roughness calculation
- Depth-based color blending
- Subsurface scattering

See `WATER_SHADING.md` for complete WaterShading documentation.

### TerrainShading Integration

The TerrainShading system uses `TerrainMaterial` to configure:
- Terrain base and deep colors
- Surface roughness
- Specular highlights
- Ambient lighting

See `TERRAIN_SHADING.md` for complete TerrainShading documentation.

---

## Extending the Material System

To add a new material type:

1. **Define the struct** in `MaterialSystem.frag`:
```glsl
struct NewMaterial {
    vec3 color;
    float roughness;
    // ... other properties
};
```

2. **Create factory functions**:
```glsl
NewMaterial createDefaultNewMaterial() {
    NewMaterial mat;
    mat.color = vec3(1.0);
    mat.roughness = 0.5;
    return mat;
}

NewMaterial createPresetNewMaterial() {
    NewMaterial mat = createDefaultNewMaterial();
    // Modify properties
    return mat;
}
```

3. **Use in shading system**: Update the corresponding shading system to accept and use the new material.

---

## Physical Constants

Physical constants (not art-directable) are defined in `Common.frag`:
- `WATER_F0`: `vec3(0.018, 0.019, 0.020)` - Fresnel F0 (based on IOR)
- `WATER_IOR`: `1.33` - Index of refraction for water
- `AIR_IOR`: `1.0` - Index of refraction for air

These remain as compile-time constants because they are physical properties.

---

## Benefits

1. **No Recompilation**: Tweak material properties without rebuilding shaders
2. **Centralized Management**: All materials defined in one place
3. **Easy Presets**: Quick access to common configurations
4. **Type Safety**: Clear structure vs scattered constants
5. **Extensible**: Easy to add new material types
6. **Art-Directable**: Perfect for iterative design and tweaking

---

## Future Material Types

The system is designed to be extended with additional material types:
- **SkyMaterial**: For sky rendering configuration
- **CloudMaterial**: For volumetric cloud properties
- **ParticleMaterial**: For particle system materials
- etc.

Each new material type follows the same pattern: struct definition + factory functions.

