# Terrain System API Documentation

## Overview

The Terrain System provides advanced procedural terrain generation with multi-scale noise, domain warping, ridged multifractal noise, and erosion effects. Based on techniques from Perlin & Hoffert "Hypertexture" (SIGGRAPH 1989), Musgrave et al. "The Synthesis and Rendering of Eroded Fractal Terrains" (SIGGRAPH 1989), and domain warping techniques.

## Key Features

- **Multi-scale noise**: Large, medium, and small scale terrain features
- **Ridged multifractal**: Sharp ridges like mountain ranges
- **Domain warping**: Flowing, organic terrain features
- **Erosion simulation**: Smoothing effects for realistic terrain
- **Billow noise**: Cloud-like patterns for detail
- **SDF function**: Integration with VolumeRaymarching system

## Structure

### `TerrainParams`
Terrain configuration structure.

```glsl
struct TerrainParams {
    // Base terrain properties
    float baseHeight;       // Base height of the terrain
    float heightVariation;  // Maximum height variation from base height
    
    // Multi-scale noise parameters
    float largeScale;       // Large-scale terrain feature size
    float mediumScale;      // Medium-scale terrain feature size
    float smallScale;       // Small-scale terrain feature size (detail)
    
    // Amplitude weights for each scale
    float largeAmplitude;   // Amplitude of large-scale features
    float mediumAmplitude;  // Amplitude of medium-scale features
    float smallAmplitude;   // Amplitude of small-scale features
    
    // Advanced terrain features
    float roughness;        // Overall terrain roughness (0.0 = smooth, 1.0 = rough)
    float ridgedness;       // Ridged multifractal influence (0.0 = none, 1.0 = full)
    float domainWarp;       // Domain warping strength (0.0 = none, 1.0 = strong)
    float erosion;          // Erosion-like smoothing (0.0 = none, 1.0 = heavy)
    
    // Terrain type modifiers
    float mountainness;     // Mountain-like features (0.0 = flat, 1.0 = mountains)
    float valleyness;       // Valley/canyon features (0.0 = none, 1.0 = deep valleys)
    
    // Noise function parameters
    int octaves;           // Number of octaves for fractal noise
    float persistence;     // Amplitude falloff between octaves
    float lacunarity;      // Frequency multiplier between octaves
};
```

## Preset Functions

### `TerrainParams initTerrainParams()`
Initializes terrain parameters with default values.

**Returns:** `TerrainParams` with default settings

---

### `TerrainParams createDefaultTerrain()`
Creates default terrain configuration.

**Returns:** `TerrainParams` with standard settings

---

### `TerrainParams createFlatTerrain()`
Creates low-poly, flat terrain with minimal height variation.

**Returns:** `TerrainParams` configured for flat terrain:
- Base height: -105.0
- Height variation: 2.0
- Single octave (low detail)
- Minimal roughness

---

### `TerrainParams createMountainTerrain()`
Creates mountainous terrain with sharp ridges.

**Returns:** `TerrainParams` configured for mountains:
- Base height: 100.0
- Height variation: 200.0
- High ridgedness (0.8)
- Domain warping enabled
- 6 octaves

---

### `TerrainParams createHillyTerrain()`
Creates hilly terrain with moderate variation.

**Returns:** `TerrainParams` configured for hills:
- Base height: 20.0
- Height variation: 80.0
- Moderate ridgedness (0.2)
- 5 octaves

---

### `TerrainParams createPlainsTerrain()`
Creates flat plains terrain.

**Returns:** `TerrainParams` configured for plains:
- Base height: 0.0
- Height variation: 10.0
- Low roughness
- Minimal variation

---

## Main Functions

### `float getTerrainHeight(vec2 pos, TerrainParams params)`
Returns the height of the terrain at a given 2D position.

**Parameters:**
- `pos`: 2D position (x, z coordinates in world space)
- `params`: Terrain configuration

**Returns:** Terrain height in meters

**Process:**
1. Applies domain warping (if enabled)
2. Samples multi-scale noise (large, medium, small)
3. Applies ridged noise (if enabled)
4. Applies valley noise (if enabled)
5. Applies roughness detail
6. Applies erosion smoothing
7. Returns final height

**Example:**
```glsl
TerrainParams params = createFlatTerrain();
float height = getTerrainHeight(vec2(10.0, 5.0), params);
```

---

### `vec3 getTerrainNormal(vec3 pos, TerrainParams params)`
Returns the normal vector of the terrain at a given position.

**Parameters:**
- `pos`: 3D position in world space
- `params`: Terrain configuration

**Returns:** Normalized normal vector `vec3`

**Note:** Uses central differences with epsilon = 0.1

**Example:**
```glsl
vec3 pos = vec3(10.0, height, 5.0);
vec3 normal = getTerrainNormal(pos, params);
```

---

### `float getTerrainSDF(vec3 pos, TerrainParams params)`
Signed Distance Function for terrain surface. Used by VolumeRaymarching system.

**Parameters:**
- `pos`: 3D position in world space
- `params`: Terrain configuration

