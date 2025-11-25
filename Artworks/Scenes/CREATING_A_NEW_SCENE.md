# Creating a New Scene

## Overview

This guide walks you through creating a new scene using the available shader systems. A scene is a complete shader entry point that orchestrates multiple systems to render a final image.

## Quick Start

A scene file typically follows this structure:

1. **Include core systems** (Common, MaterialSystem, CameraSystem, etc.)
2. **Define scene-specific geometry** (SDF functions, objects, etc.)
3. **Define macro contracts** (for shading system integration)
4. **Include shading systems** (WaterShading, TerrainShading, etc.)
5. **Include RenderPipeline** (or create custom rendering function)
6. **Implement mainImage()** (shader entry point with camera, rendering, and post-processing)

## Step-by-Step Guide

### Step 1: Create Your Scene File

Create a new `.frag` file in `Artworks/Scenes/YourSceneName/Scene.frag`:

```glsl
// ============================================================================
// YOUR SCENE NAME - SHADER ENTRY POINT
// ============================================================================

#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
```

### Step 2: Include Required Systems

Include the systems you need for your scene:

```glsl
// Core systems (always needed)
#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"

// Geometry systems (choose based on your scene)
#include "../../Systems/GeometrySystems/WaveSystem.frag"        // For water surfaces
#include "../../Systems/GeometrySystems/TerrainSystem.frag"     // For terrain/ground
#include "../../Systems/GeometrySystems/ObjectSystem.frag"      // For 3D objects
#include "../../Systems/CoreSystems/DistanceFieldSystem.frag"
#include "../../Systems/CoreSystems/VolumeRaymarching.frag"

// Shading systems (include after defining macros - see Step 3)
#include "../../Systems/MaterialShading/WaterShading.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/MaterialShading/ObjectShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"

// Pipeline (include last)
#include "../../Systems/Pipeline/RenderPipeline.frag"
```

### Step 3: Define Scene-Specific Geometry

Define your scene's geometry using SDF (Signed Distance Field) functions:

```glsl
// Example: Custom object SDF
float getMyObjectSDF(vec3 p, float time) {
    // Your object definition here
    // Return positive = outside, negative = inside, zero = on surface
    return length(p) - 1.0;  // Simple sphere example
}

// Example: Scene SDF (combines all geometry)
float getSceneSDF(vec3 pos, float time, TerrainParams terrainParams) {
    float terrainDist = getTerrainSDF(pos, terrainParams);
    float objectDist = getMyObjectSDF(pos, time);
    
    // Combine using smooth minimum
    return smoothMinSDF(terrainDist, objectDist, 2.0);
}
```

### Step 4: Define Macro Contracts (If Needed)

If your scene uses water or terrain with special interactions, define macros before including shading systems:

```glsl
// Define macros BEFORE including shading systems

// For WaterShading (if you have terrain under water)
#define WATER_TERRAIN_HEIGHT(pos, params) getTerrainHeight(pos, params)
#define WATER_SHADING_GET_SDF(pos, t, params) getSceneSDF(pos, t, params)

// For TerrainShading (if you have waves above terrain for caustics)
#define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
#define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)

// NOW include shading systems (they will use these macros)
#include "../../Systems/WaterShading.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
```

**Note:** See `MACRO_CONTRACTS.md` for complete documentation of all available macros.

### Step 5: Define Surface Types (If Extending)

If you need custom surface types beyond the generic ones, use helper macros:

```glsl
// After including RenderPipeline.frag
const int SURFACE_MY_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + SURFACE_TERRAIN_TYPE(0);
const int SURFACE_MY_OBJECT = SURFACE_SCENE_EXTENSION_BASE + SURFACE_OBJECT_TYPE(0);
```

**Generic surface types available:**
- `SURFACE_PRIMARY` - Main surface (water, ground, floor, etc.)
- `SURFACE_SECONDARY` - Secondary surface (terrain, floor, etc.)
- `SURFACE_OBJECT` - Interactive objects
- `SURFACE_VOLUME` - Volumetric surfaces

