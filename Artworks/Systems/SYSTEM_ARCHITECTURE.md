# System Architecture & Extension Guide

## Overview

This document describes the architecture of the shader system and provides patterns for extending it with new surface types, interaction systems, and rendering features.

## System Organization

The system is organized into modular, reusable components:

```
Systems/
├── Core Systems (no dependencies)
│   ├── Common.frag              - Shared utilities, constants, math functions
│   ├── CameraSystem.frag        - Camera definitions and presets
│   ├── SkySystem.frag           - Sky/atmosphere rendering
│   ├── VolumeRaymarching.frag  - Core raymarching algorithms
│   └── DistanceFieldSystem.frag - Distance field utilities and macros
│
├── Geometry Systems (pure geometry, minimal dependencies)
│   ├── TerrainSystem.frag       - Terrain height generation
│   ├── WaveSystem.frag          - Water wave geometry
│   └── ObjectSystem.frag       - Object distance fields
│
├── Material & Shading Systems
│   ├── MaterialSystem.frag     - Material definitions and presets
│   ├── WaterShading.frag        - Water surface shading
│   ├── TerrainShading.frag     - Terrain surface shading
│   └── ObjectShading.frag      - Object surface shading
│
├── Interaction Systems (utility libraries)
│   └── WaterInteractionSystem.frag - Water-surface interaction utilities
│
└── Pipeline Systems
    └── RenderPipeline.frag      - Main rendering orchestration
```

## Naming Conventions

### Factory Functions

The system follows consistent naming patterns for factory functions:

- **`createDefault<Type>()`** - Creates a neutral default instance
  - Example: `createDefaultWaterMaterial()`, `createDefaultTerrain()`, `createDefaultWaterInteractionParams()`
  - These should be reasonable defaults suitable for most use cases

- **`create<Variant><Type>()`** - Creates a specific preset variant
  - Example: `createChoppyWater()`, `createFlatTerrain()`, `createSandyTerrainMaterial()`
  - Variants are named by their distinguishing characteristic (e.g., `Choppy`, `Flat`, `Sandy`)

### Material Types

- Material structs: `<SurfaceType>Material` (e.g., `WaterMaterial`, `TerrainMaterial`)
- Material factory: `createDefault<SurfaceType>Material()`
- Material variants: `create<Variant><SurfaceType>Material()`

### System Types

- System parameter structs: `<System>Params` (e.g., `TerrainParams`, `WaveParams`)
- System factory: `createDefault<System>()` or `createDefault<System>Params()`
- System variants: `create<Variant><System>()`

## Extension Patterns

### 1. Adding a New Material Type

To add a new material type (e.g., `SnowMaterial`, `LavaMaterial`):

**Step 1: Define the Material Struct**

Add to `MaterialSystem.frag`:

```glsl
struct SnowMaterial {
    vec3 baseColor;          // Base snow color (typically white/off-white)
    vec3 shadowColor;        // Color in shadows/crevices
    float roughness;         // Surface roughness
    float specularIntensity; // Specular highlight intensity
    float sparkleIntensity;  // Sparkle/glitter effect intensity
    float meltFactor;        // Melting effect factor
};

// Create default snow material
SnowMaterial createDefaultSnowMaterial() {
    SnowMaterial mat;
    mat.baseColor = vec3(0.95, 0.98, 1.0);
    mat.shadowColor = vec3(0.7, 0.75, 0.8);
    mat.roughness = 0.3;
    mat.specularIntensity = 0.4;
    mat.sparkleIntensity = 0.2;
    mat.meltFactor = 0.0;
    return mat;
}

// Create variant presets
SnowMaterial createPowderSnowMaterial() {
    SnowMaterial mat = createDefaultSnowMaterial();
    mat.roughness = 0.5;
    mat.sparkleIntensity = 0.3;
    return mat;
}

SnowMaterial createWetSnowMaterial() {
    SnowMaterial mat = createDefaultSnowMaterial();
    mat.baseColor = vec3(0.85, 0.88, 0.9);
    mat.roughness = 0.1;
    mat.specularIntensity = 0.6;
    mat.meltFactor = 0.3;
    return mat;
}
```

**Step 2: Use in Shading System**

Create or extend a shading system (e.g., `SnowShading.frag`):

```glsl
#include "MaterialSystem.frag"
#include "SkySystem.frag"

vec3 shadeSnow(vec3 pos, vec3 normal, vec3 viewDir, 
               SnowMaterial material, LightingInfo light) {
    // Shading implementation using material properties
    // ...
}
```

