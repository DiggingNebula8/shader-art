# Sky System Documentation

## Overview

The Sky System provides a comprehensive abstraction for lighting, sky, and atmospheric rendering. It includes physically-based atmospheric scattering, sun/moon rendering, stars, clouds, and fog effects.

## Basic Usage

```glsl
// Create a sky preset
SkyAtmosphere sky = createSkyPreset_ClearDay();

// Evaluate sky color for a direction
vec3 skyColor = evaluateSky(sky, dir, time);

// Get lighting information
LightingInfo light = evaluateLighting(sky, time);

// Apply atmospheric fog
vec3 fogColor = applyAtmosphericFog(color, pos, camPos, rayDir, sky, time);
```

## Available Presets

### Clear Day
```glsl
SkyAtmosphere sky = createSkyPreset_ClearDay();  // Bright sunny day
```
- High sun elevation (0.7)
- Strong sun intensity (2.5)
- Low cloud density (0.2)
- Minimal fog (0.01)
- Stars disabled

### Sunset/Sunrise
```glsl
SkyAtmosphere sky = createSkyPreset_Sunset();  // Warm sunset/sunrise
```
- Low sun elevation (0.1)
- Sun positioned in west (rotation 0.75)
- Warm sun color (orange/red tint)
- Enhanced horizon glow
- Moderate clouds and fog

### Night
```glsl
SkyAtmosphere sky = createSkyPreset_Night();  // Starlit night with moon
```
- Sun below horizon (-0.3)
- Moon visible at elevation 0.5
- Stars enabled with full density
- Dark sky colors
- Low fog density

### Cloudy Day
```glsl
SkyAtmosphere sky = createSkyPreset_CloudyDay();  // Overcast day
```
- Moderate sun elevation (0.6)
- High cloud density (0.8) and coverage (0.9)
- Gray sky colors
- Increased fog

### Stormy
```glsl
SkyAtmosphere sky = createSkyPreset_Stormy();  // Dark stormy sky
```
- Low sun elevation (0.3)
- Very high cloud density (1.0) and coverage (1.0)
- Dark, gray sky colors
- High fog density (0.04)
- Dimmed sun color

### Foggy
```glsl
SkyAtmosphere sky = createSkyPreset_Foggy();  // Foggy/hazy atmosphere
```
- Moderate sun elevation (0.5)
- High fog density (0.05)
- Reduced fog distance (30.0)
- Gray-tinted sky colors

## Customizing Presets

You can customize any preset by modifying its properties after creation:

```glsl
// Start with a preset
SkyAtmosphere sky = createSkyPreset_ClearDay();

// Customize properties
sky.sunElevation = 0.3;           // Lower sun
sky.cloudDensity = 0.8;            // More clouds
sky.fogDensity = 0.05;             // More fog
sky.horizonGlowIntensity = 1.0;    // Brighter horizon glow

// Use the customized sky
vec3 skyColor = evaluateSky(sky, dir, time);
```

## SkyAtmosphere Structure

### Sun/Moon Configuration
- `sunRotation`: Sun rotation angle (0 = east, 0.5 = noon, 1 = west)
- `sunElevation`: Sun elevation (-1 = below horizon, 1 = zenith)
- `sunColor`: Base sun color (before atmospheric effects)
- `sunSize`: Sun angular size in radians
- `sunIntensity`: Sun light intensity multiplier
- `sunPower`: Sun disk brightness power
- `enableMoon`: Enable moon rendering
- `moonRotation`: Moon rotation (typically opposite to sun)
- `moonElevation`: Moon elevation
- `moonColor`: Moon color
- `moonSize`: Moon angular size
- `moonIntensity`: Moon light intensity

### Atmospheric Scattering
- `rayleighCoefficient`: Rayleigh scattering strength
- `rayleighScaleHeight`: Rayleigh scale height in meters
- `mieCoefficient`: Mie scattering strength
- `mieScaleHeight`: Mie scale height in meters
- `mieG`: Mie asymmetry parameter (0.0-1.0)
- `scatteringScale`: Overall scattering intensity scale

### Sky Colors & Gradients
- `zenithColor`: Sky color at zenith (top)
- `horizonColor`: Sky color at horizon
- `nightColor`: Night sky base color
- `twilightColor`: Twilight/sunset base color

