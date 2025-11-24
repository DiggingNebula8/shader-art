# Render Pipeline Refactoring Plan

## Current Problems

1. **OceanSystem.frag is monolithic** - Does too many things:
   - Wave generation (geometry)
   - Water physics (refraction, reflection, caustics)
   - Terrain integration (floor shading, raymarching)
   - Sky integration (reflections, lighting)
   - PBR shading (Fresnel, BRDF, subsurface)
   - Raymarching

2. **Scene.frag is tightly coupled** - Directly calls OceanSystem functions:
   - `raymarchOcean()` - finds surface
   - `shadeOcean()` - does everything else
   - Hard to swap systems or modify pipeline

3. **No clear separation of concerns**:
   - Geometry vs Material vs Integration
   - Hard to test/modify individual components
   - Difficult to add new features (e.g., different water types)

## Proposed Architecture

### New Structure

```
Scene.frag (or RenderPipeline.frag)
  ├─ VolumeRaymarching.frag (MAIN RAYMARCHING SOURCE)
  │   ├─ raymarchVolume() - generic volume raymarching
  │   ├─ raymarchSurface() - surface intersection
  │   └─ Accepts SDF functions from any system
  │
  ├─ Geometry Systems (provide SDFs)
  │   ├─ WaveSystem.frag → getWaveSDF()
  │   ├─ TerrainSystem.frag → getTerrainSDF()
  │   └─ (Future: CloudSystem, etc.)
  │
  ├─ Shading Layer (computes colors)
  │   ├─ WaterShading.frag - water material properties
  │   ├─ TerrainShading.frag - terrain material properties  
  │   └─ SkySystem.frag - sky/atmosphere (already separate)
  │
  └─ Integration Layer (combines everything)
      ├─ calculateRefraction() - uses VolumeRaymarching + TerrainSDF
      ├─ calculateReflection() - uses VolumeRaymarching + WaveSDF
      └─ composeFinalColor() - combines all contributions
```

### New Files to Create

1. **WaveSystem.frag** (extract from OceanSystem)
   - Pure wave geometry functions
   - `getWaveHeight()`, `getNormal()`, `getGradient()`
   - Wave parameters and configuration
   - No dependencies on Sky/Terrain/Shading

2. **WaterShading.frag** (extract from OceanSystem)
   - Pure water material properties
   - `getFresnel()`, `getWaterRoughness()`, `getWaterColor()`
   - PBR functions (BRDF, subsurface scattering)
   - No dependencies on Terrain/Sky (uses interfaces)

3. **TerrainShading.frag** (extract from OceanSystem)
   - Terrain material properties
   - `shadeOceanFloor()` - shades terrain with caustics
   - Terrain-specific lighting and material functions
   - Uses TerrainParams for configuration

4. **VolumeRaymarching.frag** (NEW - unified raymarching system)
   - Generic volume raymarching that accepts SDF functions
   - `raymarchSurfaceCore()` - raymarch to find surface intersections
   - `raymarchVolumeCore()` - raymarch through volumes (water, clouds, etc.)
   - Main source of truth for all raymarching
   - Systems provide SDFs via macros, VolumeRaymarching handles algorithm

5. **RenderPipeline.frag** (new orchestration layer)
   - Coordinates all systems
   - Defines clear interfaces between systems
   - Handles integration logic (calculateRefraction, calculateReflection, composeFinalColor)
   - Scene.frag becomes thin wrapper

### Refactored OceanSystem.frag

**Remove it entirely** - Functions moved to specialized systems

## Implementation Steps

### Phase 1: Extract Wave System
- [x] Create `WaveSystem.frag`
- [x] Move wave generation functions from OceanSystem
- [x] Remove Sky/Terrain dependencies
- [x] Add `getWaveSDF()` function for VolumeRaymarching
- [x] Update OceanSystem to include WaveSystem (temporary during transition)

### Phase 2: Create Unified Volume Raymarching
- [x] Create `VolumeRaymarching.frag` - MAIN RAYMARCHING SOURCE
- [x] Design include-based SDF interface (GLSL-compatible)
- [x] Implement `raymarchVolumeCore()` - generic volume raymarching algorithm
- [x] Implement `raymarchSurfaceCore()` - surface intersection algorithm
- [x] Move existing raymarching logic from OceanSystem:
  - [x] `raymarchOcean()` → becomes `raymarchWaveSurface()` wrapper
  - [x] `raymarchThroughWater()` → becomes `raymarchTerrain()` wrapper using volume raymarching
