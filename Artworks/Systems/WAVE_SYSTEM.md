# Wave System API Documentation

## Overview

The Wave System provides pure wave geometry functions for ocean surface generation. It implements a 10-component wave spectrum based on Tessendorf's "Simulating Ocean Water" (SIGGRAPH 2001) paper. This system has **no dependencies** on Sky, Terrain, or Shading systems - it provides pure geometry functions.

## Key Features

- **10-component wave spectrum** with realistic amplitude and frequency distribution
- **Analytical derivatives** for efficient normal and gradient calculation
- **Temporally stable** phase calculation to prevent precision drift
- **SDF function** for integration with VolumeRaymarching system
- **Micro-detail enhancement** for wave crests to reduce banding

## Constants

### Wave Configuration

```glsl
const int NUM_WAVES = 10;  // Total number of wave components
const vec2 PRIMARY_SWELL_DIR = vec2(0.9578, 0.2873);  // Dominant wind direction
```

### Wave Parameters

The system uses three arrays defining the wave spectrum:

- **`waveAmps[NUM_WAVES]`**: Wave amplitudes in meters (1.4m primary swell down to 0.015m detail waves)
- **`waveNumbers[NUM_WAVES]`**: Wave numbers k in rad/m (0.12 rad/m primary to 8.5 rad/m detail)
- **`waveDirs[NUM_WAVES]`**: Wave directions (pre-normalized, distributed around primary swell)

## Functions

### Wave Direction

#### `vec2 getWaveDir(int i)`
Returns the direction vector for wave component `i`.

**Parameters:**
- `i`: Wave index (0 to NUM_WAVES-1)

**Returns:** Normalized direction vector `vec2`

---

### Wave Height Functions

#### `float getWaveHeight(vec2 pos, float time)`
Calculates the wave height at a given 2D position and time.

**Parameters:**
- `pos`: 2D position (x, z coordinates in world space)
- `time`: Animation time

**Returns:** Wave height in meters (can be positive or negative)

**Example:**
```glsl
float height = getWaveHeight(vec2(10.0, 5.0), iTime);
```

---

#### `vec3 getWaveHeightAndGradient(vec2 pos, float time)`
Computes both wave height and gradient together (optimized for when both are needed).

**Parameters:**
- `pos`: 2D position (x, z coordinates)
- `time`: Animation time

**Returns:** `vec3(height, grad.x, grad.y)` where:
- `x`: Wave height
- `y`: Gradient x-component
- `z`: Gradient y-component

**Example:**
```glsl
vec3 hg = getWaveHeightAndGradient(pos.xz, time);
float height = hg.x;
vec2 gradient = hg.yz;
```

---

### Wave Gradient Functions

#### `vec2 getWaveGradient(vec2 pos, float time)`
Calculates the wave gradient (2D derivative) at a given position.

**Parameters:**
- `pos`: 2D position (x, z coordinates)
- `time`: Animation time

**Returns:** Gradient vector `vec2(grad.x, grad.y)`

**Note:** The gradient is computed analytically from the wave equations, not via finite differences.

**Example:**
```glsl
vec2 grad = getWaveGradient(pos.xz, time);
float slope = length(grad);  // Wave steepness
```

---

### Normal Calculation

#### `vec3 getNormal(vec2 pos, float time, out vec2 gradient)`
Calculates the surface normal from wave gradients with smoothing and micro-detail enhancement.

**Parameters:**
- `pos`: 2D position (x, z coordinates)
- `time`: Animation time
- `gradient`: Output parameter - receives the computed gradient

**Returns:** Normalized surface normal `vec3`

**Features:**
- Temporally stable smoothing using rotated offsets
- Micro-detail enhancement at wave crests
- Reduces aliasing and banding artifacts

**Example:**
```glsl
vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);
```

---

### Angular Frequency

#### `float getAngularFrequency(float k)`
Computes angular frequency w from wave number k using the deep water dispersion relation.

**Parameters:**
- `k`: Wave number in rad/m

**Returns:** Angular frequency w in rad/s

