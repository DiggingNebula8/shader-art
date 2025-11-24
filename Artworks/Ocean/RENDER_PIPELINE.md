# Render Pipeline API Documentation

## Overview

The Render Pipeline orchestrates all rendering systems to produce the final scene. It coordinates wave geometry, terrain geometry, water shading, terrain shading, sky system, and raymarching to render a complete ocean scene.

## Key Responsibilities

- **Orchestration**: Coordinates all rendering systems
- **Raymarching**: Finds surface intersections using VolumeRaymarching
- **Shading**: Delegates to WaterShading and TerrainShading systems
- **Composition**: Combines all contributions into final color

## Dependencies

The Render Pipeline includes and coordinates:
- **MaterialSystem**: Material properties and factory functions
- **WaveSystem**: Wave geometry and raymarching
- **TerrainSystem**: Terrain geometry and raymarching
- **WaterShading**: Water material properties and PBR shading
- **TerrainShading**: Terrain material properties and caustics
- **SkySystem**: Atmosphere and lighting
- **VolumeRaymarching**: Unified raymarching algorithm
- **CameraSystem**: Camera parameters (for future use)

## Structures

### `RenderContext`
Input context for rendering.

```glsl
struct RenderContext {
    vec3 cameraPos;        // Camera position in world space
    vec3 rayDir;           // Ray direction (normalized)
    float time;            // Animation time
    SkyAtmosphere sky;     // Sky configuration
    TerrainParams terrainParams;  // Terrain configuration
    Camera camera;         // Camera parameters
    WaterMaterial waterMaterial;  // Water material properties (art-directable)
};
```

### `RenderResult`
Result from scene rendering.

```glsl
struct RenderResult {
    vec3 color;        // Final rendered color
    bool hit;          // Whether a surface was hit
    vec3 hitPosition;  // Hit position (for fog calculation)
    float distance;    // Ray distance (for DOF and fog)
};
```

### `SurfaceHit`
Internal structure for surface intersection data.

```glsl
struct SurfaceHit {
    bool hit;          // Whether surface was hit
    vec3 position;     // Hit position
    vec3 normal;       // Surface normal
    vec2 gradient;     // Wave gradient (for water)
    float distance;    // Ray distance
    int surfaceType;   // SURFACE_WATER or SURFACE_TERRAIN
};
```

### Surface Type Constants

```glsl
const int SURFACE_WATER = 0;
const int SURFACE_TERRAIN = 1;
```

## Main Function

### `RenderResult renderScene(RenderContext ctx)`
Main scene rendering function. Called by `Scene.frag` to render the complete scene.

**Parameters:**
- `ctx`: `RenderContext` struct containing camera, ray, time, sky, and terrain configuration

**Returns:** `RenderResult` struct with final color and hit information

**Process:**
1. Raymarches to water surface using `WaveSystem.raymarchWaveSurface()`
2. Stabilizes hit position to reduce jittering
3. Computes normal and gradient from stabilized position
4. Composes final color using `composeFinalColor()`
5. Returns color and hit data

**Example:**
```glsl
#include "RenderPipeline.frag"
#include "SkySystem.frag"
#include "CameraSystem.frag"

// Create water material (art-directable)
WaterMaterial waterMaterial = createDefaultWaterMaterial();
// Or use presets: createClearTropicalWater(), createMurkyWater(), createChoppyWater()

// Create render context
RenderContext ctx;
ctx.cameraPos = cam.position;
ctx.rayDir = rayDir;
ctx.time = iTime;
ctx.sky = createSkyPreset_ClearDay();
ctx.terrainParams = createDefaultOceanFloor();
ctx.camera = cam;
ctx.waterMaterial = waterMaterial;

// Render scene
RenderResult result = renderScene(ctx);
vec3 color = result.color;

// Use hit information for post-processing
if (result.hit) {
    // Apply fog, DOF, etc. using result.distance and result.hitPosition
}
```

---

## Internal Functions