### Step 6: Create Rendering Function

You can either use the generic `renderScene()` from RenderPipeline, or create a custom rendering function:

#### Option A: Use Generic RenderPipeline

```glsl
#include "../../Systems/Pipeline/RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Setup camera, sky, materials...
    RenderContext ctx;
    // ... populate ctx ...
    
    RenderResult result = renderScene(ctx);
    vec3 color = result.color;
    
    // Post-processing...
    fragColor = vec4(color, 1.0);
}
```

#### Option B: Custom Rendering Function

```glsl
RenderResult renderMyScene(RenderContext ctx) {
    // Raymarch your surfaces
    VolumeHit waterHit = raymarchWaveSurface(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    VolumeHit terrainHit = raymarchTerrain(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time, ctx.terrainParams);
    
    // Determine closest hit
    SurfaceHit surfaceHit;
    // ... determine which surface was hit ...
    
    // Compose final color
    vec3 color = composeFinalColor(surfaceHit, ctx);
    
    RenderResult result;
    result.color = color;
    result.hit = surfaceHit.hit;
    result.hitPosition = surfaceHit.position;
    result.distance = surfaceHit.distance;
    return result;
}
```

### Step 7: Implement mainImage()

The `mainImage()` function is the shader entry point:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 1. Setup camera
    Camera cam = createDefaultCamera();
    cam.position = vec3(0.0, 5.0, 10.0);
    cam.target = vec3(0.0, 0.0, 0.0);
    cam.focalLength = 50.0;  // 50mm lens
    
    // 2. Generate camera ray
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rayDir = generateCameraRay(cam, uv, iResolution.xy);
    
    // 3. Create sky configuration
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    // Or customize: sky.sunMoon.sunElevation = 0.3;
    
    // 4. Create terrain configuration
    TerrainParams terrainParams = createFlatTerrain();
    // Or use: createMountainTerrain(), createPlainsTerrain(), etc.
    
    // 5. Create materials
    WaterMaterial waterMaterial = createDefaultWaterMaterial();
    TerrainMaterial terrainMaterial = createDefaultTerrainMaterial();
    ObjectMaterial objectMaterial = createDefaultObjectMaterial();
    
    // 6. Create render context
    RenderContext ctx;
    ctx.cameraPos = cam.position;
    ctx.rayDir = rayDir;
    ctx.time = iTime;
    ctx.sky = sky;
    ctx.terrainParams = terrainParams;
    ctx.camera = cam;
    ctx.waterMaterial = waterMaterial;
    ctx.terrainMaterial = terrainMaterial;
    ctx.objectMaterial = objectMaterial;
    
    // 7. Render scene
    RenderResult result = renderScene(ctx);  // Or renderMyScene(ctx)
    vec3 color = result.color;
    
    // 8. Post-processing
    // Atmospheric fog
    color = applyAtmosphericFog(color, result.hitPosition, ctx.cameraPos, ctx.rayDir, sky, ctx.time);
    
    // Camera exposure
    color = applyExposure(color, cam);
    
    // Depth of field (if enabled)
    if (cam.enableDOF) {
        color = applyDepthOfField(color, result.distance, cam);
    }
    
    // Tone mapping
    color = toneMapReinhardJodie(color);  // Or your own tone mapping
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
```

## Available Systems

### GeometrySystems

#### WaveSystem
- **Purpose:** Ocean wave geometry
- **Key Functions:**
  - `getWaveHeight(pos, time)` - Get wave height at 2D position
  - `getWaveGradient(pos, time)` - Get wave gradient
  - `getNormal(pos, time, gradient)` - Get surface normal
  - `raymarchWaveSurface(start, dir, maxDist, time)` - Raymarch to wave surface
- **Presets:** None (uses fixed wave spectrum)
- **Documentation:** `WAVE_SYSTEM.md`

#### TerrainSystem
- **Purpose:** Procedural terrain generation
- **Key Functions:**
  - `getTerrainHeight(pos, params)` - Get terrain height at 2D position
  - `getTerrainNormal(pos, params)` - Get terrain normal
  - `raymarchTerrain(start, dir, maxDist, time, params)` - Raymarch to terrain
- **Presets:**
  - `createDefaultTerrain()` - Standard terrain
  - `createFlatTerrain()` - Flat/low-poly terrain
  - `createMountainTerrain()` - Mountainous terrain
  - `createHillyTerrain()` - Hilly terrain
  - `createPlainsTerrain()` - Flat plains
- **Documentation:** `TERRAIN_SYSTEM.md`

#### ObjectSystem
- **Purpose:** 3D object SDF utilities
- **Key Functions:**
  - `sdSphere(p, r)` - Sphere SDF
  - `sdBox(p, size)` - Box SDF
  - `sdCylinder(p, h, r)` - Cylinder SDF
  - `opUnion(a, b)` - Union operation
  - `opSmoothUnion(a, b, k)` - Smooth union
- **Documentation:** `OBJECT_SYSTEM.md` (if exists)

### Shading Systems

#### WaterShading
- **Purpose:** Water surface shading with PBR, refraction, reflection
- **Key Functions:**
  - `shadeWater(params)` - Shade water surface
- **Macros Required (Optional):**
  - `WATER_TERRAIN_HEIGHT(pos, params)` - For water depth calculation
  - `WATER_SHADING_GET_SDF(pos, t, params)` - For translucency
- **Documentation:** `WATER_SHADING.md`

#### TerrainShading
- **Purpose:** Terrain surface shading with caustics
- **Key Functions:**
  - `shadeTerrain(params)` - Shade terrain surface
- **Macros Required (Optional):**
  - `TERRAIN_WAVE_HEIGHT(pos, time)` - For caustics
  - `TERRAIN_WAVE_GRADIENT(pos, time)` - For caustics focus
- **Documentation:** `TERRAIN_SHADING.md`

#### ObjectShading
- **Purpose:** Object surface shading with PBR
- **Key Functions:**
  - `shadeObject(params)` - Shade object surface
- **Documentation:** `OBJECT_SHADING.md` (if exists)

### Atmosphere & Lighting

#### SkySystem
- **Purpose:** Sky, atmosphere, and lighting
- **Key Functions:**
  - `evaluateSky(sky, dir, time)` - Get sky color for direction
  - `evaluateLighting(sky, time)` - Get lighting information
  - `applyAtmosphericFog(color, pos, camPos, rayDir, sky, time)` - Apply fog
- **Presets:**
  - `createSkyPreset_ClearDay()` - Bright sunny day
  - `createSkyPreset_Sunset()` - Sunset/sunrise
  - `createSkyPreset_Night()` - Starlit night
  - `createSkyPreset_CloudyDay()` - Overcast day
  - `createSkyPreset_Stormy()` - Dark stormy sky
  - `createSkyPreset_Foggy()` - Foggy/hazy atmosphere
- **Documentation:** `SKY_SYSTEM.md`

#### CameraSystem
- **Purpose:** Camera configuration and ray generation
- **Key Functions:**
  - `generateCameraRay(cam, uv, resolution)` - Generate camera ray
  - `applyExposure(color, cam)` - Apply camera exposure
  - `applyDepthOfField(color, distance, cam)` - Apply depth of field
- **Presets:**
  - `createDefaultCamera()` - Standard camera
  - `createSunnyDayCamera()` - Bright day camera
  - `createLowLightCamera()` - Low light camera
- **Documentation:** `CAMERA_SYSTEM.md`

### Material System

#### MaterialSystem
- **Purpose:** Material properties and presets
- **Material Types:**
  - `WaterMaterial` - Water surface materials
  - `TerrainMaterial` - Terrain surface materials
  - `ObjectMaterial` - Object surface materials
- **Water Presets:**
  - `createDefaultWaterMaterial()` - Realistic water
  - `createClearTropicalWater()` - Clear tropical water
  - `createMurkyWater()` - Murky/muddy water
  - `createChoppyWater()` - Rough/choppy water
- **Terrain Presets:**
  - `createDefaultTerrainMaterial()` - Standard terrain
  - `createSandyTerrainMaterial()` - Sandy terrain
  - `createRockyTerrainMaterial()` - Rocky terrain
- **Documentation:** `MATERIAL_SYSTEM.md`

### Pipeline System

#### RenderPipeline
- **Purpose:** Orchestrates all rendering systems
- **Key Functions:**
  - `renderScene(ctx)` - Main rendering function
  - `composeFinalColor(hit, ctx)` - Compose final color from surface hit
- **Documentation:** `RENDER_PIPELINE.md`

## Common Scene Patterns

### Pattern 1: Simple Terrain Scene

```glsl
// No water, just terrain
#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/GeometrySystems/TerrainSystem.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/Pipeline/RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    Camera cam = createDefaultCamera();
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rayDir = generateCameraRay(cam, uv, iResolution.xy);
    
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    TerrainParams terrain = createMountainTerrain();
    TerrainMaterial terrainMat = createDefaultTerrainMaterial();
    
    RenderContext ctx;
    ctx.cameraPos = cam.position;
    ctx.rayDir = rayDir;
    ctx.time = iTime;
    ctx.sky = sky;
    ctx.terrainParams = terrain;
    ctx.camera = cam;
    ctx.terrainMaterial = terrainMat;
    
    RenderResult result = renderScene(ctx);
    vec3 color = result.color;
    
    // Post-processing...
    fragColor = vec4(color, 1.0);
}
```

### Pattern 2: Ocean Scene (Water + Terrain)

```glsl
// Water surface with terrain below
#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/GeometrySystems/WaveSystem.frag"
#include "../../Systems/GeometrySystems/TerrainSystem.frag"
#include "../../Systems/CoreSystems/DistanceFieldSystem.frag"
#include "../../Systems/CoreSystems/VolumeRaymarching.frag"