- [x] Create system-specific raymarch wrappers:
  - [x] WaveSystem: `raymarchWaveSurface()` - wraps VolumeRaymarching with getWaveSDF
  - [x] TerrainSystem: `raymarchTerrain()` - wraps VolumeRaymarching with getTerrainSDF
- [x] Update OceanSystem to use new wrappers (backward compatible)

### Phase 3: Extract Water Shading
- [x] Create `WaterShading.frag`
- [x] Move PBR/material functions from OceanSystem
- [x] Create `WaterShadingParams` struct for clear interface
- [x] Use VolumeRaymarching for refraction calculations
- [x] Remove direct Terrain dependencies (use params struct)
- [x] Create `TerrainShading.frag`
- [x] Move `shadeOceanFloor()` from OceanSystem to TerrainShading
- [x] Create `TerrainShadingParams` struct for clear interface

### Phase 4: Create Render Pipeline
- [x] Create `RenderPipeline.frag`
- [x] Move integration logic from Scene.frag:
  - [x] `calculateRefraction()` - uses VolumeRaymarching + TerrainSDF
  - [x] `calculateReflection()` - uses VolumeRaymarching + WaveSDF
  - [x] `composeFinalColor()` - combines all contributions
- [x] Define clear system interfaces
- [x] Implement high-level rendering functions

### Phase 5: Refactor Scene.frag
- [ ] Make Scene.frag thin wrapper
- [ ] Use RenderPipeline for orchestration
- [ ] Remove direct OceanSystem dependencies
- [ ] Keep OceanSystem as thin compatibility layer during transition

### Phase 6: Cleanup
- [ ] Remove OceanSystem.frag (after full migration verified)
- [ ] Update documentation
- [ ] Verify all functionality works
- [ ] Performance testing and optimization

## Benefits

1. **Modularity**: Each system has single responsibility
2. **Testability**: Can test systems independently
3. **Extensibility**: Easy to add new water types, materials, etc.
4. **Maintainability**: Clear boundaries, easier to modify
5. **Reusability**: Systems can be used independently
6. **Performance**: Can optimize individual systems

## Interface Design

### WaveSystem Interface
```glsl
// Pure geometry - no dependencies
float getWaveHeight(vec2 pos, float time);
vec3 getNormal(vec2 pos, float time, out vec2 gradient);
vec2 getGradient(vec2 pos, float time);
```

### TerrainShading Interface
```glsl
// Terrain material properties
struct TerrainShadingParams {
    vec3 pos;                    // Terrain position
    vec3 normal;                 // Terrain normal
    vec3 viewDir;                // View direction
    float time;                  // Time for animation
    TerrainParams terrainParams; // Terrain configuration
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration
    vec3 waterSurfacePos;        // Water surface position (for caustics)
    vec3 waterNormal;            // Water surface normal (for caustics)
};

vec3 shadeTerrain(TerrainShadingParams params);
```

### WaterShading Interface
```glsl
// Material properties - minimal dependencies
vec3 getFresnel(vec3 viewDir, vec3 normal);
float getWaterRoughness(vec2 gradient, float waveHeight);
vec3 getWaterColor(float depth, vec3 viewDir);

// Shading parameters struct - clear interface for all dependencies
struct WaterShadingParams {
    vec3 pos;                    // Surface position
    vec3 normal;                // Surface normal
    vec3 viewDir;                // View direction
    vec2 gradient;               // Wave gradient
    float time;                  // Time for animation
    LightingInfo light;          // Lighting information (from SkySystem)
    SkyAtmosphere sky;           // Sky configuration (for reflections)
    TerrainParams floorParams;   // Terrain params (for depth calculation)
};

struct WaterShadingResult {
    vec3 color;                  // Final shaded color
    float dynamicRoughness;       // Computed roughness
    vec3 reflectedDir;            // Reflection direction
};

WaterShadingResult shadeWater(WaterShadingParams params);
```

### VolumeRaymarching Interface

**GLSL-Compatible Design**: Since GLSL doesn't support function pointers, we use include-based polymorphism.

