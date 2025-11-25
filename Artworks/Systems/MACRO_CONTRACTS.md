# Macro Contracts Documentation

## Overview

This document catalogs all macro contracts across the shader system. Macro contracts define optional or required macros that systems expect to be defined by scenes or other systems for customization and extension.

## Contract Types

- **Optional Macros**: Have defaults and can be omitted. Systems provide fallback behavior if not defined.
- **Required Macros**: Must be defined before using specific functionality. No defaults provided.
- **Runtime Macros**: Defined at runtime (typically via other macros) and used internally.

## System Macro Contracts

### WaterShading System

**File:** `WaterShading.frag`

#### Optional Macros

##### `WATER_TERRAIN_HEIGHT(pos, params)`
- **Signature:** `float WATER_TERRAIN_HEIGHT(vec2 pos, TerrainParams params)`
- **Purpose:** Get terrain height at position for water depth calculation
- **Default:** Returns `0.0` if not defined (for scenes without terrain)
- **Used by:** Water depth and color calculation
- **Example:**
  ```glsl
  #define WATER_TERRAIN_HEIGHT(pos, params) getTerrainHeight(pos, params)
  ```

##### `WATER_SHADING_GET_SDF(pos, t, params)`
- **Signature:** `float WATER_SHADING_GET_SDF(vec3 pos, float t, TerrainParams params)`
- **Purpose:** Get scene SDF for translucency calculation (optional feature)
- **Default:** Translucency disabled if not defined
- **Used by:** `sampleTranslucency()`, `calculateRefractedColor()`
- **Note:** Must be defined before calling translucency functions
- **Example:**
  ```glsl
  #define WATER_SHADING_GET_SDF(pos, t, params) getSceneSDF(pos, t, params)
  ```

#### Runtime Macros

##### `getSDF(pos, time)`
- **Signature:** `float getSDF(vec3 pos, float time)`
- **Purpose:** Used internally by `DISTANCE_FIELD_RAYMARCH` for translucency
- **Note:** Automatically defined from `WATER_SHADING_GET_SDF` if provided
- **Defined by:** WaterShading system (from `WATER_SHADING_GET_SDF`)
- **Used by:** DistanceFieldSystem raymarching macros

---

### TerrainShading System

**File:** `TerrainShading.frag`

#### Optional Macros

##### `TERRAIN_WAVE_HEIGHT(pos, time)`
- **Signature:** `float TERRAIN_WAVE_HEIGHT(vec2 pos, float time)`
- **Purpose:** Get wave height at position for caustics calculation
- **Default:** Returns `0.0` if not defined (disables wave-based caustics)
- **Used by:** Caustics calculation
- **Note:** Required for realistic underwater caustics effects
- **Example:**
  ```glsl
  #define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
  ```

##### `TERRAIN_WAVE_GRADIENT(pos, time)`
- **Signature:** `vec2 TERRAIN_WAVE_GRADIENT(vec2 pos, float time)`
- **Purpose:** Get wave gradient at position for caustics focus calculation
- **Default:** Returns `vec2(0.0)` if not defined (disables gradient-based caustics)
- **Used by:** Caustics calculation
- **Note:** Required for realistic underwater caustics effects
- **Example:**
  ```glsl
  #define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)
  ```

**Usage Guidelines:**
- **Scenes WITH water:** Define both macros to enable caustics
- **Scenes WITHOUT water:** Omit macros (defaults will disable caustics)

---

### VolumeRaymarching System

**File:** `VolumeRaymarching.frag`

#### Required Macros

##### `getSDF(pos, time)`
- **Signature:** `float getSDF(vec3 pos, float time)`
- **Purpose:** Signed distance function for raymarching
- **Returns:** Signed distance to nearest surface (positive = outside, negative = inside)
- **Required by:** `RAYMARCH_SURFACE_CORE`, `RAYMARCH_VOLUME_CORE` macros
- **Usage Pattern:**
  ```glsl
  #define getSDF(pos, t) getWaveSDF(pos, t)  // Define macro
  VolumeHit hit;
  RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);  // Use macro
  #undef getSDF  // Clean up macro
  ```
- **Note:** Must be defined before calling raymarching macros, not before including the file

**Example Implementations:**
- `getWaveSDF(pos, time)` - Wave surface SDF
- `getTerrainSDF(pos, params)` - Terrain surface SDF
- `getBuoySDF(pos, time)` - Object SDF

---

### DistanceFieldSystem

**File:** `DistanceFieldSystem.frag`

#### Required Macros