**Formula:** `w = sqrt(g * k)` where `g = 9.81 m/s²`

**Note:** This ensures angular frequencies are always computed from wave numbers, preventing temporal drift.

---

### Signed Distance Function

#### `float getWaveSDF(vec3 pos, float time)`
Signed Distance Function for the wave surface. Used by the VolumeRaymarching system.

**Parameters:**
- `pos`: 3D position in world space
- `time`: Animation time

**Returns:** 
- Positive if above the surface
- Negative if below the surface
- Zero at the surface

**Example:**
```glsl
float dist = getWaveSDF(worldPos, time);
if (dist < 0.001) {
    // Near surface
}
```

---

### Raymarching Integration

#### `VolumeHit raymarchWaveSurface(vec3 start, vec3 dir, float maxDist, float time)`
Raymarches to find the wave surface intersection.

**Parameters:**
- `start`: Ray start position
- `dir`: Ray direction (normalized)
- `maxDist`: Maximum raymarching distance
- `time`: Animation time

**Returns:** `VolumeHit` struct containing:
- `hit`: Whether a surface was hit
- `distance`: Distance traveled
- `position`: Hit position
- `normal`: **Placeholder** - not computed (see note below)
- `gradient`: **Placeholder** - not computed (see note below)
- `valid`: Whether result is valid

**⚠️ IMPORTANT:** Normal and gradient are **NOT** computed by this function to avoid redundant computation. Callers (specifically `RenderPipeline.renderScene()`) must recompute them after position stabilization.

**Example:**
```glsl
VolumeHit hit = raymarchWaveSurface(camPos, rayDir, 150.0, time);
if (hit.hit && hit.valid) {
    // Compute normal after position stabilization
    vec2 gradient;
    vec3 normal = getNormal(hit.position.xz, time, gradient);
}
```

---

## Wave Spectrum Details

The system uses a realistic ocean wave spectrum:

1. **Primary Swell** (index 0): 1.4m amplitude, 0.12 rad/m (~52m wavelength)
2. **Secondary Swell** (index 1): 0.55m amplitude, 0.20 rad/m
3. **Tertiary Swell** (index 2): 0.35m amplitude, 0.32 rad/m
4. **Cross Swell** (index 3): 0.22m amplitude, 0.50 rad/m (perpendicular to primary)
5. **Detail Waves** (indices 4-9): Decreasing amplitudes (0.14m to 0.015m) with increasing frequencies

Wave directions are distributed around the primary swell direction for realistic wave interaction.

## Physics

Waves follow the **deep water dispersion relation**:
- Angular frequency: `w = sqrt(g * k)` where `g = 9.81 m/s²`
- Wave number `k` is in rad/m
- Angular frequency `w` is in rad/s

This ensures waves propagate correctly and maintain temporal stability.

## Performance Notes

- **Analytical derivatives**: Gradients and normals are computed analytically, not via finite differences
- **Optimized height+gradient**: Use `getWaveHeightAndGradient()` when both are needed
- **Temporal stability**: Phase calculations use stable arithmetic to prevent drift
- **Micro-detail**: Only computed at wave crests where needed (reduces cost)

## Examples

### Basic Wave Height Query
```glsl
#include "WaveSystem.frag"

float height = getWaveHeight(vec2(0.0, 0.0), iTime);
```

### Normal Calculation for Shading
```glsl
#include "WaveSystem.frag"

vec2 gradient;
vec3 normal = getNormal(pos.xz, time, gradient);
// Use normal and gradient for shading
```

### Raymarching Integration
```glsl
#include "WaveSystem.frag"
#include "VolumeRaymarching.frag"

VolumeHit hit = raymarchWaveSurface(camPos, rayDir, 150.0, time);
if (hit.hit && hit.valid) {
    // Position is in hit.position
    // Compute normal separately
    vec2 gradient;
    vec3 normal = getNormal(hit.position.xz, time, gradient);
}
```

## References

- Tessendorf, J. "Simulating Ocean Water" (SIGGRAPH 2001)
- Deep water wave dispersion relation: `w² = gk` for deep water