**VolumeRaymarching.frag** (Core Algorithm):
```glsl
#ifndef VOLUME_RAYMARCHING_FRAG
#define VOLUME_RAYMARCHING_FRAG

// Volume raymarching result
struct VolumeHit {
    bool hit;           // Did we hit something?
    float distance;     // Distance traveled
    vec3 position;      // Hit position
    vec3 normal;        // Surface normal (if surface hit)
    bool valid;         // Is the result valid?
};

// Core raymarching algorithm - expects getSDF() to be defined via #define
// Systems must define getSDF() before including this file
VolumeHit raymarchSurfaceCore(vec3 start, vec3 dir, float maxDist, float time) {
    // Uses getSDF(pos, time) - must be defined by including system
    float t = 0.0;
    float prevH = 1e10;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos = start + dir * t;
        float h = getSDF(pos, time);  // System provides this function
        
        if (abs(h) < MIN_DIST * 1.5) {
            // Hit found - refine position
            vec3 refinedPos = pos;
            if (abs(h) > MIN_DIST * 0.5) {
                float refineStep = h * 0.3;
                refinedPos = start + dir * (t - refineStep);
                float hRefined = getSDF(refinedPos, time);
                if (abs(hRefined) < abs(h)) {
                    pos = refinedPos;
                }
            }
            
            VolumeHit hit;
            hit.hit = true;
            hit.distance = t;
            hit.position = pos;
            hit.valid = true;
            hit.normal = vec3(0.0, 1.0, 0.0);  // Default - will be calculated by wrapper
            return hit;
        }
        
        if (t > maxDist) break;
        
        float stepSize = clamp(h * 0.4, MIN_DIST * 0.5, 1.0);
        if (abs(h) > abs(prevH) * 1.1 && i > 2) {
            stepSize = MIN_DIST;
        }
        
        prevH = h;
        t += stepSize;
    }
    
    VolumeHit miss;
    miss.hit = false;
    miss.distance = maxDist;
    miss.position = start + dir * maxDist;
    miss.valid = true;
    return miss;
}

// Volume raymarching (for raymarching through volumes, not to surfaces)
// Used for raymarching through water to find floor, clouds, etc.
VolumeHit raymarchVolumeCore(vec3 start, vec3 dir, float maxDist, float time) {
    float t = 0.0;
    const float STEP_SIZE = 0.5;  // Fixed step size for volume traversal
    
    for (int i = 0; i < 200; i++) {
        vec3 pos = start + dir * t;
        float h = getSDF(pos, time);  // System provides this function
        
        // Hit found (surface intersection)
        if (h < MIN_DIST) {
            VolumeHit hit;
            hit.hit = true;
            hit.distance = t;
            hit.position = pos;
            hit.valid = true;
            hit.normal = vec3(0.0, 1.0, 0.0);  // Default - calculated by wrapper
            return hit;
        }
        
        // Exit conditions
        if (t > maxDist || h > 50.0) {
            break;  // Too far or surface too far away
        }
        
        // Adaptive step size
        float stepSize = clamp(h * 0.3, STEP_SIZE, 2.0);
        t += stepSize;
    }
    
    // No hit found
    VolumeHit miss;
    miss.hit = false;
    miss.distance = maxDist;
    miss.position = start + dir * maxDist;
    miss.valid = true;
    miss.normal = vec3(0.0);
    return miss;
}

#endif
```

**System SDF Functions**:
```glsl
// WaveSystem.frag
#include "VolumeRaymarching.frag"  // Include at file scope for VolumeHit struct

float getWaveSDF(vec3 pos, float time) {
    return pos.y - getWaveHeight(pos.xz, time);
}

// System-specific raymarch wrapper
VolumeHit raymarchWaveSurface(vec3 start, vec3 dir, float maxDist, float time) {
    // Use macro to inject SDF function into core algorithm
    #define getSDF getWaveSDF
    VolumeHit hit = raymarchSurfaceCore(start, dir, maxDist, time);
    #undef getSDF
    
    // Calculate normal using system-specific function
    if (hit.hit) {
        vec2 gradient;
        hit.normal = getNormal(hit.position.xz, time, gradient);
    }
    
    return hit;
}

// TerrainSystem.frag  
#include "VolumeRaymarching.frag"  // Include at file scope for VolumeHit struct

float getTerrainSDF(vec3 pos, TerrainParams params) {
    return pos.y - getTerrainHeight(pos.xz, params);
}

// System-specific raymarch wrapper with parameters
VolumeHit raymarchTerrain(vec3 start, vec3 dir, float maxDist, float time, TerrainParams params) {
    // Define SDF function that captures params via macro
    #define getSDF(pos, t) getTerrainSDF(pos, params)
    VolumeHit hit = raymarchSurfaceCore(start, dir, maxDist, time);
    #undef getSDF
    
    // Calculate normal using system-specific function
    if (hit.hit) {
        hit.normal = getTerrainNormal(hit.position, params);
    }
    
    return hit;
}
```

