# Water Shading System API Documentation

## Overview

The Water Shading System provides physically-based rendering (PBR) functions for water surfaces. It implements realistic water material properties including Fresnel reflection, specular highlights, subsurface scattering, refraction, and volumetric lighting. Based on Filament PBR Engine, Unreal Engine 4/5 Water Shading, and research papers on subsurface light transport.

## Dependencies

- **MaterialSystem**: For water material properties (`WaterMaterial`)
- **WaveSystem**: For wave height/gradient queries (`getWaveHeight`, `getWaveGradient`)
- **TerrainSystem**: For terrain height queries (`getTerrainHeight`)
- **VolumeRaymarching**: For terrain raymarching (`raymarchTerrain`)
- **SkySystem**: For sky color evaluation and lighting information

## Structures

### `WaterDepthInfo`
Contains water depth and color information.

```glsl
struct WaterDepthInfo {
    float depth;        // Water depth in meters
    float depthFactor;  // Normalized depth factor (0-1)
    vec3 waterColor;    // Base water color with view angle tinting
};
```

### `WaterShadingParams`
Input parameters for water shading.

```glsl
struct WaterShadingParams {
    vec3 pos;                    // Surface position
    vec3 normal;                 // Surface normal
    vec3 viewDir;                // View direction (normalized)
    vec2 gradient;               // Wave gradient
    float time;                  // Time for animation
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration (for reflections)
    TerrainParams floorParams;   // Terrain params (for depth calculation)
    WaterMaterial material;      // Water material properties (art-directable)
};
```

### `WaterShadingResult`
Result from main shading function.

```glsl
struct WaterShadingResult {
    vec3 color;                  // Final shaded color
    float dynamicRoughness;      // Computed roughness
    vec3 reflectedDir;           // Reflection direction
};
```

### `WaterLightingResult`
Result from lighting calculation.

```glsl
struct WaterLightingResult {
    vec3 color;                  // Final lit color
    float dynamicRoughness;      // Calculated roughness
    vec3 reflectedDir;           // Reflection direction
};
```

## Main Function

### `WaterShadingResult shadeWater(WaterShadingParams params)`
Main water shading function that orchestrates all shading components.

**Parameters:**
- `params`: `WaterShadingParams` struct containing all shading inputs

**Returns:** `WaterShadingResult` with final color and shading data

**Process:**
1. Calculates water depth and base color
2. Computes dynamic roughness from wave state
3. Calculates refracted color (with raymarching and floor shading)
4. Calculates reflected color (with roughness-based sampling)
5. Applies PBR lighting (diffuse, specular, ambient, subsurface, volumetric)

**Example:**
```glsl
WaterShadingParams params;
params.pos = surfacePos;
params.normal = surfaceNormal;
params.viewDir = viewDir;
params.gradient = waveGradient;
params.time = time;
params.light = lightingInfo;
params.sky = sky;
params.floorParams = terrainParams;

WaterShadingResult result = shadeWater(params);
vec3 finalColor = result.color;
```

---

## Fresnel Functions

### `vec3 getWaterF0()`
Returns the F0 (reflectance at normal incidence) for water.

**Returns:** `vec3(0.018, 0.019, 0.020)` - Wavelength-dependent Fresnel F0

---

### `vec3 getFresnel(vec3 viewDir, vec3 normal)`
Calculates Fresnel reflectance using Schlick's approximation.

**Parameters:**
- `viewDir`: View direction (normalized)
- `normal`: Surface normal (normalized)

**Returns:** Fresnel reflectance `vec3` (RGB)

**Note:** Uses proper Fresnel calculation clamped between F0 and 1.0.

---

### `vec3 fresnelSchlick(float cosTheta, vec3 F0)`
Schlick's Fresnel approximation.

**Parameters:**
- `cosTheta`: Cosine of angle between view and normal
- `F0`: Reflectance at normal incidence

**Returns:** Fresnel reflectance `vec3`

---

## PBR Shading Models

### `float D_GGX(float NdotH, float roughness)`
GGX (Trowbridge-Reitz) microfacet distribution.

**Parameters:**
- `NdotH`: Dot product of normal and half vector
- `roughness`: Surface roughness (0-1)

**Returns:** Distribution value

---

### `float G_Smith(float NdotV, float NdotL, float roughness)`
Smith geometry function (combines view and light geometry terms).

**Parameters:**
- `NdotV`: Dot product of normal and view direction
- `NdotL`: Dot product of normal and light direction
- `roughness`: Surface roughness

**Returns:** Geometry term

---

### `vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness, vec3 skyReflectionColor)`
Modern specular BRDF with multi-scattering compensation.

**Parameters:**
- `normal`: Surface normal
- `viewDir`: View direction
- `lightDir`: Light direction
- `lightColor`: Light color
- `roughness`: Surface roughness
- `skyReflectionColor`: Sky reflection color for integration