##### `getSDF(pos, time)`
- **Signature:** `float getSDF(vec3 pos, float time)`
- **Purpose:** Signed distance function for distance field raymarching
- **Returns:** Signed distance to nearest surface (positive = outside, negative = inside)
- **Required by:** `DISTANCE_FIELD_RAYMARCH` macro
- **Usage Pattern:**
  ```glsl
  #define getSDF(pos, t) length(pos) - 1.0
  float dist;
  DISTANCE_FIELD_RAYMARCH(start, dir, maxDist, time, dist);
  ```
- **Note:** Must be defined before calling `DISTANCE_FIELD_RAYMARCH`, not before including the file

---

### RenderPipeline System

**File:** `RenderPipeline.frag`

#### Helper Macros (for Scene Extensions)

##### `SURFACE_TERRAIN_TYPE(offset)`
- **Signature:** `SURFACE_TERRAIN_TYPE(int offset)`
- **Purpose:** Helper macro to define terrain-type surface extensions safely
- **Returns:** Even offset value (maps to terrain shading)
- **Usage:**
  ```glsl
  const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);
  ```
- **Note:** `offset` should be sequential (0, 1, 2, ...) - macro ensures even values

##### `SURFACE_OBJECT_TYPE(offset)`
- **Signature:** `SURFACE_OBJECT_TYPE(int offset)`
- **Purpose:** Helper macro to define object-type surface extensions safely
- **Returns:** Odd offset value (maps to object shading)
- **Usage:**
  ```glsl
  const int SURFACE_UNDERWATER_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(0);
  ```
- **Note:** `offset` should be sequential (0, 1, 2, ...) - macro ensures odd values

**Surface Type Extension Pattern:**
```glsl
// In scene file, after including RenderPipeline.frag:
const int SURFACE_MY_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);  // Even = terrain
const int SURFACE_MY_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(0);    // Odd = object
```

---

## Macro Definition Guidelines

### When to Define Macros

1. **Before including the system** - For optional macros that customize behavior
2. **Before calling specific functions** - For required macros used by specific functions
3. **In scene files** - For scene-specific customizations

### Macro Cleanup

- **Always undefine macros** after use if they're system-specific
- **Keep macros defined** if they're used throughout the scene
- **Use `#undef`** to clean up temporary macros

### Best Practices

1. **Document macro contracts** in system headers
2. **Provide sensible defaults** for optional macros
3. **Use descriptive names** that indicate the system (e.g., `WATER_TERRAIN_HEIGHT`)
4. **Follow naming convention:** `<SYSTEM>_<PURPOSE>` for optional macros
5. **Define macros close to usage** to avoid conflicts

## Example: Complete Scene Setup

```glsl
// Scene file: Ocean/Scene.frag

// 1. Define optional macros BEFORE including systems
#define WATER_TERRAIN_HEIGHT(pos, params) getTerrainHeight(pos, params)
#define WATER_SHADING_GET_SDF(pos, t, params) getSceneSDF(pos, t, params)
#define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
#define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)

// 2. Include systems (they will use the macros)
#include "WaterShading.frag"
#include "TerrainShading.frag"
#include "RenderPipeline.frag"

// 3. Define scene-specific surface types using helper macros
const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);
const int SURFACE_UNDERWATER_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(0);

// 4. Use systems normally - macros are already defined
```

## Macro Contract Summary Table

| System | Macro | Type | Required | Default |
|--------|-------|------|----------|---------|
| WaterShading | `WATER_TERRAIN_HEIGHT` | Optional | No | `0.0` |
| WaterShading | `WATER_SHADING_GET_SDF` | Optional | No | (disabled) |
| TerrainShading | `TERRAIN_WAVE_HEIGHT` | Optional | No | `0.0` |
| TerrainShading | `TERRAIN_WAVE_GRADIENT` | Optional | No | `vec2(0.0)` |
| VolumeRaymarching | `getSDF` | Required | Yes | None |
| DistanceFieldSystem | `getSDF` | Required | Yes | None |
| RenderPipeline | `SURFACE_TERRAIN_TYPE` | Helper | No | N/A |
| RenderPipeline | `SURFACE_OBJECT_TYPE` | Helper | No | N/A |

## Notes

- **Macro conflicts:** If multiple systems use `getSDF`, define it locally before each use and undefine after
- **Performance:** Macros are expanded inline - no function call overhead
- **Debugging:** Use `#ifdef` to check if macros are defined
- **Documentation:** Always document macro contracts in system headers

## Future Extensions

When adding new systems with macro contracts:

1. Document the contract in the system header
2. Add to this document
3. Provide sensible defaults for optional macros
4. Follow naming conventions
5. Include usage examples

