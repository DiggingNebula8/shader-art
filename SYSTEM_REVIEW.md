# System Review: Non-Generic Functionalities

## Overview
This document identifies non-generic functionalities in the systems that should be made generic or moved to scene-specific files.

## Issues Found

### 1. **DistanceFieldSystem.frag** - Ocean Scene-Specific SDF Definitions

**Location:** Lines 134-165

**Issue:** Contains Ocean-scene-specific functions `getSceneSDF()` and `getSceneNormal()` that hardcode calls to:
- `getTerrainSDF()` (from TerrainSystem)
- `getBuoySDF()` (from ObjectSystem - Ocean-specific)
- `getTerrainNormal()` (from TerrainSystem)
- `getBuoyNormal()` (from ObjectSystem - Ocean-specific)

**Impact:** This makes DistanceFieldSystem non-generic. It cannot be reused for other scenes without modification.

**Recommendation:** 
- Move `getSceneSDF()` and `getSceneNormal()` to the Ocean scene file (Scene.frag)
- Keep only generic distance field algorithms and macros in DistanceFieldSystem.frag
- The API functions (`getDistanceToSurface`, `getDistanceFieldInfo`, etc.) should accept a generic SDF function pointer or macro

**Current Code:**
```glsl
float getSceneSDF(vec3 pos, float time, TerrainParams terrainParams) {
    float terrainDist = getTerrainSDF(pos, terrainParams);
    float objectDist = getBuoySDF(pos, time);  // Ocean-specific!
    return smoothMinSDF(terrainDist, objectDist, smoothK);
}
```

---

### 2. **ObjectSystem.frag** - Ocean-Specific Buoy Object

**Location:** Lines 58-132

**Issue:** Contains Ocean-scene-specific object definitions:
- `getBuoySDF()` - Creates a specific buoy object (cylinder + sphere + pole + flag)
- `getBuoyNormal()` - Normal calculation for buoy
- `raymarchBuoy()` - Raymarching wrapper for buoy

**Impact:** ObjectSystem should provide generic object primitives (spheres, boxes, cylinders) and operations, not scene-specific objects.

**Recommendation:**
- Move `getBuoySDF()`, `getBuoyNormal()`, and `raymarchBuoy()` to the Ocean scene file
- Keep only generic SDF primitives (`sdSphere`, `sdCylinder`, `sdBox`) and operations (`opUnion`, `opSmoothUnion`, etc.) in ObjectSystem.frag
- ObjectSystem should be a library of primitives, not scene objects

**Current Code:**
```glsl
float getBuoySDF(vec3 p, float time) {
    // Buoy floats on water, so we need to account for wave height
    vec2 buoyBasePos = vec2(0.0, 0.0);
    float waterHeight = getWaveHeight(buoyBasePos, time);  // Ocean-specific!
    // ... creates specific buoy geometry
}
```

---

### 3. **RenderPipeline.frag** - Hardcoded Scene-Specific Raymarching

**Location:** Lines 181-209

**Issue:** Hardcodes calls to scene-specific raymarching functions:
- `raymarchBuoy()` - Ocean-specific
- `raymarchWaveSurface()` - Ocean-specific (waves)
- `raymarchTerrain()` - Generic, but used in Ocean-specific way

Also hardcodes Ocean-specific logic:
- Line 204: `getWaveHeight()` - Checks if terrain is above water level

**Impact:** RenderPipeline cannot be reused for other scenes. It's tightly coupled to the Ocean scene structure.

**Recommendation:**
- Make RenderPipeline accept a scene configuration structure that defines:
  - Which surfaces to raymarch
  - Surface type constants
  - Surface-specific logic (like water level checks)
- Or move the Ocean-specific rendering logic to Scene.frag and keep RenderPipeline as a generic orchestrator

**Current Code:**
```glsl
RenderResult renderScene(RenderContext ctx) {
    VolumeHit objectHit = raymarchBuoy(...);  // Ocean-specific!
    VolumeHit waterHit = raymarchWaveSurface(...);  // Ocean-specific!
    VolumeHit terrainHit = raymarchTerrain(...);
    
    // Ocean-specific logic:
    float terrainWaterHeight = getWaveHeight(terrainHit.position.xz, ctx.time);
    if (terrainHit.position.y > terrainWaterHeight) {
        // ...
    }
}
```

---

### 4. **TerrainSystem.frag** - Ocean-Specific Preset Name ✅ FIXED

**Location:** Line 186

**Issue:** Contains preset `createDefaultOceanFloor()` with Ocean-specific name.

