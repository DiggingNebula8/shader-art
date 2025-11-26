// ============================================================================
// CAMERA TEST SCENE - SHADER ENTRY POINT
// ============================================================================
// This scene demonstrates the new camera system features:
//   - Camera animation (orbiting, interpolation)
//   - Camera effects (vignette, chromatic aberration, film grain)
//   - Improved depth of field
//   - Exposure compensation
//   - Various camera presets
//
// Architecture:
//   Scene.frag (THIS FILE)
//     ├─ mainImage() - Shader entry point
//     ├─ Simple geometry (spheres) for testing
//     ├─ Camera setup with animation and effects
//     └─ Direct rendering with camera features
// ============================================================================

#include "../../Systems/CoreSystems/Common.frag"
#include "../../Systems/CoreSystems/CameraSystem.frag"
#include "../../Systems/CoreSystems/SkySystem.frag"
#include "../../Systems/CoreSystems/DistanceFieldSystem.frag"
#include "../../Systems/GeometrySystems/ObjectSystem.frag"
#include "../../Systems/MaterialShading/ObjectShading.frag"

// ============================================================================
// SIMPLE SCENE GEOMETRY
// ============================================================================

// Simple sphere SDF
float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

// Scene with multiple spheres at different distances
// Note: Objects are animated. Set time = 0.0 in the function call to make them static.
float getSceneSDF(vec3 pos, float time) {
    // Sphere 1: Close (for DOF testing) - Static (reference point)
    float sphere1 = sphereSDF(pos, vec3(0.0, 0.0, 2.0), 0.5);
    
    // Sphere 2: Medium distance - Rotating around Y-axis
    float angle2 = time * 0.5;
    vec2 sphere2XZ = vec2(-2.0, 0.0);
    sphere2XZ = vec2(
        cos(angle2) * sphere2XZ.x - sin(angle2) * sphere2XZ.y,
        sin(angle2) * sphere2XZ.x + cos(angle2) * sphere2XZ.y
    );
    float sphere2 = sphereSDF(pos, vec3(sphere2XZ.x, 1.0, sphere2XZ.y + 5.0), 0.8);
    
    // Sphere 3: Far distance - Floating up and down
    float sphere3Y = -0.5 + sin(time * 0.8) * 0.5;
    float sphere3 = sphereSDF(pos, vec3(2.0, sphere3Y, 8.0), 0.6);
    
    // Sphere 4: Very far - Orbiting in XZ plane
    vec3 sphere4Pos = vec3(
        cos(time * 0.3) * 2.0,
        2.0,
        12.0 + sin(time * 0.3) * 1.0
    );
    float sphere4 = sphereSDF(pos, sphere4Pos, 1.0);
    
    // Combine using smooth union
    float result = sphere1;
    result = smoothMinSDF(result, sphere2, 1.0);
    result = smoothMinSDF(result, sphere3, 1.0);
    result = smoothMinSDF(result, sphere4, 1.0);
    
    return result;
}

// Get normal using finite differences
vec3 getSceneNormal(vec3 pos, float time) {
    const float eps = 0.001;
    float d = getSceneSDF(pos, time);
    return normalize(vec3(
        getSceneSDF(pos + vec3(eps, 0.0, 0.0), time) - d,
        getSceneSDF(pos + vec3(0.0, eps, 0.0), time) - d,
        getSceneSDF(pos + vec3(0.0, 0.0, eps), time) - d
    ));
}

// Simple raymarching
float raymarchScene(vec3 ro, vec3 rd, float maxDist, float time) {
    const int maxSteps = 64;
    const float minDist = 0.001;
    
    float t = 0.0;
    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * t;
        float d = getSceneSDF(p, time);
        
        if (d < minDist) {
            return t;
        }
        
        t += d;
        if (t > maxDist) break;
    }
    
    return maxDist;
}

// ============================================================================
// TONE MAPPING
// ============================================================================