// Define macros BEFORE including shading systems
#define WATER_TERRAIN_HEIGHT(pos, params) getTerrainHeight(pos, params)
#define TERRAIN_WAVE_HEIGHT(pos, time) getWaveHeight(pos, time)
#define TERRAIN_WAVE_GRADIENT(pos, time) getWaveGradient(pos, time)

#include "../../Systems/MaterialShading/WaterShading.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/Pipeline/RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // ... setup and render ...
}
```

### Pattern 3: Custom Object Scene

```glsl
// Custom objects with terrain
#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/GeometrySystems/TerrainSystem.frag"
#include "../../Systems/GeometrySystems/ObjectSystem.frag"
#include "../../Systems/CoreSystems/DistanceFieldSystem.frag"
#include "../../Systems/CoreSystems/VolumeRaymarching.frag"

// Define custom object
float getMyObjectSDF(vec3 p, float time) {
    return length(p) - 1.0;  // Sphere
}

// Raymarch custom object
VolumeHit raymarchMyObject(vec3 start, vec3 dir, float maxDist, float time) {
    #define getSDF(pos, t) getMyObjectSDF(pos, t)
    VolumeHit hit;
    RAYMARCH_SURFACE_CORE(start, dir, maxDist, time, hit);
    #undef getSDF
    return hit;
}

