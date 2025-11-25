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

// Apply depth of field blur (simplified - uses distance-based blur)
vec3 applyDepthOfField(vec3 color, float distance, Camera cam) {
    if (!cam.enableDOF) return color;
    
    float coc = calculateCircleOfConfusion(cam, distance);
    // Simplified: just darken/blur based on CoC
    // In a full implementation, this would sample multiple rays
    float blurFactor = 1.0 - min(coc * 10.0, 0.5);
    return color * blurFactor;
}

#endif // CAMERA_SYSTEM_FRAG

