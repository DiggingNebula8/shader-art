// ============================================================================
// MODULAR PHYSICALLY-BASED CAMERA SYSTEM
// ============================================================================
// Implements real camera parameters: shutter speed, f-stop, ISO, focal length
// See CAMERA_SYSTEM.md for documentation and usage examples
//
// NAMING CONVENTION:
//   Camera system uses simplified naming: create<Variant>Camera()
//   (e.g., createSunnyDayCamera(), createLowLightCamera())
//   This differs from materials which use create<Variant><Type>Material()
//   because cameras are configuration objects, not materials.
//   This is an intentional design choice and is consistent across all presets.
// ============================================================================

#ifndef CAMERA_SYSTEM_FRAG
#define CAMERA_SYSTEM_FRAG

#include "Common.frag"

struct Camera {
    // Position and orientation
    vec3 position;
    vec3 target;
    vec3 up;
    
    // Physical camera parameters
    float focalLength;      // mm (e.g., 24mm, 50mm, 85mm)
    float fStop;            // Aperture f-number (e.g., 1.4, 2.8, 5.6, 11)
    float shutterSpeed;     // seconds (e.g., 1/60 = 0.0167, 1/250 = 0.004)
    float iso;              // ISO sensitivity (e.g., 100, 400, 1600)
    
    // Depth of field (optional)
    float focusDistance;    // meters - distance to focus plane
    bool enableDOF;         // Enable depth of field
    
    // Sensor properties
    float sensorWidth;      // mm (full frame = 36mm, APS-C = 23.6mm)
    float sensorHeight;     // mm (full frame = 24mm, APS-C = 15.7mm)
    
    // Exposure compensation (optional)
    float exposureCompensation; // EV stops (-2.0 to +2.0, 0.0 = no compensation)
    
    // Camera effects (optional)
    float vignetteStrength;     // Vignette strength (0.0 = none, 1.0 = strong)
    float chromaticAberration;  // Chromatic aberration strength (0.0 = none, 1.0 = strong)
    float filmGrain;            // Film grain strength (0.0 = none, 1.0 = strong)
};

// Default camera configuration
Camera createDefaultCamera() {
    Camera cam;
    
    // Position and orientation
    cam.position = vec3(0.0, 4.0, 8.0);
    cam.target = vec3(0.0, 0.0, 0.0);
    cam.up = vec3(0.0, 1.0, 0.0);
    
    // Physical parameters (realistic values)
    cam.focalLength = 50.0;        // 50mm lens (standard)
    cam.fStop = 2.8;               // f/2.8 (moderate aperture)
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100 (low sensitivity)
    
    // Depth of field
    cam.focusDistance = 10.0;      // Focus at 10 meters
    cam.enableDOF = false;         // Disable by default (performance)
    
    // Sensor (full frame 35mm)
    cam.sensorWidth = 36.0;
    cam.sensorHeight = 24.0;
    
    // Exposure compensation
    cam.exposureCompensation = 0.0; // No compensation by default
    
    // Camera effects (disabled by default)
    cam.vignetteStrength = 0.0;
    cam.chromaticAberration = 0.0;
    cam.filmGrain = 0.0;
    
    return cam;
}

// Camera presets for common scenarios
Camera createSunnyDayCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 8.0;               // f/8 (smaller aperture for bright scenes)
    cam.shutterSpeed = 1.0 / 250.0; // 1/250s (fast shutter)
    cam.iso = 100.0;               // ISO 100 (low sensitivity)
    return cam;
}

Camera createLowLightCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8 (wide aperture)
    cam.shutterSpeed = 1.0 / 60.0; // 1/60s (slower shutter)
    cam.iso = 800.0;               // ISO 800 (higher sensitivity)
    return cam;
}

Camera createMotionBlurCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8
    cam.shutterSpeed = 1.0 / 30.0; // 1/30s (slow shutter for motion blur)
    cam.iso = 200.0;               // ISO 200
    return cam;
}

Camera createHighSpeedCamera() {
    Camera cam = createDefaultCamera();
    cam.fStop = 2.8;               // f/2.8
    cam.shutterSpeed = 1.0 / 1000.0; // 1/1000s (very fast shutter)
    cam.iso = 400.0;               // ISO 400
    return cam;
}

