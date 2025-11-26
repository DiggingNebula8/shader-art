# Camera System Documentation

## Overview

The Camera System implements a physically-based camera model with real-world parameters: shutter speed, f-stop, ISO, and focal length. It provides realistic exposure control and optional depth of field effects.

## Basic Usage

```glsl
// 1. Create a camera
Camera cam = createDefaultCamera();

// 2. Configure settings
cam.fStop = 2.8;
cam.shutterSpeed = 1.0 / 60.0;
cam.iso = 100.0;

// 3. Generate camera ray
vec3 rd = generateCameraRay(cam, uv, iResolution.xy);

// 4. Apply exposure to final color
color = applyExposure(color, cam);
```

## Camera Presets

### Default Camera
```glsl
Camera cam = createDefaultCamera();
```
- Focal length: 50mm (standard lens)
- F-stop: 2.8 (moderate aperture)
- Shutter speed: 1/60s
- ISO: 100 (low sensitivity)
- Focus distance: 10 meters
- DOF: Disabled by default

### Sunny Day Camera
```glsl
Camera cam = createSunnyDayCamera();
```
- F-stop: 8.0 (smaller aperture for bright scenes)
- Shutter speed: 1/250s (fast shutter)
- ISO: 100 (low sensitivity)
- **Use case**: Bright outdoor scenes with plenty of light

### Low Light Camera
```glsl
Camera cam = createLowLightCamera();
```
- F-stop: 2.8 (wide aperture)
- Shutter speed: 1/60s (slower shutter)
- ISO: 800 (higher sensitivity)
- **Use case**: Dimly lit scenes, indoor photography

### Motion Blur Camera
```glsl
Camera cam = createMotionBlurCamera();
```
- F-stop: 2.8
- Shutter speed: 1/30s (slow shutter for motion blur)
- ISO: 200
- **Use case**: Capturing motion, artistic effects

### High Speed Camera
```glsl
Camera cam = createHighSpeedCamera();
```
- F-stop: 2.8
- Shutter speed: 1/1000s (very fast shutter)
- ISO: 400
- **Use case**: Freezing fast motion, sports photography

### Cinematic Camera
```glsl
Camera cam = createCinematicCamera();
```
- Focal length: 85mm (portrait lens)
- F-stop: 1.4 (very wide aperture)
- Shutter speed: 1/48s (cinematic 24fps with 180° shutter)
- ISO: 100
- DOF: Enabled
- Focus distance: 8 meters
- **Use case**: Cinematic rendering, shallow depth of field

### Sky Camera
```glsl
Camera cam = createSkyCamera();
```
- Focal length: 20mm (wide angle lens)
- F-stop: 5.6 (moderate aperture for bright sky)
- Shutter speed: 1/125s (moderate shutter)
- ISO: 100 (low sensitivity)
- DOF: Disabled
- **Use case**: Sky-only scenes, atmospheric rendering

## Camera Parameters

### Position and Orientation
- `position`: Camera position in world space
- `target`: Point the camera is looking at
- `up`: Up vector for camera orientation

### Physical Camera Parameters
- `focalLength`: Lens focal length in mm
  - 24mm: Wide angle
  - 50mm: Standard (normal)
  - 85mm: Portrait
  - 200mm: Telephoto
- `fStop`: Aperture f-number
  - Lower = wider aperture = more light = less depth of field
  - Common values: 1.4, 2.8, 5.6, 8, 11, 16, 22
- `shutterSpeed`: Exposure time in seconds
  - Longer = more light = more motion blur
  - Common values: 1/1000s (0.001), 1/250s (0.004), 1/60s (0.0167), 1/30s (0.033)
- `iso`: ISO sensitivity
  - Higher = more sensitive = brighter = more noise
  - Common values: 100 (low), 400 (medium), 800 (high), 1600+ (very high)

### Depth of Field
- `focusDistance`: Distance to focus plane in meters
- `enableDOF`: Enable/disable depth of field (has performance impact)

### Sensor Properties
- `sensorWidth`: Sensor width in mm
  - Full frame: 36mm
  - APS-C: 23.6mm
- `sensorHeight`: Sensor height in mm
  - Full frame: 24mm
  - APS-C: 15.7mm

### Exposure Compensation
- `exposureCompensation`: Exposure compensation in EV stops
  - Range: -2.0 to +2.0 (0.0 = no compensation)
  - +1.0 EV = 2x brighter, -1.0 EV = 0.5x brighter
  - Useful for fine-tuning exposure without changing f-stop/shutter/ISO

