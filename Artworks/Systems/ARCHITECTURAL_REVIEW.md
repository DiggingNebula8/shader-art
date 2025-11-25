# Architectural Review

## Overview

This document identifies architectural issues, inconsistencies, and potential improvements in the shader system architecture.

## Issues Found

### 1. Dependency Violations

#### Issue: DistanceFieldSystem mis-categorized
**Location:** `SYSTEM_ARCHITECTURE.md:34`, `WaterShading.frag:49`

**Problem:** 
- `WaterShading.frag` includes `DistanceFieldSystem.frag` and uses `DISTANCE_FIELD_RAYMARCH` macro
- According to `SYSTEM_ARCHITECTURE.md`, DistanceFieldSystem is listed as a "Pipeline System"
- But it's actually a utility system used by shading systems (WaterShading uses it for translucency)
- The categorization is incorrect - it should be a Core/Utility system, not Pipeline

**Impact:** 
- Documentation doesn't match reality
- Confusing for developers trying to understand dependencies
- Dependency rules are unclear

**Recommendation:**
- **FIXED:** Move DistanceFieldSystem to "Core Systems" category in SYSTEM_ARCHITECTURE.md
- Update dependency rules to clarify that utility systems (like DistanceFieldSystem) can be included by shading systems
- Document that DistanceFieldSystem provides macro-based utilities for raymarching

#### Issue: WaterShading includes TerrainSystem for type only
**Location:** `WaterShading.frag:52`

**Problem:**
- `WaterShading.frag` includes `TerrainSystem.frag` only for `TerrainParams` type definition
- This creates a dependency from WaterShading to TerrainSystem
- The comment says "only for TerrainParams type definition (not for function calls)"
- Functions are accessed via `WATER_TERRAIN_HEIGHT` macro instead

**Impact:**
- Creates coupling between WaterShading and TerrainSystem
- If TerrainParams changes, WaterShading must be recompiled even if it doesn't use terrain functions

**Recommendation:**
- Consider moving `TerrainParams` to a shared header (e.g., `Common.frag` or a new `Types.frag`)
- OR: Document this as an acceptable exception with clear rationale
- OR: Use forward declaration pattern if GLSL supports it

### 2. Surface Type Extension Mechanism

#### Issue: Fragile even/odd offset convention
**Location:** `RenderPipeline.frag:110-132`

**Problem:**
- Scene-specific surface types use even/odd offset convention:
  - Even offsets → terrain shading
  - Odd offsets → object shading
- This is implicit and not type-safe
- Easy to make mistakes when adding new surface types
- No compile-time checking

**Example:**
```glsl
const int SURFACE_UNDERWATER_TERRAIN = SURFACE_SCENE_EXTENSION_BASE + 0;  // Even = terrain ✓
const int SURFACE_UNDERWATER_OBJECT = SURFACE_SCENE_EXTENSION_BASE + 1;   // Odd = object ✓
const int SURFACE_LAVA = SURFACE_SCENE_EXTENSION_BASE + 2;                 // Even = terrain (wrong!)
```

**Impact:**
- Runtime errors if convention is violated
- No documentation at point of use
- Difficult to maintain

**Recommendation:**
- Add helper macros: `SURFACE_TERRAIN_TYPE(offset)` and `SURFACE_OBJECT_TYPE(offset)`
- OR: Use explicit mapping function instead of implicit convention
- OR: Document convention more prominently with examples

### 3. Macro Contract Documentation

#### Issue: Inconsistent macro contract documentation
**Location:** Multiple files

**Problem:**
- Some systems document macro contracts clearly (WaterShading, TerrainShading)
- Others don't document optional macros (ObjectShading, RenderPipeline)
- No central registry of all macro contracts

**Impact:**
- Developers may not know about optional macros
- Inconsistent usage patterns
- Hard to discover available customization points

**Recommendation:**
- Create `MACRO_CONTRACTS.md` documenting all macro contracts
- Standardize macro contract documentation format
- Add macro contract section to SYSTEM_ARCHITECTURE.md

### 4. Naming Inconsistencies

#### Issue: Camera system naming pattern
**Location:** `CameraSystem.frag`

**Problem:**
- Camera system uses `create<Variant>Camera()` pattern (e.g., `createSunnyDayCamera()`)
- This is correct, but inconsistent with material naming which uses `create<Variant><Type>Material()`
- Camera is a single type, so `createDefaultCamera()` is fine
- Variants like `createSunnyDayCamera()` could be `createSunnyDayCamera()` or `createCameraSunnyDay()`

**Current:** `createSunnyDayCamera()`, `createLowLightCamera()`
**Material pattern:** `createClearTropicalWater()`, `createSandyTerrainMaterial()`

**Impact:**
- Minor inconsistency, but could confuse developers
- Not a critical issue, but worth documenting

**Recommendation:**
- Document that Camera system uses simplified naming (no "Material" suffix)
- OR: Standardize to `create<Variant>Camera()` pattern (already correct)
- Consider: Camera is not a material, so different naming is acceptable

### 5. Architecture Documentation Issues

#### Issue: DistanceFieldSystem categorization unclear
**Location:** `SYSTEM_ARCHITECTURE.md:34`