Camera createCinematicCamera() {
    Camera cam = createDefaultCamera();
    cam.focalLength = 85.0;        // 85mm (portrait lens)
    cam.fStop = 1.4;               // f/1.4 (very wide aperture)
    cam.shutterSpeed = 1.0 / 48.0; // 1/48s (cinematic 24fps with 180° shutter)
    cam.iso = 100.0;               // ISO 100
    cam.enableDOF = true;          // Enable depth of field
    cam.focusDistance = 8.0;       // Focus at 8 meters
    return cam;
}

Camera createSkyCamera() {
    Camera cam = createDefaultCamera();
    cam.focalLength = 20.0;        // 20mm wide angle lens (very wide field of view)
    cam.fStop = 5.6;               // f/5.6 aperture (moderate for bright sky)
    cam.shutterSpeed = 1.0 / 125.0; // 1/125 second (moderate shutter)
    cam.iso = 100.0;               // ISO 100 (low sensitivity)
    cam.enableDOF = false;         // Disable DOF for sky-only scenes
    return cam;
}

// Calculate exposure value (EV) from camera settings
// Uses the standard photographic exposure formula
// Each f-stop change doubles/halves light (f/1.4, f/2, f/2.8, f/4, f/5.6, f/8, f/11, f/16, f/22)
// Each shutter speed change doubles/halves light (1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15)
// Each ISO change doubles/halves sensitivity (100, 200, 400, 800, 1600)
float calculateExposure(Camera cam) {
    // Exposure is inversely proportional to f-stop squared
    // Lower f-stop number = larger aperture = more light
    // Formula: Exposure ∝ 1 / (fStop^2) * shutterSpeed * ISO
    
    // Calculate relative exposure compared to standard
    // Standard: f/2.8, 1/60s, ISO 100
    
    // F-stop contribution (inverse relationship - lower f-stop = more light)
    // f/1.4 = 4x brighter than f/2.8, f/5.6 = 4x darker than f/2.8
    float fStopFactor = (2.8 * 2.8) / (cam.fStop * cam.fStop);
    
    // Shutter speed contribution (longer = more light)
    // 1/30s = 2x brighter than 1/60s, 1/125s = 2x darker than 1/60s
    float shutterFactor = cam.shutterSpeed / (1.0 / 60.0);
    
    // ISO contribution (higher = more sensitive = brighter)
    // ISO 200 = 2x brighter than ISO 100, ISO 50 = 2x darker than ISO 100
    float isoFactor = cam.iso / 100.0;
    
    // Combined exposure multiplier
    float exposureMultiplier = fStopFactor * shutterFactor * isoFactor;
    
    // Apply exposure compensation (EV stops)
    // Each EV stop doubles/halves exposure: +1 EV = 2x brighter, -1 EV = 0.5x brighter
    exposureMultiplier *= pow(2.0, cam.exposureCompensation);
    
    // Clamp to reasonable range
    // This allows for dramatic changes: 0.1x to 10x brightness
    return clamp(exposureMultiplier, 0.1, 10.0);
}

// Calculate field of view from focal length and sensor size
// FOV = 2 * atan(sensorSize / (2 * focalLength))
float calculateFOV(Camera cam) {
    // Use sensor width for horizontal FOV
    float fovRadians = 2.0 * atan(cam.sensorWidth / (2.0 * cam.focalLength));
    return fovRadians;
}

// Calculate depth of field parameters
// Returns circle of confusion radius in meters
float calculateCircleOfConfusion(Camera cam, float distance) {
    if (!cam.enableDOF) return 0.0;
    
    // Circle of confusion based on sensor size
    // CoC = (sensorWidth / 1500) for acceptable sharpness
    float cocDiameter = cam.sensorWidth / 1500.0; // mm
    
    // Convert to meters
    float cocRadius = cocDiameter * 0.0005; // mm to meters (approximate)
    
    // Calculate blur based on focus distance
    float focusDist = cam.focusDistance;
    float blurAmount = abs(distance - focusDist) / focusDist;
    
    // Aperture affects depth of field:
    // Larger f-stop (smaller aperture) = more depth of field (less blur)
    float dofFactor = 2.8 / max(cam.fStop, 0.001); // Normalize to f/2.8, avoid div-by-zero
    
    return cocRadius * blurAmount * dofFactor;
}

