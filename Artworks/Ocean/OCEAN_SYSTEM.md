# Ocean System Documentation

## Overview

The Ocean System provides a comprehensive, physically-based ocean rendering solution with realistic wave simulation, water shading, and ocean floor terrain. It implements:

- **Wave Simulation**: Based on Tessendorf's "Simulating Ocean Water" (SIGGRAPH 2001) with 10-component wave spectrum
- **PBR Water Shading**: Physically-based rendering with Fresnel, specular highlights, and subsurface scattering
- **Refraction & Reflection**: Realistic light transport through water with raymarching
- **Ocean Floor**: Procedural terrain with customizable depth and variation
- **Modular Architecture**: Split into focused helper functions for maintainability

## Basic Usage

```glsl
#include "OceanSystem.frag"
#include "SkySystem.frag"

// Create sky for lighting
SkyAtmosphere sky = createSkyPreset_ClearDay();

// Calculate wave height and normal at a position
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);

// Shade the ocean surface
vec3 color = shadeOcean(pos, normal, viewDir, time, gradient, sky);
```

## Wave System

The ocean uses a 10-component wave spectrum with realistic amplitude and frequency distribution.

### Wave Parameters

- **NUM_WAVES**: 10 waves total
- **PRIMARY_SWELL_DIR**: Dominant wind direction `vec2(0.9578, 0.2873)`
- **TIME_SCALE**: 0.3 (slows wave motion for more realistic appearance)

### Wave Spectrum

The wave system includes:
1. **Primary Swell**: Largest amplitude (1.4m), longest wavelength (~52m)
2. **Secondary/Tertiary Swells**: Medium amplitude waves
3. **Cross Swell**: Perpendicular to primary direction
4. **Detail Waves**: 6 smaller waves for fine detail

### Wave Functions

#### `getWaveHeight(vec2 pos, float time)`
Returns the wave height at a given position and time.

```glsl
float height = getWaveHeight(pos.xz, time);
```

#### `getWaveHeightAndGradient(vec2 pos, float time)`
Returns wave height and gradient (for normals calculation).

```glsl
vec3 result = getWaveHeightAndGradient(pos.xz, time);
float height = result.x;
vec2 gradient = result.yz;
```

#### `getNormal(vec2 pos, float time, out vec2 gradient)`
Calculates the surface normal from wave gradients.

```glsl
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);
```

#### `getWaveSpeed(float k)`
Calculates wave speed from wave number using dispersion relation: `w = sqrt(g*k)`

## Water Properties

### Physical Constants

- **WATER_IOR**: 1.33 (index of refraction for water)
- **AIR_IOR**: 1.0 (index of refraction for air)
- **waterAbsorption**: `vec3(0.15, 0.045, 0.015)` m^-1 (realistic absorption coefficients)

### Roughness

- **baseRoughness**: 0.03 (very smooth, calm water)
- **maxRoughness**: 0.12 (choppy water)

Roughness is calculated dynamically based on wave gradients and height:
```glsl
float dynamicRoughness = calculateWaterRoughness(gradient, waveHeight);
```

### Water Colors

- **shallowWaterColor**: `vec3(0.0, 0.5, 0.75)` - Bright turquoise for shallow water
- **deepWaterColor**: `vec3(0.0, 0.2, 0.4)` - Darker blue for deep water

Water color blends based on depth using exponential falloff.

## Ocean Floor

The ocean floor is procedurally generated with customizable parameters.

### OceanFloorParams Structure

```glsl
struct OceanFloorParams {
    float baseDepth;        // Base depth (negative Y value)
    float heightVariation;  // Maximum height variation
    float largeScale;       // Large-scale terrain feature size
    float mediumScale;      // Medium-scale terrain feature size
    float smallScale;       // Small-scale terrain feature size
    float largeAmplitude;   // Large-scale amplitude
    float mediumAmplitude;  // Medium-scale amplitude
    float smallAmplitude;   // Small-scale amplitude
    float roughness;        // Floor material roughness
};
```

### Default Floor Parameters

```glsl
OceanFloorParams floorParams;
floorParams.baseDepth = -105.0;
floorParams.heightVariation = 25.0;
floorParams.largeScale = 0.02;
floorParams.mediumScale = 0.08;
floorParams.smallScale = 0.3;
floorParams.largeAmplitude = 0.6;
floorParams.mediumAmplitude = 0.3;
floorParams.smallAmplitude = 0.1;
floorParams.roughness = 0.5;
```