**Usage in RenderPipeline**:
```glsl
// RenderPipeline.frag
#include "WaveSystem.frag"
#include "TerrainSystem.frag"

// Raymarch to water surface
VolumeHit waterHit = raymarchWaveSurface(camPos, rayDir, MAX_DIST, time);

// Raymarch through water to find floor
if (waterHit.hit) {
    vec3 refractedDir = calculateRefractionDir(viewDir, waterNormal);
    VolumeHit floorHit = raymarchTerrain(waterHit.position, refractedDir, MAX_DEPTH, time, terrainParams);
}
```

### RenderPipeline Interface
```glsl
// High-level rendering functions
struct SurfaceHit {
    bool hit;
    vec3 position;
    vec3 normal;
    vec2 gradient;
    float distance;
    int surfaceType;  // 0 = water, 1 = terrain, etc.
};

struct RenderContext {
    vec3 cameraPos;
    vec3 rayDir;
    float time;
    SkyAtmosphere sky;
    TerrainParams terrainParams;
    Camera camera;
};

// Main rendering function
vec3 renderScene(vec3 ro, vec3 rd, float time, RenderContext ctx);

// Integration functions (in RenderPipeline.frag)
vec3 calculateRefraction(vec3 pos, vec3 normal, vec3 viewDir, RenderContext ctx);
vec3 calculateReflection(vec3 pos, vec3 normal, vec3 viewDir, RenderContext ctx);
vec3 composeFinalColor(SurfaceHit hit, RenderContext ctx);
```

## Migration Strategy

1. **Parallel Implementation**: Create new systems alongside old ones
2. **Gradual Migration**: Move functions one at a time
3. **Testing**: Verify each step works before proceeding
4. **Documentation**: Update docs as we go
5. **Cleanup**: Remove old code once new system is complete

## Unified Volume Raymarching Architecture

### Design Philosophy
**One source of truth for raymarching** - VolumeRaymarching.frag is the main raymarching system. All geometry systems provide SDF functions that VolumeRaymarching uses.

### Architecture

**VolumeRaymarching.frag** (Main Raymarching System)
- Single source of truth for all raymarching algorithms
- Provides `raymarchSurfaceCore()` and `raymarchVolumeCore()` - generic algorithms
- Handles all raymarching logic (stepping, convergence, etc.)
- No knowledge of specific geometry (waves, terrain, etc.)
- Systems provide SDFs via `#define getSDF` macro before calling core functions

**Geometry Systems** (SDF Providers)
- **WaveSystem.frag**: `getWaveSDF(vec3 pos, float time)`
- **TerrainSystem.frag**: `getTerrainSDF(vec3 pos, TerrainParams params)`
- **Future**: CloudSystem, ObjectSystem, etc.
- Each system provides its own SDF function
- VolumeRaymarching calls these functions, doesn't know what they represent

### Benefits
- **Single source of truth**: All raymarching logic in one place
- **Extensible**: Add new geometry by adding SDF function
- **Testable**: Test raymarching algorithm independently
- **Maintainable**: Fix raymarching bugs in one place
- **Flexible**: Easy to swap/combine SDFs

### Example Usage

```glsl
// RenderPipeline.frag
#include "WaveSystem.frag"
#include "TerrainSystem.frag"

// Raymarch to water surface
VolumeHit waterHit = raymarchWaveSurface(camPos, rayDir, MAX_DIST, time);

// Raymarch through water to find floor
if (waterHit.hit) {
    vec3 refractedDir = calculateRefractionDir(viewDir, waterHit.normal);
    VolumeHit floorHit = raymarchTerrain(
        waterHit.position, refractedDir, MAX_DEPTH, 
        time, terrainParams
    );
}

// Future: Raymarch through clouds
// VolumeHit cloudHit = raymarchClouds(startPos, rayDir, MAX_DIST, time, cloudParams);
```

