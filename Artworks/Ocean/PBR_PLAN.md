# Physically Based Rendering (PBR) Conversion Plan

## Current State Analysis

### Non-PBR Issues Identified

1. **Lighting Mixing** (Line 169)
   - Current: `color * 0.5 + ambientLightColor * 0.3 + sunLight`
   - Problem: Arbitrary multipliers, no energy conservation
   - Should: Use proper BRDF with energy-conserving terms

2. **Fresnel Calculation** (Line 123-126)
   - Current: Simple power-based approximation
   - Problem: Not physically accurate, missing IOR (Index of Refraction)
   - Should: Use Schlick's Fresnel approximation with water IOR (~1.33)

3. **Specular Model** (Line 133-137)
   - Current: Blinn-Phong with fixed shininess (64)
   - Problem: Not energy-conserving, doesn't match real water
   - Should: Cook-Torrance/GGX microfacet model

4. **Ambient Lighting** (Line 26)
   - Current: Fixed color `vec3(0.05, 0.1, 0.2)`
   - Problem: Not physically based, arbitrary
   - Should: Environment-based ambient (IBL or sky sampling)

5. **Refraction** (Line 156, 166)
   - Current: Simple color mixing
   - Problem: Not physically accurate refraction
   - Should: Proper refraction with IOR, possibly raytraced

6. **Sparkles** (Line 144-151)
   - Current: Ad-hoc high-power specular
   - Problem: Not part of BRDF, arbitrary
   - Should: Integrated into microfacet BRDF as surface detail

7. **Energy Conservation**
   - Current: None - can exceed 1.0, no guarantees
   - Problem: Colors can be unrealistic
   - Should: Ensure `diffuse + specular ≤ 1.0` (minus absorption)

---

## PBR Implementation Plan

### Phase 1: Core PBR Foundation

#### 1.1 Add Physical Material Properties
```glsl
// Mathematical constants
const float PI = 3.14159265;

// Material properties for water
const float waterIOR = 1.33;              // Index of refraction (water)
const float airIOR = 1.0;                 // Index of refraction (air)
const vec3 waterAbsorption = vec3(0.1, 0.2, 0.3);  // Absorption coefficient
const float roughness = 0.02;             // Surface roughness (0=smooth, 1=rough)
const float metallic = 0.0;              // Not metallic (dielectric)
const vec3 albedo = vec3(0.0, 0.3, 0.5);  // Base color
```

#### 1.2 Implement Schlick's Fresnel Approximation
```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// For dielectrics (water), F0 is small (~0.02)
vec3 getFresnel(vec3 viewDir, vec3 normal)
{
    float cosTheta = max(dot(viewDir, normal), 0.0);
    vec3 F0 = vec3(0.02); // Dielectric F0
    return fresnelSchlick(cosTheta, F0);
}
```

#### 1.3 Implement Cook-Torrance BRDF
```glsl
// Normal Distribution Function (GGX/Trowbridge-Reitz)
float D_GGX(float NdotH, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

// Geometry Function (Smith with Schlick-GGX)
float G_SchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness)
{
    return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
}

// Cook-Torrance specular BRDF
vec3 specularBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor, float roughness)
{
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float VdotH = max(dot(viewDir, halfVec), 0.0);
    
    float D = D_GGX(NdotH, roughness);
    float G = G_Smith(NdotV, NdotL, roughness);
    vec3 F = fresnelSchlick(VdotH, vec3(0.02));
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001; // Avoid division by zero
    
    return (numerator / denominator) * lightColor * NdotL;
}
```

---

### Phase 2: Lighting System Overhaul

#### 2.1 Replace Ambient with Environment Lighting
```glsl
// Sample sky/environment for ambient
vec3 getEnvironmentLight(vec3 normal)
{
    // Sample sky color based on normal direction
    vec3 skyDir = normalize(normal + vec3(0.0, 1.0, 0.0));
    return skyColor(skyDir) * 0.5; // Scale down for ambient
}

// Or implement IBL (Image Based Lighting) if environment map available
```

