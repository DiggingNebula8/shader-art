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

You can customize any preset by modifying its properties after creation. Note that the `SkyAtmosphere` struct uses nested sub-structs for better organization:

```glsl
// Start with a preset
SkyAtmosphere sky = createSkyPreset_ClearDay();

// Customize properties using nested structs
sky.sunMoon.sunElevation = 0.3;           // Lower sun
sky.clouds.cloudDensity = 0.8;            // More clouds
sky.fog.fogDensity = 0.05;                // More fog
sky.colors.horizonGlowIntensity = 1.0;    // Brighter horizon glow

// Use the customized sky
vec3 skyColor = evaluateSky(sky, dir, time);
```

## SkyAtmosphere Structure

The `SkyAtmosphere` struct is organized into sub-structs for better maintainability and clarity:

```glsl
struct SkyAtmosphere {
    SunMoonConfig sunMoon;      // Sun and moon configuration
    ScatteringConfig scattering; // Atmospheric scattering parameters
    ColorConfig colors;          // Sky colors and gradients
    CloudConfig clouds;          // Cloud parameters
    FogConfig fog;              // Fog/atmospheric perspective
    
    // Stars (top-level for simplicity)
    bool enableStars;
    float starDensity;
    float starBrightness;
    float starTwinkle;
    
    // Advanced Controls (top-level)
    float exposure;
    float contrast;
    float saturation;
    float horizonOffset;
};
```

### Sun/Moon Configuration (`sunMoon`)
- `sunMoon.sunRotation`: Sun rotation angle (0 = east, 0.5 = noon, 1 = west)
- `sunMoon.sunElevation`: Sun elevation (-1 = below horizon, 1 = zenith)
- `sunMoon.sunColor`: Base sun color (before atmospheric effects)
- `sunMoon.sunSize`: Sun angular size in radians
- `sunMoon.sunIntensity`: Sun light intensity multiplier
- `sunMoon.sunPower`: Sun disk brightness power
- `sunMoon.enableMoon`: Enable moon rendering
- `sunMoon.moonRotation`: Moon rotation (typically opposite to sun)
- `sunMoon.moonElevation`: Moon elevation
- `sunMoon.moonColor`: Moon color
- `sunMoon.moonSize`: Moon angular size
- `sunMoon.moonIntensity`: Moon light intensity

### Atmospheric Scattering (`scattering`)
- `scattering.rayleighCoefficient`: Rayleigh scattering strength
- `scattering.rayleighScaleHeight`: Rayleigh scale height in meters
- `scattering.mieCoefficient`: Mie scattering strength
- `scattering.mieScaleHeight`: Mie scale height in meters
- `scattering.mieG`: Mie asymmetry parameter (0.0-1.0)
- `scattering.scatteringScale`: Overall scattering intensity scale

### Sky Colors & Gradients (`colors`)
- `colors.zenithColor`: Sky color at zenith (top)
- `colors.horizonColor`: Sky color at horizon
- `colors.nightColor`: Night sky base color
- `colors.twilightColor`: Twilight/sunset base color
- `colors.horizonGlowColor`: Horizon glow color
- `colors.horizonGlowIntensity`: Horizon glow strength
- `colors.horizonGlowPower`: Horizon glow falloff power

### Stars (top-level)
- `enableStars`: Enable star field
- `starDensity`: Star field density (0.0-1.0)
- `starBrightness`: Star brightness multiplier
- `starTwinkle`: Star twinkle amount (0.0-1.0)

### Clouds (`clouds`)
- `clouds.enableClouds`: Enable volumetric clouds
- `clouds.cloudDensity`: Overall cloud density (0.0-1.0)
- `clouds.cloudHeight`: Cloud layer height in meters
- `clouds.cloudThickness`: Cloud layer thickness in meters
- `clouds.cloudCoverage`: Cloud coverage amount (0.0-1.0)
- `clouds.cloudColorDay`: Cloud color during day
- `clouds.cloudColorSunset`: Cloud color during sunset
- `clouds.cloudColorNight`: Cloud color during night
- `clouds.cloudWindSpeed`: Cloud animation speed

### Fog/Atmospheric Perspective (`fog`)
- `fog.enableFog`: Enable atmospheric fog
- `fog.fogDensity`: Fog density (higher = more fog)
- `fog.fogDistance`: Fog start distance
- `fog.fogHeightFalloff`: Fog height falloff rate
- `fog.fogDistanceFalloff`: Fog distance falloff (0 = constant, higher = more fog at distance)
- `fog.fogHorizonBoost`: Additional fog density boost at horizon (0-1)
- `fog.fogColor`: Base fog color

### Advanced Controls (top-level)
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

// Enhance the sunset effect using nested structs
sky.sunMoon.sunElevation = 0.05;                    // Very low sun
sky.colors.horizonGlowIntensity = 1.2;               // Stronger glow
sky.colors.horizonGlowColor = vec3(1.0, 0.4, 0.1);  // More orange
sky.clouds.cloudCoverage = 0.7;                      // More clouds for dramatic effect

// Use it
vec3 skyColor = evaluateSky(sky, dir, time);
```

### Dynamic Day/Night Cycle
```glsl
// Interpolate between day and night based on time
float dayTime = sin(iTime * 0.1) * 0.5 + 0.5;  // 0 = night, 1 = day

SkyAtmosphere daySky = createSkyPreset_ClearDay();
SkyAtmosphere nightSky = createSkyPreset_Night();

// Mix sky configurations using nested structs
SkyAtmosphere sky;
sky.sunMoon.sunElevation = mix(nightSky.sunMoon.sunElevation, daySky.sunMoon.sunElevation, dayTime);
sky.sunMoon.sunIntensity = mix(nightSky.sunMoon.sunIntensity, daySky.sunMoon.sunIntensity, dayTime);
sky.colors.zenithColor = mix(nightSky.colors.zenithColor, daySky.colors.zenithColor, dayTime);
sky.colors.horizonColor = mix(nightSky.colors.horizonColor, daySky.colors.horizonColor, dayTime);
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


