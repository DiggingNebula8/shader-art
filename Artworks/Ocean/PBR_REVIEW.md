# Ocean.frag - Physically Based Rendering (PBR) Correctness Review

## Executive Summary

**Overall Assessment**: ✅ **Physically Correct with Minor Improvements Possible**

The shader implements a solid PBR foundation with Cook-Torrance BRDF, energy-conserving diffuse, proper Fresnel calculation, and tone mapping. The main areas for improvement are using IOR for F0 calculation (minor accuracy gain) and potential optimization of reflection handling (acceptable trade-off for real-time rendering).

---

## Critical Issues

### 1. ✅ **Fresnel Angle Calculation** (Line 149-152)

**Status**: ✅ **CORRECT** (after careful analysis)

```glsl
vec3 getFresnel(vec3 viewDir, vec3 normal)
{
    float cosTheta = max(dot(viewDir, normal), 0.0);
    return fresnelSchlick(cosTheta, F0_dielectric);
}
```

**Analysis**:
- `viewDir` is defined as "surface → camera" (outgoing direction)
- For reflection, the angle of incidence equals the angle of reflection
- Both incident and outgoing rays have the same angle from the normal
- Therefore: `cos(θ_incident) = |cos(θ_outgoing)|` for reflection
- Since we clamp with `max(..., 0.0)`, we get the correct magnitude
- The sign doesn't matter because Fresnel depends on the angle magnitude, not direction

**Verification**:
- When camera is perpendicular (above surface): `dot(viewDir, normal) ≈ 1` → `cos(θ) ≈ 1` → `F ≈ F0` (low reflection) ✓
- When camera is at grazing angle: `dot(viewDir, normal) ≈ 0` → `cos(θ) ≈ 0` → `F ≈ 1` (high reflection) ✓

**Conclusion**: The implementation is correct. The outgoing direction can be used because reflection is symmetric about the normal.

---

### 2. ⚠️ **MINOR: Missing IOR-Based Fresnel Accuracy**

**Problem**: Schlick's approximation uses a fixed F0 value instead of computing it from IOR.

**Current Implementation**:
```glsl
const vec3 F0_dielectric = vec3(0.02);  // Fixed value
```

**Issue**:
- `waterIOR` and `airIOR` are defined but never used
- Schlick's approximation can be more accurate when F0 is computed from IOR
- For dielectrics: `F0 = ((n1 - n2) / (n1 + n2))²`
- For water-air interface: `F0 = ((1.33 - 1.0) / (1.33 + 1.0))² ≈ 0.0201` ✓ (close, but should be computed)

**Impact**: Minor accuracy loss, but the values are defined and should be used for consistency

**Fix**:
```glsl
// Compute F0 from IOR for accuracy
const vec3 F0_dielectric = vec3(pow((waterIOR - airIOR) / (waterIOR + airIOR), 2.0));
// Result: ~0.0201, which matches current value but is computed correctly
```

---

### 3. ⚠️ **MODERATE: Potential Double-Counting of Reflection**

**Problem**: Reflection may be counted twice in the lighting equation.

**Current Implementation** (Line 324):
```glsl
vec3 color = baseColor * 0.2 + ambient + diffuse + specular;
```

Where:
- `baseColor = mix(refracted, reflected, f)` contains sky reflection
- `specular` contains sun reflection via Cook-Torrance BRDF

**Analysis**:
- **Sun reflection**: Handled correctly by Cook-Torrance specular BRDF (physically correct)
- **Sky reflection**: Mixed into `baseColor` using Fresnel factor `f`
- The `0.2` multiplier on `baseColor` is a heuristic to avoid over-brightening
- However, this is not physically accurate - sky reflection should also use Cook-Torrance BRDF

**Issue**: 
- Sky reflection is approximated with simple Fresnel mixing
- Sun reflection uses full Cook-Torrance BRDF
- Both contribute to final color, but sky reflection doesn't account for roughness/BRDF