#### 2.2 Implement Proper Light Transport
```glsl
vec3 computeLighting(vec3 pos, vec3 normal, vec3 viewDir, float time)
{
    vec3 lightDir = sunDirection;
    vec3 lightColor = sunColor * sunIntensity;
    
    // Direct lighting
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 directLight = lightColor * NdotL;
    
    // Specular (Cook-Torrance)
    vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, roughness);
    
    // Diffuse (energy-conserving)
    vec3 F = getFresnel(viewDir, normal);
    vec3 kS = F; // Specular contribution
    vec3 kD = (1.0 - kS) * (1.0 - metallic); // Diffuse contribution
    
    vec3 diffuse = kD * albedo * directLight / PI; // Lambertian
    
    // Environment/ambient
    vec3 ambient = getEnvironmentLight(normal) * albedo;
    
    // Combine with energy conservation
    return ambient + diffuse + specular;
}
```

---

### Phase 3: Water-Specific Features

#### 3.1 Proper Refraction/Reflection Split
```glsl
vec3 shadeOcean(vec3 pos, vec3 normal, vec3 viewDir, float time, vec2 gradient)
{
    // Fresnel determines reflection vs refraction ratio
    vec3 F = getFresnel(viewDir, normal);
    float fresnelFactor = dot(F, vec3(1.0/3.0)); // Average
    
    // Reflection
    vec3 reflectedDir = reflect(-viewDir, normal);
    vec3 reflected = skyColor(reflectedDir);
    
    // Refraction (simplified - could raytrace)
    vec3 refractedDir = refract(-viewDir, normal, airIOR / waterIOR);
    vec3 refracted = baseWaterColor; // Could sample environment
    
    // Mix based on Fresnel
    vec3 color = mix(refracted, reflected, fresnelFactor);
    
    // Add direct lighting
    vec3 lighting = computeLighting(pos, normal, viewDir, time);
    color += lighting;
    
    // Apply absorption based on depth
    // NOTE: Coordinate system verification required:
    // - Current Ocean.frag uses: depthFactor = smoothstep(0.0, shallowDepthRange, pos.y)
    // - This suggests pos.y increases with depth (Y-down convention) OR surface is at negative Y
    // - Verify actual coordinate system during implementation:
    //   * Check raymarching: h = pos.y - getWaveHeight() suggests Y-up with surface at getWaveHeight()
    //   * Check current depth usage: shallowDepthRange uses pos.y directly
    //   * May need: depth = max(0.0, pos.y - surfaceHeight) or similar
    float depth = max(0.0, pos.y); // TODO: Verify correct depth calculation during implementation
    vec3 absorption = exp(-waterAbsorption * depth);
    color *= absorption;
    
    // Foam (non-physical but visually important)
    float foam = getFoam(pos.xz, time, gradient);
    color = mix(color, vec3(1.0), foam * foamIntensity);
    
    return color;
}
```

#### 3.2 Subsurface Scattering (Optional - Advanced)
```glsl
// For shallow water, add subsurface scattering
vec3 computeSubsurfaceScattering(vec3 pos, vec3 normal, vec3 viewDir, vec3 lightDir)
{
    float depth = max(0.0, pos.y);
    if (depth > shallowDepthRange) return vec3(0.0);
    
    // Simplified subsurface scattering
    vec3 backLight = -lightDir;
    float backScatter = max(dot(normal, backLight), 0.0);
    vec3 sss = shallowWaterColor * backScatter * (1.0 - depth / shallowDepthRange);
    
    return sss;
}
```

---

### Phase 4: Sparkles Integration

