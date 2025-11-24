// ============================================================================
// OCEAN SCENE - SHADER ENTRY POINT
// ============================================================================
// This is the ACTUAL entry point for the shader (contains mainImage())
// 
// Architecture:
//   Scene.frag (THIS FILE)
//     ├─ mainImage() - Shader entry point (called by Shadertoy/GLSL runtime)
//     ├─ Camera setup and configuration
//     ├─ Calls RenderPipeline.renderScene() - Core rendering logic
//     └─ Post-processing (fog, exposure, DOF, tone mapping, gamma)
//
//   RenderPipeline.frag
//     ├─ renderScene() - Orchestrates all rendering systems
//     ├─ calculateRefraction() - Handles water refraction
//     ├─ calculateReflection() - Handles water reflection
//     └─ composeFinalColor() - Combines all contributions
//
//   Systems (called by RenderPipeline):
//     ├─ WaveSystem - Wave geometry
//     ├─ TerrainSystem - Terrain geometry
//     ├─ WaterShading - Water material properties
//     ├─ TerrainShading - Terrain material properties
//     └─ SkySystem - Atmosphere and lighting
// ============================================================================

#include "Common.frag"
#include "CameraSystem.frag"
#include "RenderPipeline.frag"

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
    
    // Create sky and terrain configuration
    SkyAtmosphere sky = createSkyPreset_Foggy();
    TerrainParams terrainParams = createDefaultOceanFloor();
    
    // Create render context
    RenderContext ctx;
    ctx.cameraPos = cam.position;
    ctx.rayDir = rd;
    ctx.time = iTime;
    ctx.sky = sky;
    ctx.terrainParams = terrainParams;
    ctx.camera = cam;
    
    // Render scene using RenderPipeline
    // Returns both color and hit data (avoids duplicate raymarching)
    RenderResult renderResult = renderScene(cam.position, rd, iTime, ctx);
    vec3 color = renderResult.color;
    
    // Use hit data from renderScene() instead of re-raymarching
    float distance = renderResult.hit ? renderResult.distance : MAX_DIST;
    vec3 hitPos = renderResult.hit ? renderResult.hitPosition : (cam.position + rd * MAX_DIST);
    
    // Apply atmospheric fog/haze using the SkyAtmosphere system
    color = applyAtmosphericFog(color, hitPos, cam.position, rd, sky, iTime);
    
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

