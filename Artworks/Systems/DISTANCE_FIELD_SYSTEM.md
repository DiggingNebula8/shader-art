# Distance Field System Documentation

## Overview

The Distance Field System provides a generic, reusable framework for distance field queries that works with any scene. It's designed to be scene-agnostic and can be used across different shader artworks.

## Architecture

The system consists of two parts:

1. **`DistanceFieldSystem.frag`** - Generic distance field algorithms (scene-independent)
2. **Scene-specific wrappers** - Define scene SDF and provide scene-specific interfaces (e.g., `OceanDistanceField.frag`)

## Basic Usage

### For a New Scene

1. **Define your scene SDF function:**

```glsl
#include "DistanceFieldSystem.frag"

// Define your scene's unified SDF
float getSceneSDF(vec3 pos, float time) {
    // Example: Simple sphere
    return length(pos) - 1.0;
    
    // Example: Multiple objects
    // float sphere1 = length(pos - vec3(0, 0, 0)) - 1.0;
    // float sphere2 = length(pos - vec3(2, 0, 0)) - 0.5;
    // return min(sphere1, sphere2);
}
```

2. **Use the generic distance field functions:**

```glsl
// Get distance to nearest surface along a ray
float dist = getDistanceToSurface(start, dir, maxDist, time);

// Get distance field info at a point
DistanceFieldInfo info = getDistanceFieldInfo(pos, time);
float distanceToSurface = info.distance;
vec3 surfacePos = info.surfacePos;

// Get depth along a direction
float depth = getDepthAlongDirection(start, dir, maxDepth, time);
```

### Optional: Define Normal Function

For more accurate surface position queries, define a normal function:

```glsl
vec3 getSceneNormal(vec3 pos, float time) {
    const float eps = 0.01;
    float d = getSceneSDF(pos, time);
    return normalize(vec3(
        getSceneSDF(pos + vec3(eps, 0, 0), time) - d,
        getSceneSDF(pos + vec3(0, eps, 0), time) - d,
        getSceneSDF(pos + vec3(0, 0, eps), time) - d
    ));
}
```

## Combining Multiple SDFs

The system provides helpers for combining multiple SDFs:

```glsl
float getSceneSDF(vec3 pos, float time) {
    float sphere = length(pos) - 1.0;
    float box = sdBox(pos, vec3(0.5));
    
    // Union (minimum)
    return unionSDF(sphere, box);
    
    // Smooth union
    // return smoothMinSDF(sphere, box, 0.5);
    
    // Intersection
    // return intersectionSDF(sphere, box);
    
    // Subtraction
    // return subtractionSDF(sphere, box);
}
```

## Available Functions

### Core Distance Field Functions

- `getDistanceToSurface(start, dir, maxDist, time)` - Raymarch to find nearest surface
- `getDistanceFieldInfo(pos, time)` - Get distance and surface position at a point
- `getDepthAlongDirection(start, dir, maxDepth, time)` - Get depth along a direction

### SDF Combination Helpers

- `smoothMinSDF(d1, d2, k)` - Smooth minimum (union with blending)
- `smoothMaxSDF(d1, d2, k)` - Smooth maximum (intersection with blending)
- `unionSDF(d1, d2)` - Union (minimum)
- `intersectionSDF(d1, d2)` - Intersection (maximum)
- `subtractionSDF(d1, d2)` - Subtraction

## Ocean Scene Example

The Ocean scene uses a wrapper (`OceanDistanceField.frag`) that:

1. Defines `getSceneSDF()` combining terrain and objects
2. Provides Ocean-specific functions with `TerrainParams` for backward compatibility
3. Uses the generic `DistanceFieldSystem` internally

See `OceanDistanceField.frag` for a complete example.

## Benefits

- **Reusable**: Works with any scene, not just Ocean
- **Generic**: No hard dependencies on specific systems
- **Flexible**: Easy to extend with new SDF functions
- **Efficient**: Optimized raymarching algorithms with smooth stepping

## Requirements

- Must define `getSceneSDF(vec3 pos, float time)` before using
- Optional: Define `getSceneNormal(vec3 pos, float time)` for better accuracy
- Requires `Common.frag` for constants (MIN_DIST, etc.)