### Camera Effects
- `vignetteStrength`: Vignette effect strength (0.0 = none, 1.0 = strong)
  - Darkens edges of the image for cinematic effect
- `chromaticAberration`: Chromatic aberration strength (0.0 = none, 1.0 = strong)
  - Simulates color fringing at edges (lens imperfection effect)
- `filmGrain`: Film grain strength (0.0 = none, 1.0 = strong)
  - Adds film-like grain texture, more visible in darker areas

## Exposure Relationship

The exposure system follows real photographic principles:

- **Lower f-stop** (wider aperture) = brighter image, less depth of field (more blur)
- **Higher f-stop** (smaller aperture) = darker image, more depth of field (less blur)
- **Slower shutter** = brighter image, more motion blur
- **Higher ISO** = brighter image, more noise

**Standard exposure**: f/2.8, 1/60s, ISO 100

Each parameter affects exposure multiplicatively:
- Each f-stop change doubles/halves light (f/1.4, f/2, f/2.8, f/4, f/5.6, f/8, f/11, f/16, f/22)
- Each shutter speed change doubles/halves light (1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15)
- Each ISO change doubles/halves sensitivity (100, 200, 400, 800, 1600)

**Depth of Field Note**: The DOF system correctly implements the inverse relationship between f-stop and blur amount. Larger f-stop numbers (like f/8, f/16) produce sharper images with more depth of field, while smaller f-stop numbers (like f/1.4, f/2.8) produce more blur with shallow depth of field.

## Functions

### `createDefaultCamera()`
Creates a camera with standard settings suitable for most scenes.

### `generateCameraRay(Camera cam, vec2 uv, vec2 resolution)`
Generates a camera ray direction for the given UV coordinates (0-1 range) and resolution. Automatically calculates FOV from focal length and sensor size.

### `applyExposure(vec3 color, Camera cam)`
Applies physically-based exposure to the color based on camera settings (f-stop, shutter speed, ISO).

### `applyDepthOfField(vec3 color, float distance, Camera cam)`
Applies depth of field blur effect if enabled. Blurs objects that are out of focus.

### `calculateExposure(Camera cam)`
Calculates the exposure multiplier from camera settings. Returns a value typically in range 0.1-10.0.

### `calculateFOV(Camera cam)`
Calculates field of view in radians from focal length and sensor size.

### `calculateCircleOfConfusion(Camera cam, float distance)`
Calculates circle of confusion radius for depth of field calculations. The function implements the correct physical relationship where **larger f-stop values (smaller aperture) produce less blur** (more depth of field), matching real-world camera behavior.

### `createSkyCamera()`
Creates a camera preset optimized for sky-only scenes with wide-angle lens and appropriate exposure settings.

### `orbitCamera(Camera cam, float angle, float elevation, float distance, vec3 center)`
Orbits the camera around a target point. Useful for creating circular camera movements.
- `angle`: Rotation angle in radians (0 = east, PI/2 = north, PI = west)
- `elevation`: Elevation angle in radians (-PI/2 to PI/2)
- `distance`: Distance from target point
- `center`: Target point to orbit around

### `dollyCamera(Camera cam, float distance)`
Moves the camera forward or backward along the view direction.
- `distance`: Positive = forward, negative = backward

### `panCamera(Camera cam, vec2 offset)`
Moves the camera left/right and up/down perpendicular to the view direction.
- `offset.x`: Horizontal pan (positive = right)
- `offset.y`: Vertical pan (positive = up)

### `tiltCamera(Camera cam, float angle)`
Rotates the camera up/down around the right axis.
- `angle`: Rotation angle in radians (positive = tilt up)

### `interpolateCamera(Camera cam1, Camera cam2, float t)`
Smoothly interpolates between two camera configurations.
- `t`: Interpolation factor (0.0 = cam1, 1.0 = cam2)

### `calculateAutoFocusDistance(Camera cam, vec3 rayDir, float maxDistance)`
Calculates suggested auto-focus distance. Returns a reasonable default based on camera position. For full implementation, integrate with scene raymarching.

### `applyVignette(vec3 color, vec2 uv, Camera cam)`
Applies vignette effect (darkening at edges) if enabled.

### `applyChromaticAberration(vec3 color, vec2 uv, vec2 resolution, Camera cam)`
Applies chromatic aberration effect (color fringing at edges) if enabled.

### `applyFilmGrain(vec3 color, vec2 uv, float time, Camera cam)`
Applies film grain effect if enabled. Grain is more visible in darker areas.

