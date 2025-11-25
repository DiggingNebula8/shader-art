# Volume Raymarching System API Documentation

## Overview

The Volume Raymarching System provides a unified raymarching algorithm for all systems. It implements sphere tracing (distance field raymarching) based on Hart 1996. This system defines the `VolumeHit` struct and raymarching algorithm macros that systems use with their own SDF functions.

## Key Features

- **Unified algorithm**: Single source of truth for all raymarching
- **Macro-based**: Systems define `getSDF()` macro and use algorithm macros
- **Surface and volume**: Supports both surface and volume raymarching
- **Robust**: Handles edge cases and prevents NaN/Inf issues

## Structure

### `VolumeHit`
Raymarching result structure.

```glsl
struct VolumeHit {
    bool hit;           // Did we hit something?
    float distance;     // Distance traveled
    vec3 position;      // Hit position
    vec3 normal;        // Surface normal (if surface hit)
    vec2 gradient;      // Surface gradient (for wave systems, etc.)
    bool valid;         // Is the result valid? (prevents NaN/Inf issues)
};
```

## Algorithm Macros

### `RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit)`
Surface raymarching algorithm macro. Expands to code that performs surface raymarching.

**Parameters:**
- `start`: Ray start position `vec3`
- `dir`: Ray direction `vec3` (normalized)
- `maxDist`: Maximum raymarching distance `float`
- `time`: Animation time `float`
- `hit`: `VolumeHit` variable (must be declared before macro)

**Requirements:**
- `getSDF(pos, time)` macro must be defined before use
- `hit` variable must be declared before macro
- `getSDF` macro should be undefined after use

**Process:**
1. Iterates up to `MAX_STEPS` times
2. Samples SDF at current position
3. Steps forward by distance * safety factor
4. Refines position when near surface
5. Sets hit information when surface found
6. Handles max distance and edge cases

**Example:**
```glsl
#include "VolumeRaymarching.frag"

// Define SDF function macro
#define getSDF(pos, time) getWaveSDF(pos, time)

// Declare hit variable
VolumeHit hit;

// Use raymarching macro
RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);

// Undefine macro
#undef getSDF

// Use result
if (hit.hit && hit.valid) {
    vec3 pos = hit.position;
    float dist = hit.distance;
}
```

---

### `RAYMARCH_VOLUME_CORE(start, dir, maxDist, time, hit)`
Volume raymarching algorithm macro. Expands to code that performs volume raymarching.

**Parameters:**
- `start`: Ray start position `vec3`
- `dir`: Ray direction `vec3` (normalized)
- `maxDist`: Maximum raymarching distance `float`
- `time`: Animation time `float`
- `hit`: `VolumeHit` variable (must be declared before macro)

**Requirements:**
- `getSDF(pos, time)` macro must be defined before use
- `hit` variable must be declared before macro
- `getSDF` macro should be undefined after use

**Note:** Volume raymarching is similar to surface raymarching but optimized for volume traversal.

**Example:**
```glsl
#define getSDF(pos, time) getTerrainSDF(pos, params)

VolumeHit hit;
RAYMARCH_VOLUME_CORE(start, dir, maxDist, time, hit);

#undef getSDF
```

---

## System Integration

Systems integrate with VolumeRaymarching by:

1. **Defining SDF function**: Create `getSDF()` macro that calls system-specific SDF
2. **Using macro**: Call `RAYMARCH_SURFACE_CORE` or `RAYMARCH_VOLUME_CORE`
3. **Cleaning up**: Undefine `getSDF()` macro after use

### Example: WaveSystem Integration

```glsl
// In WaveSystem.frag
#include "VolumeRaymarching.frag"

VolumeHit raymarchWaveSurface(vec3 start, vec3 dir, float maxDist, float time) {
    #define getSDF(pos, time) getWaveSDF(pos, time)
    
    VolumeHit hit;
    RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);
    
    #undef getSDF
    return hit;
}
```

### Example: TerrainSystem Integration

```glsl
// In TerrainSystem.frag
#include "VolumeRaymarching.frag"

VolumeHit raymarchTerrain(vec3 start, vec3 dir, float maxDist, float time, TerrainParams params) {
    #define getSDF(pos, t) getTerrainSDF(pos, params)
    
    VolumeHit hit;
    RAYMARCH_VOLUME_CORE(start, dir, maxDist, time, hit);
    
    if (hit.hit && hit.valid) {
        hit.normal = getTerrainNormal(hit.position, params);
    }
    
    #undef getSDF
    return hit;
}
```

---

## Algorithm Details

### Step Size Calculation
- Uses adaptive step size: `clamp(h * 0.4, MIN_DIST * 0.5, 1.0)`
- Prevents overshooting surface
- Handles edge cases where distance increases

### Position Refinement
- Refines position when near surface (`abs(h) < MIN_DIST * 1.5`)
- Uses sub-step refinement for accuracy
- Prevents surface penetration

### Edge Case Handling
- Checks for distance increase (prevents infinite loops)
- Handles max distance exceeded
- Sets `valid` flag to prevent NaN/Inf issues

---

## Constants

Defined in `Common.frag`:

- `MAX_STEPS`: 1000 - Maximum raymarching iterations
- `MIN_DIST`: 0.001 - Minimum distance threshold for surface intersection
- `MAX_DIST`: 150.0 - Maximum raymarching distance (default)

---

## Best Practices

1. **Always check `hit.valid`**: Ensures result is valid before use
2. **Undefine macros**: Clean up `getSDF()` macro after use
3. **Use appropriate macro**: Use `RAYMARCH_SURFACE_CORE` for surfaces, `RAYMARCH_VOLUME_CORE` for volumes
4. **Compute normals separately**: Macros set placeholder normals; compute actual normals after raymarching

---

## Examples

### Basic Surface Raymarching
```glsl
#include "VolumeRaymarching.frag"

// Define custom SDF
float mySDF(vec3 pos, float time) {
    return length(pos) - 1.0;  // Sphere
}

// Raymarch
#define getSDF(pos, time) mySDF(pos, time)

VolumeHit hit;
RAYMARCH_SURFACE_CORE(vec3(0.0, 0.0, 5.0), vec3(0.0, 0.0, -1.0), 10.0, 0.0, hit);

#undef getSDF

if (hit.hit && hit.valid) {
    // Surface found at hit.position
}
```

### Volume Raymarching with Normal Computation
```glsl
#define getSDF(pos, time) getTerrainSDF(pos, params)

VolumeHit hit;
RAYMARCH_VOLUME_CORE(start, dir, maxDist, time, hit);

#undef getSDF

if (hit.hit && hit.valid) {
    // Compute normal separately
    vec3 normal = getTerrainNormal(hit.position, params);
}
```

---

## References

- Hart, J. C. "Sphere Tracing: A Geometric Method for the Antialiased Ray Tracing of Implicit Surfaces" (1996)
- Distance Field Raymarching techniques

