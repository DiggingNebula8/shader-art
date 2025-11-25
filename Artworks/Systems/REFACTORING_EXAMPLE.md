# Refactoring Example: Using WaterInteractionSystem

This document shows how to refactor ObjectShading and TerrainShading to use the new WaterInteractionSystem, eliminating code duplication while maintaining system decoupling.

## Before (Current Implementation)

**ObjectShading.frag** has ~100 lines of water interaction code:
- `calculateWaterContactLine()` - 20 lines
- `applyObjectWetEffect()` - 40 lines  
- `applyObjectUnderwaterEffect()` - 35 lines

**TerrainShading.frag** has ~100 lines of similar code:
- `calculateTerrainWaterContactLine()` - 20 lines (similar to object version)
- `applyTerrainWetEffect()` - 40 lines (similar to object version)
- `applyTerrainUnderwaterEffect()` - 35 lines (nearly identical to object version)

**Total:** ~200 lines with significant duplication

## After (Using WaterInteractionSystem)

### ObjectShading.frag Refactored

```glsl
#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"
#include "WaterInteractionSystem.frag"  // Add this

// Remove all the water interaction functions (100 lines removed)

vec3 shadeObject(ObjectShadingParams params) {
    // ... existing shading code ...
    
    // Apply water interaction effects using shared system
    if (params.isWet || params.waterDepth > 0.0) {
        WaterInteractionParams interactionParams = createObjectWaterInteractionParams();
        interactionParams.pos = params.pos;
        interactionParams.normal = params.normal;
        interactionParams.waterSurfacePos = params.waterSurfacePos;
        interactionParams.waterNormal = params.waterNormal;
        interactionParams.waterDepth = params.waterDepth;
        interactionParams.time = params.time;
        interactionParams.viewDir = params.viewDir;
        interactionParams.sunDir = params.light.sunDirection;
        interactionParams.sunColor = params.light.sunColor;
        interactionParams.sunIntensity = params.light.sunIntensity;
        interactionParams.waterMaterial = params.waterMaterial;
        
        if (params.isWet) {
            color = applyWetSurfaceEffect(color, interactionParams);
        }
        
        if (params.waterDepth > 0.0) {
            color = applyUnderwaterEffect(color, interactionParams);
        }
    }
    
    return color;
}
```

### TerrainShading.frag Refactored

```glsl
#include "Common.frag"
#include "MaterialSystem.frag"
#include "SkySystem.frag"
#include "TerrainSystem.frag"
#include "WaveSystem.frag"
#include "WaterInteractionSystem.frag"  // Add this

// Remove all the water interaction functions (100 lines removed)
// Keep caustics calculation (terrain-specific)

vec3 shadeTerrain(TerrainShadingParams params) {
    // ... existing shading code including caustics ...
    
    // Apply water interaction effects using shared system
    if (params.isWet || params.waterDepth > 0.0) {
        WaterInteractionParams interactionParams = createTerrainWaterInteractionParams();
        interactionParams.pos = params.pos;
        interactionParams.normal = params.normal;
        interactionParams.waterSurfacePos = params.waterSurfacePos;
        interactionParams.waterNormal = params.waterNormal;
        interactionParams.waterDepth = params.waterDepth;
        interactionParams.time = params.time;
        interactionParams.viewDir = params.viewDir;
        interactionParams.sunDir = params.light.sunDirection;
        interactionParams.sunColor = params.light.sunColor;
        interactionParams.sunIntensity = params.light.sunIntensity;
        interactionParams.waterMaterial = params.waterMaterial;
        
        if (params.isWet) {
            color = applyWetSurfaceEffect(color, interactionParams);
        }
        
        if (params.waterDepth > 0.0) {
            color = applyUnderwaterEffect(color, interactionParams);
        }
    }
    
    return color;
}
```

## Benefits

1. **Code Reduction**: ~200 lines → ~50 lines (75% reduction)
2. **No Duplication**: Common logic in one place
3. **Consistency**: Same effects across all surfaces
4. **Maintainability**: Update interaction logic once
5. **Customization**: Each system can still customize via params
6. **No Coupling**: Systems don't depend on each other, only on utility system

## Customization Examples

### Highly Reflective Objects (e.g., Metal)

```glsl
WaterInteractionParams params = createObjectWaterInteractionParams();
params.wetSpecularPower = 256.0;  // Very shiny
params.wetDarkness = 0.8;         // Less darkening
```

### Rough Terrain (e.g., Sand)

```glsl
WaterInteractionParams params = createTerrainWaterInteractionParams();
params.wetSpecularPower = 16.0;   // Less shiny
params.contactLineIntensity = 0.8; // More foam
```

## Migration Path

1. Create `WaterInteractionSystem.frag` (done)
2. Refactor `ObjectShading.frag` to use it
3. Refactor `TerrainShading.frag` to use it
4. Test to ensure behavior is identical
5. Remove old duplicate code

This maintains backward compatibility while improving code organization.