**Impact**: 
- Not a critical error, but not fully PBR-accurate
- The heuristic `0.2` multiplier compensates but is arbitrary
- Real-time rendering trade-off (acceptable, but worth noting)

**Better Approach** (if performance allows):
- Use environment map sampling with Cook-Torrance BRDF for sky reflection
- Or use split-sum approximation for IBL (Image-Based Lighting)

**Status**: Acceptable for real-time rendering, but documented as a limitation

---

## Moderate Issues

### 4. ⚠️ **Ambient Lighting Energy Conservation**

**Problem**: Ambient lighting doesn't account for Fresnel.

**Current Implementation** (Line 313):
```glsl
vec3 ambient = getEnvironmentLight(normal) * albedo;
```

**Issue**:
- Ambient should also respect Fresnel - more reflection at grazing angles
- Currently, ambient is purely diffuse (multiplied by albedo)
- Should account for specular ambient contribution

**Impact**: Minor - ambient is typically small, but for full PBR accuracy, should use Fresnel-weighted ambient

**Better Approach**:
```glsl
vec3 ambientDiffuse = getEnvironmentLight(normal) * albedo * kD;
vec3 ambientSpecular = getEnvironmentLight(reflect(-viewDir, normal)) * F;
vec3 ambient = ambientDiffuse + ambientSpecular;
```

---

### 5. ⚠️ **Water Absorption Coefficients**

**Current Values** (Line 36):
```glsl
const vec3 waterAbsorption = vec3(0.45, 0.03, 0.015);
```

**Status**: ✅ **CORRECT** (fixed from previous review)

- Red (0.45) absorbs most - correct
- Green (0.03) absorbs medium - correct  
- Blue (0.015) absorbs least - correct
- Deep water will appear blue, shallow water will appear more green/blue - correct

**Note**: Previous review (REVIEW_V2.md) identified this as inverted, but it has been corrected.

---

## Minor Issues / Observations

### 6. Unused IOR Variables

**Problem**: `waterIOR` and `airIOR` are defined but only used for documentation.