### Floor Functions

#### `getOceanFloorHeight(vec2 pos, OceanFloorParams params)`
Returns the height of the ocean floor at a given position.

#### `getOceanFloorNormal(vec3 pos, OceanFloorParams params)`
Returns the normal vector of the ocean floor at a given position.

#### `shadeOceanFloor(vec3 floorPos, vec3 viewDir, vec3 normal, float time, OceanFloorParams floorParams, SkyAtmosphere sky, vec3 waterSurfacePos, vec3 waterNormal)`
Shades the ocean floor with PBR lighting, accounting for water surface effects.

## Main Shading Function

### `shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky)`

The main ocean shading function. It orchestrates all shading components:

1. Calculates water depth and base color
2. Computes refracted color (with raymarching and floor shading)
3. Computes reflected color (with roughness-based sampling)
4. Applies PBR lighting (diffuse, specular, ambient, subsurface, volumetric)

**Parameters:**
- `pos`: World position on water surface
- `normal`: Surface normal (from `getNormal()`)
- `viewDir`: View direction (normalized)
- `time`: Animation time
- `gradient`: Wave gradient (from `getNormal()`)
- `sky`: Sky atmosphere configuration

**Returns:** Final shaded color

```glsl
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);
vec3 color = shadeOcean(pos, normal, viewDir, time, gradient, sky);
```

## Helper Functions

The main shading function is split into focused helper functions for better maintainability:

### `calculateWaterDepthAndColor(vec3 pos, vec3 normal, vec3 viewDir, OceanFloorParams floorParams)`

Calculates water depth and base color based on floor height and view angle.

**Returns:** `WaterDepthInfo` struct containing:
- `depth`: Water depth in meters
- `depthFactor`: Normalized depth factor (0-1)
- `waterColor`: Base water color with view angle tinting

### `calculateRefractedColor(vec3 pos, vec3 normal, vec3 viewDir, WaterDepthInfo depthInfo, float time, OceanFloorParams floorParams, SkyAtmosphere sky)`

Handles refraction through water with raymarching to the ocean floor.

- Calculates refracted ray direction
- Performs raymarching through water
- Shades ocean floor when hit
- Applies water absorption and translucency

**Returns:** Refracted color (floor color with absorption)

### `calculateReflectedColor(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient, SkyAtmosphere sky)`

Handles reflection with roughness-based multi-sample blurring.

- Calculates dynamic roughness from wave state
- Distorts reflection direction based on roughness
- Performs multi-sample reflection for rough water (fixed 2 samples for temporal stability)
- Handles horizon blending

**Returns:** Reflected sky color

### `calculateWaterLighting(vec3 pos, vec3 normal, vec3 viewDir, vec3 refractedColor, vec3 reflectedColor, WaterDepthInfo depthInfo, float time, vec2 gradient, SkyAtmosphere sky, LightingInfo light)`

Applies complete PBR lighting to water.

**Returns:** `WaterLightingResult` struct containing:
- `color`: Final lit color
- `dynamicRoughness`: Calculated roughness
- `reflectedDir`: Reflection direction

**Lighting Components:**
- **Fresnel**: Calculates reflection/refraction mix
- **Direct Lighting**: Diffuse and specular BRDF
- **Ambient IBL**: Image-based lighting from sky
- **Subsurface Scattering**: Light transport through water
- **Volumetric Lighting**: God rays through water

## PBR Functions

### Fresnel

#### `getFresnel(vec3 viewDir, vec3 normal)`
Calculates Fresnel reflectance using Schlick's approximation.

#### `getWaterF0()`
Returns the F0 (reflectance at normal incidence) for water: `vec3(0.018, 0.019, 0.020)`

### Specular BRDF

#### `specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness, vec3 skyReflectionColor)`
Calculates specular reflection using GGX distribution, Smith geometry, and multi-scattering compensation.

**Features:**
- GGX microfacet distribution
- Smith geometry term
- Multi-scattering compensation for energy conservation
- Sky reflection color integration

### Subsurface Scattering

#### `getSubsurfaceScattering(vec3 normal, vec3 viewDir, vec3 lightDir, float depth)`
Calculates subsurface light transport through water.

