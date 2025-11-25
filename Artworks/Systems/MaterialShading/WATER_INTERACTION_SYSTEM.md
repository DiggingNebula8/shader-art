# Water Interaction System

## Overview

The Water Interaction System provides reusable utilities for water-surface interactions (wet surfaces, underwater effects, contact lines). It follows a utility library pattern - systems can use these functions but maintain their own customization.

## Architecture

- **Utility System**: Like `Common.frag`, provides functions without creating dependencies
- **No Coupling**: Shading systems include this but don't depend on each other
- **Customizable**: Each system can customize parameters for their specific needs
- **Extensible**: Can be extended for other interaction types (fire, snow, etc.)

## Usage

### Basic Usage

```glsl
#include "WaterInteractionSystem.frag"

// In your shading function:
WaterInteractionParams interactionParams = createObjectWaterInteractionParams();
interactionParams.pos = params.pos;
interactionParams.normal = params.normal;
interactionParams.waterSurfacePos = params.waterSurfacePos;
interactionParams.waterNormal = params.waterNormal;
interactionParams.waterDepth = params.waterDepth;
interactionParams.time = params.time;
interactionParams.viewDir = params.viewDir;
interactionParams.sunDir = light.sunDirection;
interactionParams.sunColor = light.sunColor;
interactionParams.sunIntensity = light.sunIntensity;
interactionParams.waterMaterial = params.waterMaterial;

// Apply effects
if (params.isWet) {
    color = applyWetSurfaceEffect(color, interactionParams);
}

if (params.waterDepth > 0.0) {
    color = applyUnderwaterEffect(color, interactionParams);
}
```

### Customization

Each system can customize behavior:

```glsl
// For objects (more specular, less foam)
WaterInteractionParams params = createObjectWaterInteractionParams();
params.wetSpecularPower = 128.0; // Very shiny
params.contactLineIntensity = 0.3; // Less foam

// For terrain (less specular, more foam)
WaterInteractionParams params = createTerrainWaterInteractionParams();
params.wetSpecularPower = 16.0; // Less shiny
params.contactLineIntensity = 0.6; // More foam
```

## Functions

### `float calculateWaterContactLine(vec3 pos, vec3 waterSurfacePos, float time, float contactLineIntensity)`

Calculates water contact line intensity (foam/white line where water meets surface).

**Parameters:**
- `pos`: Surface position
- `waterSurfacePos`: Water surface position
- `time`: Time for animation
- `contactLineIntensity`: Intensity multiplier

**Returns:** Contact line factor (0.0 to 1.0)

### `vec3 applyWetSurfaceEffect(vec3 baseColor, WaterInteractionParams params)`

Applies wet surface effects: darkening, reflections, droplets, contact line.

**Parameters:**
- `baseColor`: Base surface color
- `params`: Water interaction parameters

**Returns:** Color with wet surface effects applied

### `vec3 applyUnderwaterEffect(vec3 baseColor, WaterInteractionParams params)`

Applies underwater visual effects: color tinting, fog, reduced lighting, light scattering.

**Parameters:**
- `baseColor`: Base surface color
- `params`: Water interaction parameters (must have `waterDepth > 0.0`)

**Returns:** Color with underwater effects applied

## Benefits

1. **Code Reuse**: Common logic shared between systems
2. **Consistency**: Same underwater/wet effects across all surfaces
3. **Maintainability**: Update interaction logic in one place
4. **Customization**: Each system can still customize behavior
5. **Extensibility**: Easy to add new interaction types

## Future Extensions

The system can be extended for other interaction types:

- **FireInteractionSystem**: Burn marks, heat distortion, embers
- **SnowInteractionSystem**: Snow accumulation, melting, wet snow
- **MudInteractionSystem**: Mud splashes, wet mud effects

Each would follow the same pattern: utility functions that systems can use and customize.