**Status**: Not a bug, but should be used for F0 calculation (see Issue #2)

---

### 7. Sparkle Enhancement Double-Counting

**Current Implementation** (Line 329-330):
```glsl
float sparkleHighlight = computeSparkles(normal, viewDir, pos.xz, time);
color += sparkleHighlight * vec3(0.3, 0.25, 0.2);
```

**Issue**: 
- Sparkles are already integrated into BRDF via dynamic roughness (line 298)
- Additional sparkle highlight is added on top
- This is intentional (documented as "subtle enhancement"), but adds energy

**Impact**: Minor - adds visual appeal but breaks strict energy conservation

**Status**: Acceptable artistic choice, but worth noting

---

### 8. Foam Energy Conservation

**Problem**: Foam adds energy without accounting for it in the BRDF.

**Current Implementation** (Line 333):
```glsl
color = mix(color, vec3(1.0), foam * foamIntensity);
```

**Issue**: 
- Foam is non-physical (artistic effect)
- Adds white color without energy conservation
- This is acceptable for visual quality, but not physically accurate

**Status**: Acceptable - foam is an artistic effect, not a physical property

---

## Correct Implementations ✅

### 1. Cook-Torrance BRDF Implementation

**Status**: ✅ **CORRECT**

- **D_GGX**: Correctly implemented (lines 165-172)
- **G_SchlickGGX**: Correctly implemented (lines 175-180)
- **G_Smith**: Correctly implemented (lines 182-185)
- **specularBRDF**: Correctly implemented (lines 188-207)
  - Half vector: `normalize(viewDir + lightDir)` ✓
  - Fresnel uses `VdotH` ✓ (correct for Cook-Torrance)
  - Denominator: `4.0 * NdotV * NdotL` ✓
  - Early exit for back-facing surfaces ✓

### 2. Energy-Conserving Diffuse

**Status**: ✅ **CORRECT**

```glsl
vec3 kS = F; // Specular contribution from Fresnel
vec3 kD = (1.0 - kS) * (1.0 - metallic); // Diffuse contribution
vec3 diffuse = kD * albedo * lightColor * NdotL / PI;
```

- Correctly uses Fresnel to split specular/diffuse
- Accounts for metallic factor (0.0 for water)
- Includes `/PI` normalization for Lambertian BRDF ✓

### 3. Tone Mapping and Gamma Correction

**Status**: ✅ **CORRECT**

- Reinhard tone mapping: `color / (color + vec3(1.0))` ✓
- Gamma correction: `pow(color, vec3(1.0/2.2))` ✓
- Applied in correct order (tone mapping → gamma) ✓

### 4. Water Absorption Application

**Status**: ✅ **CORRECT**

```glsl
vec3 absorption = exp(-waterAbsorption * depth);
color *= absorption;
```

- Correct Beer-Lambert law implementation ✓
- Applied after lighting computation ✓
- Depth calculation is correct ✓

---

## Recommendations

### Priority 1: Optional Enhancements

1. **Use IOR for F0 calculation** (Issue #2)
   - Compute F0 from `waterIOR` and `airIOR` for maintainability
   - Current value is correct, but computing from IOR makes the code more maintainable
   - Formula: `F0 = pow((waterIOR - airIOR) / (waterIOR + airIOR), 2.0)`

### Priority 2: Improvements

3. **Improve ambient lighting** (Issue #4)
   - Add Fresnel-weighted ambient for better accuracy
   - Split into diffuse and specular ambient components

4. **Document reflection mixing** (Issue #3)
   - Add comments explaining the `0.2` multiplier heuristic
   - Consider implementing proper IBL if performance allows

### Priority 3: Optional Enhancements

5. **Remove or document sparkle enhancement** (Issue #7)
   - Either remove the extra sparkle highlight or document it as artistic license
   - Consider making it a parameter

---

## Mathematical Verification

### Fresnel Calculation (After Fix)

**Correct Formula**:
```
F(θ) = F0 + (1 - F0) * (1 - cos(θ))⁵
where cos(θ) = dot(incident, normal)
```

**Current (Incorrect)**:
```glsl
cosTheta = dot(viewDir, normal)  // Wrong: viewDir is outgoing
```

**Should Be**:
```glsl
cosTheta = dot(-viewDir, normal)  // Correct: incident = -outgoing
```

### Cook-Torrance BRDF

**Formula**: ✅ Correct
```
f_spec = (D * G * F) / (4 * (N·V) * (N·L))
```

**Implementation**: ✅ Matches formula exactly

### Energy Conservation

**Formula**: ✅ Correct
```
kS = F(θ)
kD = (1 - kS) * (1 - metallic)
```

**Implementation**: ✅ Matches formula exactly

---

## Summary

**Critical Issues**: 0 ✅

**Minor Issues**: 1
- Missing IOR-based F0 calculation (current value is correct, but should be computed from IOR for maintainability)

**Moderate Issues**: 2
- Potential double-counting of reflection (acceptable trade-off for real-time rendering)
- Ambient lighting energy conservation (minor improvement possible)

**Correct Implementations**: 5
- Fresnel calculation ✅ (correctly uses outgoing direction for reflection)
- Cook-Torrance BRDF ✅
- Energy-conserving diffuse ✅
- Tone mapping/gamma ✅
- Water absorption ✅

**Overall**: The shader is **physically correct** with solid PBR foundations. All critical physics are implemented correctly. The identified issues are minor improvements or acceptable trade-offs for real-time rendering.

**Recommendation**: 
1. **Optional**: Compute F0 from IOR for better maintainability (Issue #2)
2. **Optional**: Improve ambient lighting with Fresnel weighting (Issue #4)
3. **Document**: The reflection mixing heuristic (Issue #3) is acceptable for real-time rendering

The shader is production-ready as-is, with the suggested improvements being optional enhancements.