### Horizon Glow
- `horizonGlowColor`: Horizon glow color
- `horizonGlowIntensity`: Horizon glow strength
- `horizonGlowPower`: Horizon glow falloff power

### Stars
- `enableStars`: Enable star field
- `starDensity`: Star field density (0.0-1.0)
- `starBrightness`: Star brightness multiplier
- `starTwinkle`: Star twinkle amount (0.0-1.0)

### Clouds
- `enableClouds`: Enable volumetric clouds
- `cloudDensity`: Overall cloud density (0.0-1.0)
- `cloudHeight`: Cloud layer height in meters
- `cloudThickness`: Cloud layer thickness in meters
- `cloudCoverage`: Cloud coverage amount (0.0-1.0)
- `cloudColorDay`: Cloud color during day
- `cloudColorSunset`: Cloud color during sunset
- `cloudColorNight`: Cloud color during night
- `cloudWindSpeed`: Cloud animation speed

### Fog/Atmospheric Perspective
- `enableFog`: Enable atmospheric fog
- `fogDensity`: Fog density (higher = more fog)
- `fogDistance`: Fog start distance
- `fogHeightFalloff`: Fog height falloff rate
- `fogColor`: Base fog color

### Advanced Controls
- `exposure`: Overall sky exposure adjustment
- `contrast`: Sky contrast (1.0 = default)
- `saturation`: Sky color saturation (1.0 = default)
- `horizonOffset`: Horizon line offset (0.0 = sea level)

## Functions

### `evaluateSky(SkyAtmosphere sky, vec3 dir, float time)`
Evaluates the complete sky color for a given direction and time. Includes atmospheric scattering, sun/moon disks, stars, clouds, and post-processing.

### `evaluateLighting(SkyAtmosphere sky, float time)`
Extracts lighting information (sun/moon directions, colors, intensities) from the sky configuration.

### `skyColor(vec3 dir, SkyAtmosphere sky, float time)`
Convenience wrapper for `evaluateSky()`.

### `applyAtmosphericFog(vec3 color, vec3 pos, vec3 camPos, vec3 rayDir, SkyAtmosphere sky, float time)`
Applies atmospheric fog/haze to a color based on distance and height, using the sky configuration.

## Examples

### Basic Sky Rendering
```glsl
// Create sky
SkyAtmosphere sky = createSkyPreset_ClearDay();

// Evaluate sky color for background
vec3 bgColor = skyColor(rayDir, sky, iTime);
```

### Custom Sunset Sky
```glsl
// Start with sunset preset
SkyAtmosphere sky = createSkyPreset_Sunset();

// Enhance the sunset effect
sky.sunElevation = 0.05;              // Very low sun
sky.horizonGlowIntensity = 1.2;        // Stronger glow
sky.horizonGlowColor = vec3(1.0, 0.4, 0.1);  // More orange
sky.cloudCoverage = 0.7;               // More clouds for dramatic effect

// Use it
vec3 skyColor = evaluateSky(sky, dir, time);
```

### Dynamic Day/Night Cycle
```glsl
// Interpolate between day and night based on time
float dayTime = sin(iTime * 0.1) * 0.5 + 0.5;  // 0 = night, 1 = day

SkyAtmosphere daySky = createSkyPreset_ClearDay();
SkyAtmosphere nightSky = createSkyPreset_Night();

// Mix sky configurations
SkyAtmosphere sky;
sky.sunElevation = mix(nightSky.sunElevation, daySky.sunElevation, dayTime);
sky.sunIntensity = mix(nightSky.sunIntensity, daySky.sunIntensity, dayTime);
sky.zenithColor = mix(nightSky.zenithColor, daySky.zenithColor, dayTime);
sky.horizonColor = mix(nightSky.horizonColor, daySky.horizonColor, dayTime);
sky.enableStars = dayTime < 0.3;  // Stars visible at night

vec3 skyColor = evaluateSky(sky, dir, iTime);
```

### Atmospheric Fog Integration
```glsl
SkyAtmosphere sky = createSkyPreset_Foggy();

// Render scene
vec3 color = shadeOcean(pos, normal, viewDir, iTime, gradient, sky);

// Apply atmospheric fog
color = applyAtmosphericFog(color, pos, cam.position, rayDir, sky, iTime);
```