**Problem:**
- DistanceFieldSystem is listed under "Pipeline Systems"
- But it's included by WaterShading (a shading system)
- The dependency rules say "Pipeline Systems can depend on all systems" but don't say other systems can depend on pipeline systems

**Impact:**
- Unclear if DistanceFieldSystem is a utility or pipeline component
- Dependency rules are ambiguous

**Recommendation:**
- Clarify DistanceFieldSystem's role:
  - If it's a utility: Move to "Core Systems" or create "Utility Systems" category
  - If it's pipeline-only: Remove from WaterShading or document exception
- Update SYSTEM_ARCHITECTURE.md with clear categorization

### 6. Missing Abstractions

#### Issue: No shared type definitions
**Location:** Multiple systems

**Problem:**
- `TerrainParams` is defined in TerrainSystem but used by WaterShading
- No shared types header for common structs
- Each system defines its own types

**Impact:**
- Type dependencies create coupling
- Changes to types require recompiling dependent systems

**Recommendation:**
- Consider creating `Types.frag` for shared type definitions
- OR: Document that type dependencies are acceptable for closely related systems
- Keep current approach but document rationale

### 7. RenderPipeline Complexity

#### Issue: Complex surface type mapping logic
**Location:** `RenderPipeline.frag:107-132`

**Problem:**
- `composeFinalColor()` has complex logic for mapping surface types to shading systems
- Uses multiple conditionals and offset calculations
- Hard to extend without understanding the convention

**Impact:**
- Difficult to maintain
- Easy to introduce bugs
- Not immediately clear how to add new surface types

**Recommendation:**
- Extract surface type mapping to helper functions:
  ```glsl
  bool shouldUseTerrainShading(int surfaceType);
  bool shouldUseObjectShading(int surfaceType);
  ```
- Add clear documentation with examples
- Consider using a switch statement if GLSL supports it

### 8. Documentation Gaps

#### Issue: Missing extension examples
**Location:** `SYSTEM_ARCHITECTURE.md`

**Problem:**
- Examples show adding Snow, Lava, Foliage
- But don't show how to integrate with RenderPipeline
- No example of adding a new surface type to the pipeline

**Impact:**
- Developers may not know how to add new surface types
- May create incompatible extensions

**Recommendation:**
- Add example showing:
  - Defining new surface type constant
  - Adding to RenderPipeline mapping (if needed)
  - Creating scene-specific rendering logic

## Recommendations Summary

### High Priority

1. **Clarify DistanceFieldSystem role** - Move to Core Systems or document exception
2. **Improve surface type extension mechanism** - Add helper macros or explicit mapping
3. **Create MACRO_CONTRACTS.md** - Central documentation for all macro contracts

### Medium Priority

4. **Extract surface type mapping helpers** - Simplify RenderPipeline logic
5. **Add extension examples** - Show how to add new surface types to pipeline
6. **Document type dependencies** - Clarify when type-only dependencies are acceptable

### Low Priority

7. **Standardize naming** - Document Camera naming pattern as acceptable exception
8. **Consider shared types header** - Evaluate if Types.frag would help

## Positive Aspects

The architecture is generally well-designed:

✅ **Clear separation of concerns** - Systems are well-modularized
✅ **Consistent naming patterns** - Factory functions follow conventions
✅ **Good documentation** - Most systems are well-documented
✅ **Extensible design** - Extension points are clear
✅ **No circular dependencies** - Dependency graph is acyclic
✅ **Macro-based interfaces** - Flexible customization points

## Conclusion

The architecture is solid with minor issues that should be addressed for maintainability and clarity. The main concerns are:

1. ✅ **FIXED:** Dependency categorization (DistanceFieldSystem) - Moved to Core Systems
2. Surface type extension mechanism (fragile convention) - Needs improvement
3. Documentation gaps (macro contracts, extension examples) - Needs documentation

Most issues are documentation/clarity problems rather than fundamental architectural flaws.

## Quick Reference: Issues by Priority

### ✅ Fixed
- **DistanceFieldSystem categorization** - Moved to Core Systems in SYSTEM_ARCHITECTURE.md

### ✅ Fixed (High Priority)
1. ✅ **Surface type extension mechanism** - Added helper macros `SURFACE_TERRAIN_TYPE()` and `SURFACE_OBJECT_TYPE()`
2. ✅ **Macro contracts documentation** - Created MACRO_CONTRACTS.md with complete reference

### 🟡 Medium Priority (Should Consider)
3. **RenderPipeline complexity** - Extract helper functions
4. **Extension examples** - Add to SYSTEM_ARCHITECTURE.md
5. **Type dependency documentation** - Clarify when acceptable

### 🟢 Low Priority (Nice to Have)
6. **Camera naming** - Document as acceptable exception
7. **Shared types header** - Evaluate if needed

## Action Items

1. ✅ Update SYSTEM_ARCHITECTURE.md to fix DistanceFieldSystem categorization
2. ✅ Create MACRO_CONTRACTS.md documenting all macro contracts
3. ✅ Add helper macros for surface type extension (`SURFACE_TERRAIN_TYPE()`, `SURFACE_OBJECT_TYPE()`)
4. ✅ Update Ocean scene to use new helper macros
5. ⏳ Add extension examples to SYSTEM_ARCHITECTURE.md (medium priority)
6. ⏳ Extract surface type mapping helpers in RenderPipeline.frag (medium priority)