// Build camera coordinate system
// Returns: (right, up, forward) basis vectors
mat3 buildCameraBasis(Camera cam) {
    vec3 forward = normalize(cam.target - cam.position);
    
    // Build an unnormalized right vector first to safely detect degeneracy
    vec3 right = cross(cam.up, forward);
    if (length(right) < 0.001) {
        // Fallback when up ≈ forward (looking straight up/down)
        right = cross(vec3(1.0, 0.0, 0.0), forward);
    }
    right = normalize(right);
    vec3 up = normalize(cross(forward, right));
    
    return mat3(right, up, forward);
}

// Generate camera ray with proper FOV
vec3 generateCameraRay(Camera cam, vec2 uv, vec2 resolution) {
    mat3 basis = buildCameraBasis(cam);
    
    // Calculate aspect ratio
    float aspect = resolution.x / resolution.y;
    
    // Calculate FOV
    float fov = calculateFOV(cam);
    float tanHalfFov = tan(fov * 0.5);
    
    // Convert UV to camera space (-1 to 1)
    vec2 screenUV = (uv - 0.5) * 2.0;
    screenUV.x *= aspect;
    
    // Scale by FOV
    screenUV *= tanHalfFov;
    
    // Generate ray direction in camera space
    vec3 rayDir = normalize(vec3(screenUV, 1.0));
    
    // Transform to world space
    return basis * rayDir;
}

// Apply exposure to color
// Exposure should be applied before tone mapping for proper HDR handling
vec3 applyExposure(vec3 color, Camera cam) {
    float exposure = calculateExposure(cam);
    
    // Apply exposure multiplier
    // This directly affects brightness before tone mapping
    vec3 exposedColor = color * exposure;
    
    return exposedColor;
}

// Apply depth of field blur (improved implementation)
vec3 applyDepthOfField(vec3 color, float distance, Camera cam) {
    if (!cam.enableDOF) return color;
    
    float coc = calculateCircleOfConfusion(cam, distance);
    
    // Improved blur calculation using circle of confusion
    // CoC radius determines blur amount - larger CoC = more blur
    float blurAmount = min(coc * 5.0, 1.0); // Scale and clamp blur
    
    // Apply smooth falloff for more natural blur
    // Objects closer to focus distance blur less
    float focusDist = cam.focusDistance;
    float distRatio = distance / max(focusDist, 0.1);
    
    // Hyperfocal distance approximation for better DOF behavior
    // Objects at hyperfocal distance and beyond are equally blurred
    float hyperfocalDist = (cam.focalLength * cam.focalLength) / (cam.fStop * 0.00003);
    if (distance > hyperfocalDist) {
        blurAmount = min(blurAmount * 1.5, 1.0); // More blur for far objects
    }
    
    // Apply blur (simplified - in full implementation would sample multiple rays)
    // For now, reduce saturation and brightness to simulate blur
    float blurFactor = 1.0 - blurAmount * 0.3; // Reduce brightness slightly
    vec3 blurredColor = color * blurFactor;
    
    // Mix with original based on blur amount
    return mix(color, blurredColor, blurAmount * 0.7);
}

// ============================================================================
// CAMERA ANIMATION FUNCTIONS
// ============================================================================

// Orbit camera around a target point
// angle: rotation angle in radians
// elevation: elevation angle in radians (-PI/2 to PI/2)
// distance: distance from target
// center: target point to orbit around
Camera orbitCamera(Camera cam, float angle, float elevation, float distance, vec3 center) {
    // Calculate position on sphere
    float cosElev = cos(elevation);
    cam.position = center + vec3(
        cos(angle) * cosElev * distance,
        sin(elevation) * distance,
        sin(angle) * cosElev * distance
    );
    cam.target = center;
    return cam;
}

// Dolly camera (move forward/backward along view direction)
Camera dollyCamera(Camera cam, float distance) {
    vec3 forward = normalize(cam.target - cam.position);
    cam.position += forward * distance;
    cam.target += forward * distance;
    return cam;
}

// Pan camera (move left/right, up/down perpendicular to view direction)
Camera panCamera(Camera cam, vec2 offset) {
    mat3 basis = buildCameraBasis(cam);
    vec3 right = basis[0];
    vec3 up = basis[1];
    cam.position += right * offset.x + up * offset.y;
    cam.target += right * offset.x + up * offset.y;
    return cam;
}

// Tilt camera (rotate around right axis)
Camera tiltCamera(Camera cam, float angle) {
    mat3 basis = buildCameraBasis(cam);
    vec3 right = basis[0];
    vec3 forward = normalize(cam.target - cam.position);
    
    // Rotate forward vector around right axis
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec3 up = basis[1];
    vec3 newForward = forward * cosAngle + up * sinAngle;
    
    cam.target = cam.position + newForward * length(cam.target - cam.position);
    return cam;
}

