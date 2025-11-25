# Shader Art

A modular shader system for creating procedural scenes with physically-based rendering, realistic water, terrain, and atmospheric effects.

[![GLSL](https://img.shields.io/badge/GLSL-OpenGL-blue.svg)](https://www.opengl.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Features

- Realistic water rendering with physically-based refraction, reflection, translucency, and depth-based absorption
- Procedural terrain generation using multi-scale noise, domain warping, ridged multifractal, and erosion simulation
- Dynamic sky system with atmospheric scattering, sun/moon, stars, clouds, and fog presets
- Physically-based camera with exposure, depth of field, and realistic controls
- Material system with art-directable presets for water, terrain, and objects
- Modular architecture with composable systems
- Documentation for every system and extension patterns

## Architecture

The project is organized into modular, reusable systems:

```
Artworks/
├── Systems/                    # Core rendering systems
│   ├── CoreSystems
│   │   ├── Common.frag         # Shared utilities & math
│   │   ├── CameraSystem.frag   # Camera & ray generation
│   │   ├── SkySystem.frag      # Atmosphere & lighting
│   │   ├── VolumeRaymarching.frag  # Raymarching algorithms
│   │   └── DistanceFieldSystem.frag # SDF utilities
│   │
│   ├── GeometrySystems
│   │   ├── WaveSystem.frag     # Ocean wave geometry
│   │   ├── TerrainSystem.frag  # Procedural terrain
│   │   └── ObjectSystem.frag   # 3D object SDFs
│   │
│   ├── MaterialShading
│   │   ├── MaterialSystem.frag # Material definitions
│   │   ├── WaterShading.frag   # Water PBR shading
│   │   ├── TerrainShading.frag # Terrain shading & caustics
│   │   └── ObjectShading.frag  # Object PBR shading
│   │
│   └── Pipeline
│       └── RenderPipeline.frag # Rendering orchestration
│
└── Scenes/                     # Complete scene implementations
    ├── Ocean/                  # Ocean scene example
    │   └── Scene.frag
    └── CREATING_A_NEW_SCENE.md # Scene creation guide
```

## Quick Start

### Creating Your First Scene

Create a new scene file in `Artworks/Scenes/YourScene/Scene.frag`:

```glsl
#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/MaterialShading/MaterialSystem.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/GeometrySystems/TerrainSystem.frag"
#include "../../Systems/MaterialShading/TerrainShading.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/Pipeline/RenderPipeline.frag"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Setup camera
    Camera cam = createDefaultCamera();
    cam.position = vec3(0.0, 5.0, 10.0);
    cam.target = vec3(0.0, 0.0, 0.0);
    
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rayDir = generateCameraRay(cam, uv, iResolution.xy);
    
    // Create sky and terrain
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    TerrainParams terrain = createPlainsTerrain();
    TerrainMaterial terrainMat = createDefaultTerrainMaterial();
    
    // Setup render context
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

Load the scene in your GLSL environment. For a complete guide, see [Creating a New Scene](Artworks/Scenes/CREATING_A_NEW_SCENE.md).

## Documentation

### System Documentation

- [System Architecture](Artworks/Systems/SYSTEM_ARCHITECTURE.md) - Architecture overview and extension patterns
- [Render Pipeline](Artworks/Systems/RENDER_PIPELINE.md) - Main rendering orchestration API
- [Macro Contracts](Artworks/Systems/MACRO_CONTRACTS.md) - System integration via macros

### Core Systems

- [Wave System](Artworks/Systems/WAVE_SYSTEM.md) - Ocean wave geometry based on Tessendorf's algorithm
- [Terrain System](Artworks/Systems/TERRAIN_SYSTEM.md) - Procedural terrain with multi-scale noise
- [Sky System](Artworks/Systems/SKY_SYSTEM.md) - Atmospheric scattering, sun/moon, stars, clouds
- [Camera System](Artworks/Systems/CAMERA_SYSTEM.md) - Physically-based camera controls
- [Material System](Artworks/Systems/MATERIAL_SYSTEM.md) - Material definitions and presets

### Shading Systems

- [Water Shading](Artworks/Systems/WATER_SHADING.md) - PBR water rendering with refraction/reflection
- [Terrain Shading](Artworks/Systems/TERRAIN_SHADING.md) - Terrain shading with underwater caustics
- [Water Interaction](Artworks/Systems/WATER_INTERACTION_SYSTEM.md) - Water-surface interaction utilities

### Technical Documentation

- [Volume Raymarching](Artworks/Systems/VOLUME_RAYMARCHING.md) - Core raymarching algorithms
- [Distance Field System](Artworks/Systems/DISTANCE_FIELD_SYSTEM.md) - SDF utilities and macros

## Available Presets

### Sky Presets

```glsl
createSkyPreset_ClearDay()    // Bright sunny day
createSkyPreset_Sunset()       // Warm sunset/sunrise
createSkyPreset_Night()         // Starlit night with moon
createSkyPreset_CloudyDay()    // Overcast day
createSkyPreset_Stormy()       // Dark stormy sky
createSkyPreset_Foggy()        // Foggy/hazy atmosphere
```

### Terrain Presets

```glsl
createDefaultTerrain()         // Standard terrain
createFlatTerrain()            // Flat/low-poly terrain
createMountainTerrain()        // Mountainous terrain
createHillyTerrain()           // Hilly terrain
createPlainsTerrain()          // Flat plains
```

### Material Presets

Water Materials:
```glsl
createDefaultWaterMaterial()      // Realistic water
createClearTropicalWater()        // Clear tropical water
createMurkyWater()                // Murky/muddy water
createChoppyWater()               // Rough/choppy water
```

Terrain Materials:
```glsl
createDefaultTerrainMaterial()   // Standard terrain
createSandyTerrainMaterial()     // Sandy terrain
createRockyTerrainMaterial()     // Rocky terrain
```

## Key Systems

### Wave System
- 10-component wave spectrum based on Tessendorf's algorithm
- Analytical derivatives for efficient normal calculation
- Temporally stable phase calculation
- Micro-detail enhancement for wave crests

### Terrain System
- Multi-scale noise (large, medium, small)
- Ridged multifractal for sharp ridges
- Domain warping for organic features
- Erosion simulation for realistic terrain

### Sky System
- Physically-based atmospheric scattering (Rayleigh & Mie)
- Dynamic sun/moon positioning
- Star field with twinkling
- Volumetric clouds
- Atmospheric fog/haze

### Water Shading
- Physically-based rendering (PBR)
- Refraction and reflection
- Depth-based color absorption
- Translucency effects
- Subsurface scattering

## Project Structure

```
shader-art/
├── Artworks/
│   ├── Systems/              # Core rendering systems
│   │   ├── *.frag           # System implementations
│   │   └── *.md             # System documentation
│   │
│   ├── Scenes/              # Complete scene implementations
│   │   ├── Ocean/           # Ocean scene example
│   │   │   └── Scene.frag
│   │   └── CREATING_A_NEW_SCENE.md
│   │
│   └── *.frag               # Standalone artworks
│       ├── CelluarAutomata.frag
│       ├── Propeller.frag
│       └── Spyral.frag
│
├── init.frag                # Default shader template
├── RaymarchingBase.frag     # Base raymarching utilities
├── SYSTEM_REVIEW.md         # System review documentation
├── README.md                # This file
└── LICENSE                  # MIT License
```

## Example Scenes

### Ocean Scene
A complete ocean scene with realistic water waves, refraction and reflection, underwater terrain with caustics, floating objects, dynamic sky with atmospheric effects, and a full post-processing pipeline.

See `Artworks/Scenes/Ocean/Scene.frag` for the complete implementation.

## Usage

### In Shadertoy

1. Copy the scene code from `Artworks/Scenes/Ocean/Scene.frag`
2. Paste into Shadertoy
3. The system will automatically include all dependencies

### In Other GLSL Environments

1. Ensure your environment supports `#include` directives
2. Set up include paths to point to the `Artworks/Systems/` directory
3. Use scene files as entry points

## Learning Resources

- [Creating a New Scene](Artworks/Scenes/CREATING_A_NEW_SCENE.md) - Step-by-step guide to creating scenes
- [System Architecture](Artworks/Systems/SYSTEM_ARCHITECTURE.md) - Learn how to extend the system
- [Macro Contracts](Artworks/Systems/MACRO_CONTRACTS.md) - Understand system integration

## Technical Highlights

- Modular design with independent, composable systems
- Macro-based integration for flexible system communication
- Physically-based materials and lighting
- Performance optimized raymarching and shading
- Art-directable materials and presets that can be tweaked without recompilation
- Comprehensive documentation for every system

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Tessendorf's "Simulating Ocean Water" (SIGGRAPH 2001) - Wave system inspiration
- Perlin & Hoffert "Hypertexture" (SIGGRAPH 1989) - Terrain noise techniques
- Musgrave et al. "Eroded Fractal Terrains" (SIGGRAPH 1989) - Terrain erosion
