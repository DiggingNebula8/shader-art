// ============================================================================
// OCEAN SCENE - Main Rendering Entry Point
// ============================================================================
// Combines Camera, Sky, and Ocean systems to render a complete ocean scene
// ============================================================================

// Include all systems
#include "Common.frag"
#include "CameraSystem.frag"
#include "SkySystem.frag"
#include "OceanSystem.frag"

// ============================================================================
// TONE MAPPING
// ============================================================================

// Reinhard-Jodie tone mapping
// Separates luminance and chrominance to preserve color saturation better than basic Reinhard
// This prevents over-compression of bright areas while maintaining good exposure compatibility
vec3 toneMapReinhardJodie(vec3 x) {
    // Calculate luminance
    float luma = dot(x, vec3(0.2126, 0.7152, 0.0722));
    
    // Apply Reinhard to luminance only
    float toneMappedLuma = luma / (1.0 + luma);
    
    // Preserve chrominance (color) by scaling by the ratio of tone-mapped to original luminance
    // This prevents desaturation that basic Reinhard causes
    vec3 chrominance = x / max(luma, 0.001); // Avoid division by zero
    vec3 result = chrominance * toneMappedLuma;
    
    return clamp(result, 0.0, 1.0);
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Create and configure camera
    Camera cam = createDefaultCamera();
    
    // Camera position and orientation - Wide angle view showing ocean and sky
    // Lower camera position and angle up to capture more sky
    cam.position = vec3(0.0, 2.5, 6.0);  // Lower and closer for wide view
    cam.target = vec3(0.0, 0.5, 0.0);     // Look slightly up to see sky
    cam.up = vec3(0.0, 1.0, 0.0);
    
    // Camera settings - Wide angle lens to capture expansive view
    // Wide angle lens (20mm) for dramatic wide view showing ocean and sky
    cam.focalLength = 20.0;        // 20mm wide angle lens (very wide field of view)
    cam.fStop = 2.8;               // f/2.8 aperture
    cam.shutterSpeed = 1.0 / 60.0; // 1/60 second
    cam.iso = 100.0;               // ISO 100
    
    // Depth of field (optional - disable for performance)
    cam.focusDistance = 10.0;
    cam.enableDOF = true; // Set to true for depth of field effect
    
    // Generate camera ray using proper FOV calculation
    // UV coordinates in [0, 1] range
    vec2 uv = fragCoord / iResolution.xy;
    vec3 rd = generateCameraRay(cam, uv, iResolution.xy);
    
    // Raymarch ocean surface
    vec3 pos = raymarchOcean(cam.position, rd, iTime);
    
    // Calculate distance for depth of field
    float distance = length(pos - cam.position);
    
    // Create sky once and reuse throughout
    SkyAtmosphere sky = createSkyPreset_Foggy();
    
    // Background - render sky if we didn't hit the ocean
    if (distance > MAX_DIST * 0.95) {
        vec3 bgColor = skyColor(rd, sky, iTime);
        
        // Apply fog to background sky for consistency
        // Use a far point along the ray for fog calculation
        vec3 farPos = cam.position + rd * MAX_DIST;
        bgColor = applyAtmosphericFog(bgColor, farPos, cam.position, rd, sky, iTime);
        
        // Camera exposure + optional DOF + tone mapping + gamma, same as ocean path
        bgColor = applyExposure(bgColor, cam);
        bgColor = applyDepthOfField(bgColor, distance, cam);
        bgColor = toneMapReinhardJodie(bgColor);
        bgColor = pow(bgColor, vec3(1.0 / 2.2));
        
        fragColor = vec4(bgColor, 1.0);
        return;
    }
    
    // Stabilize position to reduce jittering
    // Use a small snap grid for XZ to ensure consistent sampling
    // Recalculate Y from the snapped XZ to maintain accuracy
    const float positionSnap = 0.0005;
    vec2 snappedXZ = floor(pos.xz / positionSnap + 0.5) * positionSnap;
    float stableY = getWaveHeight(snappedXZ, iTime);
    vec3 stablePos = vec3(snappedXZ.x, stableY, snappedXZ.y);
    
    // Compute normal (gradient computed here and passed through to avoid redundant computation)
    vec2 gradient;
    vec3 normal = getNormal(stablePos.xz, iTime, gradient);
    vec3 viewDir = -rd;
    
    // Shade ocean with sky configuration - use stable position for consistent results
    vec3 color = shadeOcean(stablePos, normal, viewDir, iTime, gradient, sky);
    
    // Apply atmospheric fog/haze using the SkyAtmosphere system
    // Use stablePos for fog calculation to match shading position
    color = applyAtmosphericFog(color, stablePos, cam.position, rd, sky, iTime);
    
    // Apply camera exposure (physically-based)
    // This multiplies the color by the exposure value
    // Changes to f-stop, shutter speed, or ISO will affect brightness here
    color = applyExposure(color, cam);
    
    // Apply depth of field (if enabled)
    color = applyDepthOfField(color, distance, cam);
    
    // Tone mapping (Reinhard-Jodie) - compresses HDR to LDR with better color preservation
    // Separates luminance and chrominance to preserve saturation better than basic Reinhard
    // Works well with existing exposure system and prevents over-compression
    color = toneMapReinhardJodie(color);
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}