## Implementation Details

### GLSL Function Pointer Limitation

GLSL doesn't support function pointers or `void*`. We use **include-based polymorphism** with `#define` macros.

**How It Works**:
1. VolumeRaymarching.frag defines the core raymarching algorithm
2. It expects `getSDF(pos, time)` to be defined via `#define` before inclusion
3. Each system provides its own `getSDF()` function
4. Systems create wrapper functions that `#define getSDF` to their implementation, include VolumeRaymarching, then `#undef`

**Example Implementation**:
```glsl
// VolumeRaymarching.frag
#ifndef VOLUME_RAYMARCHING_FRAG
#define VOLUME_RAYMARCHING_FRAG

// Core algorithm uses getSDF() which must be defined by caller
VolumeHit raymarchSurfaceCore(vec3 start, vec3 dir, float maxDist, float time) {
    // ... algorithm uses getSDF(pos, time) ...
}

#endif

// WaveSystem.frag
float getWaveSDF(vec3 pos, float time) {
    return pos.y - getWaveHeight(pos.xz, time);
}

VolumeHit raymarchWaveSurface(vec3 start, vec3 dir, float maxDist, float time) {
    #define getSDF getWaveSDF
    #include "VolumeRaymarching.frag"
    VolumeHit hit = raymarchSurfaceCore(start, dir, maxDist, time);
    #undef getSDF
    return hit;
}
```

**Benefits**:
- GLSL-compatible (no function pointers)
- Maintains architecture: VolumeRaymarching is still the single source of truth
- Systems provide SDFs, VolumeRaymarching handles algorithm
- Type-safe (compile-time checking)
- No runtime overhead

**For SDFs with Parameters**:
```glsl
// TerrainSystem.frag
VolumeHit raymarchTerrain(vec3 start, vec3 dir, float maxDist, float time, TerrainParams params) {
    // Capture params in macro
    #define getSDF(pos, t) getTerrainSDF(pos, params)
    #include "VolumeRaymarching.frag"
    VolumeHit hit = raymarchSurfaceCore(start, dir, maxDist, time);
    #undef getSDF
    return hit;
}
```

## Questions to Consider

1. Should we keep OceanSystem.frag for backward compatibility?
NO
2. Do we need a MaterialSystem abstraction?
YES
3. How do we handle system configuration (presets, etc.)?
Yes, we need System Level Controls and Presets
4. Should we support combined SDFs (e.g., min(waveSDF, terrainSDF))?
I don't see a need for it now.

## System Configuration

### Configuration Structure

Each system will have its own configuration struct and preset functions:

**WaveSystemConfig**:
```glsl
struct WaveSystemConfig {
    int numWaves;
    float timeScale;
    vec2 primarySwellDir;
    float waveAmps[NUM_WAVES];
    float waveFreqs[NUM_WAVES];
};

WaveSystemConfig createDefaultWaveConfig();
WaveSystemConfig createCalmWaveConfig();
WaveSystemConfig createStormyWaveConfig();
```

**WaterShadingConfig**:
```glsl
struct WaterShadingConfig {
    vec3 deepWaterColor;
    vec3 shallowWaterColor;
    float baseRoughness;
    float maxRoughness;
    vec3 waterAbsorption;
    float waterIOR;
};

WaterShadingConfig createDefaultWaterConfig();
WaterShadingConfig createTropicalWaterConfig();
WaterShadingConfig createMurkyWaterConfig();
```

**System Presets**:
- Preset functions for common configurations
- Easy to swap between different water types, wave patterns, etc.
- Configuration passed to system functions via structs

## MaterialSystem Abstraction

**Design**: Optional abstraction layer for material properties

```glsl
// MaterialSystem.frag (optional)
struct MaterialProperties {
    vec3 albedo;
    float roughness;
    float metallic;
    vec3 emissive;
    float ior;  // Index of refraction
};

// WaterShading and TerrainShading can both provide MaterialProperties
// Allows for unified material handling if needed in the future
```

**Note**: This is optional and can be added later if needed. Not required for initial refactoring.