### 2. Adding a New Interaction System

To add a new interaction system (e.g., `SnowInteractionSystem`, `LavaInteractionSystem`):

**Step 1: Create Interaction System File**

Create `SnowInteractionSystem.frag` following the pattern of `WaterInteractionSystem.frag`:

```glsl
// ============================================================================
// SNOW INTERACTION SYSTEM
// ============================================================================
// Generic snow interaction utilities for surfaces
// Provides common functions for snow accumulation, melting, and effects
// ============================================================================

#ifndef SNOW_INTERACTION_SYSTEM_FRAG
#define SNOW_INTERACTION_SYSTEM_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"

struct SnowInteractionParams {
    vec3 pos;                    // Surface position
    vec3 normal;                 // Surface normal
    float snowDepth;              // Snow depth at position
    float time;                   // Time for animation
    vec3 viewDir;                // View direction
    vec3 sunDir;                 // Sun direction
    SnowMaterial snowMaterial;   // Snow material properties
    float accumulationRate;       // Snow accumulation rate
    float meltRate;              // Snow melt rate
};

// Calculate snow accumulation based on surface angle
float calculateSnowAccumulation(vec3 normal, float accumulationRate) {
    // Snow accumulates more on horizontal surfaces
    float angleFactor = max(0.0, normal.y);
    return angleFactor * accumulationRate;
}

// Apply snow effect to surface
vec3 applySnowEffect(vec3 baseColor, SnowInteractionParams params) {
    // Implementation...
    return baseColor;
}

// Create default snow interaction parameters
SnowInteractionParams createDefaultSnowInteractionParams() {
    SnowInteractionParams params;
    params.accumulationRate = 1.0;
    params.meltRate = 0.1;
    return params;
}

#endif // SNOW_INTERACTION_SYSTEM_FRAG
```

**Step 2: Use in Shading Systems**

Include and use in terrain or object shading:

```glsl
#include "SnowInteractionSystem.frag"

// In terrain shading:
if (hasSnow) {
    SnowInteractionParams snowParams = createDefaultSnowInteractionParams();
    snowParams.pos = params.pos;
    snowParams.normal = params.normal;
    // ... set other params
    color = applySnowEffect(color, snowParams);
}
```

### 3. Adding a New Geometry System

To add a new geometry system (e.g., `FoliageSystem`, `CloudSystem`):

**Step 1: Create Geometry System File**

Create `FoliageSystem.frag`:

```glsl
// ============================================================================
// FOLIAGE SYSTEM
// ============================================================================
// Procedural foliage generation (trees, grass, etc.)
// ============================================================================

#ifndef FOLIAGE_SYSTEM_FRAG
#define FOLIAGE_SYSTEM_FRAG

#include "Common.frag"

struct FoliageParams {
    float density;           // Foliage density
    float treeHeight;        // Average tree height
    float grassHeight;       // Average grass height
    vec3 treeColor;          // Tree color
    vec3 grassColor;         // Grass color
    // ... other parameters
};

// Initialize default parameters
FoliageParams initFoliageParams() {
    FoliageParams params;
    params.density = 0.5;
    params.treeHeight = 10.0;
    params.grassHeight = 0.3;
    params.treeColor = vec3(0.1, 0.4, 0.1);
    params.grassColor = vec3(0.2, 0.5, 0.1);
    return params;
}

// Create default foliage
FoliageParams createDefaultFoliage() {
    return initFoliageParams();
}

// Create variant presets
FoliageParams createDenseForest() {
    FoliageParams params = initFoliageParams();
    params.density = 0.9;
    params.treeHeight = 15.0;
    return params;
}

FoliageParams createSparseGrassland() {
    FoliageParams params = initFoliageParams();
    params.density = 0.2;
    params.treeHeight = 5.0;
    params.grassHeight = 0.5;
    return params;
}

// SDF for foliage (used by raymarching)
float getFoliageSDF(vec3 pos, FoliageParams params) {
    // Implementation...
    return 0.0;
}

#endif // FOLIAGE_SYSTEM_FRAG
```

**Step 2: Integrate with Render Pipeline**

Add to `RenderPipeline.frag` or create a scene-specific wrapper that includes the new system.

### 4. Adding a New Shading System

To add a new shading system (e.g., `LavaShading`, `FoliageShading`):

**Step 1: Create Shading System File**

Create `LavaShading.frag`:

```glsl
// ============================================================================
// LAVA SHADING SYSTEM
// ============================================================================
// Lava surface shading with emissive glow and flow effects
// ============================================================================

#ifndef LAVA_SHADING_FRAG
#define LAVA_SHADING_FRAG

#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"

struct LavaShadingParams {
    vec3 pos;
    vec3 normal;
    vec3 viewDir;
    float time;
    LavaMaterial material;
    LightingInfo light;
    SkyAtmosphere sky;
};

vec3 shadeLava(LavaShadingParams params) {
    // Emissive glow
    vec3 emissive = params.material.emissiveColor * params.material.emissiveIntensity;
    
    // Flow animation
    float flow = sin(params.time * params.material.flowSpeed + params.pos.x * 0.1);
    
    // Combine effects
    vec3 color = emissive + flow * params.material.flowColor;
    
    return color;
}

#endif // LAVA_SHADING_FRAG
```

**Step 2: Define Material Type**

Add `LavaMaterial` to `MaterialSystem.frag` following the material extension pattern.

## System Dependencies

### Dependency Rules

1. **Core Systems** (`Common.frag`, `SkySystem.frag`, `CameraSystem.frag`, `VolumeRaymarching.frag`, `DistanceFieldSystem.frag`) have no dependencies
2. **Geometry Systems** depend only on `Common.frag` (and optionally `VolumeRaymarching.frag` for raymarching wrappers)
3. **Material Systems** depend only on `Common.frag`
4. **Shading Systems** depend on:
   - `Common.frag`
   - `MaterialSystem.frag`
   - `SkySystem.frag`
   - Their corresponding geometry system
   - Optional: Core utility systems (`DistanceFieldSystem.frag`, `VolumeRaymarching.frag`)
   - Optional: Interaction systems
5. **Interaction Systems** depend on:
   - `Common.frag`
   - `MaterialSystem.frag`
   - `SkySystem.frag`
6. **Pipeline Systems** can depend on all systems

### Avoiding Circular Dependencies

- Systems should not include each other circularly
- Use forward declarations or macro-based interfaces when needed
- Interaction systems are utility libraries - they don't create dependencies

## Integration Examples

### Example: Adding Snow to a Scene

```glsl
// In your scene file:
#include "TerrainSystem.frag"
#include "MaterialSystem.frag"
#include "SnowInteractionSystem.frag"
#include "TerrainShading.frag"

void main() {
    // Create terrain
    TerrainParams terrain = createDefaultTerrain();
    
    // Create materials
    TerrainMaterial terrainMat = createDefaultTerrainMaterial();
    SnowMaterial snowMat = createDefaultSnowMaterial();
    
    // Check for snow accumulation
    float snowDepth = calculateSnowAccumulation(normal, 1.0);
    
    if (snowDepth > 0.0) {
        // Apply snow interaction
        SnowInteractionParams snowParams = createDefaultSnowInteractionParams();
        // ... configure params
        color = applySnowEffect(color, snowParams);
    }
}
```

### Example: Adding Lava Surfaces

```glsl
// In your scene file:
#include "LavaShading.frag"
#include "MaterialSystem.frag"

void main() {
    LavaMaterial lavaMat = createDefaultLavaMaterial();
    
    LavaShadingParams params;
    params.material = lavaMat;
    // ... set other params
    
    vec3 color = shadeLava(params);
}
```

## Best Practices

### 1. Naming Consistency

- Always use `createDefault<Type>()` for defaults
- Use descriptive variant names: `create<Variant><Type>()`
- Keep naming consistent across all systems

### 2. Documentation

- Document all public functions and structs
- Include usage examples in comments
- Document macro contracts (see `MACRO_CONTRACTS.md` for complete reference)
- Update this architecture document when adding major systems

### 3. Modularity

- Keep systems independent where possible
- Use utility systems (like `WaterInteractionSystem`) for shared functionality
- Avoid tight coupling between systems

### 4. Performance

- Factory functions are called per-fragment - keep them lightweight
- Consider promoting common presets to global constants if profiling shows issues
- Document performance considerations in system headers

### 5. Extensibility

- Design systems to be extended, not modified
- Use structs with sensible defaults
- Provide multiple preset variants for common use cases
- Allow customization through parameters

## Future Extension Ideas

The architecture supports adding:

- **Surface Types**: Snow, Lava, Ice, Sand, Mud, etc.
- **Interaction Systems**: Fire interaction, Wind interaction, Erosion, etc.
- **Geometry Systems**: Clouds, Foliage, Buildings, etc.
- **Material Variants**: More presets for existing materials
- **Shading Effects**: Caustics for other surfaces, volumetric effects, etc.

Each extension should follow the patterns documented above to maintain consistency and modularity.