**Returns:** Specular contribution `vec3`

**Features:**
- GGX microfacet distribution
- Smith geometry term
- Multi-scattering compensation for energy conservation
- Sky reflection color integration

---

### `vec3 getMultiScatteringCompensation(vec3 F, vec3 F0, float roughness)`
Multi-scattering compensation for energy conservation.

**Parameters:**
- `F`: Fresnel term
- `F0`: Reflectance at normal incidence
- `roughness`: Surface roughness

**Returns:** Compensated Fresnel term

---

## Subsurface Scattering

### `vec3 getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth, WaterMaterial material)`
Calculates subsurface light transport through water.

**Parameters:**
- `normal`: Surface normal
- `viewDir`: View direction
- `lightDir`: Light direction
- `depth`: Water depth in meters
- `material`: Water material properties

**Returns:** Subsurface scattering contribution `vec3`

**Features:**
- Physically-based phase function
- Single and multiple scattering
- Depth-dependent tinting (shallow to deep water colors)

---

## Water Properties

### `float calculateWaterRoughness(vec2 gradient, float waveHeight, WaterMaterial material)`
Calculates dynamic roughness from wave state.

**Parameters:**
- `gradient`: Wave gradient (from `getWaveGradient()`)
- `waveHeight`: Wave height at position
- `material`: Water material properties

**Returns:** Roughness value (clamped between `material.baseRoughness` and `material.maxRoughness`)

**Features:**
- Base roughness for calm water: 0.03
- Maximum roughness for choppy water: 0.12
- Increases with wave steepness and height

---

### `vec3 getDistortedReflectionDir(vec3 reflectedDir, vec3 normal, float roughness, vec2 pos, float time)`
Distorts reflection direction based on wave roughness and position.

**Parameters:**
- `reflectedDir`: Base reflection direction
- `normal`: Surface normal
- `roughness`: Surface roughness
- `pos`: 2D position (x, z)
- `time`: Animation time

**Returns:** Distorted reflection direction `vec3`

**Features:**
- Uses wave gradients to create realistic surface distortion
- Applies roughness-based scaling
- Stable tangent construction (avoids NaN for vertical normals)

---

## Depth and Color Calculation

### `WaterDepthInfo calculateWaterDepthAndColor(vec3 pos, vec3 normal, vec3 viewDir, TerrainParams floorParams, WaterMaterial material)`
Calculates water depth and base color based on floor height and view angle.

**Parameters:**
- `pos`: Surface position
- `normal`: Surface normal
- `viewDir`: View direction
- `floorParams`: Terrain parameters
- `material`: Water material properties

**Returns:** `WaterDepthInfo` struct

**Features:**
- Calculates depth from terrain height
- Blends shallow/deep water colors based on depth
- Applies view angle tinting

---

## Refraction and Reflection

### `vec3 calculateRefractedColor(vec3 pos, vec3 normal, vec3 viewDir, WaterDepthInfo depthInfo, float time, TerrainParams floorParams, SkyAtmosphere sky, WaterMaterial material)`
Handles refraction through water with raymarching to the ocean floor.

**Parameters:**
- `pos`: Surface position
- `normal`: Surface normal
- `viewDir`: View direction
- `depthInfo`: Water depth information
- `time`: Animation time
- `floorParams`: Terrain parameters
- `sky`: Sky configuration
- `material`: Water material properties

**Returns:** Refracted color `vec3` (floor color with absorption)

**Features:**
- Calculates refracted ray direction using Snell's law
- Performs raymarching through water to find floor
- Applies water absorption based on path length
- Handles translucency for shallow water

---

### `vec3 calculateReflectedColor(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky, float dynamicRoughness, WaterMaterial material)`
Handles reflection with roughness-based multi-sample blurring.

**Parameters:**
- `pos`: Surface position
- `normal`: Surface normal
- `viewDir`: View direction
- `time`: Animation time
- `gradient`: Wave gradient
- `sky`: Sky configuration
- `dynamicRoughness`: Surface roughness (if < 0, computed from gradient)
- `material`: Water material properties

**Returns:** Reflected sky color `vec3`

**Features:**
- Calculates dynamic roughness from wave state (if not provided)
- Distorts reflection direction based on roughness
- Performs multi-sample reflection for rough water (fixed 2 samples for temporal stability)
- Handles horizon blending

**Note:** Uses fixed sample count (2) to avoid temporal flickering.

---

## Lighting Calculation

### `WaterLightingResult calculateWaterLighting(vec3 pos, vec3 normal, vec3 viewDir, vec3 refractedColor, vec3 reflectedColor, WaterDepthInfo depthInfo, float time, vec2 gradient, SkyAtmosphere sky, LightingInfo light, float dynamicRoughness, WaterMaterial material)`
Applies complete PBR lighting to water.