### `applyCameraEffects(vec3 color, vec2 uv, vec2 resolution, float time, Camera cam)`
Applies all camera effects (vignette, film grain) in one call. Convenience function.

## Examples

### Basic Camera Setup
```glsl
// Create camera
Camera cam = createDefaultCamera();

// Position camera
cam.position = vec3(0.0, 5.0, 10.0);
cam.target = vec3(0.0, 0.0, 0.0);
cam.up = vec3(0.0, 1.0, 0.0);

// Generate ray
vec2 uv = fragCoord / iResolution.xy;
vec3 rd = generateCameraRay(cam, uv, iResolution.xy);

// Create materials
WaterMaterial waterMaterial = createDefaultWaterMaterial();
TerrainMaterial terrainMaterial = createDefaultTerrainMaterial();

// Render scene (using RenderPipeline)
RenderContext ctx;
ctx.cameraPos = cam.position;
ctx.rayDir = rd;
ctx.time = iTime;
ctx.sky = createSkyPreset_ClearDay();
ctx.terrainParams = createFlatTerrain();
ctx.camera = cam;
ctx.waterMaterial = waterMaterial;
ctx.terrainMaterial = terrainMaterial;

RenderResult result = renderScene(ctx);
vec3 color = result.color;

// Apply exposure
color = applyExposure(color, cam);
```

### Manual Exposure Control
```glsl
Camera cam = createDefaultCamera();

// Brighten the scene (wider aperture)
cam.fStop = 1.4;  // f/1.4 is 4x brighter than f/2.8

// Or use slower shutter
cam.shutterSpeed = 1.0 / 30.0;  // 2x brighter than 1/60s

// Or increase ISO
cam.iso = 400.0;  // 4x brighter than ISO 100

// Apply exposure
color = applyExposure(color, cam);
```

### Depth of Field Effect
```glsl
Camera cam = createCinematicCamera();

// Enable depth of field
cam.enableDOF = true;
cam.focusDistance = 5.0;  // Focus at 5 meters
cam.fStop = 1.4;          // Wide aperture for shallow DOF

// Generate camera ray
vec2 uv = fragCoord / iResolution.xy;
vec3 rd = generateCameraRay(cam, uv, iResolution.xy);

// Create materials
WaterMaterial waterMaterial = createDefaultWaterMaterial();
TerrainMaterial terrainMaterial = createDefaultTerrainMaterial();

// Render scene (using RenderPipeline)
RenderContext ctx;
ctx.cameraPos = cam.position;
ctx.rayDir = rd;
ctx.time = iTime;
ctx.sky = createSkyPreset_ClearDay();
ctx.terrainParams = createFlatTerrain();
ctx.camera = cam;
ctx.waterMaterial = waterMaterial;
ctx.terrainMaterial = terrainMaterial;

RenderResult result = renderScene(ctx);
vec3 color = result.color;
float distance = result.distance;

// Apply depth of field
color = applyDepthOfField(color, distance, cam);
color = applyExposure(color, cam);
```

### Wide Angle Shot
```glsl
Camera cam = createDefaultCamera();

// Use wide angle lens
cam.focalLength = 24.0;  // 24mm wide angle

// This automatically increases FOV
vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
```

### Telephoto Shot
```glsl
Camera cam = createDefaultCamera();

// Use telephoto lens
cam.focalLength = 200.0;  // 200mm telephoto

// This automatically decreases FOV (zooms in)
vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
```

### Exposure Compensation
```glsl
Camera cam = createDefaultCamera();

// Want to capture fast motion but scene is dark
// Solution: Use fast shutter but compensate with ISO
cam.shutterSpeed = 1.0 / 1000.0;  // Freeze motion
cam.iso = 1600.0;                  // Compensate for lost light

// Or use wider aperture
cam.fStop = 1.4;  // Let in more light

color = applyExposure(color, cam);
```

### Using Exposure Compensation
```glsl
Camera cam = createDefaultCamera();

// Fine-tune exposure without changing f-stop/shutter/ISO
cam.exposureCompensation = 0.5;   // +0.5 EV (1.4x brighter)
// cam.exposureCompensation = -1.0; // -1.0 EV (0.5x brighter)

color = applyExposure(color, cam);
```