vec3 toneMapReinhardJodie(vec3 color) {
    float L = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 luminanceBased = color / (1.0 + L);
    vec3 perChannel = color / (1.0 + color);
    vec3 mixFactor = perChannel;
    vec3 result = mix(luminanceBased, perChannel, mixFactor);
    return clamp(result, 0.0, 1.0);
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // ============================================================================
    // CAMERA SETUP WITH ANIMATION
    // ============================================================================
    
    // Create base camera
    Camera cam = createDefaultCamera();
    
    // ============================================================================
    // CAMERA ANIMATION DEMONSTRATION
    // ============================================================================
    // Uncomment different animation modes to test:
    
    // Mode 1: Orbiting camera (default)
    float orbitAngle = iTime * 0.3;  // Rotate over time
    float orbitElevation = 0.4;       // Look down slightly
    float orbitDistance = 8.0;        // Distance from center
    vec3 orbitCenter = vec3(0.0, 0.0, 5.0);  // Center of orbit
    cam = orbitCamera(cam, orbitAngle, orbitElevation, orbitDistance, orbitCenter);
    
    // Mode 2: Smooth interpolation between two camera positions
    // Camera cam1 = createDefaultCamera();
    // cam1.position = vec3(-5.0, 3.0, 5.0);
    // cam1.target = vec3(0.0, 0.0, 5.0);
    // 
    // Camera cam2 = createDefaultCamera();
    // cam2.position = vec3(5.0, 3.0, 5.0);
    // cam2.target = vec3(0.0, 0.0, 5.0);
    // 
    // float t = sin(iTime * 0.5) * 0.5 + 0.5;  // Smooth 0-1 oscillation
    // cam = interpolateCamera(cam1, cam2, t);
    
    // Mode 3: Static camera (no animation)
    // cam.position = vec3(0.0, 3.0, 8.0);
    // cam.target = vec3(0.0, 0.0, 5.0);
    // cam.up = vec3(0.0, 1.0, 0.0);
    
    // ============================================================================
    // CAMERA SETTINGS
    // ============================================================================
    
    // Test different camera presets (uncomment to try):
    // cam = createCinematicCamera();      // Shallow DOF, portrait lens
    // cam = createSunnyDayCamera();      // Bright scene settings
    // cam = createLowLightCamera();       // Low light settings
    // cam = createSkyCamera();            // Wide angle for sky
    
    // Customize camera settings
    cam.focalLength = 50.0;        // Standard lens
    cam.fStop = 2.8;               // Moderate aperture
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100
    
    // ============================================================================
    // DEPTH OF FIELD
    // ============================================================================
    cam.enableDOF = true;          // Enable depth of field
    cam.focusDistance = 5.0;       // Focus at 5 meters (medium distance sphere)
    
    // Test shallow DOF (wide aperture):
    // cam.fStop = 1.4;             // Very wide aperture = shallow DOF
    // cam.focusDistance = 2.0;      // Focus on close sphere
    
    // ============================================================================
    // EXPOSURE COMPENSATION
    // ============================================================================
    cam.exposureCompensation = 0.0;  // No compensation (0.0 = neutral)
    // Try different values:
    // cam.exposureCompensation = 0.5;   // +0.5 EV (brighter)
    // cam.exposureCompensation = -0.5;  // -0.5 EV (darker)
    
    // ============================================================================
    // CAMERA EFFECTS
    // ============================================================================
    cam.vignetteStrength = 0.3;         // Subtle vignette (0.0 = none, 1.0 = strong)
    cam.chromaticAberration = 0.2;      // Light chromatic aberration
    cam.filmGrain = 0.15;               // Subtle film grain
    
    // Test different effect strengths:
    // cam.vignetteStrength = 0.6;       // Strong vignette
    // cam.chromaticAberration = 0.5;     // Strong chromatic aberration
    // cam.filmGrain = 0.3;              // More visible grain
    
    // ============================================================================
    // GENERATE CAMERA RAY
    // ============================================================================
    vec3 rayDir = generateCameraRay(cam, uv, iResolution.xy);
    vec3 rayOrigin = cam.position;
    
    // ============================================================================
    // RENDER SCENE
    // ============================================================================
    
    // Sky configuration
    SkyAtmosphere sky = createSkyPreset_ClearDay();
    
    // Raymarch scene
    const float maxDist = 50.0;
    float hitDist = raymarchScene(rayOrigin, rayDir, maxDist, iTime);
    
    vec3 color = vec3(0.0);
    float finalDistance = maxDist;
    
    if (hitDist < maxDist) {
        // Hit surface
        vec3 hitPos = rayOrigin + rayDir * hitDist;
        vec3 normal = getSceneNormal(hitPos, iTime);
        
        // Simple shading
        vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
        float ndotl = max(dot(normal, lightDir), 0.0);
        
        // Sky lighting
        vec3 skyColor = evaluateSky(sky, rayDir, iTime);
        vec3 sunColor = vec3(1.0, 0.95, 0.8);
        
        // Material color (vary by distance for visual interest)
        vec3 materialColor = vec3(0.3, 0.5, 0.8);  // Blue-ish
        if (hitDist > 7.0) {
            materialColor = vec3(0.8, 0.5, 0.3);  // Orange-ish for far objects
        }
        
        // Combine lighting
        vec3 ambient = skyColor * 0.3;
        vec3 diffuse = sunColor * ndotl * 0.7;
        color = materialColor * (ambient + diffuse);
        
        // Add specular highlight
        vec3 viewDir = normalize(rayOrigin - hitPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
        color += sunColor * spec * 0.3;
        
        finalDistance = hitDist;
    } else {
        // Sky only
        color = evaluateSky(sky, rayDir, iTime);
    }
    
    // ============================================================================
    // POST-PROCESSING
    // ============================================================================
    
    // Apply camera exposure (physically-based)
    color = applyExposure(color, cam);
    
    // Apply depth of field (if enabled)
    color = applyDepthOfField(color, finalDistance, cam);
    
    // Apply camera effects (vignette, film grain, etc.)
    color = applyCameraEffects(color, uv, iResolution.xy, iTime, cam);
    
    // Apply chromatic aberration (separate call for more control)
    if (cam.chromaticAberration > 0.0) {
        color = applyChromaticAberration(color, uv, iResolution.xy, cam);
    }
    
    // Tone mapping
    color = toneMapReinhardJodie(color);
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}