**Parameters:**
- `pos`: Surface position
- `normal`: Surface normal
- `viewDir`: View direction
- `refractedColor`: Precomputed refracted color
- `reflectedColor`: Precomputed reflected color
- `depthInfo`: Water depth information
- `time`: Animation time
- `gradient`: Wave gradient
- `sky`: Sky configuration
- `light`: Lighting information
- `dynamicRoughness`: Surface roughness
- `material`: Water material properties

**Returns:** `WaterLightingResult` struct

**Lighting Components:**
- **Fresnel**: Calculates reflection/refraction mix
- **Direct Lighting**: Diffuse and specular BRDF
- **Ambient IBL**: Image-based lighting from sky
- **Subsurface Scattering**: Light transport through water
- **Volumetric Lighting**: God rays through water

---

## Water Material

Water material properties are art-directable through the `WaterMaterial` struct from MaterialSystem, allowing tweaking without shader recompilation.

**See `MATERIAL_SYSTEM.md` for complete WaterMaterial documentation**, including:
- `WaterMaterial` structure definition
- Factory functions (`createDefaultWaterMaterial()`, `createClearTropicalWater()`, `createMurkyWater()`, `createChoppyWater()`)
- Preset configurations and usage examples

### Quick Reference

The `WaterMaterial` struct includes:
- `absorption` - Water absorption coefficients (m^-1) - RGB channels
- `deepWaterColor` - Color for deep water (darker blue)
- `shallowWaterColor` - Color for shallow water (bright turquoise)
- `baseRoughness` - Base roughness for calm water (very smooth)
- `maxRoughness` - Maximum roughness for choppy water

### Physical Constants

Physical constants (not art-directable) are defined in `Common.frag`:
- **`WATER_F0`**: `vec3(0.018, 0.019, 0.020)` - Fresnel F0 for water-air interface (based on IOR)
- **`WATER_IOR`**: `1.33` - Index of refraction for water
- **`AIR_IOR`**: `1.0` - Index of refraction for air

---

## Examples

### Basic Water Shading
```glsl
#include "WaterShading.frag"
#include "WaveSystem.frag"
#include "SkySystem.frag"

// Get wave normal and gradient
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);

// Get lighting information
LightingInfo light = evaluateLighting(sky, time);

// Create water material (art-directable)
WaterMaterial waterMaterial = createDefaultWaterMaterial();

// Setup shading parameters
WaterShadingParams params;
params.pos = pos;
params.normal = normal;
params.viewDir = viewDir;
params.gradient = gradient;
params.time = time;
params.light = light;
params.sky = sky;
params.floorParams = terrainParams;
params.material = waterMaterial;

// Shade water
WaterShadingResult result = shadeWater(params);
vec3 color = result.color;
```

### Custom Water Material
```glsl
// Create custom water material
WaterMaterial waterMaterial = createDefaultWaterMaterial();
waterMaterial.absorption = vec3(0.05, 0.02, 0.01);  // Clearer water
waterMaterial.shallowWaterColor = vec3(0.0, 0.6, 0.8);  // More cyan
waterMaterial.baseRoughness = 0.05;  // Slightly rougher

// Or use a preset
waterMaterial = createClearTropicalWater();

// Use in shading
WaterShadingParams params;
// ... setup params ...
params.material = waterMaterial;
WaterShadingResult result = shadeWater(params);
```

### Custom Roughness
```glsl
// Calculate roughness manually with custom material
WaterMaterial waterMaterial = createDefaultWaterMaterial();
float waveHeight = getWaveHeight(pos.xz, time);
float roughness = calculateWaterRoughness(gradient, waveHeight, waterMaterial);

// Use in reflection calculation
vec3 reflectedColor = calculateReflectedColor(
    pos, normal, viewDir, time, gradient, sky, roughness, waterMaterial
);
```

### Depth Calculation Only
```glsl
WaterMaterial waterMaterial = createDefaultWaterMaterial();
WaterDepthInfo depthInfo = calculateWaterDepthAndColor(
    pos, normal, viewDir, terrainParams, waterMaterial
);

float depth = depthInfo.depth;
vec3 waterColor = depthInfo.waterColor;
```

---

## Performance Notes

- **Fixed sample count**: Reflection uses fixed 2 samples to avoid temporal flickering
- **Roughness caching**: Roughness is computed once and reused
- **IBL optimization**: Ambient IBL uses 3 samples for rough water
- **Translucency optimization**: Refraction raymarching only performed when translucency is significant

## References

- Filament PBR Engine
- Unreal Engine 4/5 Water Shading
- Jensen et al. "A Practical Model for Subsurface Light Transport"
- "Multiple-Scattering Microfacet BSDFs with the Smith Model"