## Integration Layer Location

The integration functions (`calculateRefraction`, `calculateReflection`, `composeFinalColor`) will be in **RenderPipeline.frag**.

**RenderPipeline.frag Structure**:
```glsl
// RenderPipeline.frag
#include "Common.frag"
#include "VolumeRaymarching.frag"
#include "WaveSystem.frag"
#include "TerrainSystem.frag"
#include "WaterShading.frag"
#include "TerrainShading.frag"
#include "SkySystem.frag"

// Integration functions
vec3 calculateRefraction(...) { /* uses VolumeRaymarching + TerrainSDF */ }
vec3 calculateReflection(...) { /* uses VolumeRaymarching + WaveSDF */ }
vec3 composeFinalColor(...) { /* combines all contributions */ }

// Main rendering function
vec3 renderScene(vec3 ro, vec3 rd, float time, RenderContext ctx) {
    // Orchestrates all systems
}
```

## Testing Strategy

### Visual Testing
- **Screenshot Comparison**: Capture before/after screenshots at key camera angles
- **Animation Testing**: Verify temporal stability (no flickering)
- **Edge Cases**: Test shallow water, deep water, horizon, extreme angles

### Functional Testing
- **Phase-by-Phase**: Test after each phase before proceeding
- **Regression Testing**: Ensure existing features still work
- **Performance Testing**: Measure FPS before/after each phase

### Test Scenarios
1. **Calm Water**: Verify reflections and refractions work
2. **Choppy Water**: Test dynamic roughness and wave interactions
3. **Shallow Water**: Test floor visibility and caustics
4. **Deep Water**: Test absorption and color transitions
5. **Horizon**: Test sky integration and fog
6. **Temporal**: Test animation smoothness over time

### Performance Benchmarks
- **Baseline**: Measure current OceanSystem performance
- **After Each Phase**: Compare performance
- **Target**: No significant performance regression (< 5% overhead acceptable)
- **Optimization**: Profile and optimize if needed

## Error Handling

### VolumeHit Validation
```glsl
struct VolumeHit {
    bool hit;           // Did we hit something?
    float distance;     // Distance traveled
    vec3 position;      // Hit position
    vec3 normal;        // Surface normal (if surface hit)
    bool valid;         // Is the result valid? (prevents NaN/Inf issues)
};

// Always check valid before using hit results
if (hit.valid && hit.hit) {
    // Use hit.position, hit.normal, etc.
}
```

### SDF Validation
- SDF functions should return finite values
- Handle edge cases (very large distances, invalid positions)
- Graceful degradation if raymarching fails

## Performance Considerations

### Compile-Time Impact
- **Multiple Includes**: May increase shader compile time
- **Mitigation**: Use header guards, minimize includes
- **Testing**: Measure compile time impact

### Runtime Performance
- **Function Call Overhead**: Minimal in GLSL (functions are typically inlined)
- **Macro Expansion**: No runtime cost (compile-time only)
- **Struct Passing**: Efficient in GLSL (value semantics)

### Optimization Strategies
1. **Inline Critical Paths**: Mark hot paths for compiler optimization
2. **Reduce Redundant Calculations**: Cache expensive computations
3. **Profile and Optimize**: Use GPU profiler to identify bottlenecks
4. **Conditional Compilation**: Use `#ifdef` for optional features

### Expected Performance
- **Goal**: Maintain current performance or improve
- **Acceptable Overhead**: < 5% for modularity benefits
- **Optimization Target**: If overhead > 5%, profile and optimize

## Migration Risk Mitigation

### Keeping OceanSystem During Transition
- **Phase 1-5**: Keep OceanSystem.frag as compatibility layer
- **OceanSystem becomes thin wrapper**: Calls new systems internally
- **Gradual Migration**: Move functions one at a time
- **Testing**: Verify each function works before removing from OceanSystem

### Example Transition Pattern
```glsl
// OceanSystem.frag (during transition)
vec3 raymarchOcean(vec3 ro, vec3 rd, float time) {
    // Call new system
    VolumeHit hit = raymarchWaveSurface(ro, rd, MAX_DIST, time);
    return hit.position;
}

// After full migration, remove OceanSystem entirely
```

### Rollback Plan
- Keep old code in git history
- Each phase is independently testable
- Can revert individual phases if issues arise