**Impact:** Minor - the preset itself is generic (just terrain parameters), but the name suggests it's Ocean-specific.

**Status:** ✅ **FIXED** - Renamed to `createFlatTerrain()` for generic use. All references updated in code and documentation.

**Fixed Code:**
```glsl
TerrainParams createFlatTerrain() {
    TerrainParams params = initTerrainParams();
    params.baseHeight = -105.0;
    // ... generic flat terrain configuration
}
```

---

### 5. **RenderPipeline.frag** - Hardcoded Surface Types ✅ ACCEPTABLE

**Location:** Lines 52-55

**Issue:** Defines surface type constants (`SURFACE_WATER`, `SURFACE_TERRAIN`, `SURFACE_OBJECT`) that are Ocean-scene-specific.

**Impact:** Other scenes might have different surface types (e.g., clouds, fog volumes, etc.).

**Status:** ✅ **ACCEPTABLE** - These are just enum-like constants used for type identification. They don't contain hardcoded logic and can be extended for other scenes. The constants themselves are fine; the issue is the hardcoded logic that uses them (which is addressed in issue #3).

**Current Code:**
```glsl
const int SURFACE_WATER = 0;
const int SURFACE_TERRAIN = 1;
const int SURFACE_OBJECT = 2;
```

---

### 6. **RenderPipeline.frag** - Hardcoded Water Surface Logic

**Location:** Lines 220-242

**Issue:** Contains Ocean-specific water surface handling:
- Uses `getWaveHeight()` and `getNormal()` from WaveSystem
- Hardcodes water surface position stabilization logic

**Impact:** This logic is specific to wave-based water surfaces. Other scenes might have different water implementations.

**Recommendation:**
- Extract water surface handling to a separate function or make it configurable
- Or move Ocean-specific water handling to Scene.frag

---

## Summary

### Critical Issues (Must Fix):
1. **DistanceFieldSystem.frag** - Scene-specific SDF definitions ✅ FIXED
2. **ObjectSystem.frag** - Scene-specific object (buoy) ✅ FIXED
3. **RenderPipeline.frag** - Hardcoded scene-specific raymarching and logic ✅ FIXED

### Minor Issues:
4. **TerrainSystem.frag** - Ocean-specific preset name ✅ FIXED
5. **RenderPipeline.frag** - Hardcoded surface types ✅ ACCEPTABLE (constants are fine)

### Generic Systems (No Issues):
- ✅ **CameraSystem.frag** - Fully generic
- ✅ **Common.frag** - Fully generic
- ✅ **MaterialSystem.frag** - Fully generic
- ✅ **ObjectShading.frag** - Fully generic
- ✅ **SkySystem.frag** - Fully generic
- ✅ **TerrainShading.frag** - Generic (caustics are generic concept)
- ✅ **TerrainSystem.frag** - Generic (except preset name)
- ✅ **VolumeRaymarching.frag** - Fully generic
- ✅ **WaterShading.frag** - Generic water shading (depends on generic systems)
- ✅ **WaveSystem.frag** - Generic wave system (can be used for any waves)

## Refactoring Status

✅ **COMPLETED:**

1. **Moved scene-specific code to Scene.frag:**
   - ✅ `getSceneSDF()` and `getSceneNormal()` moved from DistanceFieldSystem to Scene.frag
   - ✅ `getBuoySDF()`, `getBuoyNormal()`, `raymarchBuoy()` moved from ObjectSystem to Scene.frag
   - ✅ Ocean-specific rendering logic (`renderOceanScene()`) created in Scene.frag
   - ✅ Distance field API functions (`getDistanceToSurface`, etc.) moved to Scene.frag

2. **Made DistanceFieldSystem generic:**
   - ✅ Removed scene-specific SDF definitions
   - ✅ Kept only generic algorithms and macros
   - ✅ Removed Ocean-scene-specific includes

3. **Made ObjectSystem generic:**
   - ✅ Removed scene-specific buoy object code
   - ✅ Kept only SDF primitives and operations
   - ✅ Removed WaveSystem dependency

4. **Made RenderPipeline generic:**
   - ✅ Removed Ocean-specific `renderScene()` function
   - ✅ Kept generic `composeFinalColor()` function
   - ✅ Documented that scene-specific rendering should be in scene files
   - ⚠️ Note: Still includes WaveSystem for water surface computation in `composeFinalColor()` (Ocean-specific, but needed for terrain caustics)

5. **Renamed Ocean-specific presets:** ✅ DONE
   - ✅ `createDefaultOceanFloor()` → `createFlatTerrain()` ✅ Completed

