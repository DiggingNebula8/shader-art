# Camera Test Scene

This scene demonstrates the new camera system features added to the shader-art project. It provides a simple testbed for exploring camera animation, effects, and settings.

## Features Demonstrated

### 1. Camera Animation
- **Orbiting**: Camera orbits around a center point with configurable angle, elevation, and distance
- **Interpolation**: Smooth transitions between two camera positions
- **Static**: Traditional static camera positioning

### 2. Camera Presets
Test different camera presets by uncommenting them:
- `createCinematicCamera()` - Shallow DOF, portrait lens
- `createSunnyDayCamera()` - Bright scene settings
- `createLowLightCamera()` - Low light settings
- `createSkyCamera()` - Wide angle for sky scenes

### 3. Depth of Field
- Enable/disable DOF with `cam.enableDOF`
- Adjust focus distance with `cam.focusDistance`
- Test shallow DOF with wide apertures (f/1.4)
- Multiple spheres at different distances demonstrate DOF blur

### 4. Exposure Compensation
- Fine-tune exposure without changing f-stop/shutter/ISO
- Range: -2.0 to +2.0 EV stops
- Each EV stop doubles/halves exposure

### 5. Camera Effects
- **Vignette**: Darkens edges for cinematic framing
- **Chromatic Aberration**: Color fringing at edges
- **Film Grain**: Film-like texture, more visible in shadows

## Usage

### Basic Setup
The scene renders 4 spheres at different distances:
- Close sphere (2m) - Blue
- Medium sphere (5m) - Blue
- Far sphere (8m) - Orange
- Very far sphere (12m) - Orange

### Testing Camera Animation

**Orbiting (default)**:
```glsl
float orbitAngle = iTime * 0.3;
float orbitElevation = 0.4;
float orbitDistance = 8.0;
cam = orbitCamera(cam, orbitAngle, orbitElevation, orbitDistance, orbitCenter);
```

**Interpolation**:
Uncomment the interpolation code block to see smooth camera transitions.

**Static**:
Uncomment the static camera code to disable animation.

### Testing Camera Effects

Adjust effect strengths in the code:
```glsl
cam.vignetteStrength = 0.3;         // 0.0 = none, 1.0 = strong
cam.chromaticAberration = 0.2;       // 0.0 = none, 1.0 = strong
cam.filmGrain = 0.15;                // 0.0 = none, 1.0 = strong
```

### Testing Depth of Field

**Shallow DOF**:
```glsl
cam.enableDOF = true;
cam.fStop = 1.4;              // Wide aperture
cam.focusDistance = 2.0;       // Focus on close sphere
```

**Deep DOF**:
```glsl
cam.enableDOF = true;
cam.fStop = 11.0;              // Narrow aperture
cam.focusDistance = 5.0;       // Focus on medium sphere
```

### Testing Exposure Compensation

```glsl
cam.exposureCompensation = 0.5;   // +0.5 EV (brighter)
cam.exposureCompensation = -0.5;  // -0.5 EV (darker)
cam.exposureCompensation = 0.0;   // No compensation (neutral)
```

## Scene Structure

- Simple geometry: 4 spheres at different distances
- Basic raymarching with SDF functions
- Simple Phong shading with sky lighting
- Full camera system integration

## Tips

1. **Start with orbiting camera** - It's the default and shows the scene well
2. **Enable DOF** - See how different spheres blur based on focus distance
3. **Adjust vignette** - Try values from 0.0 to 0.6 for different looks
4. **Test exposure compensation** - See how it affects brightness without changing other settings
5. **Try different presets** - Each preset has different characteristics

## Performance

- Camera effects are lightweight and can be used in real-time
- Depth of field has a small performance cost when enabled
- Animation functions are efficient and suitable for real-time use