### Matching Real Camera Settings
```glsl
// Replicate a real camera setup:
// Canon 5D Mark IV, 85mm f/1.2 lens, 1/125s, ISO 400

Camera cam = createDefaultCamera();
cam.focalLength = 85.0;
cam.fStop = 1.2;
cam.shutterSpeed = 1.0 / 125.0;
cam.iso = 400.0;
cam.enableDOF = true;
cam.focusDistance = 10.0;

vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
// ... render ...
color = applyExposure(color, cam);
```

### Camera Animation - Orbiting
```glsl
Camera cam = createDefaultCamera();

// Orbit camera around origin
float angle = iTime * 0.5;  // Rotate over time
float elevation = 0.3;      // Look down slightly
float distance = 10.0;       // 10 units from center
vec3 center = vec3(0.0);

cam = orbitCamera(cam, angle, elevation, distance, center);

vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
```

### Camera Animation - Smooth Interpolation
```glsl
Camera cam1 = createDefaultCamera();
cam1.position = vec3(0.0, 5.0, 10.0);
cam1.target = vec3(0.0, 0.0, 0.0);

Camera cam2 = createDefaultCamera();
cam2.position = vec3(10.0, 5.0, 0.0);
cam2.target = vec3(0.0, 0.0, 0.0);

// Interpolate between camera positions
float t = sin(iTime * 0.5) * 0.5 + 0.5;  // Smooth 0-1 oscillation
Camera cam = interpolateCamera(cam1, cam2, t);

vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
```

### Camera Effects
```glsl
Camera cam = createDefaultCamera();

// Enable camera effects
cam.vignetteStrength = 0.3;         // Subtle vignette
cam.chromaticAberration = 0.2;     // Light chromatic aberration
cam.filmGrain = 0.15;              // Subtle film grain

// ... render scene ...
vec3 color = result.color;

// Apply camera effects
vec2 uv = fragCoord / iResolution.xy;
color = applyCameraEffects(color, uv, iResolution.xy, iTime, cam);
color = applyExposure(color, cam);
```

### Improved Depth of Field
```glsl
Camera cam = createCinematicCamera();

// Improved DOF with better blur quality
cam.enableDOF = true;
cam.focusDistance = 5.0;
cam.fStop = 1.4;  // Wide aperture for shallow DOF

// ... render scene ...
vec3 color = result.color;
float distance = result.distance;

// Apply improved depth of field
color = applyDepthOfField(color, distance, cam);
color = applyExposure(color, cam);
```

## Tips

1. **For bright scenes**: Use smaller f-stop (f/8, f/11) and fast shutter (1/250s)
2. **For dark scenes**: Use larger f-stop (f/1.4, f/2.8) and higher ISO (800+)
3. **For motion blur**: Use slower shutter (1/30s or slower)
4. **For sharp images**: Use fast shutter (1/250s or faster)
5. **For shallow depth of field**: Use wide aperture (f/1.4, f/2.8) and enable DOF
6. **For deep depth of field**: Use narrow aperture (f/11, f/16) and disable DOF
7. **For fine exposure control**: Use `exposureCompensation` to adjust brightness without changing f-stop/shutter/ISO
8. **For cinematic look**: Enable vignette (0.2-0.4) and subtle film grain (0.1-0.2)
9. **For camera animation**: Use `orbitCamera()` for circular movements, `interpolateCamera()` for smooth transitions
10. **For sky scenes**: Use `createSkyCamera()` preset optimized for atmospheric rendering

## Performance Notes

- **Depth of Field**: Has performance impact when enabled. Disable for real-time applications if needed.
- **Camera Effects**: Vignette and film grain are lightweight. Chromatic aberration requires additional sampling in full implementation.
- **Camera Animation**: Animation functions are efficient and can be used in real-time.

## Advanced Features

### Improved Depth of Field
The depth of field implementation has been improved with:
- Better blur calculation using circle of confusion
- Hyperfocal distance approximation for realistic DOF behavior
- Smooth falloff for more natural blur transitions
- Proper handling of objects beyond hyperfocal distance

### Camera Animation System
The camera system now includes a complete animation toolkit:
- **Orbit**: Circular camera movements around a target
- **Dolly**: Forward/backward movement along view direction
- **Pan**: Horizontal/vertical movement perpendicular to view
- **Tilt**: Up/down rotation around right axis
- **Interpolation**: Smooth transitions between camera configurations

### Camera Effects
Post-processing effects for artistic control:
- **Vignette**: Darkens edges for cinematic framing
- **Chromatic Aberration**: Simulates lens imperfections (color fringing)
- **Film Grain**: Adds texture and character, more visible in shadows

All effects are optional and can be enabled/disabled independently.