**Returns:** Subsurface scattering contribution

## Reflection Distortion

### `getDistortedReflectionDir(vec3 reflectedDir, vec3 normal, float roughness, vec2 pos, float time)`

Distorts reflection direction based on wave roughness and position.

- Uses wave gradients to create realistic surface distortion
- Applies roughness-based scaling
- Uses stable tangent construction (avoids NaN for vertical normals)

## Examples

### Basic Ocean Rendering

```glsl
#include "OceanSystem.frag"
#include "SkySystem.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 pos = (uv - 0.5) * 20.0; // World position
    
    float time = iTime;
    
    // Calculate normal
    vec2 gradient;
    vec3 normal = getNormal(pos, time, gradient);
    float height = getWaveHeight(pos, time);
    
    // Create sky
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    
    // Shade ocean
    vec3 viewDir = normalize(vec3(0.0, 1.0, 1.0));
    vec3 color = shadeOcean(vec3(pos.x, height, pos.y), normal, viewDir, time, gradient, sky);
    
    fragColor = vec4(color, 1.0);
}
```

### Custom Ocean Floor

```glsl
// Create custom ocean floor
OceanFloorParams floorParams;
floorParams.baseDepth = -50.0;        // Shallower ocean
floorParams.heightVariation = 10.0;   // Less variation
floorParams.largeScale = 0.05;        // Larger features
floorParams.roughness = 0.3;          // Smoother floor

// The floor params are used internally by shadeOcean
// You can also use them directly for floor-only rendering
float floorHeight = getOceanFloorHeight(pos.xz, floorParams);
vec3 floorNormal = getOceanFloorNormal(vec3(pos.x, floorHeight, pos.z), floorParams);
```

### Wave Animation

```glsl
// Animate waves over time
float time = iTime;

// Get wave height at different positions
float height1 = getWaveHeight(vec2(0.0, 0.0), time);
float height2 = getWaveHeight(vec2(10.0, 5.0), time);

// Calculate normal for shading
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);
```

### Custom Water Properties

```glsl
// Modify water appearance by adjusting constants
// (Note: These are compile-time constants, modify in OceanSystem.frag)

// For clearer water (less absorption):
// const vec3 waterAbsorption = vec3(0.05, 0.02, 0.01);

// For rougher water:
// const float maxRoughness = 0.2;

// For different water colors:
// const vec3 shallowWaterColor = vec3(0.0, 0.6, 0.8); // More cyan
// const vec3 deepWaterColor = vec3(0.0, 0.15, 0.3);   // Darker blue
```

### Integration with Sky System

```glsl
// Create sky for realistic lighting
SkyAtmosphere sky = createSkyPreset_Sunset();

// Ocean automatically uses sky for:
// - Reflection color
// - Ambient lighting
// - Specular highlights
// - Volumetric lighting

vec3 color = shadeOcean(pos, normal, viewDir, time, gradient, sky);
```

## Performance Considerations

1. **Fixed Sample Count**: Reflection uses fixed 2 samples to avoid temporal flickering
2. **Raymarching**: Refraction raymarching is only performed when translucency is significant
3. **Caching**: Lighting evaluation is cached and reused
4. **Precomputed Values**: Wave speeds are precomputed for efficiency

## Technical Details

### Wave Physics

Waves follow the deep water dispersion relation:
- Speed: `v = sqrt(g * k) * TIME_SCALE`
- Frequency: `w = sqrt(g * k)`
- Where `g` is gravity (9.81 m/s²) and `k` is wave number

### Water Absorption

Light absorption follows Beer's law:
- `absorption = exp(-waterAbsorption * pathLength)`
- Red light is absorbed most, blue least (realistic for water)

### Roughness Calculation

Dynamic roughness is calculated from wave gradients:
- Base roughness for calm water
- Increases with wave steepness (gradient magnitude)
- Increases with wave height

### Tangent Construction

The reflection distortion system uses stable tangent construction that avoids NaN values for near-vertical normals by checking cross product length before normalization.

## References

- Tessendorf, J. "Simulating Ocean Water" (SIGGRAPH 2001)
- Jensen et al. "A Practical Model for Subsurface Light Transport"
- Filament PBR Engine
- Unreal Engine 4/5 Water Shading
- "Multiple-Scattering Microfacet BSDFs with the Smith Model"