**Returns:**
- Positive if above the surface
- Negative if below the surface
- Zero at the surface

**Example:**
```glsl
float dist = getTerrainSDF(worldPos, params);
if (dist < 0.001) {
    // Near surface
}
```

---

### `VolumeHit raymarchTerrain(vec3 start, vec3 dir, float maxDist, float time, TerrainParams params)`
Raymarches to find terrain surface intersection.

**Parameters:**
- `start`: Ray start position
- `dir`: Ray direction (normalized)
- `maxDist`: Maximum raymarching distance
- `time`: Animation time (not used, but required by VolumeRaymarching)
- `params`: Terrain configuration

**Returns:** `VolumeHit` struct containing:
- `hit`: Whether a surface was hit
- `distance`: Distance traveled
- `position`: Hit position
- `normal`: Computed terrain normal
- `valid`: Whether result is valid

**Note:** Unlike `raymarchWaveSurface()`, this function computes the normal automatically.

**Example:**
```glsl
VolumeHit hit = raymarchTerrain(camPos, rayDir, 150.0, time, params);
if (hit.hit && hit.valid) {
    vec3 normal = hit.normal;  // Already computed
    vec3 pos = hit.position;
}
```

---

## Advanced Noise Functions

### `float ridgedNoise(vec2 p, float scale, int octaves, float persistence, float lacunarity)`
Ridged multifractal noise - creates sharp ridges like mountain ranges.

**Parameters:**
- `p`: 2D position
- `scale`: Noise scale
- `octaves`: Number of octaves
- `persistence`: Amplitude falloff
- `lacunarity`: Frequency multiplier

**Returns:** Ridged noise value (0-1)

**Note:** Based on Musgrave's ridged multifractal algorithm.

---

### `float billowNoise(vec2 p, float scale, int octaves, float persistence, float lacunarity)`
Billow noise - creates billowy, cloud-like patterns.

**Parameters:**
- `p`: 2D position
- `scale`: Noise scale
- `octaves`: Number of octaves
- `persistence`: Amplitude falloff
- `lacunarity`: Frequency multiplier

**Returns:** Billow noise value (0-1)

---

### `vec2 domainWarp(vec2 p, float strength)`
Domain warping - warps the domain before sampling noise for more natural patterns.

**Parameters:**
- `p`: 2D position
- `strength`: Warping strength (0.0 = none, 1.0 = strong)

**Returns:** Warped position `vec2`

**Features:**
- Creates flowing, organic terrain features
- Uses two-layer warping for natural patterns

---

## Internal Functions

These functions are used internally but may be useful for advanced users:

- `float sampleScaleNoise(...)`: Samples noise at a specific scale
- `float applyRidgedNoise(...)`: Applies ridged noise to base noise
- `float applyValleyNoise(...)`: Applies valley noise to base noise

---

## Constants

Defined in the system:

- `MIN_AMPLITUDE_THRESHOLD`: 0.001 - Minimum amplitude to process
- `DOMAIN_WARP_SCALE`: 10.0 - Domain warping scale multiplier
- `ROUGHNESS_MULTIPLIER`: 0.3 - Roughness detail multiplier
- `EROSION_MULTIPLIER`: 0.5 - Erosion strength multiplier
- `EROSION_REDUCTION`: 0.7 - Erosion reduction factor
- `DEFAULT_LACUNARITY`: 2.0 - Default lacunarity value
- `MAX_OCTAVES`: 8 - Maximum octaves for noise functions

---

## Examples

### Basic Terrain Height Query
```glsl
#include "TerrainSystem.frag"

TerrainParams params = createFlatTerrain();
float height = getTerrainHeight(vec2(0.0, 0.0), params);
```

### Custom Terrain Configuration
```glsl
TerrainParams params = initTerrainParams();
params.baseHeight = -50.0;
params.heightVariation = 10.0;
params.largeScale = 0.05;
params.roughness = 0.3;
params.octaves = 3;

float height = getTerrainHeight(pos.xz, params);
```

### Terrain Normal Calculation
```glsl
vec3 pos = vec3(10.0, getTerrainHeight(vec2(10.0, 5.0), params), 5.0);
vec3 normal = getTerrainNormal(pos, params);
```

### Raymarching Integration
```glsl
#include "TerrainSystem.frag"
#include "VolumeRaymarching.frag"

TerrainParams params = createFlatTerrain();
VolumeHit hit = raymarchTerrain(camPos, rayDir, 150.0, time, params);
if (hit.hit && hit.valid) {
    vec3 normal = hit.normal;  // Already computed
}
```

---

## Performance Notes

- **Conditional processing**: Features are only processed if amplitude > threshold
- **Octave limiting**: Maximum 8 octaves for portability
- **Normal computation**: Uses central differences (may be slower than analytical)

---

## References

- Perlin & Hoffert "Hypertexture" (SIGGRAPH 1989)
- Musgrave et al. "The Synthesis and Rendering of Eroded Fractal Terrains" (SIGGRAPH 1989)
- Ebert et al. "Texturing & Modeling: A Procedural Approach"
- Domain Warping techniques for natural-looking terrain

