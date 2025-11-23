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

## Exposure Relationship

The exposure system follows real photographic principles:

- **Lower f-stop** (wider aperture) = brighter image, less depth of field
- **Slower shutter** = brighter image, more motion blur
- **Higher ISO** = brighter image, more noise

**Standard exposure**: f/2.8, 1/60s, ISO 100

Each parameter affects exposure multiplicatively:
- Each f-stop change doubles/halves light (f/1.4, f/2, f/2.8, f/4, f/5.6, f/8, f/11, f/16, f/22)
- Each shutter speed change doubles/halves light (1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15)
- Each ISO change doubles/halves sensitivity (100, 200, 400, 800, 1600)

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
Calculates circle of confusion radius for depth of field calculations.

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

// Render scene...
vec3 color = renderScene(cam.position, rd);

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

// Render scene
vec3 color = renderScene(cam.position, rd);
float distance = length(hitPoint - cam.position);

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

## Tips

1. **For bright scenes**: Use smaller f-stop (f/8, f/11) and fast shutter (1/250s)
2. **For dark scenes**: Use larger f-stop (f/1.4, f/2.8) and higher ISO (800+)
3. **For motion blur**: Use slower shutter (1/30s or slower)
4. **For sharp images**: Use fast shutter (1/250s or faster)
5. **For shallow depth of field**: Use wide aperture (f/1.4, f/2.8) and enable DOF
6. **For deep depth of field**: Use narrow aperture (f/11, f/16) and disable DOF

