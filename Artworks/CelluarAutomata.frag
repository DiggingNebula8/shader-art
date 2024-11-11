// Smoothly modulated cellular automata distance
vec2 cellInfluence(vec3 p, float time) {
    vec3 cellPosition = floor(p);               // Get the cell's grid position
    vec3 cellCenter = cellPosition + 0.5;       // Center of the cell
    float distanceToCell = length(p - cellCenter); // Distance to cell center

    // Wave-based smooth influence for fluid transitions
    float intensity = sin(time + dot(cellPosition, vec3(5.0, 10.0, 0.1)));
    float radius = 0.4 * intensity;             // Radius varies smoothly with intensity

    return vec2(distanceToCell - radius, radius); // Return both distance and radius
}

// Rotation speed for each axis
vec3 rotationSpeed = vec3(0., 0., 10.0); // Adjust these values for desired speed

// Function to rotate a vector around the X-axis by a given angle
vec3 rotateX(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// Function to rotate a vector around the Y-axis by a given angle
vec3 rotateY(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Function to rotate a vector around the Z-axis by a given angle
vec3 rotateZ(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// Scene distance function with rotation applied
vec2 map(vec3 p) {
    // Apply rotation based on time and rotation speed for each axis
    float angleX = iTime * rotationSpeed.x * saturate(p.x * 0.000002);
    float angleY = iTime * rotationSpeed.y * saturate(p.y * 0.000002);
    float angleZ = iTime * rotationSpeed.z * saturate(p.z * 0.000002);

    // Rotate point p around each axis
    p = rotateX(p, angleX);
    p = rotateY(p, angleY);
    p = rotateZ(p, angleZ);

    // Cellular field calculation
    float cellDistance = 1.0;
    float minRadius = 1.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 neighborPos = vec3(x, y, z); // Neighbor cell offset
                vec2 cellData = cellInfluence(p + neighborPos, iTime);
                
                // Update minimum distance and radius
                if (cellData.x < cellDistance) {
                    cellDistance = cellData.x;
                    minRadius = cellData.y;
                }
            }
        }
    }

    return vec2(cellDistance, minRadius); // Return minimum distance and radius
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;

    // Ray origin and direction setup
    vec3 ro = vec3(0, 0, 1);
    vec3 rd = normalize(vec3(uv, 3));
    vec3 col = vec3(0.0, 0.0, 0.0);
    float radius;

    // Raymarching loop
    float t = 0.0;
    for (int i = 0; i < 180; i++) {
        vec3 pos = ro + rd * t;
        vec2 mapData = map(pos);    // Get distance and radius from map function
        float d = mapData.x;
        radius = mapData.y;

        if (d < 0.001) break;     // Stop if close enough
        if (t > 330.0) break;     // Stop if too far
        t += d;                   // Move along the ray
    }
    radius = saturate(pow(radius,5.) * 10.);
    // Color based on distance t, smoother effect
    col = mix(vec3(0.2039, 0.0902, 0.0118), vec3(0.902, 0.4824, 0.302), exp(-t * 0.1));
    col = mix(col,vec3(0.0, 1.0, 0.0157), 1. - radius);
    fragColor = vec4(col, 1.0);
}