// Smooth interpolation between two camera positions
Camera interpolateCamera(Camera cam1, Camera cam2, float t) {
    Camera result = cam1;
    t = clamp(t, 0.0, 1.0);
    
    // Interpolate position and target
    result.position = mix(cam1.position, cam2.position, t);
    result.target = mix(cam1.target, cam2.target, t);
    
    // Interpolate up vector (normalize after interpolation)
    result.up = normalize(mix(cam1.up, cam2.up, t));
    
    // Interpolate camera parameters
    result.focalLength = mix(cam1.focalLength, cam2.focalLength, t);
    result.fStop = mix(cam1.fStop, cam2.fStop, t);
    result.shutterSpeed = mix(cam1.shutterSpeed, cam2.shutterSpeed, t);
    result.iso = mix(cam1.iso, cam2.iso, t);
    result.focusDistance = mix(cam1.focusDistance, cam2.focusDistance, t);
    
    return result;
}

// ============================================================================
// AUTO-FOCUS FUNCTIONALITY
// ============================================================================

// Calculate auto-focus distance based on nearest object
// This is a helper function - actual implementation depends on scene geometry
// For now, returns a suggested focus distance based on camera position
float calculateAutoFocusDistance(Camera cam, vec3 rayDir, float maxDistance) {
    // This is a placeholder - in a real implementation, you would:
    // 1. Ray march along the camera ray
    // 2. Find the nearest surface
    // 3. Return that distance
    
    // For now, return a reasonable default based on camera position
    // Focus at a point 1/3 of the way to the target
    float distToTarget = length(cam.target - cam.position);
    return distToTarget * 0.33;
}

// ============================================================================
// CAMERA EFFECTS
// ============================================================================

// Apply vignette effect (darkening at edges)
vec3 applyVignette(vec3 color, vec2 uv, Camera cam) {
    if (cam.vignetteStrength <= 0.0) return color;
    
    // Calculate distance from center
    vec2 center = vec2(0.5, 0.5);
    float dist = length(uv - center);
    
    // Apply vignette (smooth falloff)
    float vignette = 1.0 - smoothstep(0.3, 1.0, dist) * cam.vignetteStrength;
    
    return color * vignette;
}

// Apply chromatic aberration (color separation at edges)
// Note: This is a simplified implementation. For full chromatic aberration,
// you would need to sample the rendered image with RGB channel offsets.
vec3 applyChromaticAberration(vec3 color, vec2 uv, vec2 resolution, Camera cam) {
    if (cam.chromaticAberration <= 0.0) return color;
    
    // Calculate offset based on distance from center
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = (uv - center) * cam.chromaticAberration * 0.01;
    
    // Simulate chromatic aberration by shifting color channels
    // Red channel shifts outward, blue channel shifts inward
    vec3 colorR = vec3(color.r * 1.1, color.g * 0.98, color.b * 0.95);
    vec3 colorB = vec3(color.r * 0.95, color.g * 0.98, color.b * 1.1);
    
    // Mix based on distance from center
    float dist = length(uv - center);
    float aberrationAmount = smoothstep(0.3, 1.0, dist) * cam.chromaticAberration;
    
    // Blend between original and aberrated color
    vec3 aberratedColor = mix(colorR, colorB, 0.5);
    return mix(color, aberratedColor, aberrationAmount * 0.3);
}

// Apply film grain effect
vec3 applyFilmGrain(vec3 color, vec2 uv, float time, Camera cam) {
    if (cam.filmGrain <= 0.0) return color;
    
    // Simple noise-based grain
    // In a real implementation, use a proper noise function
    float grain = fract(sin(dot(uv + time, vec2(12.9898, 78.233))) * 43758.5453);
    grain = (grain - 0.5) * 2.0; // Center around 0
    
    // Apply grain (more visible in darker areas)
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float grainAmount = cam.filmGrain * (1.0 - luminance * 0.5);
    
    return color + grain * grainAmount * 0.1;
}

// Apply all camera effects
vec3 applyCameraEffects(vec3 color, vec2 uv, vec2 resolution, float time, Camera cam) {
    color = applyVignette(color, uv, cam);
    color = applyFilmGrain(color, uv, time, cam);
    return color;
}

#endif // CAMERA_SYSTEM_FRAG

