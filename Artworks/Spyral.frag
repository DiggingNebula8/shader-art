void mainImage(out vec4 fragColor, vec2 fragCoords) {
    // Screen resolution
    vec3 screenRes = iResolution;

    // Position vector
    vec3 o;

    // Current time
    float time = iTime;

    // Spiral pattern control variables
    float spiralFactor = .2;
    float scale = 4.0;
    float brightness = 2.0;
    float maxExponent = 30.0;
    float angleOffset = 0.314;
    float modulationFactor = 0.1;
    float fractOffset = 0.5;
    float vectorScale = 1000.0;
    vec4 rotationConstants = vec4(0.0, 11.0, 33.0, 0.0);
    vec3 color1 = vec3(0.84, 0.74, 0.87);
    vec3 color2 = vec3(0.9, 0.9, 0.6);

    // Loop through exponent values
    for (float exponent = 0.0; exponent < maxExponent; exponent++) {

        // Modulus operation for z to create layers
        o.z = mod(o.z, modulationFactor) - modulationFactor;

        // Update x based on time and scale
        float x = spiralFactor - time * scale;

        // Transform the o.xy vector using rotation matrix
        vec2 transformedVector = o.xy *= mat2(
            cos(rotationConstants + round((atan(o.y, o.x) - x) / angleOffset) * angleOffset + x)
        );
        o.x = fract(transformedVector.x) - fractOffset;

        // Calculate length of the vector
        float vectorLength = length(o);

        // Increment spiral factor
        float timeScaleIncrement = vectorLength / scale;
        spiralFactor += timeScaleIncrement;

        // Calculate cosine and sine for color manipulation
        float cosValue = cos(spiralFactor + time * scale);
        float sinValue = sin(spiralFactor + time * scale);

        // Color mask calculation
        float colourMask = clamp(cos(time * scale) + sin(time * scale), 0.0, 1.0);

        // Add to final image using brightness and vector length
        fragColor += (brightness + cosValue) * (brightness + sinValue) / (vectorLength * vectorScale);

        // Normalize and scale the position vector
        o = spiralFactor * normalize(
            vec3((fragCoords + fragCoords - screenRes.xy) * mat2(cos(rotationConstants + time * scale)), screenRes.y)
        );

        // Clamp final image values
        fragColor = clamp(fragColor, 0.0, 1.0);

        // Define two colors for mixing
        vec3 mixedColor1 = fragColor.xyz * color1;
        vec3 mixedColor2 = fragColor.xyz * color2;

        // Mix colors based on the color mask
        fragColor = vec4(mix(mixedColor1, mixedColor2, colourMask), 1.0);
    }
}
