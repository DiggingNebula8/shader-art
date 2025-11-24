# Terrain Shading System API Documentation

## Overview

The Terrain Shading System provides material properties and shading functions for terrain surfaces, with special support for ocean floor caustics. It implements PBR lighting with realistic caustics calculation for underwater terrain.

## Dependencies

- **MaterialSystem**: For terrain material properties (`TerrainMaterial`)
- **SkySystem**: For lighting information and sky configuration
- **TerrainSystem**: For terrain height queries
- **WaveSystem**: For wave height/gradient queries (for caustics)

## Structure

### `TerrainShadingParams`
Input parameters for terrain shading.

```glsl
struct TerrainShadingParams {
    vec3 pos;                    // Terrain position
    vec3 normal;                 // Terrain normal
    vec3 viewDir;                // View direction (normalized)
    float time;                  // Time for animation
    TerrainParams terrainParams; // Terrain configuration
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration
    vec3 waterSurfacePos;        // Water surface position (for caustics)
    vec3 waterNormal;            // Water surface normal (for caustics)
    TerrainMaterial material;    // Terrain material properties (art-directable)
};
```

## Main Function

### `vec3 shadeTerrain(TerrainShadingParams params)`
Main terrain shading function. Shades terrain with PBR lighting and caustics.

**Parameters:**
- `params`: `TerrainShadingParams` struct containing all shading inputs

**Returns:** Final shaded color `vec3`

**Features:**
- PBR lighting (ambient, diffuse, specular)
- Depth-based color variation
- Texture noise for detail
- Caustics calculation (if underwater)

**Example:**
```glsl
#include "MaterialSystem.frag"
#include "TerrainShading.frag"
#include "SkySystem.frag"

// Create terrain material
TerrainMaterial terrainMat = createDefaultTerrainMaterial();

TerrainShadingParams params;
params.pos = terrainPos;
params.normal = terrainNormal;
params.viewDir = viewDir;
params.time = time;
params.terrainParams = terrainParams;
params.light = evaluateLighting(sky, time);
params.sky = sky;
params.waterSurfacePos = waterPos;
params.waterNormal = waterNormal;
params.material = terrainMat;

vec3 color = shadeTerrain(params);
```

---

## Caustics Function

### `vec3 calculateCaustics(vec3 floorPos, vec3 waterSurfacePos, vec3 waterNormal, vec3 sunDir, float time, TerrainParams floorParams)`
Calculates realistic caustics for underwater terrain.

**Parameters:**
- `floorPos`: Terrain position
- `waterSurfacePos`: Water surface position above terrain
- `waterNormal`: Water surface normal
- `sunDir`: Sun direction (normalized)
- `time`: Animation time
- `floorParams`: Terrain parameters (reserved for future use)

**Returns:** Caustics color contribution `vec3`

**Features:**
- Multi-sample caustics calculation (5 samples)
- Wave gradient-based focusing
- Depth-dependent falloff and diffusion
- Angle-dependent intensity
- Temporal jittering for anti-aliasing

**Process:**
1. Calculates refracted sun direction using Snell's law
2. Samples wave gradients at multiple positions
3. Calculates focusing based on wave slope
4. Applies depth falloff and diffusion
5. Applies angle falloff
6. Returns caustics color

**Example:**
```glsl
vec3 sunDir = normalize(light.sunDirection);
vec3 caustics = calculateCaustics(
    floorPos, waterSurfacePos, waterNormal, sunDir, time, terrainParams
);
```

---

## Shading Details

### Material Properties

Terrain shading uses `TerrainMaterial` from MaterialSystem to configure:
- **Base color**: `material.baseColor` - Base terrain color
- **Deep color**: `material.deepColor` - Color for deeper areas
- **Roughness**: `material.roughness` - Surface roughness (0.0 = smooth, 1.0 = rough)
- **Specular power**: `material.specularPower` - Phong specular power
- **Ambient factor**: `material.ambientFactor` - Ambient lighting factor
- **Specular intensity**: `material.specularIntensity` - Specular highlight intensity

### Lighting Components

1. **Ambient**: `floorColor * material.ambientFactor` - Base ambient lighting
2. **Diffuse**: `floorColor * sunColor * sunIntensity * NdotL` - Direct lighting
3. **Specular**: Phong-style specular with `material.specularPower` and `material.specularIntensity`
4. **Caustics**: Calculated if sun is above horizon and water is above terrain

### Depth Variation
- Color blends between `material.baseColor` and `material.deepColor` based on height
- Texture noise adds detail using `smoothNoise()`

See `MATERIAL_SYSTEM.md` for complete TerrainMaterial documentation and presets.

---

## Examples

### Basic Terrain Shading
```glsl
#include "MaterialSystem.frag"
#include "TerrainShading.frag"
#include "TerrainSystem.frag"
#include "SkySystem.frag"

// Create terrain material
TerrainMaterial terrainMat = createDefaultTerrainMaterial();

// Get terrain height and normal
float height = getTerrainHeight(pos.xz, terrainParams);
vec3 terrainPos = vec3(pos.x, height, pos.z);
vec3 normal = getTerrainNormal(terrainPos, terrainParams);

// Setup shading parameters
TerrainShadingParams params;
params.pos = terrainPos;
params.normal = normal;
params.viewDir = viewDir;
params.time = time;
params.terrainParams = terrainParams;
params.light = evaluateLighting(sky, time);
params.sky = sky;
params.waterSurfacePos = waterPos;
params.waterNormal = waterNormal;
params.material = terrainMat;

// Shade terrain
vec3 color = shadeTerrain(params);
```

### Using Material Presets
```glsl
// Use sandy terrain material
TerrainMaterial sandyMat = createSandyTerrainMaterial();

// Or rocky terrain
TerrainMaterial rockyMat = createRockyTerrainMaterial();

// Use in shading
params.material = sandyMat;
vec3 color = shadeTerrain(params);
```

### Caustics Only
```glsl
vec3 sunDir = normalize(light.sunDirection);
vec3 caustics = calculateCaustics(
    floorPos, waterSurfacePos, waterNormal, sunDir, time, terrainParams
);

// Add to base color
vec3 finalColor = baseColor + caustics;
```

---

## Performance Notes

- **Multi-sample caustics**: Uses 5 samples for smooth caustics
- **Temporal jittering**: Reduces aliasing with stable hash-based jitter
- **Conditional caustics**: Only calculated if sun is above horizon and water is present

---

## References

- Realistic caustics calculation based on wave focusing
- PBR lighting principles

