void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    float ringRadius = 0.3;  // Adjustable radius of the ring
    float ringWidth = 0.01;  // Adjustable width of the ring
    float dist = length(uv) - ringRadius;  // Distance from the center
    // Create the ring by checking if distance is within the width range
    float alpha = saturate(1. - smoothstep(ringWidth * 0.5, ringWidth * 0.51, abs(dist))); 
    vec3 ringColor = alpha * vec3(1., 0.0, 0.0);
    
    // Control Parameters
    float speed = 100.0; // Adjustable speed via mouse
    float blades = 2.0; // Adjustable blade count
    float blur = 0.5; // Blade softness
    float innerFade = 0.2; // Center fade-out
    float outerFade = 1.0; // Outer edge fade-in
    float ringHoleRadius = 0.6; // Inner hole radius of the ring
    vec3 bladeColor = vec3(1.0, 1.0, 1.0); // Blade main color
    vec3 bgColor = vec3(0.0); // Background color
    
    // Compute the smooth spinning effect
    float phase = fract(iTime * speed * 0.5); // Smooth phase shift over time
    float spin = fract((angle / (3.14159 * 2.0) * blades) - phase); // Continuous transition
    
    // Create a soft mask for the blades
    float bladeMask = smoothstep(0.5 - blur, 0.5, spin) * smoothstep(0.5, 0.5 - blur, spin);
    
    // Fade out towards the center and edges
    float fade = smoothstep(outerFade, innerFade, radius);
    
    vec3 color = mix(bgColor, bladeColor, bladeMask * fade);
    vec3 finalColour = color * ringColor;
    vec3 fin = color + finalColour;
    
    fragColor = vec4(fin, 1.0);
}