#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/MaterialShading/ObjectShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/Pipeline/RenderPipeline.frag"

RenderResult renderMyScene(RenderContext ctx) {
    // Custom rendering logic combining terrain and objects
    VolumeHit terrainHit = raymarchTerrain(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time, ctx.terrainParams);
    VolumeHit objectHit = raymarchMyObject(ctx.cameraPos, ctx.rayDir, MAX_DIST, ctx.time);
    
    // Determine closest hit and compose color...
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // ... setup ...
    RenderResult result = renderMyScene(ctx);
    // ... post-processing ...
}
```

## Best Practices

### 1. Include Order Matters

1. Core systems first (Common, MaterialSystem, CameraSystem)
2. Geometry systems (WaveSystem, TerrainSystem, ObjectSystem)
3. Define macros (if needed)
4. Shading systems (WaterShading, TerrainShading, ObjectShading)
5. SkySystem
6. RenderPipeline (last)

### 2. Macro Contracts

- Define macros **BEFORE** including the shading systems that use them
- Use `#undef` to clean up macros if they're only needed temporarily
- See `MACRO_CONTRACTS.md` for complete documentation

### 3. Material Customization

- Start with presets, then customize properties
- Materials are art-directable (can be tweaked without recompilation)
- Use descriptive preset names for clarity