### `vec3 composeFinalColor(SurfaceHit hit, RenderContext ctx)`
Composes final color from all contributions. Internal function used by `renderScene()`.

**Parameters:**
- `hit`: `SurfaceHit` struct with intersection data
- `ctx`: `RenderContext` with rendering configuration

**Returns:** Final shaded color `vec3`

**Process:**
- If no hit: Returns sky color
- If water surface: Uses `WaterShading.shadeWater()`
- If terrain surface: Uses `TerrainShading.shadeTerrain()`

**Note:** This function is internal and typically not called directly by users.

---

## Position Stabilization

The pipeline implements position stabilization to reduce jittering:

1. **Snap XZ coordinates** to a small grid (0.0005 units)
2. **Recalculate Y** from snapped XZ using `getWaveHeight()`
3. **Compute normal/gradient** from stabilized position

This ensures consistent sampling and reduces temporal aliasing.

---

## Integration with Scene.frag

The Render Pipeline is called from `Scene.frag` (the shader entry point):

```glsl
// In Scene.frag
#include "RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Setup camera, sky, terrain...
    
    RenderContext ctx;
    // ... populate ctx ...
    
    RenderResult result = renderScene(ctx);
    vec3 color = result.color;
    
    // Post-processing (fog, exposure, DOF, tone mapping, gamma)
    // ...
    
    fragColor = vec4(color, 1.0);
}
```

---

## System Coordination

The Render Pipeline coordinates systems in this order:

1. **Raymarching** (`WaveSystem.raymarchWaveSurface()`)
   - Finds water surface intersection
   - Returns hit position (normal/gradient not computed)

2. **Position Stabilization**
   - Snaps XZ coordinates
   - Recalculates Y from wave height

3. **Normal/Gradient Computation** (`WaveSystem.getNormal()`)
   - Computed once from stabilized position
   - Avoids redundant computation

4. **Shading** (`WaterShading.shadeWater()`)
   - Calculates depth, refraction, reflection
   - Applies PBR lighting
   - Returns final color

5. **Composition**
   - Combines all contributions
   - Returns final result

---

## Performance Notes

- **Single normal computation**: Normal/gradient computed once after position stabilization
- **Deferred computation**: `raymarchWaveSurface()` doesn't compute normals to avoid redundancy
- **Position stabilization**: Reduces jittering and improves temporal stability
- **System delegation**: Refraction/reflection handled by WaterShading system

---

## Examples

### Basic Usage
```glsl
#include "MaterialSystem.frag"
#include "RenderPipeline.frag"
#include "SkySystem.frag"

SkyAtmosphere sky = createSkyPreset_ClearDay();
TerrainParams terrain = createDefaultOceanFloor();
WaterMaterial waterMaterial = createDefaultWaterMaterial();

RenderContext ctx;
ctx.cameraPos = vec3(0.0, 5.0, 10.0);
ctx.rayDir = normalize(vec3(0.0, -0.5, -1.0));
ctx.time = iTime;
ctx.sky = sky;
ctx.terrainParams = terrain;
ctx.camera = createDefaultCamera();
ctx.waterMaterial = waterMaterial;

RenderResult result = renderScene(ctx);
vec3 color = result.color;
```

### With Post-Processing
```glsl
RenderResult result = renderScene(ctx);
vec3 color = result.color;

// Apply fog based on distance
if (!result.hit) {
    float fogFactor = 1.0 - exp(-result.distance * 0.01);
    color = mix(color, vec3(0.5, 0.7, 1.0), fogFactor);
}

// Apply exposure
color = applyExposure(color, ctx.camera);

// Apply depth of field
color = applyDepthOfField(color, result.distance, ctx.camera);
```

---

## Notes

- **Normal computation**: The pipeline computes normals after position stabilization to ensure consistency
- **System boundaries**: Refraction and reflection are handled by WaterShading, not RenderPipeline
- **Future extensibility**: Structure supports terrain surfaces (currently only water is used)