#### 4.1 Integrate Sparkles into BRDF
```glsl
// Add microfacets for sparkles
float getRoughnessWithSparkles(vec2 worldPos, float time, float baseRoughness)
{
    float sparkleMask = sparkleNoise(worldPos, time);
    // Reduce roughness where sparkles occur (smoother surface)
    return mix(baseRoughness, baseRoughness * 0.1, sparkleMask * 0.3);
}

// Use in specular calculation
float dynamicRoughness = getRoughnessWithSparkles(pos.xz, time, roughness);
vec3 specular = specularBRDF(normal, viewDir, lightDir, lightColor, dynamicRoughness);
```

---

### Phase 5: Energy Conservation & Tone Mapping

#### 5.1 Ensure Energy Conservation
```glsl
// Ensure output doesn't exceed physical limits
vec3 finalColor = ambient + diffuse + specular;

// Clamp to reasonable range (HDR handling)
finalColor = min(finalColor, vec3(10.0)); // Max 10x brightness

// Tone mapping (Reinhard or ACES)
finalColor = finalColor / (finalColor + vec3(1.0)); // Simple Reinhard

// Gamma correction (if needed)
finalColor = pow(finalColor, vec3(1.0/2.2));
```

---

## Implementation Steps

**Note**: The checkmarks (✅) below indicate **planned work items**, not completed tasks. These are the steps to follow during implementation.

### Step 1: Foundation (Low Risk)
1. ✅ Add material property constants (including PI constant)
2. ✅ Implement Schlick's Fresnel
3. ✅ Replace current Fresnel with new one
4. ✅ Test visual similarity

### Step 2: BRDF (Medium Risk)
1. ✅ Implement Cook-Torrance functions
2. ✅ Replace Blinn-Phong specular
3. ✅ Add energy-conserving diffuse
4. ✅ Test and tune roughness parameter

### Step 3: Lighting (Medium Risk)
1. ✅ Replace ambient with environment lighting
2. ✅ Implement proper light transport
3. ✅ Remove arbitrary multipliers
4. ✅ Test energy conservation

### Step 4: Water Features (Higher Risk)
1. ✅ Implement proper refraction/reflection split
2. ✅ Add absorption based on depth (verify coordinate system)
3. ✅ Integrate sparkles into BRDF
4. ✅ Test visual quality

### Step 5: Polish (Low Risk)
1. ✅ Add tone mapping
2. ✅ Fine-tune parameters
3. ✅ Performance optimization
4. ✅ Documentation

---

## Parameters to Tune

1. **Roughness**: `0.01 - 0.1` (water is very smooth)
2. **IOR**: `1.33` (water) - can vary slightly for different water types
3. **Absorption**: Adjust based on water clarity
4. **F0**: `0.02` for water (dielectric)
5. **Sun intensity**: May need adjustment after PBR conversion

---

## Expected Visual Changes

1. **More realistic reflections** - Proper Fresnel will make reflections stronger at grazing angles
2. **Better specular highlights** - Cook-Torrance will give more realistic highlights
3. **Energy-conserving colors** - No more over-bright areas
4. **Better depth perception** - Absorption will make deep water darker
5. **More consistent lighting** - Environment-based ambient will look more natural

---

## Performance Considerations

- Cook-Torrance BRDF is more expensive than Blinn-Phong
- Consider caching Fresnel calculations
- Sparkles integration may add cost
- Overall: ~10-20% performance impact expected

---

## Testing Strategy

1. **Visual Comparison**: Side-by-side with current version
2. **Parameter Sweeps**: Test different roughness/IOR values
3. **Edge Cases**: Grazing angles, deep water, shallow water
4. **Performance**: Monitor FPS impact
5. **Energy Conservation**: Verify colors stay in valid range

---

## References

- [Cook-Torrance BRDF](https://learnopengl.com/PBR/Theory)
- [Schlick's Fresnel Approximation](https://en.wikipedia.org/wiki/Schlick%27s_approximation)
- [Water IOR](https://en.wikipedia.org/wiki/Refractive_index)
- [Energy Conservation in PBR](https://learnopengl.com/PBR/Theory)