### 4. Performance

- Use early exit optimizations in custom rendering functions
- Consider skipping raymarching for surfaces that won't be visible
- Use appropriate terrain presets (flat terrain is faster than mountains)

### 5. Surface Types

- Use generic surface types (`SURFACE_PRIMARY`, `SURFACE_SECONDARY`, `SURFACE_OBJECT`) when possible
- Only define custom surface types if you need special shading behavior
- Use helper macros (`SURFACE_TERRAIN_TYPE`, `SURFACE_OBJECT_TYPE`) for extensions

### 6. Post-Processing Order

Apply post-processing in this order:
1. Atmospheric fog
2. Camera exposure
3. Depth of field (if enabled)
4. Tone mapping
5. Gamma correction

## Example: Complete Minimal Scene

Here's a complete minimal scene that renders a simple terrain:

```glsl
// ============================================================================
// MINIMAL TERRAIN SCENE
// ============================================================================

#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/GeometrySystems/TerrainSystem.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/Pipeline/RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Camera
    Camera cam = createDefaultCamera();
    cam.position = vec3(0.0, 5.0, 10.0);
    cam.target = vec3(0.0, 0.0, 0.0);
    
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rayDir = generateCameraRay(cam, uv, iResolution.xy);
    
    // Sky and terrain
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    TerrainParams terrain = createPlainsTerrain();
    TerrainMaterial terrainMat = createDefaultTerrainMaterial();
    
    // Render context
    RenderContext ctx;
    ctx.cameraPos = cam.position;
    ctx.rayDir = rayDir;
    ctx.time = iTime;
    ctx.sky = sky;
    ctx.terrainParams = terrain;
    ctx.camera = cam;
    ctx.terrainMaterial = terrainMat;
    
    // Render
    RenderResult result = renderScene(ctx);
    vec3 color = result.color;
    
    // Post-processing
    color = applyAtmosphericFog(color, result.hitPosition, ctx.cameraPos, ctx.rayDir, sky, ctx.time);
    color = applyExposure(color, cam);
    color = toneMapReinhardJodie(color);
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
```

## Reference Documentation

For detailed information on each system, see:

- `Artworks/Systems/SYSTEM_ARCHITECTURE.md` - Overall architecture and extension patterns
- `Artworks/Systems/MACRO_CONTRACTS.md` - Complete macro contract documentation
- `Artworks/Systems/Pipeline/RENDER_PIPELINE.md` - Render pipeline API documentation
- `Artworks/Systems/GeometrySystems/WAVE_SYSTEM.md` - Wave system documentation
- `Artworks/Systems/GeometrySystems/TERRAIN_SYSTEM.md` - Terrain system documentation
- `Artworks/Systems/CoreSystems/SKY_SYSTEM.md` - Sky system documentation
- `Artworks/Systems/MaterialShading/MATERIAL_SYSTEM.md` - Material system documentation
- `Artworks/Systems/CoreSystems/CAMERA_SYSTEM.md` - Camera system documentation

## Getting Help

1. Check the example scene: `Artworks/Scenes/Ocean/Scene.frag`
2. Review system documentation files in `Artworks/Systems/`
3. Check macro contracts in `Artworks/Systems/MACRO_CONTRACTS.md`
4. Review architecture patterns in `Artworks/Systems/SYSTEM_ARCHITECTURE.md`

