void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // Control Parameters
    float speed = 2.0; // Adjustable speed via mouse
    float blades = 3.0; // Adjustable blade count
    float blur = 0.2; // Blade softness
    float innerFade = 0.2; // Center fade-out
    float outerFade = 1.0; // Outer edge fade-in
    vec3 bladeColor = vec3(1.0, 1.0, 1.0); // Blade color
    vec3 bgColor = vec3(0.0); // Background color
    
    // Compute the spinning effect
    float spin = mod(angle / (3.14159 * 2.0) * blades + iTime * speed, 1.0);
    
    // Create a soft mask for the blades
    float bladeMask = smoothstep(0.5 - blur, 0.5, spin) * smoothstep(0.5, 0.5 - blur, spin);
    
    // Fade out towards the center and edges
    float fade = smoothstep(outerFade, innerFade, radius);
    
    vec3 color = mix(bgColor, bladeColor, bladeMask * fade);
    
    fragColor = vec4(color, 1.0);
}
